import { supabase } from '../lib/supabase';

export interface GameSession {
    id: string;
    host_id: number;
    guest_id: number | null;
    status: 'LOBBY' | 'RACING' | 'FINISHED';
    host_score: number;
    guest_score: number;
    start_time: string | null;
    winner_id: number | null;
    created_at: string;
    next_game_id?: string | null; // For rematch
}

export const gameService = {
    /**
     * Create a new game session
     */
    async createGame(hostId: number): Promise<string | null> {
        const { data, error } = await supabase
            .from('game_sessions')
            .insert([
                {
                    host_id: hostId,
                    status: 'LOBBY',
                    host_score: 0,
                    guest_score: 0
                }
            ])
            .select('id')
            .single();

        if (error) {
            console.error('Error creating game:', error);
            return null;
        }
        return data.id;
    },

    /**
     * Join an existing game
     */
    async joinGame(gameId: string, guestId: number): Promise<boolean> {
        const { error } = await supabase
            .from('game_sessions')
            .update({ guest_id: guestId })
            .eq('id', gameId)
            .is('guest_id', null); // Only if empty

        if (error) {
            console.error('Error joining game:', error);
            return false;
        }
        return true;
    },

    /**
     * Fetch game info
     */
    async getGame(gameId: string): Promise<GameSession | null> {
        const { data, error } = await supabase
            .from('game_sessions')
            .select('*')
            .eq('id', gameId)
            .single();

        if (error) return null;
        return data;
    },

    /**
     * Start the game (Host only)
     */
    async startGame(gameId: string): Promise<void> {
        await supabase
            .from('game_sessions')
            .update({
                status: 'RACING',
                start_time: new Date(Date.now() + 3000).toISOString() // 3s countdown
            })
            .eq('id', gameId);
    },

    /**
     * Increment click score
     */
    async click(gameId: string, playerId: number): Promise<void> {
        // Optimistic update should happen in UI, this is just sync
        // We use RPC for atomic increments to avoid race conditions
        const { error } = await supabase
            .rpc('increment_score', {
                game_id: gameId,
                player_id: playerId,
                amount: 1
            });

        if (error) console.error('Error clicking:', error);
    },

    /**
     * Finish game
     */
    async finishGame(gameId: string, winnerId: number): Promise<void> {
        await supabase
            .from('game_sessions')
            .update({
                status: 'FINISHED',
                winner_id: winnerId
            })
            .eq('id', gameId);
    },

    /**
     * Create a Rematch (Host creates new game, links old game to it)
     */
    async createRematch(oldGameId: string, hostId: number): Promise<string | null> {
        // 1. Create new game
        const newGameId = await this.createGame(hostId);
        if (!newGameId) return null;

        // 2. Link old game to new game
        const { error } = await supabase
            .from('game_sessions')
            .update({ next_game_id: newGameId })
            .eq('id', oldGameId);

        if (error) {
            console.error("Error linking rematch:", error);
            // Non-critical, but good to know
        }

        return newGameId;
    }
};
