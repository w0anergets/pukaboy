import React from 'react';


interface ShopItem {
    id: string;
    name: string;
    coins: number;
    priceStars: number;
    emoji: string;
    popular?: boolean;
}

const SHOP_ITEMS: ShopItem[] = [
    { id: 'small_pack', name: 'Горсть Монет', coins: 100, priceStars: 50, emoji: '💰' },
    { id: 'medium_pack', name: 'Мешок Монет', coins: 500, priceStars: 200, emoji: '💰💰', popular: true },
    { id: 'large_pack', name: 'Сундук Монет', coins: 1500, priceStars: 500, emoji: '💎' },
];

interface ShopViewProps {
    onBack: () => void;
    onBuy: (item: ShopItem) => void;
}

export const ShopView: React.FC<ShopViewProps> = ({ onBack, onBuy }) => {
    return (
        <div className="flex flex-col min-h-screen bg-gray-900 text-white p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={onBack}
                    className="text-2xl hover:scale-110 transition-transform"
                >
                    🔙
                </button>
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                    МАГАЗИН
                </h1>
                <div className="w-8"></div> {/* Spacer */}
            </div>

            {/* Items Grid */}
            <div className="grid gap-4">
                {SHOP_ITEMS.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => onBuy(item)}
                        className={`relative bg-gray-800 rounded-2xl p-4 border-2 ${item.popular ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'border-gray-700'} active:scale-95 transition-all flex items-center justify-between group overflow-hidden`}
                    >
                        {item.popular && (
                            <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                BEST VALUE
                            </div>
                        )}

                        <div className="flex items-center gap-4 z-10">
                            <div className="text-4xl bg-gray-900/50 p-3 rounded-xl group-hover:scale-110 transition-transform">
                                {item.emoji}
                            </div>
                            <div>
                                <div className="font-bold text-lg text-white">{item.name}</div>
                                <div className="font-mono text-yellow-400">+{item.coins} PukaCoins</div>
                            </div>
                        </div>

                        <div className="z-10">
                            <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-1">
                                <span className="text-xs">⭐️</span>
                                {item.priceStars}
                            </button>
                        </div>

                        {/* Background Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                ))}
            </div>

            <div className="mt-8 text-center text-gray-500 text-xs">
                Покупки совершаются через Telegram Stars.
                <br />
                Средства списываются с вашего баланса Telegram.
            </div>
        </div>
    );
};
