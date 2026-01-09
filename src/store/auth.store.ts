import { create } from "zustand";
import { User } from "firebase/auth";

type AuthState = {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  loading: true,
  setCurrentUser: (user) => set({ currentUser: user }),
  setLoading: (loading) => set({ loading }),
}));