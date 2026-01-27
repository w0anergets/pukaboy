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

function App() {
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

  useEffect(() => {
    // 1. Setup Telegram & User
    WebApp.expand();
    // @ts-ignore
    const user = WebApp.initDataUnsafe.user;
    const me = { name: user?.first_name || `Player-${Math.floor(Math.random() * 1000)}` };
    setMyProfile(me);

    // 2. Initialize PeerJS
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My Peer ID:', id);
      setPeerId(id);
      setStatus("Готов к подключению");

      // Check for join params
      // @ts-ignore
      const startParam = WebApp.initDataUnsafe.start_param; // format: "join_PEERID"
      if (startParam && startParam.startsWith('join_')) {
        const hostId = startParam.replace('join_', '');
        joinGame(hostId);
      }
    });

    peer.on('connection', (conn) => {
      // HOST LOGIC: Someone connected to us
      handleConnection(conn);
    });

    peer.on('error', (err) => {
      console.error(err);
      setStatus(`Ошибка сети: ${err.type}`);
    });

    return () => peer.destroy();
  }, []);

  // --- Connection Handling ---

  const handleConnection = (conn: DataConnection) => {
    connRef.current = conn;

    conn.on('open', () => {
      console.log("Connection Open!");
      // Send HELLO to introduce ourselves
      sendMessage({ type: 'HELLO', payload: { name: myProfile?.name } });
    });

    conn.on('data', (data: any) => {
      const msg = data as PeerMessage;
      handleMessage(msg);
    });

    conn.on('close', () => {
      setStatus("Соперник отключился");
      setMode('MENU');
      setOpponentProfile(null);
    });
  };

  const joinGame = (hostId: string) => {
    setStatus(`Подключение к ${hostId}...`);
    isHost.current = false;

    if (!peerRef.current) return;
    const conn = peerRef.current.connect(hostId);
    handleConnection(conn);
  };

  const sendMessage = (msg: PeerMessage) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(msg);
    }
  };

  const handleMessage = (msg: PeerMessage) => {
    console.log("Received:", msg);

    switch (msg.type) {
      case 'HELLO':
        setOpponentProfile({ name: msg.payload.name });
        // If we are host and just received HELLO, we are ready to start lobby
        if (mode === 'MENU') {
          setMode('LOBBY'); // Transition to lobby to show "Ready?"
        } else {
          // If we joined, we also go to LOBBY
          setMode('LOBBY');
        }
        break;

      case 'START_GAME':
        startGame(); // Start as client
        break;

      case 'UPDATE_CLICKS':
        setGame(prev => ({ ...prev, opponentClicks: msg.payload.clicks }));
        break;

      case 'FINISH':
        setGame(prev => ({ ...prev, opponentTime: msg.payload.time }));
        break;
    }
  };

  // --- Game Interface Actions ---

  const createGame = () => {
    isHost.current = true;
    setMode('LOBBY');
    // Generate Share Link
    if (!peerId) return;

    // @ts-ignore
    const botName = 'pukaboy_bot';
    const link = `https://t.me/${botName}/app?startapp=join_${peerId}`;

    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("⚔️ Вызываю на дуэль в реальном времени! Жми кнопку!")}`;
    WebApp.openTelegramLink(url);
  };

  const doStart = () => {
    // Only Host can trigger start
    sendMessage({ type: 'START_GAME' });
    startGame();
  };

  const startGame = () => {
    // Reset Game
    setGame({
      myClicks: 0,
      opponentClicks: 0,
      myTime: null,
      opponentTime: null
    });
    setMode('RACING');
    startTimeRef.current = Date.now();
    // requestAnimationFrame(gameLoop); // loop handled by effect
    console.log("Game Started!");
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
    if (game.myTime) return; // Already finished

    const newClicks = game.myClicks + 1;

    // Update Local
    setGame(prev => ({ ...prev, myClicks: newClicks }));

    // Send Network Update
    sendMessage({ type: 'UPDATE_CLICKS', payload: { clicks: newClicks } });

    // Check Win
    if (newClicks >= WIN_SCORE) {
      const finishTime = Date.now() - startTimeRef.current;
      setGame(prev => ({ ...prev, myTime: finishTime }));
      sendMessage({ type: 'FINISH', payload: { time: finishTime } });
    }
  };

  // Check valid game end
  useEffect(() => {
    if (game.myTime && game.opponentTime) {
      // Both finished
    }
  }, [game.myTime, game.opponentTime]);


  // --- Render ---

  const getProgress = (c: number) => Math.min((c / WIN_SCORE) * 100, 100);

  if (mode === 'MENU') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 relative overflow-hidden">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-500 mb-2 transform -skew-x-6 z-10">
          PUKABOY
        </h1>
        <div className="text-xs tracking-[0.5em] text-blue-500 mb-12 z-10">REALTIME PVP</div>

        {/* Background deco */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-10 left-10 text-6xl animate-bounce">🚀</div>
          <div className="absolute bottom-20 right-10 text-6xl animate-pulse">⚡️</div>
        </div>

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

            <div className="text-[10px] text-gray-600 text-center font-mono mt-4">
              ID: {peerId}
            </div>
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
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-3xl mb-2 shadow-[0_0_15px_rgba(37,99,235,0.6)] border-4 border-gray-800">
              😎
            </div>
            <div className="font-bold text-sm bg-gray-800 px-3 py-1 rounded-full">{myProfile?.name}</div>
          </div>

          <div className="text-2xl font-black text-gray-600 italic">VS</div>

          <div className="flex flex-col items-center relative">
            <div className={`w-20 h-20 ${opponentProfile ? 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)]' : 'bg-gray-800 border-dashed border-2 border-gray-600'} rounded-full flex items-center justify-center text-3xl mb-2 border-4 border-gray-900 transition-all`}>
              {opponentProfile ? '😈' : '...'}
            </div>
            <div className="font-bold text-sm bg-gray-800 px-3 py-1 rounded-full min-w-[80px] text-center">
              {opponentProfile?.name || 'Ждем...'}
            </div>
            {/* Pulse effect if waiting */}
            {!opponentProfile && <div className="absolute inset-0 bg-white/5 rounded-full animate-ping"></div>}
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
          <div className="text-green-400 animate-pulse bg-green-900/20 px-4 py-2 rounded-lg">
            Организатор запускает гонку...
          </div>
        )}

        {!opponentProfile && (
          <div className="text-center">
            <div className="spinner mb-4 mx-auto w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 text-sm max-w-xs text-center">
              Отправь приглашение другу...
            </p>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'RACING' || mode === 'FINISHED') {
    const isFinished = !!game.myTime && !!game.opponentTime;
    const iWon = game.myTime && game.opponentTime ? game.myTime < game.opponentTime : false;

    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden touch-manipulation select-none">

        {/* Header Timer */}
        <div className={`h-20 flex flex-col items-center justify-center border-b border-gray-700 z-10 transition-colors ${game.myTime ? 'bg-gray-800' : 'bg-gray-800/80 backdrop-blur-sm'}`}>
          <span className={`font-mono text-4xl font-bold tracking-tighter ${game.myTime ? 'text-gray-500' : 'text-yellow-400'}`}>
            {game.myTime ? ((game.myTime / 1000).toFixed(2)) : timer}
          </span>
          {game.myTime && <span className="text-xs text-green-400">ФИНИШ! ЖДЕМ СОПЕРНИКА...</span>}
        </div>

        {/* Track Area */}
        <div className="flex-1 flex relative">

          {/* Lane 1: Player (You) */}
          <div className="flex-1 border-r border-gray-800 relative bg-blue-900/5">
            {/* Progress Bar */}
            <div className="absolute inset-x-0 bottom-0 bg-blue-600/30 transition-all duration-75 ease-out" style={{ height: `${getProgress(game.myClicks)}%` }}></div>

            {/* Rocket */}
            <div
              className="absolute left-1/2 transform -translate-x-1/2 text-5xl transition-all duration-75 ease-out filter drop-shadow-[0_0_15px_rgba(37,99,235,0.5)] pb-4"
              style={{ bottom: `${getProgress(game.myClicks)}%` }}
            >
              🚀
            </div>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 font-bold text-blue-500 text-xs tracking-wider bg-blue-900/20 px-2 rounded">YOU</div>
          </div>

          {/* Lane 2: Opponent */}
          <div className="flex-1 relative bg-red-900/5">
            {/* Progress Bar */}
            <div className="absolute inset-x-0 bottom-0 bg-red-600/30 transition-all duration-75 ease-linear" style={{ height: `${getProgress(game.opponentClicks)}%` }}></div>

            {/* Opponent Rocket (Ghost?) */}
            <div
              className="absolute left-1/2 transform -translate-x-1/2 text-5xl transition-all duration-75 ease-linear filter drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] pb-4"
              style={{ bottom: `${getProgress(game.opponentClicks)}%` }}
            >
              😈
            </div>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 font-bold text-red-500 text-xs tracking-wider bg-red-900/20 px-2 rounded">{opponentProfile?.name}</div>
          </div>

          {/* Result Overlay */}
          {isFinished && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center animate-in fade-in duration-300">
              <div className="text-8xl mb-4 animate-bounce">
                {iWon ? '🏆' : '🐢'}
              </div>
              <h2 className={`text-4xl font-black italic mb-8 ${iWon ? 'text-yellow-400' : 'text-gray-400'}`}>
                {iWon ? 'ТЫ ПОБЕДИЛ!' : 'ПРОИГРАЛ'}
              </h2>
              <div className="grid grid-cols-2 gap-8 text-center mb-8">
                <div>
                  <div className="text-gray-500 text-xs uppercase">ТВОЕ ВРЕМЯ</div>
                  <div className="text-2xl font-mono font-bold text-white">{(game.myTime! / 1000).toFixed(2)}s</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs uppercase">{opponentProfile?.name}</div>
                  <div className="text-2xl font-mono font-bold text-red-400">{(game.opponentTime! / 1000).toFixed(2)}s</div>
                </div>
              </div>
              <button
                onClick={() => { setMode('MENU'); setOpponentProfile(null); }}
                className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-gray-200 transition-colors"
              >
                В МЕНЮ
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="h-[35vh] bg-gray-800 p-8 flex justify-center items-center rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20 relative">
          {/* Visual notch */}
          <div className="absolute top-3 w-16 h-1 bg-gray-600/30 rounded-full"></div>

          <button
            onPointerDown={handleTap}
            disabled={!!game.myTime}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all duration-75 border-4
                ${game.myTime
                ? 'bg-gray-700 border-gray-600 opacity-50 grayscale'
                : 'bg-gradient-to-b from-blue-500 to-blue-700 border-blue-400/30 shadow-[0_10px_0_rgb(30,58,138)] active:shadow-none active:translate-y-[10px] active:scale-95'
              }
             `}
          >
            <span className="text-4xl font-black text-white drop-shadow-md select-none">TAP!</span>
            <span className="text-xs font-mono text-blue-200 mt-1">{game.myClicks}/{WIN_SCORE}</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App
