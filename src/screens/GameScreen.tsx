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
    const isFinishedRef = useRef(false);

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
                    if (newSess.status === 'FINISHED' && !isFinishedRef.current) {
                        isFinishedRef.current = true;
                        // Small delay to ensure last click sound plays?
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

        setMyScore(prev => {
            if (prev >= WIN_SCORE) return prev; // Client-side Cap

            const newScore = prev + 1;

            // Optimistic Feedback
            WebApp.HapticFeedback.impactOccurred('medium');

            // Server Sync
            gameService.click(sessionId, user.id);

            // Finish Check (Client-side trigger)
            if (newScore >= WIN_SCORE) {
                gameService.finishGame(sessionId, user.id);
            }

            return newScore;
        });
    };

    // Render Helpers
    const getProgress = (s: number) => Math.min((s / WIN_SCORE) * 100, 100);

    return (
        <div
            className="flex flex-col h-screen bg-black overflow-hidden select-none relative"
            style={{ touchAction: 'none' }}
        >
            {/* Split Background */}
            <div className="absolute inset-0 flex">
                <div className="w-1/2 bg-[#DFFF00] border-r-4 border-black box-border relative">
                    {/* Checkered Pattern Strip (Left) */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 h-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAkSURBVHgB7YwxDQAADEPRu/w7Ww0O4O4yF6aGg6aKu4O1/0yQARt5Ck7CAAAAAElFTkSuQmCC')] opacity-20" />
                </div>
                <div className="w-1/2 bg-[#FF00FF] border-l-4 border-black box-border relative">
                    {/* Checkered Pattern Strip (Right) */}
                    <div className="absolute left-0 top-0 bottom-0 w-8 h-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAkSURBVHgB7YwxDQAADEPRu/w7Ww0O4O4yF6aGg6aKu4O1/0yQARt5Ck7CAAAAAElFTkSuQmCC')] opacity-20" />
                </div>
            </div>

            {/* Elements Layer */}
            <div className="relative z-10 flex flex-col h-full pointer-events-none">

                {/* MOON (Goal) */}
                <div className="h-32 flex justify-center items-start pt-4">
                    <div className="w-24 h-24 rounded-full bg-gray-300 border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20">
                        <span className="font-black text-xl text-black">MOON</span>
                    </div>
                </div>

                {/* TRACKS */}
                <div className="flex-1 flex w-full relative">

                    {/* PLAYER 1 (ME) - LEFT */}
                    <div className="w-1/2 relative h-full">
                        <div
                            className="absolute left-1/2 -translate-x-1/2 w-20 transition-all duration-100 ease-linear flex flex-col items-center"
                            style={{ bottom: `${getProgress(myScore)}%`, marginBottom: '-40px' }}
                        >
                            {/* Avatar */}
                            <div className="relative">
                                {/* Flame */}
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-4xl animate-pulse delay-75">🔥</div>
                                <div className="w-16 h-16 rounded-full bg-white border-2 border-black overflow-hidden relative z-10">
                                    <img src={user.photo_url || `https://ui-avatars.com/api/?name=${user.first_name}`} className="w-full h-full object-cover" />
                                </div>
                            </div>
                        </div>

                        {/* Rage Meter (Visual Bar on side) */}
                        <div className="absolute left-2 bottom-4 top-4 w-4 bg-black/20 rounded-full flex flex-col-reverse p-1 overflow-hidden">
                            <div className="w-full bg-black rounded-full transition-all duration-75" style={{ height: `${getProgress(myScore)}%` }} />
                        </div>
                    </div>

                    {/* PLAYER 2 (OPPONENT) - RIGHT */}
                    <div className="w-1/2 relative h-full">
                        <div
                            className="absolute left-1/2 -translate-x-1/2 w-20 transition-all duration-100 ease-linear flex flex-col items-center"
                            style={{ bottom: `${getProgress(oppScore)}%`, marginBottom: '-40px' }}
                        >
                            {/* Avatar */}
                            <div className="relative">
                                {/* Flame */}
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-4xl animate-pulse">💨</div>
                                <div className="w-16 h-16 rounded-full bg-white border-2 border-black overflow-hidden relative z-10">
                                    {/* Simple opponent placeholder if no image */}
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center font-bold text-black border-2 border-black">OPP</div>
                                </div>
                            </div>
                        </div>

                        {/* Rage Meter (Visual Bar on side) */}
                        <div className="absolute right-2 bottom-4 top-4 w-4 bg-black/20 rounded-full flex flex-col-reverse p-1 overflow-hidden">
                            <div className="w-full bg-black rounded-full transition-all duration-75" style={{ height: `${getProgress(oppScore)}%` }} />
                        </div>
                    </div>

                </div>

                {/* EARTH (Start) */}
                <div className="h-24 flex items-end justify-center pb-4 z-20">
                    <div className="bg-[#4CAF50] border-4 border-black px-12 py-2 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <span className="font-black text-3xl text-black">EARTH</span>
                    </div>
                </div>
            </div>

            {/* Tap Zone (Invisible Top Layer) */}
            <div
                className="absolute inset-0 z-30"
                onPointerDown={handleTap}
            >
                {/* Initial Countdown Overlay */}
                {countdown !== null && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 backdrop-blur-sm">
                        <div className="text-9xl font-black text-yellow-400 animate-ping">
                            {countdown}
                        </div>
                    </div>
                )}

                {/* Tap Burst FX (Optional - Could use a library later) */}
            </div>

            {/* Timer Overlay (Top Center) */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40">
                <div className="bg-black text-yellow-400 font-mono text-xl px-4 py-1 rounded border-2 border-white">
                    {timer}s
                </div>
            </div>
        </div>
    );
};
