import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { enableMapSet } from 'immer';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  Participant,
  TrackPublication,
  RemoteTrack,
  RemoteAudioTrack,
  ExternalE2EEKeyProvider,
  type AudioCaptureOptions,
  LocalAudioTrack,
} from 'livekit-client';
import { getRNNoiseProcessor } from '../lib/noise-suppression';
import { playJoinSound, playLeaveSound, playPingSound, preloadSounds } from '../services/sounds';

// Ping message type for data channel
const PING_MESSAGE_TYPE = 'conact:ping';

// -------------------------
// LiveKit WebAudio Context (FIX 1)
// -------------------------
let liveKitAudioContext: AudioContext | null = null;
async function getOrCreateLiveKitAudioContext(): Promise<AudioContext> {
  if (!liveKitAudioContext || liveKitAudioContext.state === 'closed') {
    liveKitAudioContext = new AudioContext();
  }
  if (liveKitAudioContext.state === 'suspended') {
    try {
      await liveKitAudioContext.resume();
    } catch (err) {
      console.warn('LiveKit AudioContext resume() failed:', err);
    }
  }
  return liveKitAudioContext;
}

// E2EE key provider singleton
let e2eeKeyProvider: ExternalE2EEKeyProvider | null = null;
function getE2EEKeyProvider(): ExternalE2EEKeyProvider {
  if (!e2eeKeyProvider) {
    e2eeKeyProvider = new ExternalE2EEKeyProvider();
  }
  return e2eeKeyProvider;
}

enableMapSet();

// Device settings stored separately with persistence
export interface DeviceSettings {
  selectedAudioInput: string | null;
  selectedAudioOutput: string | null;
  selectedVideoInput: string | null;
  noiseSuppression: boolean;
}

// Participant audio settings stored with persistence
export interface ParticipantAudioSettings {
  // Key is participant identity (e.g., @user:localhost)
  volumes: Record<string, number>;
  mutedUsers: string[];
}

interface ParticipantSettingsState {
  settings: ParticipantAudioSettings;
  getVolume: (identity: string) => number;
  setVolume: (identity: string, volume: number) => void;
  isMuted: (identity: string) => boolean;
  toggleMute: (identity: string) => void;
}

export const useParticipantSettingsStore = create<ParticipantSettingsState>()(
  persist(
    (set, get) => ({
      settings: {
        volumes: {},
        mutedUsers: [],
      },
      getVolume: (identity: string) => {
        return get().settings.volumes[identity] ?? 100;
      },
      setVolume: (identity: string, volume: number) => {
        set((state) => ({
          settings: {
            ...state.settings,
            volumes: {
              ...state.settings.volumes,
              [identity]: volume,
            },
          },
        }));
      },
      isMuted: (identity: string) => {
        return get().settings.mutedUsers.includes(identity);
      },
      toggleMute: (identity: string) => {
        set((state) => {
          const isMuted = state.settings.mutedUsers.includes(identity);
          return {
            settings: {
              ...state.settings,
              mutedUsers: isMuted
                ? state.settings.mutedUsers.filter((id) => id !== identity)
                : [...state.settings.mutedUsers, identity],
            },
          };
        });
      },
    }),
    {
      name: 'conact-participant-settings',
    }
  )
);

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

