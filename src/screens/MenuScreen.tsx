import React from 'react';
import { UserProfile } from '../services/userService';

interface MenuScreenProps {
    user: UserProfile | null;
    onCreateGame: () => void;
    status: string;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ user, onCreateGame, status }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6 relative overflow-hidden">

            {/* Background Ambience */}
            <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-900 to-gray-900 animate-pulse-slow pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none" />

            {/* Header / Brand */}
            <div className="z-10 flex flex-col items-center mb-12">
                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] transform -skew-x-6 tracking-tighter">
                    PUKABOY
                </h1>
                <div className="text-xs tracking-[0.8em] text-cyan-500 font-bold mt-2 uppercase">Cyber Clicker</div>
                <div className="text-[10px] text-gray-600 font-mono mt-1">v1.0 (Reborn)</div>
            </div>

            {/* User Info Card */}
            <div className="z-10 w-full max-w-sm mb-8">
                <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl border border-gray-700/50 p-4 flex items-center justify-between shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 p-[2px]">
                            <div className="w-full h-full rounded-full bg-gray-900 overflow-hidden">
                                {user?.avatar_url ? (
                                    <img src={user.avatar_url} alt="Av" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="font-bold text-sm text-gray-200">{user?.full_name || 'Ghost'}</div>
                            <div className="text-xs text-blue-400">Online</div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="text-xs text-gray-500 uppercase font-mono tracking-widest">Balance</div>
                        <div className="flex items-center gap-1">
                            <span className="text-xl">🍌</span>
                            <span className="text-xl font-mono font-bold text-yellow-400 drop-shadow-sm">{user?.puka_coins || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="z-10 w-full max-w-sm flex flex-col gap-4">
                <button
                    onClick={onCreateGame}
                    className="group relative w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-lg py-5 rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                    disabled={!user}
                >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none transform skew-x-12" />
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl group-hover:rotate-12 transition-transform">⚔️</span>
                        <span>CREATE DUEL</span>
                    </div>
                </button>

                <button
                    className="w-full bg-gray-800/80 hover:bg-gray-700/80 text-yellow-500 font-bold py-4 rounded-xl border border-yellow-500/10 backdrop-blur-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <span className="text-xl">🛒</span>
                    <span>SHOP</span>
                </button>

                {/* Status Line */}
                <div className="h-6 flex items-center justify-center">
                    {status && (
                        <div className="text-xs font-mono text-cyan-400 animate-pulse">
                            [{status.toUpperCase()}]
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
