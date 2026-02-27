import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuthStore } from '../store/auth';

// In Electron (file:// protocol), we need absolute URLs.
// In web dev (localhost:5173), Vite proxy handles /api.
// In web production (cx.guendogan-consulting.de), nginx proxies /api.
const isElectron = typeof window !== 'undefined' && (
  window.location.protocol === 'file:' ||
  (window as any).electronAPI !== undefined
);

const API_BASE_URL = isElectron
  ? 'https://cx.guendogan-consulting.de/api/v1'
  : '/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      const { token, matrixAccessToken } = useAuthStore.getState();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (matrixAccessToken) {
        config.headers['X-Matrix-Token'] = matrixAccessToken;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().logout();
          if (!isElectron) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async register(username: string, password: string, displayName?: string) {
    const response = await this.client.post('/auth/register', {
      username,
      password,
      displayName,
    });
    return response.data.data;
  }

  async login(username: string, password: string) {
    const response = await this.client.post('/auth/login', {
      username,
      password,
    });
    return response.data.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data.data;
  }

  // Guilds
  async getGuilds() {
    const response = await this.client.get('/guilds');
    return response.data.data;
  }

  async getGuild(guildId: string) {
    const response = await this.client.get(`/guilds/${guildId}`);
    return response.data.data;
  }

  async createGuild(data: { name: string; description?: string; visibility?: string }) {
    const response = await this.client.post('/guilds', data);
    return response.data.data;
  }

  async updateGuild(guildId: string, data: Partial<{ name: string; description: string; visibility: string }>) {
    const response = await this.client.patch(`/guilds/${guildId}`, data);
    return response.data.data;
  }

  async deleteGuild(guildId: string) {
    const response = await this.client.delete(`/guilds/${guildId}`);
    return response.data.data;
  }

  async leaveGuild(guildId: string) {
    const response = await this.client.delete(`/guilds/${guildId}/members/@me`);
    return response.data.data;
  }

  // Channels
  async getChannels(guildId: string) {
    const response = await this.client.get(`/guilds/${guildId}/channels`);
    return response.data.data;
  }

  async createChannel(guildId: string, data: { name: string; type: string; topic?: string }) {
    const response = await this.client.post(`/guilds/${guildId}/channels`, data);
    return response.data.data;
  }

  async updateChannel(guildId: string, channelId: string, data: Partial<{ name: string; topic: string }>) {
    const response = await this.client.patch(`/guilds/${guildId}/channels/${channelId}`, data);
    return response.data.data;
  }

  async deleteChannel(guildId: string, channelId: string) {
    const response = await this.client.delete(`/guilds/${guildId}/channels/${channelId}`);
    return response.data.data;
  }

  async joinVoiceChannel(guildId: string, channelId: string) {
    const response = await this.client.post(`/guilds/${guildId}/channels/${channelId}/join`);
    return response.data.data;
  }

  async getVoiceParticipants(guildId: string, channelId: string) {
    const response = await this.client.get(`/guilds/${guildId}/channels/${channelId}/participants`);
    return response.data.data;
  }

  // Invites
  async createInvite(guildId: string, options?: { maxUses?: number; maxAge?: number }) {
    const response = await this.client.post(`/guilds/${guildId}/invites`, options);
    return response.data.data;
  }

  async getInvites(guildId: string) {
    const response = await this.client.get(`/guilds/${guildId}/invites`);
    return response.data.data;
  }

  async getInviteInfo(code: string) {
    const response = await this.client.get(`/invites/code/${code}`);
    return response.data.data;
  }

  async redeemInvite(code: string) {
    const response = await this.client.post(`/invites/code/${code}/redeem`);
    return response.data.data;
  }

  async deleteInvite(guildId: string, inviteId: string) {
    const response = await this.client.delete(`/guilds/${guildId}/invites/${inviteId}`);
    return response.data.data;
  }

  // Members
  async getMembers(guildId: string) {
    const response = await this.client.get(`/guilds/${guildId}/members`);
    return response.data.data;
  }

  async kickMember(guildId: string, userId: string, reason?: string) {
    const response = await this.client.delete(`/guilds/${guildId}/members/${userId}`, {
      data: { reason },
    });
    return response.data.data;
  }

  // Bans
  async getBans(guildId: string) {
    const response = await this.client.get(`/guilds/${guildId}/bans`);
    return response.data.data;
  }

  async banMember(guildId: string, userId: string, reason?: string) {
    const response = await this.client.put(`/guilds/${guildId}/bans/${userId}`, { reason });
    return response.data.data;
  }

  async unbanMember(guildId: string, targetMatrixUserId: string) {
    const response = await this.client.delete(`/guilds/${guildId}/bans/${encodeURIComponent(targetMatrixUserId)}`);
    return response.data.data;
  }

  // Roles
  async getRoles(guildId: string) {
    const response = await this.client.get(`/guilds/${guildId}/roles`);
    return response.data.data;
  }

  async createRole(guildId: string, data: { name: string; color?: string; permissions?: Record<string, boolean> }) {
    const response = await this.client.post(`/guilds/${guildId}/roles`, data);
    return response.data.data;
  }

  async updateRole(guildId: string, roleId: string, data: Partial<{ name: string; color: string; permissions: Record<string, boolean> }>) {
    const response = await this.client.patch(`/guilds/${guildId}/roles/${roleId}`, data);
    return response.data.data;
  }

  async deleteRole(guildId: string, roleId: string) {
    const response = await this.client.delete(`/guilds/${guildId}/roles/${roleId}`);
    return response.data.data;
  }

  async assignRole(guildId: string, userId: string, roleId: string) {
    const response = await this.client.put(`/guilds/${guildId}/members/${userId}/roles/${roleId}`);
    return response.data.data;
  }

  async removeRole(guildId: string, userId: string, roleId: string) {
    const response = await this.client.delete(`/guilds/${guildId}/members/${userId}/roles/${roleId}`);
    return response.data.data;
  }

  // Audit Logs
  async getAuditLogs(guildId: string, limit?: number) {
    const response = await this.client.get(`/guilds/${guildId}/audit-logs`, {
      params: { limit },
    });
    return response.data.data;
  }

  // Directory
  async getDirectory(params?: { search?: string; category?: string; tags?: string; limit?: number; offset?: number }) {
    const response = await this.client.get('/directory', { params });
    return response.data.data;
  }

  async getFeaturedGuilds() {
    const response = await this.client.get('/directory/featured');
    return response.data.data;
  }

  // Users
  async searchUsers(query: string) {
    const response = await this.client.get('/auth/users/search', { params: { q: query } });
    return response.data.data;
  }

  async getUser(userId: string) {
    const response = await this.client.get(`/auth/users/${userId}`);
    return response.data.data;
  }

  // Friends
  async getFriends() {
    const response = await this.client.get('/friends');
    return response.data.data;
  }

  async getFriendRequests() {
    const response = await this.client.get('/friends/requests');
    return response.data.data;
  }

  async getPendingRequests() {
    const response = await this.client.get('/friends/pending');
    return response.data.data;
  }

  async sendFriendRequest(targetUserId: string) {
    const response = await this.client.post('/friends/request', { targetUserId });
    return response.data.data;
  }

  async acceptFriendRequest(friendshipId: string) {
    const response = await this.client.post(`/friends/${friendshipId}/accept`);
    return response.data.data;
  }

  async declineFriendRequest(friendshipId: string) {
    const response = await this.client.post(`/friends/${friendshipId}/decline`);
    return response.data.data;
  }

  async removeFriend(targetUserId: string) {
    const response = await this.client.delete(`/friends/${targetUserId}`);
    return response.data.data;
  }

  // Direct Messages
  async getDMThreads() {
    const response = await this.client.get('/dm');
    return response.data.data;
  }

  async createOrGetDMThread(targetUserId: string) {
    const response = await this.client.post('/dm', { targetUserId });
    return response.data.data;
  }

  async getDMThread(threadId: string) {
    const response = await this.client.get(`/dm/${threadId}`);
    return response.data.data;
  }
}

export const api = new ApiClient();