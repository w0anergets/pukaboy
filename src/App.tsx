import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import './App.css';
import { userService, UserProfile } from './services/userService';
import { MenuScreen } from './screens/MenuScreen';

function App() {
  const [mode, setMode] = useState('MENU');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState("Initializing...");

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
        } else {
          setStatus("Auth Error");
        }
      });
    } else {
      setStatus("Run in Telegram");
    }
  }, []);

  const handleCreateGame = () => {
    // Placeholder for next step
    console.log("Create Game Clicked");
    setStatus("Creating Game...");
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
    </div>
  );
}

export default App;
