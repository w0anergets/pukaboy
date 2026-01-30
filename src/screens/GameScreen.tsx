import React, { useEffect, useState, useRef } from 'react';
import type { UserProfile } from '../services/userService';
import { gameService } from '../services/gameService';
import type { GameSession } from '../services/gameService';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import spriteBody from '../assets/sprites/sticker_body_glitch.png';
import spriteFlame from '../assets/sprites/sticker_flame_glitch.png';
import spriteCloud from '../assets/sprites/sticker_cloud.png';
import spriteTrail from '../assets/sprites/sticker_trail.png';
import { soundService } from '../services/soundService';

interface GameScreenProps {
    sessionId: string;
    user: UserProfile;
    initialSession: GameSession;
    onFinish: (session: GameSession) => void;
}

const WIN_SCORE = 150; // Increased score for longer fun

interface Particle {
    id: number;
    type: 'text' | 'cloud' | 'spark';
    text?: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    scale: number;
    life: number;
    rotation: number;
    vRot: number;
}

export const GameScreen: React.FC<GameScreenProps> = ({ sessionId, user, initialSession, onFinish }) => {
    // State
    const [session, setSession] = useState<GameSession>(initialSession);
    const [myScore, setMyScore] = useState(0);
    const [oppScore, setOppScore] = useState(0);

    const [countdown, setCountdown] = useState<number | null>(null);
    const [timer, setTimer] = useState("0.00");

    // Juice State
    const [particles, setParticles] = useState<Particle[]>([]);
    const [shake, setShake] = useState(0);
    const [cps, setCps] = useState(0);
    const clicksRef = useRef<number[]>([]);
    const bgOffset = useRef(0);

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

    // Game Loop (Animation & Logic)
    useEffect(() => {
        let frameId: number;
        let lastTime = Date.now();

        const loop = () => {
            const now = Date.now();
            const dt = (now - lastTime) / 16.66; // Normalize to 60fps
            lastTime = now;

            // Update CPS
            clicksRef.current = clicksRef.current.filter(t => now - t < 1000);
            setCps(clicksRef.current.length);

            // Update Background Scroll (Warp Speed)
            bgOffset.current += (10 + (cps * 2)) * dt;

            // Update Shake
            if (shake > 0) setShake(prev => Math.max(0, prev - 1 * dt));

            // Update Particles
            setParticles(prev => prev.map(p => ({
                ...p,
                x: p.x + p.vx * dt,
                y: p.y + p.vy * dt,
                rotation: p.rotation + p.vRot * dt,
                life: p.life - (p.type === 'cloud' ? 0.02 : 0.03) * dt,
                scale: p.type === 'cloud' ? p.scale + 0.01 * dt : p.scale
            })).filter(p => p.life > 0));

            frameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(frameId);
    }, [cps, shake]);


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
                        soundService.playStart();
                        WebApp.HapticFeedback.notificationOccurred('success');
                        setShake(20); // Big shake on start
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

    // 3. Realtime Sync
    useEffect(() => {
        const channel = supabase
            .channel(`game_${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
                (payload) => {
                    const newSess = payload.new as GameSession;
                    setSession(newSess);
                    const sOppScore = amIHost ? newSess.guest_score : newSess.host_score;
                    setOppScore(sOppScore);
                    const sMyScore = amIHost ? newSess.host_score : newSess.guest_score;
                    if (sMyScore > myScoreRef.current) setMyScore(sMyScore);

                    if (newSess.status === 'FINISHED' && !isFinishedRef.current) {
                        isFinishedRef.current = true;
                        soundService.playWin();
                        onFinish(newSess);
                    }
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [sessionId, amIHost, onFinish]);

    // 4. Interaction
    const handleTap = (e: React.PointerEvent) => {
        if (countdown !== null) return;
        if (!e.isPrimary) return;

        clicksRef.current.push(Date.now());
        setShake(5);

        // Spawn Particles
        // 1. Text
        const words = ['PUK!', 'TAP!', 'BOY!', 'GOGO!', '🔥'];
        setParticles(prev => [
            ...prev,
            {
                id: Math.random(),
                type: 'text',
                text: words[Math.floor(Math.random() * words.length)],
                x: e.clientX,
                y: e.clientY,
                vx: (Math.random() - 0.5) * 5,
                vy: -5 - Math.random() * 5,
                scale: 1,
                life: 1.0,
                rotation: (Math.random() - 0.5) * 30,
                vRot: (Math.random() - 0.5) * 10
            },
            // 2. Cloud Smoke at bottom
            {
                id: Math.random(),
                type: 'cloud',
                x: window.innerWidth / 2 + (Math.random() - 0.5) * 100,
                y: window.innerHeight + 50,
                vx: (Math.random() - 0.5) * 2,
                vy: -10 - Math.random() * 10, // Fast up
                scale: 0.5 + Math.random(),
                life: 1.0,
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 5
            }
        ]);

        setMyScore(prev => {
            if (prev >= WIN_SCORE) return prev;
            const newScore = prev + 1;
            WebApp.HapticFeedback.impactOccurred('medium');
            soundService.playTap();
            gameService.click(sessionId, user.id);
            if (newScore >= WIN_SCORE) gameService.finishGame(sessionId, user.id);
            return newScore;
        });
    };

    // Render Helpers
    const getProgress = (s: number) => Math.min((s / WIN_SCORE) * 100, 100);
    const scoreDelta = myScore - oppScore;
    // Dynamic Positioning: 50% base. Max delta moves +/- 30%. CPS adds jitter.
    const myY = 50 - Math.max(-30, Math.min(30, scoreDelta * 1.5)) - (cps > 5 ? 1 : 0);
    const oppY = 50 + Math.max(-30, Math.min(30, scoreDelta * 1.5));

    // Intro/Outro Transforms
    const isWinner = isFinishedRef.current && myScore >= WIN_SCORE;
    const isLoser = isFinishedRef.current && oppScore >= WIN_SCORE;

    const shakeStyle = { transform: `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)` };

    return (
        <div
            className="flex flex-col h-screen bg-[#111] overflow-hidden select-none relative"
            style={{ touchAction: 'none' }}
        >
            {/* --- LAYERS --- */}

            {/* 1. WARP SPEED BACKGROUND */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Gradient Base */}
                <div className="absolute inset-0 bg-gradient-to-b from-purple-900 via-black to-blue-900" />

                {/* Moving Grid/Stars */}
                <div
                    className="absolute inset-x-0 -top-[100%] h-[300%] opacity-40"
                    style={{
                        backgroundImage: `repeating-linear-gradient(transparent 0, transparent 49px, rgba(255,255,255,0.1) 50px),
                                          repeating-linear-gradient(90deg, transparent 0, transparent 49px, rgba(255,255,255,0.1) 50px)`,
                        backgroundSize: '100% 100px',
                        transform: `translateY(${bgOffset.current % 100}px) perspective(500px) rotateX(20deg)`
                    }}
                />

                {/* Speed Lines Overlay */}
                <div
                    className="absolute inset-0 opacity-20 mix-blend-overlay"
                    style={{
                        backgroundImage: `repeating-radial-gradient(circle at 50% 50%, white, transparent 2px, transparent 100px)`,
                        transform: `scale(${1 + (cps / 10)}) translateZ(0)`
                    }}
                />
            </div>

            {/* 2. SIDE PROGRESS BARS (Arrows) */}
            {/* Left Box (My Progress) */}
            <div className="absolute left-4 top-4 bottom-4 w-8 z-20 flex flex-col items-center">
                <div className="flex-1 w-full bg-gray-800/80 border-2 border-white rounded-t-full rounded-b-lg relative overflow-hidden">
                    {/* The Arrow Shape Mask or just Fill */}
                    <div
                        className="absolute bottom-0 w-full bg-[#DFFF00] transition-all duration-100 ease-linear shadow-[0_0_15px_#DFFF00]"
                        style={{ height: `${getProgress(myScore)}%` }}
                    />
                    {/* Checkered pattern over bar */}
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/checkerboard-cross.png')] mix-blend-multiply" />
                </div>
                {/* Avatar Icon at bottom */}
                <div className="w-10 h-10 -mt-4 rounded-full border-2 border-white bg-white z-30">
                    <img src={user.avatar_url || ''} className="w-full h-full object-cover rounded-full" />
                </div>
            </div>

            {/* Right Box (Opponent Progress) */}
            <div className="absolute right-4 top-4 bottom-4 w-8 z-20 flex flex-col items-center">
                <div className="flex-1 w-full bg-gray-800/80 border-2 border-white rounded-t-full rounded-b-lg relative overflow-hidden">
                    <div
                        className="absolute bottom-0 w-full bg-[#FF00FF] transition-all duration-100 ease-linear shadow-[0_0_15px_#FF00FF]"
                        style={{ height: `${getProgress(oppScore)}%` }}
                    />
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/checkerboard-cross.png')] mix-blend-multiply" />
                </div>
                <div className="w-10 h-10 -mt-4 rounded-full border-2 border-white bg-gray-300 z-30 flex items-center justify-center font-bold text-xs text-black">
                    OPP
                </div>
            </div>


            {/* 3. CENTER STAGE (Avatars) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={shakeStyle}>

                {/* OPPONENT */}
                <div
                    className="absolute transition-all duration-300 ease-out flex flex-col items-center"
                    style={{
                        top: `${oppY}%`,
                        left: '30%',
                        zIndex: oppScore > myScore ? 30 : 10,
                        transform: `scale(${0.9}) translate(-50%, -50%) ${isLoser ? 'rotate(90deg) translate(500px, 0)' : ''}`
                    }}
                >
                    <div className="relative w-40 h-40">
                        {/* BLEND MODE IMAGE: Screen mode removes black bg, keeps colors */}
                        <img
                            src={spriteBody}
                            className="w-full h-full object-contain mix-blend-screen drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] grayscale opacity-80"
                        />
                        {/* Opponent Identity */}
                        <div className="absolute top-[10%] left-[35%] w-[30%] h-[30%] rounded-full overflow-hidden opacity-50">
                            <div className="w-full h-full bg-black text-white flex items-center justify-center text-[10px] font-bold">OPP</div>
                        </div>
                    </div>
                </div>

                {/* MY PLAYER */}
                <div
                    className="absolute transition-all duration-100 ease-linear flex flex-col items-center"
                    style={{
                        top: isWinner ? '-20%' : `${myY}%`,
                        left: '50%',
                        zIndex: 20,
                        transform: `translate(-50%, -50%) scale(${1 + cps / 40}) rotate(${cps / 2}deg)`,
                        transition: isWinner ? 'top 1s ease-in' : 'all 0.1s linear'
                    }}
                >
                    <div className="relative w-64 h-64">
                        {/* Trail */}
                        <div className="absolute top-[80%] left-1/2 -translate-x-1/2 w-20 h-[200px] origin-top opacity-80 mix-blend-screen animate-pulse">
                            <img src={spriteTrail} className="w-full h-full object-cover opacity-60" />
                        </div>

                        {/* Flame */}
                        <div className="absolute top-[60%] left-1/2 -translate-x-1/2 w-32 h-48 mix-blend-screen origin-top transform -translate-y-4">
                            <img
                                src={spriteFlame}
                                className="w-full h-full object-contain"
                                style={{ transform: `scaleY(${0.5 + Math.min(cps / 15, 1.5)})` }}
                            />
                        </div>

                        {/* Body (Sticker) */}
                        <div className="relative w-full h-full mix-blend-screen filter brightness-110 contrast-125">
                            <img src={spriteBody} className="w-full h-full object-contain drop-shadow-[0_0_5px_cyan]" />

                            {/* Face Overlay (Positioned roughly over the helmet area in sprite) */}
                            <div className="absolute top-[22%] left-[45%] w-[22%] h-[22%] rounded-full overflow-hidden border-2 border-black bg-white z-10 transform -rotate-12">
                                <img src={user.avatar_url || ''} className="w-full h-full object-cover" />
                            </div>
                        </div>
                    </div>
                </div>

            </div>


            {/* 4. PARTICLE SYSTEM */}
            {particles.map(p => {
                if (p.type === 'cloud') {
                    return (
                        <div key={p.id}
                            className="absolute pointer-events-none mix-blend-screen opacity-50"
                            style={{
                                left: p.x, top: p.y,
                                transform: `translate(-50%, -50%) scale(${p.scale}) rotate(${p.rotation}deg)`,
                                opacity: p.life
                            }}
                        >
                            <img src={spriteCloud} className="w-24 h-24 object-contain" />
                        </div>
                    )
                }
                return (
                    <div
                        key={p.id}
                        className="absolute pointer-events-none z-50 font-black text-4xl text-[#DFFF00]"
                        style={{
                            left: p.x, top: p.y,
                            transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.life})`,
                            opacity: p.life,
                            textShadow: '3px 3px 0px black, -1px -1px 0 black'
                        }}
                    >
                        {p.text}
                    </div>
                )
            })}


            {/* 5. TAP LAYER */}
            <div
                className="absolute inset-0 z-50 flex items-center justify-center cursor-pointer"
                onPointerDown={handleTap}
            >
                {/* Countdown */}
                {countdown !== null && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm">
                        <div className="text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-red-600 animate-ping" style={{ WebkitTextStroke: '6px white' }}>
                            {countdown}
                        </div>
                    </div>
                )}
            </div>

            {/* Timer Tab */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50">
                <div className="bg-black/50 border-2 border-white/50 px-6 py-1 rounded-full backdrop-blur">
                    <span className="font-mono text-white text-xl font-bold tracking-widest">{timer}</span>
                </div>
            </div>

        </div>
    );
};
