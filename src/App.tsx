import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import './App.css';
import { userService } from './services/userService';
import type { UserProfile } from './services/userService';
import { MenuScreen } from './screens/MenuScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultScreen } from './screens/ResultScreen';
import { gameService } from './services/gameService';
import type { GameSession } from './services/gameService';

function App() {
  const [mode, setMode] = useState<'MENU' | 'LOBBY' | 'RACING' | 'FINISHED'>('MENU');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState("Initializing...");

  // Game State
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<GameSession | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Basic Init
        if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
          WebApp.ready();
          WebApp.expand();
          WebApp.enableClosingConfirmation();
        }

        // Global Styles
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        document.body.style.backgroundColor = '#111827';

        // Auth Logic
        // @ts-ignore
        const tgUser = WebApp.initDataUnsafe?.user;

        if (tgUser) {
          setStatus("Authenticating...");
          try {
            const user = await userService.getOrCreateUser({
              id: tgUser.id,
              username: tgUser.username,
              first_name: tgUser.first_name,
              last_name: tgUser.last_name,
              photo_url: tgUser.photo_url
            });

            if (user) {
              setUser(user);
              setStatus("Ready");

              // Deep Link Check
              // @ts-ignore
              const startParam = WebApp.initDataUnsafe.start_param;
              if (startParam && startParam.startsWith('join_')) {
                const sessId = startParam.replace('join_', '');
                const success = await gameService.joinGame(sessId, user.id);
                if (success) {
                  setCurrentSessionId(sessId);
                  setMode('LOBBY');
                } else {
                  alert("Could not join game (Full or Error)");
                }
              }
            } else {
              setStatus("Auth Failed");
            }
          } catch (e) {
            console.error("Auth Error", e);
            setStatus("Auth Connection Error");
          }
        } else {
          // Fallback for debugging / non-telegram
          // Delay slightly to not flash
          setTimeout(() => {
            if (import.meta.env.DEV) {
              // Auto-login as debug user in dev
              const debugUser = {
                id: 999999,
                username: 'DebugUser',
                first_name: 'Debug',
                last_name: 'Mode',
                photo_url: null
              };
              userService.getOrCreateUser(debugUser).then(u => {
                setUser(u);
                setStatus("Ready (Debug)");
              });
            } else {
              setStatus("Run in Telegram");
            }
          }, 500);
        }

      } catch (err) {
        console.error("Init Error:", err);
        setStatus(`Init Error: ${err}`);
      }
    };

    init();

    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, []);

  const handleCreateGame = async () => {
    if (!user) return;
    setStatus("Creating Session...");
    const sessId = await gameService.createGame(user.id);
    if (sessId) {
      setCurrentSessionId(sessId);
      setMode('LOBBY');

      // Generate Link
      // @ts-ignore
      const botName = 'pukaboy_bot';
      const appName = 'game';
      const link = `https://t.me/${botName}/${appName}?startapp=join_${sessId}`;
      WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("🏁 DUEL ME!")}`);
    } else {
      setStatus("Error creating game");
    }
  };

  const handleRaceStart = (session: GameSession) => {
    setSessionData(session);
    setMode('RACING');
  };

  const handleRaceFinish = (session: GameSession) => {
    setSessionData(session);
    setMode('FINISHED');
  };

  const handleRematch = (newSessId: string) => {
    setCurrentSessionId(newSessId);
    setSessionData(null);
    setMode('LOBBY');
    // Guest will typically auto-join or need to click join again?
    // In createRematch, host creates it.
    // If I am guest, passing newSessId means I want to go to that lobby.
    if (user && newSessId) {
      gameService.joinGame(newSessId, user.id);
    }
  };

  const handleBackToMenu = () => {
    setCurrentSessionId(null);
    setSessionData(null);
    setMode('MENU');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans overflow-hidden select-none">
      {mode === 'MENU' && (
        <MenuScreen
          user={user}
          onCreateGame={handleCreateGame}
          status={status}
        />
      )}

      {mode === 'LOBBY' && user && currentSessionId && (
        <LobbyScreen
          sessionId={currentSessionId}
          user={user}
          onStart={handleRaceStart}
          onBack={handleBackToMenu}
        />
      )}

      {mode === 'RACING' && user && currentSessionId && sessionData && (
        <GameScreen
          sessionId={currentSessionId}
          user={user}
          initialSession={sessionData}
          onFinish={handleRaceFinish}
        />
      )}

      {mode === 'FINISHED' && user && sessionData && (
        <ResultScreen
          session={sessionData}
          user={user}
          onRematch={handleRematch}
          onMenu={handleBackToMenu}
        />
      )}

      {/* Emergency Status Display */}
      {status !== 'Ready' && status !== 'Ready (Debug)' && (
        <div className="fixed bottom-0 w-full bg-red-900 text-white text-xs p-1 text-center font-mono z-50 opacity-80">
          DEBUG: {status}
          {status === 'Run in Telegram' && (
            <button
              className="ml-2 underline"
              onClick={() => {
                // Manual Debug Trigger
                userService.getOrCreateUser({ id: 777, first_name: 'Manual', username: 'Debug' }).then(u => {
                  setUser(u);
                  setStatus("Ready");
                });
              }}
            >
              [Force Login]
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
