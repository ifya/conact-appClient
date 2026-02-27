import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { api } from '../services/api';

export interface DMUser {
  id: string;
  matrixUserId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface DMThread {
  id: string;
  matrixRoomId: string;
  createdAt: string;
  otherUser: DMUser | null;
  isNew?: boolean;
}

interface DMState {
  threads: DMThread[];
  activeThreadId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchThreads: () => Promise<void>;
  createOrGetThread: (targetUserId: string) => Promise<DMThread>;
  setActiveThread: (threadId: string | null) => void;
  clearError: () => void;
}

export const useDMStore = create<DMState>()(
  immer((set) => ({
    threads: [],
    activeThreadId: null,
    isLoading: false,
    error: null,

    fetchThreads: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const threads = await api.getDMThreads();
        set((state) => {
          state.threads = threads;
          state.isLoading = false;
        });
      } catch (error: any) {
        set((state) => {
          state.error = error.response?.data?.error?.message || 'Failed to load DM threads';
          state.isLoading = false;
        });
      }
    },

    createOrGetThread: async (targetUserId: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const thread = await api.createOrGetDMThread(targetUserId);
        set((state) => {
          // Add to threads if new
          if (thread.isNew) {
            state.threads.unshift(thread);
          } else {
            // Move to top if existing
            const index = state.threads.findIndex((t) => t.id === thread.id);
            if (index > 0) {
              state.threads.splice(index, 1);
              state.threads.unshift(thread);
            } else if (index === -1) {
              state.threads.unshift(thread);
            }
          }
          state.activeThreadId = thread.id;
          state.isLoading = false;
        });
        return thread;
      } catch (error: any) {
        const message = error.response?.data?.error?.message || 'Failed to create DM thread';
        set((state) => {
          state.error = message;
          state.isLoading = false;
        });
        throw new Error(message);
      }
    },

    setActiveThread: (threadId: string | null) => {
      set((state) => {
        state.activeThreadId = threadId;
      });
    },

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },
  }))
);
