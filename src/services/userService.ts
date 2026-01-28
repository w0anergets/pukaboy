import { supabase } from '../lib/supabase';

export interface UserProfile {
    id: number;
    username: string | null;
    full_name: string | null;
    puka_coins: number;
    is_premium: boolean;
}

export const userService = {
    /**
     * Get user profile or create if not exists
     */
    async getOrCreateUser(telegramUser: { id: number; username?: string; first_name: string; last_name?: string }): Promise<UserProfile | null> {
        const { data: existingUser, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', telegramUser.id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "Row not found"
            console.error('Error fetching user:', fetchError);
            return null;
        }

        if (existingUser) {
            return existingUser;
        }

        // Create new user
        const newUser = {
            id: telegramUser.id,
            username: telegramUser.username || null,
            full_name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
            puka_coins: 100, // Welcome bonus
            is_premium: false
        };

        const { data: createdUser, error: insertError } = await supabase
            .from('profiles')
            .insert([newUser])
            .select()
            .single();

        if (insertError) {
            console.error('Error creating user:', insertError);
            return null;
        }

        return createdUser;
    },

    /**
     * Update user coins balance
     */
    async updateBalance(userId: number, amount: number): Promise<number | null> {
        // 1. Get current balance
        const { data: user, error: fetchError } = await supabase
            .from('profiles')
            .select('puka_coins')
            .eq('id', userId)
            .single();

        if (fetchError || !user) return null;

        const newBalance = user.puka_coins + amount;

        // 2. Update
        const { data: updatedUser, error: updateError } = await supabase
            .from('profiles')
            .update({ puka_coins: newBalance })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) return null;

        return updatedUser.puka_coins;
    }
};
