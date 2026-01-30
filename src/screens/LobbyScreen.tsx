import React, { useEffect, useState } from 'react';
import type { UserProfile } from '../services/userService';
import { gameService } from '../services/gameService';
import type { GameSession } from '../services/gameService';
import { supabase } from '../lib/supabase';
import { userService } from '../services/userService';

interface LobbyScreenProps {
    sessionId: string;
    user: UserProfile;
    onStart: (session: GameSession) => void;
    onBack: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ sessionId, user, onStart, onBack }) => {
    const [session, setSession] = useState<GameSession | null>(null);
    const [opponent, setOpponent] = useState<UserProfile | null>(null);
    const [error, setError] = useState<string | null>(null);

    const amIHost = session?.host_id === user.id;

    // 1. Fetch Initial & Subscribe
    useEffect(() => {
        let channel: any = null;

        const init = async () => {
            // Initial Fetch
            const game = await gameService.getGame(sessionId);
            if (!game) {
                setError("Game not found");
                return;
            }
            setSession(game);

            // Subscribe
            channel = supabase
                .channel(`lobby_${sessionId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
                    (payload) => {
                        console.log("Lobby Update:", payload.new);
                        setSession(payload.new as GameSession);
                    }
                )
                .subscribe();
        };

        init();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [sessionId]);

    // 2. Fetch Opponent Details
    useEffect(() => {
        if (!session) return;
        const oppId = session.host_id === user.id ? session.guest_id : session.host_id;

        if (oppId) {
            userService.getOrCreateUser({ id: oppId, first_name: 'Opponent' } as any).then(setOpponent);
        } else {
            setOpponent(null);
        }

        // Auto-Start Check (If status became RACING)
        if (session.status === 'RACING') {
            onStart(session);
        }

    }, [session, user.id, onStart]);


    const handleHostStart = async () => {
        if (!amIHost || !session?.guest_id) return;
        // Host triggers start
        await gameService.startGame(sessionId);
        // UI will react to Realtime update -> onStart
    };

    if (error) {
        return (
            <div className="h-screen flex flex-col items-center justify-center text-white p-4 text-center">
                <div className="text-red-500 mb-4 text-2xl">⚠️</div>
                <div>{error}</div>
                <button onClick={onBack} className="mt-8 text-blue-400">Back to Menu</button>
            </div>
        );
    }

    if (!session) {
        return <div className="h-screen flex items-center justify-center text-gray-500">Loading Lobby...</div>;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
            <h2 className="text-xl font-bold mb-8 text-gray-400 tracking-widest uppercase">
                {amIHost ? "Waiting for Opponent" : "Waiting for Host"}
            </h2>

            <div className="flex gap-4 items-center mb-12 w-full justify-center">
                {/* MY AVATAR */}
                <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(37,99,235,0.6)] border-4 border-gray-800 bg-gray-800 overflow-hidden relative">
                        {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <span className="text-3xl">😎</span>}
                        <div className="absolute bottom-0 w-full text-[8px] bg-blue-600 text-center py-1">YOU</div>
                    </div>
                </div>

                <div className="text-2xl font-black text-gray-600 italic">VS</div>

                {/* OPPONENT AVATAR */}
                <div className="flex flex-col items-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-2 border-4 border-gray-900 transition-all overflow-hidden relative ${session.guest_id ? 'shadow-[0_0_15px_rgba(220,38,38,0.6)]' : 'border-dashed border-gray-700'}`}>
                        {session.guest_id ? (
                            opponent?.avatar_url ? <img src={opponent.avatar_url} className="w-full h-full object-cover" /> : <span className="text-3xl">😈</span>
                        ) : (
                            <span className="animate-pulse text-gray-600 text-4xl">?</span>
                        )}
                    </div>
                    <div className="font-bold text-sm bg-gray-800 px-3 py-1 rounded-full text-gray-400">
                        {opponent?.full_name || '...'}
                    </div>
                </div>
            </div>

            {/* Host Controls */}
            {amIHost && session.guest_id && (
                <button
                    onClick={handleHostStart}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-xl py-5 rounded-2xl shadow-[0_5px_0_rgb(21,128,61)] active:shadow-none active:translate-y-[5px] transition-all animate-pulse"
                >
                    START RACE 🚀
                </button>
            )}

            {/* Guest Message */}
            {!amIHost && session.guest_id && (
                <div className="text-green-400 animate-pulse bg-green-900/20 px-4 py-2 rounded-lg text-center">
                    Host is starting the race...
                </div>
            )}

            {/* Waiting Message */}
            {!session.guest_id && (
                <div className="text-center text-gray-500 text-xs max-w-xs">
                    Invite a friend using the "Share" button in Telegram menu, or wait for someone to join via link.
                </div>
            )}

            <button onClick={onBack} className="mt-12 text-gray-600 hover:text-white transition-colors text-sm">
                Cancel
            </button>
        </div>
    );
};
