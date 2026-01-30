```
import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import './App.css';
import { userService } from './services/userService';
import type { UserProfile } from './services/userService';
import { MenuScreen } from './screens/MenuScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { gameService, GameSession } from './services/gameService';

function App() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mode, setMode] = useState<'MENU' | 'LOBBY'>('MENU'); 
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState("Initializing...");
  
  // Lobby State
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Basic Init
    WebApp.ready();
    WebApp.expand();
    WebApp.enableClosingConfirmation(); 
    
    // Global Styles
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#111827'; // gray-900

    // Auth
    // @ts-ignore
    const tgUser = WebApp.initDataUnsafe.user;
    if (tgUser) {
        setStatus("Authenticating...");
        userService.getOrCreateUser(tgUser).then(u => {
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
  console.log("Race Starting!", session);
  // Next Step: Switch to GAME mode
  // setMode('RACING'); or similar
  alert("Race Started! (Implementing in next step)");
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
        onBack={() => {
          setMode('MENU');
          setCurrentSessionId(null);
        }}
      />
    )}
  </div>
);
}

export default App;
```
