import { useState, useEffect, useRef } from 'react'
import WebApp from '@twa-dev/sdk'
import './App.css'
import { userService } from './services/userService';
import type { UserProfile } from './services/userService';
import { gameService } from './services/gameService';
import type { GameSession } from './services/gameService';
import { supabase } from './lib/supabase';
import { ShopView } from './components/ShopView';

// --- Types ---
type AppMode = 'MENU' | 'LOBBY' | 'RACING' | 'FINISHED' | 'SHOP';

interface GameState {
  myClicks: number;
  opponentClicks: number;
  myTime: number | null;
  opponentTime: number | null;
}

// --- Constants ---
const WIN_SCORE = 50;
const VERSION = "v0.3.0 (Realtime DB)";

// Debug Logger Helper
const useLogger = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const log = (msg: string) => {
    console.log(msg);
    setLogs(prev => [msg, ...prev].slice(0, 10)); // Keep last 10 logs
  };
  return { logs, log };
};

function App() {
  const { logs, log } = useLogger();

  // UI State
  const [mode, setMode] = useState<AppMode>('MENU');
  const [status, setStatus] = useState("Инициализация...");

  // User Data
  const [dbUser, setDbUser] = useState<UserProfile | null>(null);

  // Game Session State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<GameSession | null>(null);
  const [opponentName] = useState<string | null>(null);

  // Local Game State (for smooth UI)
  const [game, setGame] = useState<GameState>({
    myClicks: 0,
    opponentClicks: 0,
    myTime: null,
    opponentTime: null
  });

  const startTimeRef = useRef<number>(0);
  const [timer, setTimer] = useState("0.00");
  const subscriptionRef = useRef<any>(null);

  // 1. Initialize & Auth
  useEffect(() => {
    WebApp.expand();
    // @ts-ignore
    const user = WebApp.initDataUnsafe.user;

    if (user) {
      userService.getOrCreateUser(user).then(userData => {
        if (userData) {
          setDbUser(userData);
          log(`Logged in as ${userData.full_name}`);
          setStatus("Готов");

          // Check if opened via link
          // @ts-ignore
          const startParam = WebApp.initDataUnsafe.start_param;
          if (startParam && startParam.startsWith('join_')) {
            const hostSessionId = startParam.replace('join_', '');
            log(`Joining session: ${hostSessionId}`);
            joinSession(hostSessionId, userData.id);
          }
        } else {
          setStatus("Ошибка входа (DB)");
        }
      });
    } else {
      setStatus("Ошибка: Запустите из Telegram");
      // DEV MODE (Mock User - Uncomment for local dev)
      // setDbUser({ id: 123, username: 'dev', full_name: 'Dev Player', puka_coins: 999, is_premium: false });
    }

    return () => {
      if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
    };
  }, []);

  // 2. Realtime Subscription
  useEffect(() => {
    if (!sessionId) return;

    log(`Subscribing to session ${sessionId}...`);

    const channel = supabase
      .channel(`game_${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const newSession = payload.new as GameSession;
          handleSessionUpdate(newSession);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          log("Realtime Connected 🟢");
        }
      });

    subscriptionRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Handle Updates from DB
  const handleSessionUpdate = (newSession: GameSession) => {
    setSessionData(newSession);

    if (!dbUser) return;
    const amIHost = newSession.host_id === dbUser.id;

    // Update Scores
    setGame(prev => ({
      ...prev,
      myClicks: amIHost ? newSession.host_score : newSession.guest_score,
      opponentClicks: amIHost ? newSession.guest_score : newSession.host_score
    }));

    // State Transitions
    if (newSession.status === 'RACING' && mode !== 'RACING') {
      log("RACING STARTED!");
      setMode('RACING');
      startTimeRef.current = new Date(newSession.start_time!).getTime();
      WebApp.HapticFeedback.notificationOccurred('success');
    }

    if (newSession.status === 'FINISHED' && mode !== 'FINISHED') {
      log("GAME FINISHED!");
      // Determine winner logic if needed, or just show end screen
      const now = Date.now();
      // Use server time ideally, but local diff works for MVP display
      const startTime = new Date(newSession.start_time!).getTime();

      // Mock finish times based on who won (DB winner_id)
      // In real app, we would store finish_times in DB for each player
      if (newSession.winner_id === dbUser.id) {
        setGame(prev => ({ ...prev, myTime: now - startTime, opponentTime: null }));
      } else {
        setGame(prev => ({ ...prev, myTime: null, opponentTime: now - startTime }));
      }
    }

    // Update Lobby Status
    if (newSession.status === 'LOBBY' && newSession.guest_id && !opponentName) {
      // We could fetch opponent name here
    }
  };

  // --- Actions ---

  const createGame = async () => {
    if (!dbUser) return;
    setStatus("Создание игры...");
    const id = await gameService.createGame(dbUser.id);

    if (id) {
      setSessionId(id);
      setMode('LOBBY');
      setSessionData({
        id,
        host_id: dbUser.id,
        guest_id: null,
        status: 'LOBBY',
        host_score: 0,
        guest_score: 0,
        start_time: null,
        winner_id: null
      });

      // Generate Link
      // @ts-ignore
      const botName = 'pukaboy_bot';
      const appName = 'game';
      const link = `https://t.me/${botName}/${appName}?startapp=join_${id}`;
      WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("🏁 DUEL ME!")}`);
    } else {
      setStatus("Ошибка создания");
    }
  };

  const joinSession = async (sessId: string, myId: number) => {
    setStatus("Вход в игру...");
    const success = await gameService.joinGame(sessId, myId);
    if (success) {
      setSessionId(sessId);
      setMode('LOBBY');
      // Fetch initial state
      const initial = await gameService.getGame(sessId);
      if (initial) {
        setSessionData(initial);
      }
    } else {
      setStatus("Не удалось войти (игра полная?)");
    }
  };

  const doStart = async () => {
    if (!sessionId) return;
    await gameService.startGame(sessionId);
  };

  const handleTap = async () => {
    if (mode !== 'RACING' || !sessionId || !dbUser) return;

    // Optimistic UI update
    setGame(prev => ({ ...prev, myClicks: prev.myClicks + 1 }));

    WebApp.HapticFeedback.impactOccurred('light');

    // Send to DB
    await gameService.click(sessionId, dbUser.id);

    // Local Check for finish (Server will authorize efficiently later)
    if (game.myClicks + 1 >= WIN_SCORE) {
      log("Winner!");
      await gameService.finishGame(sessionId, dbUser.id);
    }
  };

  const handleBuy = async (item: any) => {
    log(`Buying ${item.name}...`);
    if (!dbUser) return;
    // MOCK PURCHASE
    const newBal = await userService.updateBalance(dbUser.id, item.coins);
    if (newBal !== null) {
      setDbUser({ ...dbUser, puka_coins: newBal });
      WebApp.HapticFeedback.notificationOccurred('success');
      setMode('MENU');
    }
  };

  // Timer Effect
  useEffect(() => {
    let animId: number;
    const loop = () => {
      if (mode === 'RACING') {
        const now = Date.now();
        const start = startTimeRef.current || now;
        setTimer(((now - start) / 1000).toFixed(2));
        animId = requestAnimationFrame(loop);
      }
    };
    if (mode === 'RACING') {
      animId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animId);
  }, [mode]);


  // --- Render ---

  // Helper to get formatted progress
  const getProgress = (c: number) => Math.min((c / WIN_SCORE) * 100, 100);

  const amIHost = sessionData?.host_id === dbUser?.id;

  return (
    <>
      {/* Debug Overlay */}
      <div className="fixed bottom-0 left-0 w-full h-20 bg-black/80 text-[10px] text-green-400 font-mono p-2 pointer-events-none overflow-hidden z-50 opacity-50">
        {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {(function () {
        if (mode === 'SHOP') {
          return <ShopView onBack={() => setMode('MENU')} onBuy={handleBuy} />;
        }

        if (mode === 'MENU') {
          return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 relative overflow-hidden">
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-gray-800/80 rounded-full px-4 py-2 border border-yellow-500/30">
                <span className="text-xl">🍌</span>
                <span className="font-mono font-bold text-yellow-400">{dbUser?.puka_coins ?? '...'}</span>
              </div>

              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-500 mb-2 transform -skew-x-6 z-10">
                PUKABOY
              </h1>
              <div className="text-xs tracking-[0.5em] text-blue-500 mb-1 z-10">REALTIME PVP</div>
              <div className="text-[10px] text-gray-600 font-mono mb-8 z-10 opacity-50">{VERSION}</div>

              <div className="w-full max-w-xs space-y-4 z-10">
                <button
                  onClick={createGame}
                  disabled={!dbUser}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>⚔️</span> {status.startsWith('Создание') ? '...' : 'СОЗДАТЬ ДУЭЛЬ'}
                </button>

                <button
                  onClick={() => setMode('SHOP')}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-yellow-400 font-bold py-3 rounded-xl border border-yellow-500/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>🛒</span> МАГАЗИН
                </button>

                <div className="text-center text-xs text-gray-500 h-4">{status}</div>
              </div>
            </div>
          );
        }

        if (mode === 'LOBBY') {
          return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
              <h2 className="text-xl font-bold mb-8 text-gray-400 tracking-widest">ОЖИДАНИЕ СОПЕРНИКА</h2>

              <div className="flex gap-4 items-center mb-12 w-full justify-center">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-3xl mb-2 shadow-[0_0_15px_rgba(37,99,235,0.6)] border-4 border-gray-800">😎</div>
                  <div className="font-bold text-sm bg-gray-800 px-3 py-1 rounded-full">YOU</div>
                </div>
                <div className="text-2xl font-black text-gray-600 italic">VS</div>
                <div className="flex flex-col items-center">
                  <div className={`w-20 h-20 ${sessionData?.guest_id ? 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)]' : 'bg-gray-800 border-dashed border-2 border-gray-600'} rounded-full flex items-center justify-center text-3xl mb-2 border-4 border-gray-900 transition-all`}>
                    {sessionData?.guest_id ? '😈' : '...'}
                  </div>
                  <div className="font-bold text-sm bg-gray-800 px-3 py-1 rounded-full">{sessionData?.guest_id ? 'Opponent' : 'Ждем...'}</div>
                </div>
              </div>

              {sessionData?.guest_id && amIHost && (
                <button
                  onClick={doStart}
                  className="w-full max-w-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-xl py-5 rounded-2xl shadow-[0_5px_0_rgb(21,128,61)] active:shadow-none active:translate-y-[5px] transition-all animate-pulse"
                >
                  ПОГНАЛИ! 🚀
                </button>
              )}

              {sessionData?.guest_id && !amIHost && (
                <div className="text-green-400 animate-pulse bg-green-900/20 px-4 py-2 rounded-lg">Организатор запускает гонку...</div>
              )}

              {!sessionData?.guest_id && (
                <div className="text-center text-gray-500 text-xs">Пригласи друга через кнопку "Share" в меню...</div>
              )}

              <button
                onClick={() => { setMode('MENU'); setSessionId(null); }}
                className="mt-8 text-gray-500 underline text-xs"
              >
                Отмена
              </button>
            </div>
          );
        }

        return (
          <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden touch-manipulation select-none">
            {/* ... REUSE EXISTING GAME RENDER, BUT WITH NEW STATE ... */}
            <div className={`h-20 flex flex-col items-center justify-center border-b border-gray-700 z-10 transition-colors ${game.myTime ? 'bg-gray-800' : 'bg-gray-800/80 backdrop-blur-sm'}`}>
              <span className={`font-mono text-4xl font-bold tracking-tighter ${game.myTime ? 'text-gray-500' : 'text-yellow-400'}`}>
                {game.myTime ? ((game.myTime / 1000).toFixed(2)) : timer}
              </span>
            </div>

            <div className="flex-1 flex relative">
              <div className="flex-1 border-r border-gray-800 relative bg-blue-900/5">
                <div className="absolute inset-x-0 bottom-0 bg-blue-600/30 transition-all duration-75 ease-out" style={{ height: `${getProgress(game.myClicks)}%` }}></div>
                <div className="absolute left-1/2 transform -translate-x-1/2 text-5xl transition-all duration-75 ease-out pb-4" style={{ bottom: `${getProgress(game.myClicks)}%` }}>🚀</div>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 font-bold text-blue-500 text-xs tracking-wider bg-blue-900/20 px-2 rounded">YOU</div>
              </div>

              <div className="flex-1 relative bg-red-900/5">
                <div className="absolute inset-x-0 bottom-0 bg-red-600/30 transition-all duration-75 ease-linear" style={{ height: `${getProgress(game.opponentClicks)}%` }}></div>
                <div className="absolute left-1/2 transform -translate-x-1/2 text-5xl transition-all duration-75 ease-linear pb-4" style={{ bottom: `${getProgress(game.opponentClicks)}%` }}>😈</div>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 font-bold text-red-500 text-xs tracking-wider bg-red-900/20 px-2 rounded">OPP</div>
              </div>

              {game.myTime && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center animate-in fade-in duration-300">
                  <div className="text-8xl mb-4 animate-bounce">
                    {sessionData?.winner_id === dbUser?.id ? '🏆' : '🐢'}
                  </div>
                  <h2 className={`text-4xl font-black italic mb-8 ${sessionData?.winner_id === dbUser?.id ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {sessionData?.winner_id === dbUser?.id ? 'ТЫ ПОБЕДИЛ!' : 'ПРОИГРАЛ'}
                  </h2>
                  <button onClick={() => { setMode('MENU'); setSessionId(null); setGame({ myClicks: 0, opponentClicks: 0, myTime: null, opponentTime: null }); }} className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-gray-200 transition-colors">В МЕНЮ</button>
                </div>
              )}
            </div>

            <div className="h-[35vh] bg-gray-800 p-8 flex justify-center items-center rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20 relative">
              <div className="absolute top-3 w-16 h-1 bg-gray-600/30 rounded-full"></div>
              <button
                onPointerDown={handleTap}
                disabled={!!game.myTime}
                className={`w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all duration-75 border-4
                    ${game.myTime ? 'bg-gray-700 border-gray-600 opacity-50 grayscale' : 'bg-gradient-to-b from-blue-500 to-blue-700 border-blue-400/30 shadow-[0_10px_0_rgb(30,58,138)] active:shadow-none active:translate-y-[10px] active:scale-95'}
                 `}
              >
                <span className="text-4xl font-black text-white drop-shadow-md select-none">TAP!</span>
                <span className="text-xs font-mono text-blue-200 mt-1">{game.myClicks}/{WIN_SCORE}</span>
              </button>
            </div>
          </div>
        );
      })()}
    </>
  );
}

export default App
