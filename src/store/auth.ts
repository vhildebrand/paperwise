// src/store/auth.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient'; // Make sure this path is correct
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>; // Also updated signIn for consistency
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; needsVerification?: boolean }>; // Updated return type
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  isEmailVerified: () => boolean; // New helper function
  resendVerificationEmail: (email: string) => Promise<boolean>; // New function to resend verification
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user, loading: false }),
  
  // Helper function to check if user's email is verified
  isEmailVerified: () => {
    const { user } = get();
    return user?.email_confirmed_at !== null;
  },
  
  // Function to resend verification email
  resendVerificationEmail: async (email: string) => {
    try {
      set({ loading: true, error: null });
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      set({ loading: false });
      return true;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return false;
    }
  },
  
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

      // Check if user was created but needs email verification
      if (data.user && !data.user.email_confirmed_at) {
        set({ user: data.user, loading: false });
        return { success: true, needsVerification: true };
      }
      
      // User is fully verified
      if (data.user) {
        set({ user: data.user, loading: false });
        return { success: true, needsVerification: false };
      }
      
      // Handle the edge case where no error is thrown but no user is returned
      set({ loading: false });
      return { success: false }; 

    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return { success: false }; // <-- Return false on failure
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