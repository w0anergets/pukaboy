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
    // Basic Init
    WebApp.ready();
    WebApp.expand();
    WebApp.enableClosingConfirmation();

    // Global Styles
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none'; // CRITICAL: Prevent swipes globally
    document.body.style.backgroundColor = '#111827'; // gray-900

    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };

    // Auth
    // @ts-ignore
    const tgUser = WebApp.initDataUnsafe.user;
    if (tgUser) {
      setStatus("Authenticating...");
      userService.getOrCreateUser({
        id: tgUser!.id,
        username: tgUser!.username,
        first_name: tgUser!.first_name,
        last_name: tgUser!.last_name,
        photo_url: tgUser!.photo_url
      }).then(u => {
        if (u) {
          setUser(u);
          setStatus("Ready");

          // Deep Link Check
          // @ts-ignore
          const startParam = WebApp.initDataUnsafe.start_param;
          if (startParam && startParam.startsWith('join_')) {
            const sessId = startParam.replace('join_', '');
            console.log("Deep link join:", sessId);
            // Attempt join
            gameService.joinGame(sessId, u.id).then(success => {
              if (success) {
                setCurrentSessionId(sessId);
                setMode('LOBBY');
              } else {
                alert("Could not join game (Full or Error)");
              }
            });
          }
        } else {
          setStatus("Auth Error");
        }
      });
    } else {
      setStatus("Run in Telegram");
    }
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
    </div>
  );
}

export default App;
