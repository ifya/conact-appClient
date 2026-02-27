import * as sdk from 'matrix-js-sdk';
import { useAuthStore } from '../store/auth';

// In Electron (file:// protocol), we need absolute URLs.
const isElectron = typeof window !== 'undefined' && (
  window.location.protocol === 'file:' ||
  (window as any).electronAPI !== undefined
);

const MATRIX_BASE_URL = isElectron
  ? 'https://cx.guendogan-consulting.de'
  : window.location.origin;

class MatrixService {
  private client: sdk.MatrixClient | null = null;
  private syncPromise: Promise<void> | null = null;

async initialize(): Promise<sdk.MatrixClient> {
  const { matrixAccessToken, user, matrixDeviceId } = useAuthStore.getState();

  if (!matrixAccessToken || !user) {
    throw new Error('Not authenticated');
  }

  if (this.client) {
    return this.client;
  }

  this.client = sdk.createClient({
    baseUrl: MATRIX_BASE_URL,
    accessToken: matrixAccessToken,
    userId: user.matrixUserId,
    deviceId: matrixDeviceId || undefined,
    timelineSupport: true,
    useAuthorizationHeader: true,
  });

  // Initialize Rust crypto for E2EE (modern approach)
  // Use user+device specific database prefix to avoid conflicts when switching users or devices
  const safeUserId = user.matrixUserId.replace(/[^a-zA-Z0-9]/g, '_');
  const safeDeviceId = (matrixDeviceId || 'default').replace(/[^a-zA-Z0-9]/g, '_');
  const cryptoDbPrefix = `matrix-crypto-${safeUserId}-${safeDeviceId}`;

  try {
    await this.client.initRustCrypto({
      cryptoDatabasePrefix: cryptoDbPrefix,
    });

    // Get crypto API for additional setup
    const crypto = this.client.getCrypto();
    if (crypto) {
      // Allow sending encrypted messages to unverified devices
      (crypto as any).globalBlacklistUnverifiedDevices = false;

      // Check and enable key backup if available
      // IMPORTANT: do NOT auto-reset key backup here (can break recovery flows)
      try {
        const backupInfo = await crypto.checkKeyBackupAndEnable();
        if (backupInfo) {
          console.log('Matrix key backup enabled');
        } else {
          console.warn('Matrix key backup not available yet (no auto-reset performed)');
        }
      } catch (backupError) {
        console.warn('Matrix key backup check failed:', backupError);
      }
    }

    console.log('Matrix Rust crypto initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize Rust crypto:', error);
  }

  return this.client;
}

  async startSync(): Promise<void> {
    if (!this.client) {
      await this.initialize();
    }

    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = new Promise((resolve, reject) => {
      this.client!.once(sdk.ClientEvent.Sync, async (state: string) => {
        if (state === 'PREPARED') {
          console.log('Matrix sync completed');

          // Auto-join any pending room invites after initial sync
          try {
            const rooms = this.client!.getRooms();
            for (const room of rooms) {
              const membership = room.getMyMembership();
              if (membership === 'invite') {
                console.log('Auto-joining pending invite for room:', room.roomId);
                try {
                  await this.client!.joinRoom(room.roomId);
                  console.log('Successfully joined pending invite:', room.roomId);
                } catch (err) {
                  console.warn('Failed to auto-join pending invite:', room.roomId, err);
                }
              }
            }
          } catch (err) {
            console.warn('Failed to check pending invites:', err);
          }

          resolve();
        }
      });

      const handleError = (error: Error) => {
        console.error('Matrix sync error:', error);
        reject(error);
      };
      this.client!.on('sync.error' as sdk.ClientEvent, handleError);

      // Auto-join DM room invites
      this.client!.on(sdk.RoomMemberEvent.Membership, async (_event, member) => {
        if (member.membership === 'invite' && member.userId === this.client!.getUserId()) {
          const roomId = member.roomId;
          try {
            // Check if this is a DM room (trusted_private_chat preset creates direct rooms)
            // Auto-join all invites for simplicity - DMs and other private rooms
            console.log('Auto-joining invited room:', roomId);
            await this.client!.joinRoom(roomId);
            console.log('Successfully joined room:', roomId);
          } catch (err) {
            console.warn('Failed to auto-join room:', roomId, err);
          }
        }
      });

      this.client!.startClient({
        initialSyncLimit: 50,
        lazyLoadMembers: true,
      });
    });

    return this.syncPromise;
  }

  async stopSync(): Promise<void> {
    if (this.client) {
      this.client.stopClient();
      this.syncPromise = null;
    }
  }

  getClient(): sdk.MatrixClient | null {
    return this.client;
  }

  async getRoom(roomId: string): Promise<sdk.Room | null> {
    if (!this.client) return null;
    return this.client.getRoom(roomId);
  }

  async getRooms(): Promise<sdk.Room[]> {
    if (!this.client) return [];
    return this.client.getRooms();
  }

async sendMessage(roomId: string, content: string, txnId?: string): Promise<sdk.ISendEventResponse> {
  if (!this.client) {
    throw new Error('Matrix client not initialized');
  }

  // With lazyLoadMembers enabled, we must load room members before sending
  // encrypted messages so the crypto layer knows all recipients
  const room = this.client.getRoom(roomId);
  if (room) {
    await room.loadMembersIfNeeded();
  }

  if (txnId) {
    return (this.client as any).sendEvent(
      roomId,
      'm.room.message',
      {
        msgtype: 'm.text',
        body: content,
      },
      txnId
    ) as Promise<sdk.ISendEventResponse>;
  }

  return this.client.sendTextMessage(roomId, content);
}

