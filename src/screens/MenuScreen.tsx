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
                        PUKA<br />BOY
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
                    disabled={status !== 'Ready'}
                    className="w-full max-w-xs bg-white border-4 border-black rounded-2xl py-6 relative active:scale-95 transition-transform group shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                >
                    <span className="text-4xl font-black text-black uppercase tracking-tighter">
                        START RAGE
                    </span>
                    {/* Decorative Stars */}
                    <div className="absolute -top-4 -right-4 text-4xl animate-bounce">💥</div>
                </button>

                {/* Shop / Secondary */}
                <button className="w-full max-w-xs bg-black border-4 border-white rounded-2xl py-4 active:scale-95 transition-transform shadow-[4px_4px_0px_0px_rgba(255,255,255,0.5)]">
                    <span className="text-2xl font-bold text-white uppercase">SHOP</span>
                </button>

                {/* Status Footer */}
                <div className="absolute bottom-6 font-mono font-bold text-xs bg-black text-white px-2 py-1">
                    STATUS: {status}
                </div>
            </div>
        </div>
    );
};
