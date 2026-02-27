import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'stage' | 'announcement' | 'category';
  topic?: string;
  position: number;
  matrixRoomId: string;
  parentCategoryId?: string;
  isNsfw?: boolean;
}

export interface Role {
  id: string;
  name: string;
  color?: string;
  rank: number;
  permissions: Record<string, boolean>;
  isDefault?: boolean;
}

export interface Guild {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  bannerUrl?: string;
  visibility: 'public' | 'private' | 'unlisted';
  matrixSpaceRoomId: string;
  channels: Channel[];
  roles: Role[];
  memberRole?: Role;
}

interface GuildsState {
  guilds: Guild[];
  currentGuildId: string | null;
  currentChannelId: string | null;

  // Computed
  currentGuild: Guild | null;
  currentChannel: Channel | null;

  // Actions
  setGuilds: (guilds: Guild[]) => void;
  addGuild: (guild: Guild) => void;
  updateGuild: (guildId: string, updates: Partial<Guild>) => void;
  removeGuild: (guildId: string) => void;
  setCurrentGuild: (guildId: string | null) => void;
  setCurrentChannel: (channelId: string | null) => void;
  addChannel: (guildId: string, channel: Channel) => void;
  updateChannel: (guildId: string, channelId: string, updates: Partial<Channel>) => void;
  removeChannel: (guildId: string, channelId: string) => void;
}

export const useGuildsStore = create<GuildsState>()(
  immer((set, get) => ({
    guilds: [],
    currentGuildId: null,
    currentChannelId: null,

    get currentGuild() {
      const state = get();
      return state.guilds.find((g) => g.id === state.currentGuildId) || null;
    },

    get currentChannel() {
      const state = get();
      const guild = state.guilds.find((g) => g.id === state.currentGuildId);
      return guild?.channels.find((c) => c.id === state.currentChannelId) || null;
    },

    setGuilds: (guilds) => {
      set((state) => {
        state.guilds = guilds;
      });
    },

    addGuild: (guild) => {
      set((state) => {
        state.guilds.push(guild);
      });
    },

    updateGuild: (guildId, updates) => {
      set((state) => {
        const guild = state.guilds.find((g) => g.id === guildId);
        if (guild) {
          Object.assign(guild, updates);
        }
      });
    },

    removeGuild: (guildId) => {
      set((state) => {
        state.guilds = state.guilds.filter((g) => g.id !== guildId);
        if (state.currentGuildId === guildId) {
          state.currentGuildId = null;
          state.currentChannelId = null;
        }
      });
    },

    setCurrentGuild: (guildId) => {
      set((state) => {
        state.currentGuildId = guildId;
        // Auto-select first text channel
        if (guildId) {
          const guild = state.guilds.find((g) => g.id === guildId);
          const firstTextChannel = guild?.channels.find((c) => c.type === 'text');
          state.currentChannelId = firstTextChannel?.id || null;
        } else {
          state.currentChannelId = null;
        }
      });
    },

    setCurrentChannel: (channelId) => {
      set((state) => {
        state.currentChannelId = channelId;
      });
    },

    addChannel: (guildId, channel) => {
      set((state) => {
        const guild = state.guilds.find((g) => g.id === guildId);
        if (guild) {
          guild.channels.push(channel);
          guild.channels.sort((a, b) => a.position - b.position);
        }
      });
    },

    updateChannel: (guildId, channelId, updates) => {
      set((state) => {
        const guild = state.guilds.find((g) => g.id === guildId);
        const channel = guild?.channels.find((c) => c.id === channelId);
        if (channel) {
          Object.assign(channel, updates);
        }
      });
    },

    removeChannel: (guildId, channelId) => {
      set((state) => {
        const guild = state.guilds.find((g) => g.id === guildId);
        if (guild) {
          guild.channels = guild.channels.filter((c) => c.id !== channelId);
          if (state.currentChannelId === channelId) {
            state.currentChannelId = guild.channels[0]?.id || null;
          }
        }
      });
    },
  }))
);
