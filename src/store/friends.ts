import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { api } from '../services/api';

export interface Friend {
  id: string;
  matrixUserId: string;
  displayName: string;
  avatarUrl?: string;
  status?: string;
}

// Incoming request: has 'user' (the requester)
export interface IncomingFriendRequest {
  id: string;
  user: Friend;
  createdAt: string;
}

// Outgoing request: has 'user' (the addressee)
export interface OutgoingFriendRequest {
  id: string;
  user: Friend;
  createdAt: string;
}

// Friends list item from API
export interface FriendListItem {
  friendshipId: string;
  user: Friend;
  since: string;
}

interface FriendsState {
  friends: FriendListItem[];
  incomingRequests: IncomingFriendRequest[];
  outgoingRequests: OutgoingFriendRequest[];
  isLoading: boolean;
  error: string | null;
  pollingInterval: ReturnType<typeof setInterval> | null;

  // Actions
  fetchFriends: () => Promise<void>;
  fetchRequests: () => Promise<void>;
  sendFriendRequest: (targetUserId: string) => Promise<void>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (targetUserId: string) => Promise<void>;
  clearError: () => void;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useFriendsStore = create<FriendsState>()(
  immer((set, get) => ({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    isLoading: false,
    error: null,
    pollingInterval: null,

    fetchFriends: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const friends = await api.getFriends();
        set((state) => {
          state.friends = friends;
          state.isLoading = false;
        });
      } catch (error: any) {
        set((state) => {
          state.error = error.response?.data?.error?.message || 'Failed to load friends';
          state.isLoading = false;
        });
      }
    },

    fetchRequests: async () => {
      try {
        const [incoming, outgoing] = await Promise.all([
          api.getFriendRequests(),
          api.getPendingRequests(),
        ]);
        set((state) => {
          state.incomingRequests = incoming;
          state.outgoingRequests = outgoing;
        });
      } catch (error: any) {
        set((state) => {
          state.error = error.response?.data?.error?.message || 'Failed to load requests';
        });
      }
    },

    sendFriendRequest: async (targetUserId: string) => {
      try {
        const result = await api.sendFriendRequest(targetUserId);
        // Refetch to get proper formatted data
        await get().fetchRequests();
        return result;
      } catch (error: any) {
        const message = error.response?.data?.error?.message || 'Failed to send friend request';
        set((state) => {
          state.error = message;
        });
        throw new Error(message);
      }
    },

    acceptRequest: async (friendshipId: string) => {
      try {
        await api.acceptFriendRequest(friendshipId);
        // Refetch both friends and requests to get proper data
        await Promise.all([get().fetchFriends(), get().fetchRequests()]);
      } catch (error: any) {
        const message = error.response?.data?.error?.message || 'Failed to accept request';
        set((state) => {
          state.error = message;
        });
        throw new Error(message);
      }
    },

    declineRequest: async (friendshipId: string) => {
      try {
        await api.declineFriendRequest(friendshipId);
        set((state) => {
          state.incomingRequests = state.incomingRequests.filter(
            (r) => r.id !== friendshipId
          );
        });
      } catch (error: any) {
        const message = error.response?.data?.error?.message || 'Failed to decline request';
        set((state) => {
          state.error = message;
        });
        throw new Error(message);
      }
    },

    removeFriend: async (targetUserId: string) => {
      try {
        await api.removeFriend(targetUserId);
        set((state) => {
          state.friends = state.friends.filter((f) => f.user.id !== targetUserId);
        });
      } catch (error: any) {
        const message = error.response?.data?.error?.message || 'Failed to remove friend';
        set((state) => {
          state.error = message;
        });
        throw new Error(message);
      }
    },

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },

    startPolling: () => {
      const { pollingInterval } = get();
      if (pollingInterval) return; // Already polling

      // Fetch immediately
      get().fetchRequests();
      get().fetchFriends();

      // Then poll every 5 seconds
      const interval = setInterval(() => {
        get().fetchRequests();
        get().fetchFriends();
      }, 5000);

      set((state) => {
        state.pollingInterval = interval;
      });
    },

    stopPolling: () => {
      const { pollingInterval } = get();
      if (pollingInterval) {
        clearInterval(pollingInterval);
        set((state) => {
          state.pollingInterval = null;
        });
      }
    },
  }))
);