  async sendTyping(roomId: string, isTyping: boolean): Promise<void> {
    if (!this.client) return;
    await this.client.sendTyping(roomId, isTyping, isTyping ? 30000 : 0);
  }

  async joinRoom(roomId: string): Promise<sdk.Room> {
    if (!this.client) {
      throw new Error('Matrix client not initialized');
    }
    return this.client.joinRoom(roomId);
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (!this.client) return;
    await this.client.leave(roomId);
  }

async getMessages(
  roomId: string,
  limit: number = 50
): Promise<{ messages: sdk.MatrixEvent[]; end: string }> {
  if (!this.client) {
    throw new Error('Matrix client not initialized');
  }

  const room = this.client.getRoom(roomId);
  if (!room) {
    throw new Error('Room not found');
  }

  const timeline = room.getLiveTimeline();

  const isMessageLikeEvent = (event: sdk.MatrixEvent) => {
    const type = event.getType();
    return type === 'm.room.message' || type === 'm.room.encrypted';
  };

  let events = timeline.getEvents();
  let messageEvents = events.filter(isMessageLikeEvent);

  let paginationAttempts = 0;
  const maxAttempts = 5;

  while (messageEvents.length < limit && paginationAttempts < maxAttempts) {
    const paginationToken = timeline.getPaginationToken(sdk.Direction.Backward);
    if (!paginationToken) {
      console.log('No more pagination token, reached start of room history');
      break;
    }

    try {
      const moreMessages = await this.client.paginateEventTimeline(timeline, {
        backwards: true,
        limit: Math.max(limit - messageEvents.length, 30),
      });

      if (!moreMessages) {
        console.log('No more messages to paginate');
        break;
      }

      events = timeline.getEvents();
      messageEvents = events.filter(isMessageLikeEvent);
      paginationAttempts++;
    } catch (error) {
      console.error('Error paginating timeline:', error);
      break;
    }
  }

  const messages = messageEvents.slice(-limit);

  return {
    messages,
    end: timeline.getPaginationToken(sdk.Direction.Backward) || '',
  };
}

  onRoomTimeline(
    callback: (event: sdk.MatrixEvent, room: sdk.Room | undefined, toStartOfTimeline: boolean | undefined) => void
  ): () => void {
    if (!this.client) {
      return () => {};
    }

    const wrappedCallback = (
      event: sdk.MatrixEvent,
      room: sdk.Room | undefined,
      toStartOfTimeline: boolean | undefined
    ) => {
      callback(event, room, toStartOfTimeline);
    };

    this.client.on(sdk.RoomEvent.Timeline, wrappedCallback as any);
    return () => {
      this.client?.off(sdk.RoomEvent.Timeline, wrappedCallback as any);
    };
  }

  onRoomMember(
    callback: (event: sdk.MatrixEvent, member: sdk.RoomMember) => void
  ): () => void {
    if (!this.client) {
      return () => {};
    }

    this.client.on(sdk.RoomMemberEvent.Membership, callback as any);
    return () => {
      this.client?.off(sdk.RoomMemberEvent.Membership, callback as any);
    };
  }

  onTyping(
    callback: (event: sdk.MatrixEvent, member: sdk.RoomMember) => void
  ): () => void {
    if (!this.client) {
      return () => {};
    }

    this.client.on(sdk.RoomMemberEvent.Typing, callback as any);
    return () => {
      this.client?.off(sdk.RoomMemberEvent.Typing, callback as any);
    };
  }

  async uploadFile(file: File): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not initialized');
    }

    const response = await this.client.uploadContent(file, {
      type: file.type,
    });

    return response.content_uri;
  }

  async sendFile(
    roomId: string,
    file: File
  ): Promise<sdk.ISendEventResponse> {
    if (!this.client) {
      throw new Error('Matrix client not initialized');
    }

    const contentUri = await this.uploadFile(file);

    const content = {
      body: file.name,
      filename: file.name,
      info: {
        mimetype: file.type,
        size: file.size,
      },
      msgtype: file.type.startsWith('image/')
        ? 'm.image'
        : file.type.startsWith('video/')
        ? 'm.video'
        : file.type.startsWith('audio/')
        ? 'm.audio'
        : 'm.file',
      url: contentUri,
    } as any;

    return this.client.sendMessage(roomId, content);
  }

  async sendImageFromUrl(
    roomId: string,
    imageUrl: string,
    title: string,
    width?: number,
    height?: number
  ): Promise<sdk.ISendEventResponse> {
    if (!this.client) {
      throw new Error('Matrix client not initialized');
    }

    // Load room members for E2E encryption
    const room = this.client.getRoom(roomId);
    if (room) {
      await room.loadMembersIfNeeded();
    }

    const content = {
      body: title,
      msgtype: 'm.image',
      url: imageUrl,
      info: {
        mimetype: 'image/gif',
        w: width,
        h: height,
      },
    } as any;

    return this.client.sendMessage(roomId, content);
  }

  async setReadMarker(roomId: string, eventId: string): Promise<void> {
    if (!this.client) return;
    await this.client.setRoomReadMarkers(roomId, eventId);
  }

  destroy(): void {
    if (this.client) {
      this.client.stopClient();
      this.client = null;
      this.syncPromise = null;
    }
  }
}

export const matrixService = new MatrixService();