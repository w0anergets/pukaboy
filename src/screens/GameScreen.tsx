import React, { useEffect, useState, useRef } from 'react';
import type { UserProfile } from '../services/userService';
import { gameService } from '../services/gameService';
import type { GameSession } from '../services/gameService';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';

interface GameScreenProps {
    sessionId: string;
    user: UserProfile;
    initialSession: GameSession;
    onFinish: (session: GameSession) => void;
}

const WIN_SCORE = 100;

export const GameScreen: React.FC<GameScreenProps> = ({ sessionId, user, initialSession, onFinish }) => {
    // State
    const [session, setSession] = useState<GameSession>(initialSession);
    const [myScore, setMyScore] = useState(0); // Optimistic Score
    const [oppScore, setOppScore] = useState(0);

    const [countdown, setCountdown] = useState<number | null>(null);
    const [timer, setTimer] = useState("0.00");

    // Refs for stale closure prevention
    const myScoreRef = useRef(0);
    const sessionRef = useRef(session);

    const amIHost = session.host_id === user.id;

    // Sync Refs
    useEffect(() => { myScoreRef.current = myScore; }, [myScore]);
    useEffect(() => { sessionRef.current = session; }, [session]);

    // 1. Countdown Logic
    useEffect(() => {
        if (session.start_time) {
            const start = new Date(session.start_time).getTime();
            const now = Date.now();
            const diff = start - now;

            if (diff > 0) {
                setCountdown(Math.ceil(diff / 1000));

                const interval = setInterval(() => {
                    const d = start - Date.now();
                    if (d <= 0) {
                        setCountdown(null);
                        clearInterval(interval);
                        WebApp.HapticFeedback.notificationOccurred('success');
                    } else {
                        setCountdown(Math.ceil(d / 1000));
                    }
                }, 100);
                return () => clearInterval(interval);
            }
        }
    }, [session.start_time]);

    // 2. Race Timer
    useEffect(() => {
        if (!session.start_time || countdown !== null) return;

        let reqId: number;
        const start = new Date(session.start_time).getTime();

        const loop = () => {
            const now = Date.now();
            setTimer(((now - start) / 1000).toFixed(2));
            reqId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(reqId);
    }, [session.start_time, countdown]);


    // 3. Realtime Subscription
    useEffect(() => {
        const channel = supabase
            .channel(`game_${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
                (payload) => {
                    const newSess = payload.new as GameSession;
                    setSession(newSess);

                    // Sync Opponent Score (Always)
                    const sOppScore = amIHost ? newSess.guest_score : newSess.host_score;
                    setOppScore(sOppScore);

                    // Sync My Score (Only if Server is ahead - rare, or if reset happen)
                    const sMyScore = amIHost ? newSess.host_score : newSess.guest_score;
                    if (sMyScore > myScoreRef.current) {
                        setMyScore(sMyScore);
                    }

                    // Check Finish
                    if (newSess.status === 'FINISHED') {
                        onFinish(newSess);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId, amIHost, onFinish]);


    // 4. Interaction
    const handleTap = () => {
        if (countdown !== null) return; // Block input during countdown
        if (myScore >= WIN_SCORE) return;

        // Optimistic
        const newScore = myScore + 1;
        setMyScore(newScore);
        WebApp.HapticFeedback.impactOccurred('medium');

        // Server
        gameService.click(sessionId, user.id);

        if (newScore >= WIN_SCORE) {
            gameService.finishGame(sessionId, user.id);
        }
    };

    // Render Helpers
    const getProgress = (s: number) => Math.min((s / WIN_SCORE) * 100, 100);

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden touch-none select-none">
            {/* Header */}
            <div className="h-24 bg-gray-800 flex items-center justify-center border-b border-gray-700 bg-opacity-80 backdrop-blur-md z-10">
                <div className={`font-mono text-5xl font-bold tracking-tighter ${countdown ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                    {countdown ? countdown : timer}
                </div>
            </div>

            {/* Track */}
            <div className="flex-1 flex relative">
                {/* Me */}
                <div className="flex-1 border-r border-gray-800 relative bg-blue-900/10">
                    <div className="absolute inset-x-0 bottom-0 bg-blue-600/50 transition-all duration-75 ease-out" style={{ height: `${getProgress(myScore)}%` }} />
                    <div className="absolute left-1/2 -translate-x-1/2 transition-all duration-75 pb-2" style={{ bottom: `${getProgress(myScore)}%` }}>
                        <span className="text-4xl">🚀</span>
                    </div>
                </div>

                {/* Opponent */}
                <div className="flex-1 relative bg-red-900/10">
                    <div className="absolute inset-x-0 bottom-0 bg-red-600/50 transition-all duration-75 ease-linear" style={{ height: `${getProgress(oppScore)}%` }} />
                    <div className="absolute left-1/2 -translate-x-1/2 transition-all duration-75 pb-2" style={{ bottom: `${getProgress(oppScore)}%` }}>
                        <span className="text-4xl">😈</span>
                    </div>
                </div>

                {/* Tap Zone Overlay */}
                <div
                    className="absolute inset-0 z-20 flex items-end justify-center pb-20 active:bg-white/5 transition-colors"
                    onPointerDown={handleTap}
                >
                    <div className="w-64 h-64 rounded-full border-4 border-white/10 flex items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-white/20 select-none">
                            {countdown ? 'WAIT' : 'TAP HERE'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="h-16 flex items-center justify-between px-8 bg-gray-900 border-t border-gray-800">
                <div className="text-blue-400 font-bold font-mono">{myScore}/100</div>
                <div className="text-red-400 font-bold font-mono">{oppScore}/100</div>
            </div>
        </div>
    );
};
