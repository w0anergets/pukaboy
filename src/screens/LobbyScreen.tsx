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
            const game = await gameService.getGame(sessionId);
            if (!game) {
                setError("Game not found");
                return;
            }
            setSession(game);

            channel = supabase
                .channel(`lobby_${sessionId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
                    (payload) => {
                        setSession(payload.new as GameSession);
                    }
                )
                .subscribe();
        };

        init();
        return () => { if (channel) supabase.removeChannel(channel); };
    }, [sessionId]);

    // 2. Fetch Opponent
    useEffect(() => {
        if (!session) return;
        const oppId = session.host_id === user.id ? session.guest_id : session.host_id;

        if (oppId) {
            userService.getOrCreateUser({ id: oppId, first_name: 'Opponent' } as any).then(setOpponent);
        } else {
            setOpponent(null);
        }

        if (session.status === 'RACING') {
            onStart(session);
        }
    }, [session, user.id, onStart]);

    const handleHostStart = async () => {
        if (!amIHost || !session?.guest_id) return;
        await gameService.startGame(sessionId);
    };

    if (error) return <div className="h-screen bg-black text-white flex items-center justify-center font-bold text-2xl">{error}</div>;
    if (!session) return <div className="h-screen bg-black text-white flex items-center justify-center font-bold text-2xl">LOADING...</div>;

    return (
        <div className="flex flex-col h-screen bg-black overflow-hidden relative font-sans">
            {/* Split Background */}
            <div className="absolute inset-0 flex">
                <div className="w-1/2 bg-[#DFFF00] border-r-4 border-black box-border" />
                <div className="w-1/2 bg-[#FF00FF] border-l-4 border-black box-border" />
            </div>

            {/* Content Layer */}
            <div className="relative z-10 flex flex-col h-full">

                {/* Header */}
                <div className="h-24 flex items-center justify-center">
                    <h1 className="text-4xl font-black text-black drop-shadow-[2px_2px_0px_white]">LOBBY</h1>
                </div>

                {/* VS Area */}
                <div className="flex-1 flex w-full items-center">

                    {/* Left: Host */}
                    <div className="w-1/2 flex flex-col items-center justify-center p-4">
                        <div className="w-24 h-24 rounded-full border-4 border-black bg-white overflow-hidden mb-2 shadow-[4px_4px_0px_0px_black]">
                            {(amIHost ? user : opponent) ? (
                                <img src={(amIHost ? user : opponent)?.avatar_url || ''} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gray-300" />
                            )}
                        </div>
                        <div className="bg-black text-white px-2 py-1 font-bold font-mono text-sm transform -rotate-2">
                            {(amIHost ? user.username : opponent?.username) || 'HOST'}
                        </div>
                    </div>

                    {/* VS Badge */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                        <div className="bg-white border-4 border-black px-4 py-2 font-black text-3xl italic shadow-[4px_4px_0px_0px_black] transform rotate-6">
                            VS
                        </div>
                    </div>

                    {/* Right: Guest */}
                    <div className="w-1/2 flex flex-col items-center justify-center p-4">
                        <div className="w-24 h-24 rounded-full border-4 border-black bg-white overflow-hidden mb-2 shadow-[4px_4px_0px_0px_black] border-dashed">
                            {(!amIHost ? user : opponent) ? (
                                <img src={(!amIHost ? user : opponent)?.avatar_url || ''} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl animate-pulse">?</div>
                            )}
                        </div>
                        <div className="bg-black text-white px-2 py-1 font-bold font-mono text-sm transform rotate-2">
                            {(!amIHost ? user.username : opponent?.username) || 'WAITING...'}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="h-32 flex flex-col items-center justify-center p-6 space-y-4">
                    {amIHost ? (
                        <button
                            onClick={handleHostStart}
                            disabled={!session.guest_id}
                            className={`w-full max-w-xs border-4 border-black rounded-xl py-4 font-black text-2xl uppercase transition-transform active:scale-95 shadow-[4px_4px_0px_0px_black] ${session.guest_id ? 'bg-white text-black animate-pulse' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                        >
                            {session.guest_id ? 'START RAGE!' : 'WAITING...'}
                        </button>
                    ) : (
                        <div className="bg-black text-white px-6 py-3 font-bold text-xl rounded-xl border-4 border-white animate-pulse">
                            WAITING FOR HOST
                        </div>
                    )}

                    <button onClick={onBack} className="text-black font-bold underline hover:text-white">
                        CANCEL
                    </button>
                </div>
            </div>
        </div>
    );
};