interface DeviceState {
  devices: MediaDeviceInfo[];
  settings: DeviceSettings;
  setSelectedAudioInput: (deviceId: string | null) => Promise<void>;
  setSelectedAudioOutput: (deviceId: string | null) => Promise<void>;
  setSelectedVideoInput: (deviceId: string | null) => Promise<void>;
  setNoiseSuppression: (enabled: boolean) => void;
  refreshDevices: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      devices: [],
      settings: {
        selectedAudioInput: null,
        selectedAudioOutput: null,
        selectedVideoInput: null,
        noiseSuppression: false,
      },
      refreshDevices: async () => {
        try {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream.getTracks().forEach((track) => track.stop());
          } catch {}
          try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoStream.getTracks().forEach((track) => track.stop());
          } catch {}
          const deviceList = await navigator.mediaDevices.enumerateDevices();
          const deviceCounts = { audioinput: 0, audiooutput: 0, videoinput: 0 };
          const devices: MediaDeviceInfo[] = deviceList
            .filter((d) => d.kind === 'audioinput' || d.kind === 'audiooutput' || d.kind === 'videoinput')
            .map((d) => {
              const kind = d.kind as 'audioinput' | 'audiooutput' | 'videoinput';
              deviceCounts[kind]++;
              let fallbackLabel: string;
              if (kind === 'audioinput') fallbackLabel = `Microphone ${deviceCounts[kind]}`;
              else if (kind === 'audiooutput') fallbackLabel = `Speaker ${deviceCounts[kind]}`;
              else fallbackLabel = `Camera ${deviceCounts[kind]}`;
              return {
                deviceId: d.deviceId,
                label: d.label || fallbackLabel,
                kind,
              };
            });
          set({ devices });
        } catch (error) {
          console.error('Failed to enumerate devices:', error);
        }
      },
      setSelectedAudioInput: async (deviceId) => {
        set((state) => ({
          settings: { ...state.settings, selectedAudioInput: deviceId },
        }));
        if (roomRef && deviceId) {
          try {
            await roomRef.switchActiveDevice('audioinput', deviceId);
          } catch (error) {
            console.error('Failed to switch audio input device:', error);
          }
        }
      },
      setSelectedAudioOutput: async (deviceId) => {
        set((state) => ({
          settings: { ...state.settings, selectedAudioOutput: deviceId },
        }));
        if (deviceId) {
          document.querySelectorAll<HTMLAudioElement>('[data-lk-audio]').forEach(async (el) => {
            try {
              if ('setSinkId' in el) {
                await (el as any).setSinkId(deviceId);
              }
            } catch (error) {
              console.error('Failed to set audio output device:', error);
            }
          });
        }
      },
      setSelectedVideoInput: async (deviceId) => {
        set((state) => ({
          settings: { ...state.settings, selectedVideoInput: deviceId },
        }));
        if (roomRef && deviceId) {
          try {
            await roomRef.switchActiveDevice('videoinput', deviceId);
          } catch (error) {
            console.error('Failed to switch video input device:', error);
          }
        }
      },
      setNoiseSuppression: (enabled) => {
        set((state) => ({
          settings: { ...state.settings, noiseSuppression: enabled },
        }));
      },
    }),
    {
      name: 'conact-device-settings',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

// Store room reference outside of immer
let roomRef: Room | null = null;

function getRemoteAudioTrack(identity: string, source: Track.Source = Track.Source.Microphone): RemoteAudioTrack | null {
  if (!roomRef) return null;
  const participant = roomRef.remoteParticipants.get(identity);
  if (!participant) return null;
  const publication = participant.getTrackPublication(source);
  if (!publication || !publication.track) return null;
  if (publication.track.kind !== Track.Kind.Audio) return null;
  return publication.track as RemoteAudioTrack;
}

function applyVolumeToParticipant(identity: string, volume: number): void {
  const track = getRemoteAudioTrack(identity, Track.Source.Microphone);
  if (track) {
    const normalizedVolume = Math.min(1, Math.max(0, volume / 100));
    track.setVolume(normalizedVolume);
    console.log(`[LiveKit] Set volume for ${identity} to ${normalizedVolume} (${volume}%)`);
  }
}

function applyScreenShareAudioVolume(identity: string, enabled: boolean): void {
  const track = getRemoteAudioTrack(identity, Track.Source.ScreenShareAudio);
  if (track) {
    track.setVolume(enabled ? 1 : 0);
    console.log(`[LiveKit] Screen share audio for ${identity}: ${enabled ? 'enabled' : 'muted'}`);
  }
}

export interface VideoTrackInfo {
  trackSid: string;
  source: 'camera' | 'screen_share';
}

export interface VoiceParticipant {
  identity: string;
  displayName: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  videoTracks: VideoTrackInfo[];
}

interface VoiceState {
  isConnected: boolean;
  isConnecting: boolean;
  currentChannelId: string | null;
  currentGuildId: string | null;
  participants: Map<string, VoiceParticipant>;
  localParticipant: VoiceParticipant | null;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  showVideoOverlay: boolean;
  showScreenPicker: boolean;
  screenShareAudioEnabled: Map<string, boolean>;
  userVolumes: Map<string, number>;
  locallyMutedUsers: Set<string>;
  connect: (token: string, serverUrl: string, channelId: string, guildId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  startScreenShareWithSource: (sourceId: string) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  setShowScreenPicker: (show: boolean) => void;
  updateParticipant: (identity: string, updates: Partial<VoiceParticipant>) => void;
  getRoom: () => Room | null;
  setShowVideoOverlay: (show: boolean) => void;
  toggleScreenShareAudio: (identity: string) => void;
  setUserVolume: (identity: string, volume: number) => void;
  toggleLocalMute: (identity: string) => void;
  isUserLocallyMuted: (identity: string) => boolean;
  getUserVolume: (identity: string) => number;
  isScreenShareAudioEnabled: (identity: string) => boolean;
  sendPing: (identity: string) => void;
}

export const isElectron = typeof window !== 'undefined' && (
  window.location.protocol === 'file:' ||
  (window as any).electronAPI !== undefined
);

export const useVoiceStore = create<VoiceState>()(
  immer((set, get) => ({
    isConnected: false,
    isConnecting: false,
    currentChannelId: null,
    currentGuildId: null,
    participants: new Map(),
    localParticipant: null,
    isMuted: false,
    isDeafened: false,
    isVideoEnabled: false,
    isScreenSharing: false,
    showVideoOverlay: false,
    showScreenPicker: false,
    screenShareAudioEnabled: new Map(),
    userVolumes: new Map(),
    locallyMutedUsers: new Set(),

    connect: async (token, serverUrl, channelId, guildId) => {
      if (roomRef) {
        console.log('LiveKit: Disconnecting from existing room before connecting to new one');
        await roomRef.disconnect();
        roomRef = null;
        document.querySelectorAll('[data-lk-audio]').forEach((el) => el.remove());
      }

      // Load persisted participant settings
      const participantSettings = useParticipantSettingsStore.getState().settings;
      const persistedVolumes = new Map(Object.entries(participantSettings.volumes));
      const persistedMuted = new Set(participantSettings.mutedUsers);

      set((s) => {
        s.isConnecting = true;
        s.participants.clear();
        s.localParticipant = null;
        s.isMuted = false;
        s.isDeafened = false;
        s.isVideoEnabled = false;
        s.isScreenSharing = false;
        // Restore persisted settings
        s.userVolumes = persistedVolumes;
        s.locallyMutedUsers = persistedMuted;
      });

      try {
        const deviceSettings = useDeviceStore.getState().settings;
        const audioCaptureDefaults: AudioCaptureOptions = {
          deviceId: deviceSettings.selectedAudioInput || undefined,
        };

        const e2eeKeyProvider = getE2EEKeyProvider();
        const e2eeOptions = {
          keyProvider: e2eeKeyProvider,
          worker: new Worker(new URL('livekit-client/e2ee-worker', import.meta.url)),
        };

        const audioContext = await getOrCreateLiveKitAudioContext();

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          webAudioMix: { audioContext },
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720, frameRate: 30 },
            deviceId: deviceSettings.selectedVideoInput || undefined,
          },
          audioCaptureDefaults,
          audioOutput: {
            deviceId: deviceSettings.selectedAudioOutput || undefined,
          },
          e2ee: e2eeOptions,

          // HIGH-QUALITY SCREEN SHARE FOR GAMES
          publishDefaults: {
            screenShareEncoding: {
              maxBitrate: 8_000_000,
              maxFramerate: 30,
            },
            screenShareSimulcastLayers: [],
          },
        });

        // Preload sounds on connect
        preloadSounds();

        // Event listeners
        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          set((s) => {
            s.participants.set(participant.identity, {
              identity: participant.identity,
              displayName: participant.name || participant.identity,
              isSpeaking: false,
              isMuted: false,
              isVideoEnabled: false,
              isScreenSharing: false,
              videoTracks: [],
            });
          });
          // Play join sound
          playJoinSound();
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          set((s) => {
            s.participants.delete(participant.identity);
          });
          // Play leave sound
          playLeaveSound();
        });

        // Handle incoming data messages (for ping)
        room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
          try {
            const message = JSON.parse(new TextDecoder().decode(payload));
            if (message.type === PING_MESSAGE_TYPE) {
              // Someone pinged us - play ping sound (bypasses deafen)
              console.log(`Ping received from ${participant?.identity || 'unknown'}`);
              playPingSound();
            }
          } catch {
            // Not a JSON message, ignore
          }
        });

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          set((s) => {
            s.participants.forEach((p) => { p.isSpeaking = false; });
            if (s.localParticipant) s.localParticipant.isSpeaking = false;
            speakers.forEach((speaker) => {
              const participant = s.participants.get(speaker.identity);
              if (participant) participant.isSpeaking = true;
              if (s.localParticipant?.identity === speaker.identity) s.localParticipant.isSpeaking = true;
            });
          });
        });

        room.on(RoomEvent.TrackMuted, (publication: TrackPublication, participant: Participant) => {
          if (publication.kind === Track.Kind.Audio) {
            set((s) => {
              const p = s.participants.get(participant.identity);
              if (p) p.isMuted = true;
            });
          }
        });

        room.on(RoomEvent.TrackUnmuted, (publication: TrackPublication, participant: Participant) => {
          if (publication.kind === Track.Kind.Audio) {
            set((s) => {
              const p = s.participants.get(participant.identity);
              if (p) p.isMuted = false;
            });
          }
        });

        room.on(RoomEvent.Connected, () => {
          console.log('LiveKit: Room connected');
          set((s) => {
            s.isConnected = true;
            s.isConnecting = false;
          });
        });

        room.on(RoomEvent.Disconnected, () => {
          console.log('LiveKit: Room disconnected');
          document.querySelectorAll('[data-lk-audio]').forEach((el) => el.remove());
          document.querySelectorAll('[data-lk-screenshare-audio]').forEach((el) => el.remove());
          roomRef = null;
          set((s) => {
            s.isConnected = false;
            s.isConnecting = false;
            s.currentChannelId = null;
            s.currentGuildId = null;
            s.participants.clear();
            s.localParticipant = null;
            s.screenShareAudioEnabled.clear();
          });
        });

        room.on(RoomEvent.TrackSubscribed, async (track: RemoteTrack, publication, participant) => {
          console.log('LiveKit: Track subscribed', track.kind, 'source:', publication.source, 'from', participant.identity);
          if (track.kind === Track.Kind.Audio) {
            const isScreenShareAudio = publication.source === Track.Source.ScreenShareAudio;
            const audioTrack = track as RemoteAudioTrack;
            const audioElement = audioTrack.attach();
            audioElement.autoplay = true;
            audioElement.style.display = 'none';

            const state = get();
            const isDeafened = state.isDeafened;

            if (isScreenShareAudio) {
              audioElement.setAttribute('data-lk-screenshare-audio', participant.identity);
              const screenShareEnabled = state.screenShareAudioEnabled.get(participant.identity) ?? false;
              audioTrack.setVolume(isDeafened ? 0 : (screenShareEnabled ? 1 : 0));
            } else {
              audioElement.setAttribute('data-lk-audio', participant.identity);
              const volume = state.userVolumes.get(participant.identity) ?? 100;
              const isLocallyMuted = state.locallyMutedUsers.has(participant.identity);
              const effectiveVolume = (isDeafened || isLocallyMuted) ? 0 : Math.min(volume, 100);
              audioTrack.setVolume(effectiveVolume / 100);
            }

            const outputDeviceId = useDeviceStore.getState().settings.selectedAudioOutput;
            if (outputDeviceId && 'setSinkId' in audioElement) {
              try {
                await (audioElement as any).setSinkId(outputDeviceId);
              } catch (error) {
                console.error('Failed to set audio output device:', error);
              }
            }
            document.body.appendChild(audioElement);
          } else if (track.kind === Track.Kind.Video) {
            const source = publication.source === Track.Source.ScreenShare ? 'screen_share' : 'camera';
            set((s) => {
              const p = s.participants.get(participant.identity);
              if (p) {
                p.videoTracks = [...p.videoTracks, { trackSid: track.sid!, source }];
                if (source === 'camera') {
                  p.isVideoEnabled = true;
                } else {
                  p.isScreenSharing = true;
                  s.showVideoOverlay = true;
                }
              }
            });
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication, participant) => {
          console.log('LiveKit: Track unsubscribed', track.kind);
          track.detach().forEach((el) => el.remove());
          if (track.kind === Track.Kind.Video) {
            const source = publication.source === Track.Source.ScreenShare ? 'screen_share' : 'camera';
            set((s) => {
              const p = s.participants.get(participant.identity);
              if (p) {
                p.videoTracks = p.videoTracks.filter((t) => t.trackSid !== track.sid);
                if (source === 'camera') p.isVideoEnabled = false;
                else p.isScreenSharing = false;
              }
            });
          }
        });

        await e2eeKeyProvider.setKey(channelId);
        await room.setE2EEEnabled(true);
        console.log('LiveKit: E2EE enabled for channel', channelId);
        console.log('LiveKit: Connecting to', serverUrl);
        await room.connect(serverUrl, token);
        console.log('LiveKit: Connected successfully');

        roomRef = room;

        // Microphone with RNNoise (your original code)
        try {
          const deviceSettings = useDeviceStore.getState().settings;
          const audioContext = await getOrCreateLiveKitAudioContext();
          const audioConstraints: MediaTrackConstraints = {
            deviceId: deviceSettings.selectedAudioInput || undefined,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: false,
          };
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
          const mediaTrack = audioStream.getAudioTracks()[0];

          const localAudioTrack = new LocalAudioTrack(
            mediaTrack,
            audioConstraints,
            false,
            audioContext
          );

          if (deviceSettings.noiseSuppression) {
            await localAudioTrack.setProcessor(getRNNoiseProcessor());
          }

          await room.localParticipant.publishTrack(localAudioTrack, {
            source: Track.Source.Microphone,
          });
          console.log('LiveKit: Microphone enabled with processor');
        } catch (error) {
          console.error('Failed to enable microphone with processor:', error);
          await room.localParticipant.setMicrophoneEnabled(true);
        }

        set((s) => {
          s.isConnected = true;
          s.isConnecting = false;
          s.currentChannelId = channelId;
          s.currentGuildId = guildId;
          s.localParticipant = {
            identity: room.localParticipant.identity,
            displayName: room.localParticipant.name || room.localParticipant.identity,
            isSpeaking: false,
            isMuted: false,
            isVideoEnabled: false,
            isScreenSharing: false,
            videoTracks: [],
          };

          room.remoteParticipants.forEach((participant: RemoteParticipant) => {
            const videoTracks: VideoTrackInfo[] = [];
            participant.videoTrackPublications.forEach((pub) => {
              if (pub.track) {
                videoTracks.push({
                  trackSid: pub.track.sid!,
                  source: pub.source === Track.Source.ScreenShare ? 'screen_share' : 'camera',
                });
              }
            });
            s.participants.set(participant.identity, {
              identity: participant.identity,
              displayName: participant.name || participant.identity,
              isSpeaking: false,
              isMuted: !participant.isMicrophoneEnabled,
              isVideoEnabled: participant.isCameraEnabled,
              isScreenSharing: participant.isScreenShareEnabled,
              videoTracks,
            });
          });
        });
      } catch (error) {
        console.error('Failed to connect to voice channel:', error);
        set((s) => { s.isConnecting = false; });
        throw error;
      }
    },

    disconnect: async () => {
      if (roomRef) {
        await roomRef.disconnect();
        roomRef = null;
      }
      set((s) => {
        s.isConnected = false;
        s.currentChannelId = null;
        s.currentGuildId = null;
        s.participants.clear();
        s.localParticipant = null;
        s.isMuted = false;
        s.isDeafened = false;
        s.isVideoEnabled = false;
        s.isScreenSharing = false;
        s.showVideoOverlay = false;
      });
    },

    toggleMute: () => {
      const { isMuted } = get();
      if (!roomRef) return;
      const newMuted = !isMuted;
      set((s) => {
        s.isMuted = newMuted;
        if (s.localParticipant) s.localParticipant.isMuted = newMuted;
      });
      roomRef.localParticipant.setMicrophoneEnabled(!newMuted).catch((err) => {
        console.error('Failed to toggle mute:', err);
        set((s) => {
          s.isMuted = isMuted;
          if (s.localParticipant) s.localParticipant.isMuted = isMuted;
        });
      });
    },

    toggleDeafen: () => {
      const { isDeafened, isMuted } = get();
      if (!roomRef) return;
      const newDeafened = !isDeafened;
      set((s) => {
        s.isDeafened = newDeafened;
        if (newDeafened) {
          s.isMuted = true;
          if (s.localParticipant) s.localParticipant.isMuted = true;
        } else {
          s.isMuted = false;
          if (s.localParticipant) s.localParticipant.isMuted = false;
        }
      });

      const state = get();
      roomRef.remoteParticipants.forEach((participant) => {
        const identity = participant.identity;
        if (newDeafened) {
          applyVolumeToParticipant(identity, 0);
          applyScreenShareAudioVolume(identity, false);
        } else {
          const isLocallyMuted = state.locallyMutedUsers.has(identity);
          applyVolumeToParticipant(identity, isLocallyMuted ? 0 : (state.userVolumes.get(identity) ?? 100));
          const screenShareEnabled = state.screenShareAudioEnabled.get(identity) ?? false;
          applyScreenShareAudioVolume(identity, screenShareEnabled);
        }
      });

      if (newDeafened && !isMuted) {
        roomRef.localParticipant.setMicrophoneEnabled(false).catch(console.error);
      }
      if (!newDeafened) {
        roomRef.localParticipant.setMicrophoneEnabled(true).catch(console.error);
      }
    },

    toggleVideo: async () => {
      const { isVideoEnabled } = get();
      if (!roomRef) return;
      const newVideoEnabled = !isVideoEnabled;
      try {
        await roomRef.localParticipant.setCameraEnabled(newVideoEnabled);
        set((s) => {
          s.isVideoEnabled = newVideoEnabled;
          if (s.localParticipant) s.localParticipant.isVideoEnabled = newVideoEnabled;
          if (newVideoEnabled) s.showVideoOverlay = true;
        });
      } catch (error) {
        console.error('Failed to toggle video:', error);
      }
    },

    toggleScreenShare: async () => {
      const { isScreenSharing } = get();
      if (!roomRef) return;
      if (isScreenSharing) {
        await get().stopScreenShare();
        return;
      }

      if (isElectron) {
        set((s) => { s.showScreenPicker = true; });
        return;
      }

      // Browser high-quality path
      try {
        await roomRef.localParticipant.setScreenShareEnabled(true, {
          contentHint: 'motion',
          resolution: { width: 1920, height: 1080, frameRate: 30 },
        });
        set((s) => {
          s.isScreenSharing = true;
          if (s.localParticipant) s.localParticipant.isScreenSharing = true;
          s.showVideoOverlay = true;
        });
      } catch (error) {
        console.error('Failed to start screen share:', error);
      }
    },

    startScreenShareWithSource: async (sourceId: string) => {
      if (!roomRef) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxWidth: 1920,
              maxHeight: 1080,
              maxFrameRate: 30,
            },
          } as any,
        });

        const videoTrack = stream.getVideoTracks()[0];
        videoTrack.contentHint = 'motion';

        await roomRef.localParticipant.publishTrack(videoTrack, {
          source: Track.Source.ScreenShare,
          name: 'screen',
          simulcast: false,
          screenShareEncoding: {
            maxBitrate: 10_000_000,
            maxFramerate: 30,
          },
          videoCodec: 'vp9',
        });

        set((s) => {
          s.isScreenSharing = true;
          s.showScreenPicker = false;
          if (s.localParticipant) s.localParticipant.isScreenSharing = true;
          s.showVideoOverlay = true;
        });

        videoTrack.onended = () => get().stopScreenShare();
      } catch (error) {
        console.error('Failed to start screen share with source:', error);
        set((s) => { s.showScreenPicker = false; });
      }
    },

    stopScreenShare: async () => {
      if (!roomRef) return;
      try {
        await roomRef.localParticipant.setScreenShareEnabled(false);
        set((s) => {
          s.isScreenSharing = false;
          if (s.localParticipant) s.localParticipant.isScreenSharing = false;
        });
      } catch (error) {
        console.error('Failed to stop screen share:', error);
      }
    },

    setShowScreenPicker: (show: boolean) => {
      set((s) => { s.showScreenPicker = show; });
    },

    updateParticipant: (identity, updates) => {
      set((s) => {
        const participant = s.participants.get(identity);
        if (participant) Object.assign(participant, updates);
      });
    },

    getRoom: () => roomRef,

    setShowVideoOverlay: (show: boolean) => {
      set((s) => { s.showVideoOverlay = show; });
    },

    toggleScreenShareAudio: (identity: string) => {
      const state = get();
      const currentEnabled = state.screenShareAudioEnabled.get(identity) ?? false;
      const newEnabled = !currentEnabled;
      const isDeafened = state.isDeafened;
      set((s) => { s.screenShareAudioEnabled.set(identity, newEnabled); });
      if (!isDeafened) applyScreenShareAudioVolume(identity, newEnabled);
    },

    setUserVolume: (identity: string, volume: number) => {
      const clampedVolume = Math.max(0, Math.min(100, volume));
      set((s) => { s.userVolumes.set(identity, clampedVolume); });
      // Persist to localStorage
      useParticipantSettingsStore.getState().setVolume(identity, clampedVolume);
      const state = get();
      const isLocallyMuted = state.locallyMutedUsers.has(identity);
      const isDeafened = state.isDeafened;
      if (!isLocallyMuted && !isDeafened) {
        applyVolumeToParticipant(identity, clampedVolume);
      }
    },

    toggleLocalMute: (identity: string) => {
      const state = get();
      const isCurrentlyMuted = state.locallyMutedUsers.has(identity);
      const isDeafened = state.isDeafened;
      set((s) => {
        if (isCurrentlyMuted) s.locallyMutedUsers.delete(identity);
        else s.locallyMutedUsers.add(identity);
      });
      // Persist to localStorage
      useParticipantSettingsStore.getState().toggleMute(identity);
      if (!isDeafened) {
        if (isCurrentlyMuted) {
          const volume = get().userVolumes.get(identity) ?? 100;
          applyVolumeToParticipant(identity, volume);
        } else {
          applyVolumeToParticipant(identity, 0);
        }
      }
    },

    isUserLocallyMuted: (identity: string) => get().locallyMutedUsers.has(identity),
    getUserVolume: (identity: string) => get().userVolumes.get(identity) ?? 100,
    isScreenShareAudioEnabled: (identity: string) => get().screenShareAudioEnabled.get(identity) ?? false,

    sendPing: (identity: string) => {
      if (!roomRef) return;
      const participant = roomRef.remoteParticipants.get(identity);
      if (!participant) {
        console.warn('Cannot ping: participant not found', identity);
        return;
      }
      try {
        const message = JSON.stringify({ type: PING_MESSAGE_TYPE });
        const data = new TextEncoder().encode(message);
        // Send to specific participant
        roomRef.localParticipant.publishData(data, {
          reliable: true,
          destinationIdentities: [identity],
        });
        console.log(`Ping sent to ${identity}`);
      } catch (err) {
        console.error('Failed to send ping:', err);
      }
    },
  }))
);