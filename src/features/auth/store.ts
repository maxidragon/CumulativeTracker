import { create } from "zustand";
import { clearAuthSession, loadAuthState, type AuthSession } from "./model";

type AuthStore = {
  session: AuthSession | null;
  error: string | null;
  dismissError: () => void;
  expireSession: () => void;
  setError: (message: string) => void;
  signOut: () => void;
};

const initial = loadAuthState();

export const useAuthStore = create<AuthStore>((set) => ({
  session: initial.session,
  error: initial.error,
  dismissError: () => set({ error: null }),
  expireSession: () => {
    clearAuthSession();
    set({
      session: null,
      error: "Your WCA sign-in expired. Please sign in again.",
    });
  },
  setError: (error) => set({ error }),
  signOut: () => {
    clearAuthSession();
    set({ session: null, error: null });
  },
}));
