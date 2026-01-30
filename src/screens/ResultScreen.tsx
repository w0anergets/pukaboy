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
    if (!initialSession || !user) {
        return <div className="p-10 text-center" onClick={onMenu}>Error: No Result Data. Tap to Menu.</div>;
    }

    const [session, setSession] = useState<GameSession>(initialSession);
    const [status, setStatus] = useState("");

    const amIWinner = session.winner_id === user.id;
    const amIHost = session.host_id === user.id;

    useEffect(() => {
        const channel = supabase
            .channel(`result_${session.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
                (payload) => {
                    const updated = payload.new as GameSession;
                    setSession(updated);
                    if (updated.next_game_id) setStatus("Rematch Ready!");
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session.id]);

    const handleRematchClick = async () => {
        if (amIHost) {
            setStatus("Creating...");
            const newId = await gameService.createRematch(session.id, user.id);
            if (newId) onRematch(newId);
        } else {
            if (session.next_game_id) {
                onRematch(session.next_game_id);
            } else {
                setStatus("Wait for Host...");
            }
        }
    };

    return (
        <div className="flex flex-col h-screen bg-black overflow-hidden relative font-sans">
            {/* Split Background */}
            <div className="absolute inset-0 flex opacity-50">
                <div className="w-1/2 bg-[#DFFF00]" />
                <div className="w-1/2 bg-[#FF00FF]" />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 space-y-6">

                {/* Result Title */}
                <div className="bg-white border-4 border-black px-8 py-4 transform -rotate-3 shadow-[8px_8px_0px_0px_black] mb-8">
                    <h1 className="text-6xl font-black text-black uppercase tracking-tighter">
                        {amIWinner ? "VICTORY" : "DEFEAT"}
                    </h1>
                </div>

                {/* Score / Stats */}
                <div className="bg-black border-4 border-white p-4 rounded-xl text-center transform rotate-2">
                    <div className="text-white font-mono text-xl">
                        {amIWinner ? "YOU SMASHED IT!" : "YOU GOT CRUSHED!"}
                    </div>
                </div>

                <div className="h-12" />

                {/* Actions */}
                <button
                    onClick={handleRematchClick}
                    className="w-full max-w-xs bg-gradient-to-r from-blue-500 to-purple-500 border-4 border-black rounded-2xl py-6 relative active:scale-95 transition-transform shadow-[8px_8px_0px_0px_white]"
                >
                    <span className="text-3xl font-black text-white uppercase italic">
                        {amIHost ? "REMATCH" : (session.next_game_id ? "JOIN REMATCH" : "WAIT FOR HOST")}
                    </span>
                    <div className="absolute -top-3 -left-3 text-3xl animate-spin-slow">🔄</div>
                </button>

                <button
                    onClick={onMenu}
                    className="w-full max-w-xs bg-white border-4 border-black rounded-xl py-3 active:scale-95 transition-transform"
                >
                    <span className="font-bold text-black uppercase">BACK TO MENU</span>
                </button>

                <div className="font-mono text-white text-xs bg-black px-2">
                    {status}
                </div>
            </div>
        </div>
    );
};
