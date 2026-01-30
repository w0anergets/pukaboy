import { soundService } from '../services/soundService';

// ... (imports)

// Speed Lines SVG Data (Radial lines)
const SPEED_LINES_BG = `url('data:image/svg+xml;utf8,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%"><stop offset="0%" style="stop-color:white;stop-opacity:0" /><stop offset="100%" style="stop-color:white;stop-opacity:1" /></radialGradient></defs><path d="M50 50 L0 0 M50 50 L100 0 M50 50 L100 100 M50 50 L0 100" stroke="url(%23grad)" stroke-width="2" opacity="0.5"/></svg>')`;

export const GameScreen: React.FC<GameScreenProps> = ({ sessionId, user, initialSession, onFinish }) => {
    // ... (existing state)

    // Juice State
    const [shake, setShake] = useState(0);
    const [cps, setCps] = useState(0);
    const clicksRef = useRef<number[]>([]);

    // Audio Init
    useEffect(() => {
        soundService.init();
        soundService.playStart();
    }, []);

    // CPS Tracker
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            // Keep clicks from last 1s
            clicksRef.current = clicksRef.current.filter(t => now - t < 1000);
            setCps(clicksRef.current.length);
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // ... (existing effects)

    // Finish Sound
    useEffect(() => {
        if (session.status === 'FINISHED') {
            soundService.playWin();
        }
    }, [session.status]);


    const handleTap = () => {
        if (countdown !== null) return;

        // Track Click for CPS
        clicksRef.current.push(Date.now());

        // Shake Effect
        setShake(prev => 5); // Set shake intensity
        setTimeout(() => setShake(0), 50);

        setMyScore(prev => {
            if (prev >= WIN_SCORE) return prev;
            const newScore = prev + 1;

            WebApp.HapticFeedback.impactOccurred('medium');
            soundService.playTap();

            gameService.click(sessionId, user.id);
            if (newScore >= WIN_SCORE) {
                gameService.finishGame(sessionId, user.id);
            }
            return newScore;
        });
    };

    // Juice Styles
    const shakeStyle = shake ? { transform: `translate(${Math.random() * shake - shake / 2}px, ${Math.random() * shake - shake / 2}px)` } : {};
    const vignetteOpacity = Math.min(cps / 15, 0.8); // Max opacity at 15 CPS
    const speedLinesOpacity = Math.min(cps / 20, 0.6);

    const getStickerStyle = (id: number, type: 'body' | 'engine') => {
        // ... (existing sticker logic)
        const index = id % 4;
        const x = (index % 2) * 100;
        const y = Math.floor(index / 2) * 100;
        return {
            backgroundImage: `url(${type === 'body' ? spritesBodies : spritesEngines})`,
            backgroundPosition: `${x}% ${y}%`,
            backgroundSize: '200% 200%',
            width: '100%',
            height: '100%'
        };
    };

    const getProgress = (s: number) => Math.min((s / WIN_SCORE) * 100, 100);

    return (
        <div
            className="flex flex-col h-screen bg-black overflow-hidden select-none relative"
            style={{ touchAction: 'none' }}
        >
            {/* Base Layer: Split Background (Shake applied here) */}
            <div className="absolute inset-0 flex" style={shakeStyle}>
                <div className="w-1/2 bg-[#DFFF00] border-r-4 border-black box-border relative">
                    <div className="absolute right-0 top-0 bottom-0 w-8 h-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAkSURBVHgB7YwxDQAADEPRu/w7Ww0O4O4yF6aGg6aKu4O1/0yQARt5Ck7CAAAAAElFTkSuQmCC')] opacity-20" />
                </div>
                <div className="w-1/2 bg-[#FF00FF] border-l-4 border-black box-border relative">
                    <div className="absolute left-0 top-0 bottom-0 w-8 h-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAkSURBVHgB7YwxDQAADEPRu/w7Ww0O4O4yF6aGg6aKu4O1/0yQARt5Ck7CAAAAAElFTkSuQmCC')] opacity-20" />
                </div>
            </div>

            {/* Elements Layer (Avatars) */}
            <div className="relative z-10 flex flex-col h-full pointer-events-none" style={shakeStyle}>

                {/* Goal Area (No Text) */}
                <div className="h-24" />

                {/* TRACKS */}
                <div className="flex-1 flex w-full relative">
                    {/* PLAYER 1 (ME) */}
                    <div className="w-1/2 relative h-full">
                        <div
                            className="absolute left-1/2 -translate-x-1/2 w-32 transition-all duration-75 ease-linear flex flex-col items-center"
                            style={{ bottom: `${getProgress(myScore)}%`, marginBottom: '-60px' }}
                        >
                            <div className={`relative w-32 h-32 ${cps > 5 ? 'animate-bounce' : ''}`}>
                                <div className="absolute top-16 left-1/2 -translate-x-1/2 w-16 h-16 z-0"><div style={getStickerStyle(user.id, 'engine')} /></div>
                                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-20 h-20 z-10"><div style={getStickerStyle(user.id, 'body')} /></div>
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white border-2 border-black overflow-hidden z-20">
                                    <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.full_name}`} className="w-full h-full object-cover" />
                                </div>
                                {/* Exhaust Spark */}
                                {cps > 8 && <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-4xl animate-ping">💥</div>}
                            </div>
                        </div>
                        <div className="absolute left-2 bottom-4 top-4 w-4 bg-black/20 rounded-full flex flex-col-reverse p-1 overflow-hidden">
                            <div className="w-full bg-black rounded-full transition-all duration-75" style={{ height: `${getProgress(myScore)}%` }} />
                        </div>
                    </div>

                    {/* PLAYER 2 (OPPONENT) */}
                    <div className="w-1/2 relative h-full">
                        <div
                            className="absolute left-1/2 -translate-x-1/2 w-32 transition-all duration-100 ease-linear flex flex-col items-center"
                            style={{ bottom: `${getProgress(oppScore)}%`, marginBottom: '-60px' }}
                        >
                            <div className="relative w-32 h-32">
                                <div className="absolute top-16 left-1/2 -translate-x-1/2 w-16 h-16 z-0"><div style={getStickerStyle(session.guest_id || 999, 'engine')} /></div>
                                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-20 h-20 z-10"><div style={getStickerStyle(session.guest_id || 999, 'body')} /></div>
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white border-2 border-black overflow-hidden z-20">
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center font-bold text-black text-xs">OPP</div>
                                </div>
                            </div>
                        </div>
                        <div className="absolute right-2 bottom-4 top-4 w-4 bg-black/20 rounded-full flex flex-col-reverse p-1 overflow-hidden">
                            <div className="w-full bg-black rounded-full transition-all duration-75" style={{ height: `${getProgress(oppScore)}%` }} />
                        </div>
                    </div>
                </div>

                {/* Start Area (No Text) */}
                <div className="h-24" />
            </div>

            {/* SPEED FX LAYERS */}
            {/* Speed Lines */}
            <div
                className="absolute inset-0 pointer-events-none z-20 bg-no-repeat bg-center bg-cover mix-blend-overlay transition-opacity duration-200"
                style={{
                    backgroundImage: `repeating-radial-gradient(circle at center, transparent 0, transparent 10px, rgba(255,255,255,0.2) 11px, transparent 12px)`,
                    opacity: speedLinesOpacity,
                    transform: 'scale(2)'
                }}
            />
            {/* Vignette */}
            <div
                className="absolute inset-0 pointer-events-none z-20 bg-[radial-gradient(circle_at_center,transparent_30%,black_100%)] transition-opacity duration-200"
                style={{ opacity: vignetteOpacity }}
            />


            {/* Tap Zone */}
            <div
                className="absolute inset-0 z-30 flex items-center justify-center"
                onPointerDown={handleTap}
            >
                {/* Initial Countdown */}
                {countdown !== null && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 backdrop-blur-sm">
                        <div className="text-9xl font-black text-yellow-400 animate-ping">
                            {countdown}
                        </div>
                    </div>
                )}
            </div>

            {/* Timer */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40">
                <div className="bg-black text-white font-mono text-xl px-4 py-1 rounded border-2 border-white">
                    {timer}s
                </div>
            </div>
        </div>
    );
};
