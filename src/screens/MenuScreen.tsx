import React from 'react';
import type { UserProfile } from '../services/userService';

interface MenuScreenProps {
    user: UserProfile | null;
    onCreateGame: () => void;
    status: string;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ user, onCreateGame, status }) => {
    return (
        <div className="flex flex-col h-screen bg-black overflow-hidden relative font-sans">
            {/* Split Background */}
            <div className="absolute inset-0 flex">
                <div className="w-1/2 bg-[#DFFF00] border-r-4 border-black box-border" />
                <div className="w-1/2 bg-[#FF00FF] border-l-4 border-black box-border" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 space-y-8">

                {/* Title */}
                <div className="text-center transform -rotate-2">
                    <h1 className="text-7xl font-black text-black leading-none drop-shadow-[4px_4px_0px_rgba(255,255,255,1)]">
                        RAGE<br />FLIGHT
                    </h1>
                </div>

                {/* User Card (Sticker Style) */}
                {user && (
                    <div className="bg-white border-4 border-black rounded-3xl p-4 flex items-center space-x-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transform rotate-1">
                        <div className="w-16 h-16 rounded-full border-2 border-black overflow-hidden bg-gray-200">
                            <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.full_name}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-black text-lg uppercase">{user.username || user.full_name}</span>
                            <span className="font-black text-yellow-600 text-xl font-mono">{user.puka_coins} COINS</span>
                        </div>
                    </div>
                )}

                {/* Main Action */}
                <button
                    onClick={onCreateGame}
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
        </div >
    );
};
