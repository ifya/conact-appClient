// VoicePanel.tsx
import { PhoneOff, Monitor, Video, VideoOff, Wifi, Users } from 'lucide-react';
import { useVoiceStore } from '../store/voice';
import { useGuildsStore } from '../store/guilds';
import { ParticipantContextMenu } from './ParticipantContextMenu';
import { clsx } from 'clsx';

export function VoicePanel() {
  const {
    isConnected,
    isConnecting,
    currentChannelId,
    currentGuildId,
    participants,
    localParticipant,
    disconnect,
    toggleVideo,
    toggleScreenShare,
    isVideoEnabled,
    isScreenSharing,
    setShowVideoOverlay,
  } = useVoiceStore();
  const guilds = useGuildsStore((state) => state.guilds);
  if (!isConnected && !isConnecting) {
    return null;
  }
  const guild = guilds.find((g) => g.id === currentGuildId);
  const channel = guild?.channels.find((c) => c.id === currentChannelId);
  return (
    <div className="border-t border-background-tertiary bg-background-secondary p-2 min-h-[fit-content]">
      {/* Connection status */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={clsx(
            'h-2 w-2 rounded-full',
            isConnecting ? 'bg-text-warning animate-pulse' : 'bg-text-positive'
          )} />
          <span className="text-sm font-medium text-text-positive">
            {isConnecting ? 'Connecting...' : 'Voice Connected'}
          </span>
        </div>
        {isConnected && (
          <Wifi size={14} className="text-text-positive" />
        )}
      </div>
      {/* Channel info */}
      {channel && (
        <div className="mb-2 text-xs text-text-muted">
          {channel.name} / {guild?.name}
        </div>
      )}
      {/* Participants */}
      {isConnected && (
        <div className="mb-2 space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin min-h-0">
          {/* Local participant */}
          {localParticipant && (
            <div className="flex items-center gap-2 rounded px-1 py-0.5">
              <div className={clsx(
                'h-6 w-6 rounded-full bg-brand-primary flex items-center justify-center text-xs text-white',
                localParticipant.isSpeaking && 'ring-2 ring-text-positive'
              )}>
                {localParticipant.displayName[0]?.toUpperCase()}
              </div>
              <span className="text-sm text-text-normal truncate flex-1">
                {localParticipant.displayName} (you)
              </span>
              {localParticipant.isMuted && (
                <span className="text-text-danger text-xs">muted</span>
              )}
            </div>
          )}
          {/* Remote participants */}
          {Array.from(participants.values()).map((participant) => (
            <ParticipantContextMenu
              key={participant.identity}
              participantIdentity={participant.identity}
              participantName={participant.displayName}
            >
              <div className="flex items-center gap-2 rounded px-1 py-0.5 cursor-context-menu hover:bg-background-accent">
                <div className={clsx(
                  'h-6 w-6 rounded-full bg-channel-default flex items-center justify-center text-xs text-white',
                  participant.isSpeaking && 'ring-2 ring-text-positive'
                )}>
                  {participant.displayName[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-text-normal truncate flex-1">
                  {participant.displayName}
                </span>
                {participant.isMuted && (
                  <span className="text-text-danger text-xs">muted</span>
                )}
              </div>
            </ParticipantContextMenu>
          ))}
        </div>
      )}
      {/* Controls */}
      {isConnected && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setShowVideoOverlay(true)}
            className="rounded-full p-2 bg-background-tertiary text-text-muted hover:bg-background-accent"
            title="Open Video View"
          >
            <Users size={18} />
          </button>
          <button
            onClick={toggleVideo}
            className={clsx(
              'rounded-full p-2',
              isVideoEnabled
                ? 'bg-brand-primary text-white'
                : 'bg-background-tertiary text-text-muted hover:bg-background-accent'
            )}
            title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isVideoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          <button
            onClick={toggleScreenShare}
            className={clsx(
              'rounded-full p-2',
              isScreenSharing
                ? 'bg-brand-primary text-white'
                : 'bg-background-tertiary text-text-muted hover:bg-background-accent'
            )}
            title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          >
            <Monitor size={18} />
          </button>
          <button
            onClick={disconnect}
            className="rounded-full bg-text-danger p-2 text-white hover:bg-red-600"
            title="Disconnect"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      )}
    </div>
  );
}