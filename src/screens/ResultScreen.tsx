import React, { useEffect, useState } from 'react';
import type { UserProfile } from '../services/userService';
import { gameService } from '../services/gameService';
import type { GameSession } from '../services/gameService';
import { supabase } from '../lib/supabase';

interface ResultScreenProps {
    session: GameSession;
    user: UserProfile;
    onRematch: (newSessionId: string) => void;
    onMenu: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ session: initialSession, user, onRematch, onMenu }) => {
    const [session, setSession] = useState<GameSession>(initialSession);
    const [status, setStatus] = useState("");

    const amIWinner = session.winner_id === user.id;
    const amIHost = session.host_id === user.id;

    // Realtime Check for Rematch Link
    useEffect(() => {
        const channel = supabase
            .channel(`result_${session.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
                (payload) => {
                    const updated = payload.new as GameSession;
                    setSession(updated);

                    if (updated.next_game_id) {
                        // Auto-redirect guest if desired, or just show button
                        setStatus("Host created a rematch!");
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session.id]);

    const handleRematchClick = async () => {
        if (amIHost) {
            setStatus("Creating Rematch...");
            const newId = await gameService.createRematch(session.id, user.id);
            if (newId) {
                onRematch(newId);
            } else {
                setStatus("Error creating rematch");
            }
        } else {
            if (session.next_game_id) {
                onRematch(session.next_game_id);
            } else {
                setStatus("Waiting for host...");
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6 relative overflow-hidden">
            {/* Background FX */}
            <div className={`absolute inset-0 opacity-20 ${amIWinner ? 'bg-yellow-500' : 'bg-red-900'} z-0`} />

            <div className="z-10 flex flex-col items-center text-center">
                <div className="text-9xl mb-4 animate-bounce filter drop-shadow-lg">
                    {amIWinner ? '🏆' : '💀'}
                </div>

                <h1 className={`text-5xl font-black italic uppercase mb-2 ${amIWinner ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500' : 'text-gray-500'}`}>
                    {amIWinner ? 'VICTORY' : 'DEFEAT'}
                </h1>

                <div className="text-xs font-mono text-gray-400 mb-12">
                    {amIWinner ? '+10 PukaCoins Received' : 'Better luck next time'}
                </div>

                <div className="w-full max-w-xs space-y-4">
                    {(amIHost || session.next_game_id) ? (
                        <button
                            onClick={handleRematchClick}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xl py-5 rounded-2xl shadow-xl transition-all active:scale-95 animate-pulse"
                        >
                            {amIHost ? 'REMATCH ⚔️' : (session.next_game_id ? 'JOIN REMATCH 🚀' : 'Waiting for Host...')}
                        </button>
                    ) : (
                        <div className="text-gray-500 text-sm animate-pulse">Waiting for host to decide...</div>
                    )}

                    <button
                        onClick={onMenu}
                        className="w-full py-4 text-gray-500 font-bold hover:text-white transition-colors"
                    >
                        BACK TO MENU
                    </button>
                </div>

                <div className="mt-4 text-xs text-blue-400 font-mono h-4">
                    {status}
                </div>
            </div>
        </div>
    );
};
