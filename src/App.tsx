import { useState, useEffect, useRef } from 'react'
import WebApp from '@twa-dev/sdk'
import Peer, { DataConnection } from 'peerjs'
import './App.css'

// --- Types ---
type AppMode = 'MENU' | 'LOBBY' | 'RACING' | 'FINISHED';

interface GameState {
  myClicks: number;
  opponentClicks: number;
  myTime: number | null;
  opponentTime: number | null;
}

interface PeerMessage {
  type: 'HELLO' | 'START_GAME' | 'UPDATE_CLICKS' | 'FINISH';
  payload?: any;
}

// --- Constants ---
const WIN_SCORE = 50;

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
  const [myProfile, setMyProfile] = useState<{ name: string } | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<{ name: string } | null>(null);

  // P2P State
  const [peerId, setPeerId] = useState<string | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const isHost = useRef<boolean>(false);

  // Game State
  const [game, setGame] = useState<GameState>({
    myClicks: 0,
    opponentClicks: 0,
    myTime: null,
    opponentTime: null
  });

  const startTimeRef = useRef<number>(0);
  const [timer, setTimer] = useState("0.00");

  // --- REFS FOR EVENT HANDLERS (Fix Stale Closure) ---
  // We store the latest version of these functions in refs so the PeerJS callbacks always call the fresh one
  const handleMessageRef = useRef<(msg: PeerMessage) => void>(() => { });

  useEffect(() => {
    // 1. Setup Telegram & User
    WebApp.expand();
    // @ts-ignore
    const user = WebApp.initDataUnsafe.user;
    const me = { name: user?.first_name || `Player-${Math.floor(Math.random() * 1000)}` };
    setMyProfile(me);
    log(`User: ${me.name}`);

    // 2. Initialize PeerJS
    const peer = new Peer({
      debug: 2,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      log(`My PeerID: ${id}`);
      setPeerId(id);
      setStatus("Готов");

      // Check for join params
      // @ts-ignore
      const startParam = WebApp.initDataUnsafe.start_param;
      if (startParam && startParam.startsWith('join_')) {
        const hostId = startParam.replace('join_', '');
        log(`Joining host: ${hostId}`);
        joinGame(hostId);
      }
    });

    peer.on('connection', (conn) => {
      log('Incoming connection...');
      handleConnection(conn);
    });

    peer.on('error', (err) => {
      log(`Peer Error: ${err.type}`);
      setStatus(`Err: ${err.type}`);
    });

    return () => peer.destroy();
  }, []);

  // Update the ref logic every render
  useEffect(() => {
    handleMessageRef.current = (msg: PeerMessage) => {
      // Actual Message Logic with Fresh State
      switch (msg.type) {
        case 'HELLO':
          log(`Opponent Hello: ${msg.payload.name}`);
          setOpponentProfile({ name: msg.payload.name });
          setMode('LOBBY'); // Always go to lobby on hello
          break;

        case 'START_GAME':
          log('Received START_GAME');
          startGame();
          break;

        case 'UPDATE_CLICKS':
          setGame(prev => ({ ...prev, opponentClicks: msg.payload.clicks }));
          break;

        case 'FINISH':
          log(`Opponent Finished: ${msg.payload.time}`);
          setGame(prev => ({ ...prev, opponentTime: msg.payload.time }));
          break;
      }
    };
  });

  const handleConnection = (conn: DataConnection) => {
    connRef.current = conn;

    conn.on('open', () => {
      log("Connection Established!");
      // Send HELLO to introduce ourselves
      sendMessage({ type: 'HELLO', payload: { name: myProfile?.name } });
    });

    conn.on('data', (data: any) => {
      // Use the Ref to call the fresh handler
      handleMessageRef.current(data as PeerMessage);
    });

    conn.on('close', () => {
      log("Connection Closed");
      setStatus("Соперник вышел");
      setMode('MENU');
      setOpponentProfile(null);
    });

    conn.on('error', (err) => {
      log(`Conn Err: ${err}`);
    });
  };

  const joinGame = (hostId: string) => {
    setStatus(`Connecting to ${hostId}...`);
    isHost.current = false;

    if (!peerRef.current) return;
    const conn = peerRef.current.connect(hostId, {
      reliable: true
    });
    handleConnection(conn);
  };

  const sendMessage = (msg: PeerMessage) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(msg);
    } else {
      log("Send failed: Connection not open");
    }
  };

  // --- Actions ---

  const createGame = () => {
    isHost.current = true;
    setMode('LOBBY');

    if (!peerId) return;
    // @ts-ignore
    const botName = 'pukaboy_bot';
    const appName = 'game'; // Must match the short name in BotFather
    const link = `https://t.me/${botName}/${appName}?startapp=join_${peerId}`;

    log(`Generated Link: ${link}`);
    WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("🏁 DUEL ME!")}`);
  };

  const doStart = () => {
    log("Host Clicked Start");
    sendMessage({ type: 'START_GAME' });
    startGame();
  };

  const startGame = () => {
    log("Starting Game Loop...");
    setGame({
      myClicks: 0,
      opponentClicks: 0,
      myTime: null,
      opponentTime: null
    });
    setMode('RACING');
    startTimeRef.current = Date.now();
  };

  // Timer Effect
  useEffect(() => {
    let animId: number;
    const loop = () => {
      if (mode === 'RACING') {
        const now = Date.now();
        setTimer(((now - startTimeRef.current) / 1000).toFixed(2));
        animId = requestAnimationFrame(loop);
      }
    };
    if (mode === 'RACING') {
      animId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animId);
  }, [mode]);


  // --- Gameplay ---

  const handleTap = () => {
    if (mode !== 'RACING') return;
    if (game.myTime) return;

    // Add vibration for better feel
    WebApp.HapticFeedback.impactOccurred('light');

    const newClicks = game.myClicks + 1;
    setGame(prev => ({ ...prev, myClicks: newClicks }));
    sendMessage({ type: 'UPDATE_CLICKS', payload: { clicks: newClicks } });

    if (newClicks >= WIN_SCORE) {
      const finishTime = Date.now() - startTimeRef.current;
      log(`Finished in ${finishTime}ms`);
      setGame(prev => ({ ...prev, myTime: finishTime }));
      sendMessage({ type: 'FINISH', payload: { time: finishTime } });
      WebApp.HapticFeedback.notificationOccurred('success');
    }
  };


  // --- Render ---

  const getProgress = (c: number) => Math.min((c / WIN_SCORE) * 100, 100);

  return (
    <>
      {/* Debug Overlay */}
      <div className="fixed bottom-0 left-0 w-full h-20 bg-black/80 text-[10px] text-green-400 font-mono p-2 pointer-events-none overflow-hidden z-50 opacity-50">
        {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {(function () {
        if (mode === 'MENU') {
          return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 relative overflow-hidden">
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-500 mb-2 transform -skew-x-6 z-10">
                PUKABOY
              </h1>
              <div className="text-xs tracking-[0.5em] text-blue-500 mb-12 z-10">REALTIME PVP</div>

              {!peerId ? (
                <div className="animate-pulse text-blue-400 font-mono bg-gray-800 px-4 py-2 rounded-lg">{status}</div>
              ) : (
                <div className="w-full max-w-xs space-y-4 z-10">
                  <button
                    onClick={createGame}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>⚔️</span> СОЗДАТЬ ДУЭЛЬ
                  </button>
                  <div className="text-[10px] text-gray-600 text-center font-mono mt-4">ID: {peerId}</div>
                </div>
              )}
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
                  <div className="font-bold text-sm bg-gray-800 px-3 py-1 rounded-full">{myProfile?.name}</div>
                </div>
                <div className="text-2xl font-black text-gray-600 italic">VS</div>
                <div className="flex flex-col items-center">
                  <div className={`w-20 h-20 ${opponentProfile ? 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)]' : 'bg-gray-800 border-dashed border-2 border-gray-600'} rounded-full flex items-center justify-center text-3xl mb-2 border-4 border-gray-900 transition-all`}>
                    {opponentProfile ? '😈' : '...'}
                  </div>
                  <div className="font-bold text-sm bg-gray-800 px-3 py-1 rounded-full">{opponentProfile?.name || 'Ждем...'}</div>
                </div>
              </div>

              {opponentProfile && isHost.current && (
                <button
                  onClick={doStart}
                  className="w-full max-w-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-xl py-5 rounded-2xl shadow-[0_5px_0_rgb(21,128,61)] active:shadow-none active:translate-y-[5px] transition-all animate-pulse"
                >
                  ПОГНАЛИ! 🚀
                </button>
              )}

              {opponentProfile && !isHost.current && (
                <div className="text-green-400 animate-pulse bg-green-900/20 px-4 py-2 rounded-lg">Организатор запускает гонку...</div>
              )}

              {!opponentProfile && (
                <div className="text-center text-gray-500 text-xs">Пригласи друга через кнопку "Share" в меню...</div>
              )}
            </div>
          );
        }

        return (
          <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden touch-manipulation select-none">
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
                <div className="absolute top-2 left-1/2 -translate-x-1/2 font-bold text-red-500 text-xs tracking-wider bg-red-900/20 px-2 rounded">{opponentProfile?.name}</div>
              </div>

              {game.myTime && game.opponentTime && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center animate-in fade-in duration-300">
                  <div className="text-8xl mb-4 animate-bounce">
                    {game.myTime < game.opponentTime ? '🏆' : '🐢'}
                  </div>
                  <h2 className={`text-4xl font-black italic mb-8 ${game.myTime < game.opponentTime ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {game.myTime < game.opponentTime ? 'ТЫ ПОБЕДИЛ!' : 'ПРОИГРАЛ'}
                  </h2>
                  <div className="grid grid-cols-2 gap-8 text-center mb-8">
                    <div>
                      <div className="text-gray-500 text-xs uppercase">ТВОЕ ВРЕМЯ</div>
                      <div className="text-2xl font-mono font-bold text-white">{(game.myTime / 1000).toFixed(2)}s</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs uppercase">{opponentProfile?.name}</div>
                      <div className="text-2xl font-mono font-bold text-red-400">{(game.opponentTime / 1000).toFixed(2)}s</div>
                    </div>
                  </div>
                  <button onClick={() => { setMode('MENU'); setOpponentProfile(null); }} className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-gray-200 transition-colors">В МЕНЮ</button>
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
