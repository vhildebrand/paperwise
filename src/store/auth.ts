// src/store/auth.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient'; // Make sure this path is correct
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>; // Also updated signIn for consistency
  signUp: (email: string, password: string, name: string) => Promise<boolean>; // Changed from Promise<void>
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user, loading: false }),
  
  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      set({ user: data.user, loading: false });
      return true; // <-- Return true on success
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return false; // <-- Return false on failure
    }
  },

  // --- MODIFIED signUp FUNCTION ---
  signUp: async (email: string, password: string, name: string) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            // Corrected to match your component's usage ('name')
            // If your Supabase table expects 'full_name', use that here.
            full_name: name, 
          },
        },
      });

      if (error) throw error;

      // Ensure a user object was returned before considering it a success
      if (data.user) {
        set({ user: data.user, loading: false });
        return true; // <-- Return true on success
      }
      
      // Handle the edge case where no error is thrown but no user is returned
      set({ loading: false });
      return false; 

    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return false; // <-- Return false on failure
    }
  },
  // --- END OF MODIFICATION ---

  signOut: async () => {
    try {
      set({ loading: true, error: null });
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
}));