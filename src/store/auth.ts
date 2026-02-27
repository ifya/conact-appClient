import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface User {
  id: string;
  matrixUserId: string;
  displayName: string;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  matrixAccessToken: string | null;
  matrixDeviceId: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (user: User, token: string, matrixAccessToken: string, matrixDeviceId: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set) => ({
      user: null,
      token: null,
      matrixAccessToken: null,
      matrixDeviceId: null,
      isAuthenticated: false,

      login: (user, token, matrixAccessToken, matrixDeviceId) => {
        set((state) => {
          state.user = user;
          state.token = token;
          state.matrixAccessToken = matrixAccessToken;
          state.matrixDeviceId = matrixDeviceId;
          state.isAuthenticated = true;
        });
      },

      logout: () => {
        set((state) => {
          state.user = null;
          state.token = null;
          state.matrixAccessToken = null;
          state.matrixDeviceId = null;
          state.isAuthenticated = false;
        });
      },

      updateUser: (updates) => {
        set((state) => {
          if (state.user) {
            Object.assign(state.user, updates);
          }
        });
      },
    })),
    {
      name: 'conact-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        matrixAccessToken: state.matrixAccessToken,
        matrixDeviceId: state.matrixDeviceId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
