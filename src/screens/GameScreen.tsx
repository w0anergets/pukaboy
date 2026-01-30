import React, { useEffect, useState, useRef } from 'react';
import type { UserProfile } from '../services/userService';
import { gameService } from '../services/gameService';
import type { GameSession } from '../services/gameService';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import spritesBody from '../assets/sprites/sticker_body.png';
import spritesFlame from '../assets/sprites/sticker_flame.png';
import { soundService } from '../services/soundService';

interface GameScreenProps {
    sessionId: string;
    user: UserProfile;
    initialSession: GameSession;
    onFinish: (session: GameSession) => void;
}

const WIN_SCORE = 100;

// Particle System for Text (PUK, TAP, BOY)
interface Particle {
    id: number;
    text: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
}

export const GameScreen: React.FC<GameScreenProps> = ({ sessionId, user, initialSession, onFinish }) => {
    // State
    const [session, setSession] = useState<GameSession>(initialSession);
    const [myScore, setMyScore] = useState(0); // Optimistic Score
    const [oppScore, setOppScore] = useState(0);

    const [countdown, setCountdown] = useState<number | null>(null);
    const [timer, setTimer] = useState("0.00");

    // Juice State
    const [particles, setParticles] = useState<Particle[]>([]);
    const [cps, setCps] = useState(0); // Clicks Per Second
    const clicksRef = useRef<number[]>([]);

    // Refs
    const myScoreRef = useRef(0);
    const sessionRef = useRef(session);
    const isFinishedRef = useRef(false);

    const amIHost = session.host_id === user.id;

    // Sync Refs
    useEffect(() => { myScoreRef.current = myScore; }, [myScore]);
    useEffect(() => { sessionRef.current = session; }, [session]);

    // Audio Init
    useEffect(() => {
        soundService.init();
        soundService.playStart();
    }, []);

    // CPS Tracker
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            clicksRef.current = clicksRef.current.filter(t => now - t < 1000);
            setCps(clicksRef.current.length);
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Particle Game Loop
    useEffect(() => {
        let frameId: number;
        const loop = () => {
            setParticles(prev => prev.map(p => ({
                ...p,
                x: p.x + p.vx,
                y: p.y + p.vy,
                life: p.life - 0.05
            })).filter(p => p.life > 0));
            frameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(frameId);
    }, []);


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
                        soundService.playStart(); // Go sound
                        WebApp.HapticFeedback.notificationOccurred('success');
                    } else {
                        const sec = Math.ceil(d / 1000);
                        if (sec !== countdown) {
                            soundService.playCountdown();
                            setCountdown(sec);
                        }
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
            setTimer(((Date.now() - start) / 1000).toFixed(2));
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

                    // Sync My Score (Only if Server is ahead - rare)
                    const sMyScore = amIHost ? newSess.host_score : newSess.guest_score;
                    if (sMyScore > myScoreRef.current) {
                        setMyScore(sMyScore);
                    }

                    // Check Finish
                    if (newSess.status === 'FINISHED' && !isFinishedRef.current) {
                        isFinishedRef.current = true;
                        soundService.playWin();
                        onFinish(newSess);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId, amIHost, onFinish]);

    // 4. Interaction (TAP)
    const handleTap = (e: React.PointerEvent) => {
        if (countdown !== null) return;

        // Prevent multi-touch logic is in App.tsx, but ensure here too just in case
        if (!e.isPrimary) return;

        clicksRef.current.push(Date.now());

        // Spawn Text Particle
        const words = ['PUK', 'TAP', 'BOY', 'GO!', '🚀'];
        const word = words[Math.floor(Math.random() * words.length)];
        // Random drift direction
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;

        setParticles(prev => [...prev, {
            id: Date.now() + Math.random(),
            text: word,
            x: e.clientX,
            y: e.clientY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0
        }]);

        setMyScore(prev => {
            if (prev >= WIN_SCORE) return prev;
            const newScore = prev + 1;

            WebApp.HapticFeedback.impactOccurred('light');
            soundService.playTap();
            gameService.click(sessionId, user.id);

            if (newScore >= WIN_SCORE) {
                gameService.finishGame(sessionId, user.id);
            }
            return newScore;
        });
    };

    // Calculate Vertical Positions (50% is center)
    // If I have higher CPS/Score, I move up relative to opponent?
    // User requested: "Who is faster moves up".
    // Let's use CPS + Score Delta to control Y position.

    // Base position = 50%
    // If My Score > Opp Score -> Move Up (Subtract %)
    // Max movement +/- 30%

    const scoreDelta = myScore - oppScore;
    const myPosOffset = Math.max(-30, Math.min(30, scoreDelta * 2));
    // If I am leading (positive delta), my Y should be smaller (higher on screen).
    // So 50 - myPosOffset.

    const myY = 50 - myPosOffset;
    const oppY = 50 + myPosOffset; // Opponent moves opposite

    const getProgress = (s: number) => Math.min((s / WIN_SCORE) * 100, 100);

    return (
        <div
            className="flex flex-col h-screen bg-black overflow-hidden select-none relative"
            style={{ touchAction: 'none' }}
        >
            {/* 1. Warp Speed Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* CSS Animation for Stars/Particles needed here. Using a simple placeholder for now */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black" />

                {/* Moving Stars Effect (Fake using CSS grid or repetitivebg) */}
                <div className="absolute inset-0 opacity-50 animate-warp-speed"
                    style={{
                        backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                        animation: `warpSpeed ${Math.max(0.1, 1 - (cps / 20))}s linear infinite`
                    }}
                />
            </div>

            <style>{`
                @keyframes warpSpeed {
                    from { transform: translateY(-40px); }
                    to { transform: translateY(0); }
                }
            `}</style>

            {/* Vignette (Intense) */}
            <div
                className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_0%,black_120%)] transition-opacity duration-100"
                style={{ opacity: 0.3 + Math.min(cps / 20, 0.6) }}
            />


            {/* 2. Side Progress Bars (Earth -> Moon) */}
            <div className="absolute left-2 top-4 bottom-4 w-6 bg-gray-800 border-2 border-white rounded-full flex flex-col-reverse p-1 z-20 overflow-hidden">
                <div
                    className="w-full bg-[#DFFF00] rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_#DFFF00]"
                    style={{ height: `${getProgress(myScore)}%` }}
                />
            </div>

            <div className="absolute right-2 top-4 bottom-4 w-6 bg-gray-800 border-2 border-white rounded-full flex flex-col-reverse p-1 z-20 overflow-hidden">
                <div
                    className="w-full bg-[#FF00FF] rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_#FF00FF]"
                    style={{ height: `${getProgress(oppScore)}%` }}
                />
            </div>


            {/* 3. Center Stage (Avatars) */}
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">

                {/* OPPONENT */}
                <div
                    className="absolute transition-all duration-300 ease-out flex flex-col items-center"
                    style={{
                        top: `${oppY}%`,
                        left: '25%', // Left lane? Or overlap? User said "Side by side"? "Start middle"
                        transform: `translate(-50%, -50%) scale(${0.8}) opacity(0.8)`
                    }}
                >
                    <div className="relative w-32 h-32 animate-bounce-slow">
                        {/* Flame */}
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-16 h-24 z-0 animate-pulse">
                            <img src={spritesFlame} className="w-full h-full object-contain rotate-180 opacity-50" />
                        </div>
                        {/* Body */}
                        <div className="absolute top-0 left-0 w-full h-full z-10">
                            <img src={spritesBody} className="w-full h-full object-contain drop-shadow-[0_0_2px_white]" />
                        </div>
                        {/* Head */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full border-2 border-white bg-gray-300 z-20 overflow-hidden">
                            <div className="w-full h-full flex items-center justify-center font-bold text-[8px] text-center">OPP</div>
                        </div>
                    </div>
                </div>

                {/* PLAYER (ME) */}
                <div
                    className="absolute transition-all duration-100 ease-linear flex flex-col items-center"
                    style={{
                        top: `${myY}%`,
                        left: '50%', // Center
                        transform: `translate(-50%, -50%) scale(${1 + (cps / 50)})` // Scale with speed
                    }}
                >
                    <div className="relative w-48 h-48">
                        {/* Flame (Huge) */}
                        <div className="absolute top-32 left-1/2 -translate-x-1/2 w-24 h-48 z-0">
                            <img
                                src={spritesFlame}
                                className="w-full h-full object-contain rotate-180 origin-top"
                                style={{ transform: `rotate(180deg) scaleY(${0.5 + Math.min(cps / 10, 1)})` }}
                            />
                        </div>

                        {/* Body */}
                        <div className="absolute top-0 left-0 w-full h-full z-10 animate-rubble">
                            <img src={spritesBody} className="w-full h-full object-contain filter drop-shadow-[0_0_4px_white]" />
                        </div>

                        {/* Head */}
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-4 border-white bg-white z-20 overflow-hidden shadow-lg">
                            <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.full_name}`} className="w-full h-full object-cover" />
                        </div>
                    </div>
                </div>

            </div>


            {/* 4. Particle Layer */}
            {particles.map(p => (
                <div
                    key={p.id}
                    className="absolute pointer-events-none z-40 text-black font-black text-2xl"
                    style={{
                        left: p.x,
                        top: p.y,
                        opacity: p.life,
                        transform: `scale(${p.life}) rotate(${p.vx * 10}deg)`,
                        textShadow: '2px 2px 0px white' // Sticker outline effect
                    }}
                >
                    {p.text}
                </div>
            ))}


            {/* 5. Tap Zone */}
            <div
                className="absolute inset-0 z-50 flex items-center justify-center"
                onPointerDown={handleTap}
            >
                {/* Countdown Overlay */}
                {countdown !== null && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md">
                        <div className="text-[10rem] font-black text-[#DFFF00] animate-ping stroke-black stroke-2" style={{ WebkitTextStroke: '4px black' }}>
                            {countdown}
                        </div>
                    </div>
                )}
            </div>

            {/* Top Timer */}
            <div className="absolute top-safe px-4 py-2 bg-black/50 backdrop-blur rounded-full border border-white/20 z-50 mt-4 mx-auto left-0 right-0 w-32 flex justify-center">
                <span className="font-mono text-xl font-bold text-white">{timer}</span>
            </div>

        </div>
    );
};
