import { useEffect, useRef, useState } from 'react';
import { X, Maximize2, Minimize2, MicOff, MonitorUp, Mic, Video, VideoOff, Monitor, PhoneOff, Headphones, VolumeX, Maximize, Volume2 } from 'lucide-react';
import { useVoiceStore, VoiceParticipant } from '../store/voice';
import { Track } from 'livekit-client';
import { clsx } from 'clsx';
import { ScreenPickerDialog } from './dialogs/ScreenPickerDialog';
import { ParticipantContextMenu } from './ParticipantContextMenu';

interface VideoTileProps {
  participant: VoiceParticipant;
  isLocal?: boolean;
  isFocused?: boolean;
  onClick?: () => void;
}

function VideoTile({ participant, isLocal, isFocused, onClick }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const room = useVoiceStore((s) => s.getRoom)();
  const { isScreenShareAudioEnabled, toggleScreenShareAudio, isUserLocallyMuted } = useVoiceStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const screenShareAudioEnabled = isScreenShareAudioEnabled(participant.identity);
  const isLocallyMuted = isUserLocallyMuted(participant.identity);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === tileRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tileRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await tileRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  useEffect(() => {
    if (!room || !videoRef.current) return;
    if (!participant.isVideoEnabled) return;
    const livekitParticipant = isLocal
      ? room.localParticipant
      : room.remoteParticipants.get(participant.identity);
    if (!livekitParticipant) return;
    const cameraPublication = livekitParticipant.getTrackPublication(Track.Source.Camera);
    const cameraTrack = cameraPublication?.track;
    if (cameraTrack) {
      console.log('Attaching camera track for', participant.displayName);
      cameraTrack.attach(videoRef.current);
    }
    return () => {
      if (cameraTrack && videoRef.current) {
        cameraTrack.detach(videoRef.current);
      }
    };
  }, [room, participant.identity, participant.displayName, isLocal, participant.isVideoEnabled]);

  useEffect(() => {
    if (!room || !screenShareRef.current) return;
    if (!participant.isScreenSharing) return;
    const livekitParticipant = isLocal
      ? room.localParticipant
      : room.remoteParticipants.get(participant.identity);
    if (!livekitParticipant) return;
    const screenPublication = livekitParticipant.getTrackPublication(Track.Source.ScreenShare);
    const screenTrack = screenPublication?.track;
    if (screenTrack) {
      console.log('Attaching screen share track for', participant.displayName);
      screenTrack.attach(screenShareRef.current);
    }
    return () => {
      if (screenTrack && screenShareRef.current) {
        screenTrack.detach(screenShareRef.current);
      }
    };
  }, [room, participant.identity, participant.displayName, isLocal, participant.isScreenSharing]);

  const hasVideo = participant.isVideoEnabled || participant.isScreenSharing;

  return (
    <div
      ref={tileRef}
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden rounded-lg bg-background-tertiary cursor-pointer transition-all min-h-[200px]',
        isFocused ? 'col-span-2 row-span-2' : '',
        participant.isSpeaking && 'ring-2 ring-text-positive ring-offset-0',
        isFullscreen && 'rounded-none !ring-0'
      )}
    >
      {participant.isScreenSharing && (
        <video
          ref={screenShareRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-contain"
        />
      )}

      {participant.isVideoEnabled && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={clsx(
            'object-cover',
            participant.isScreenSharing
              ? 'absolute bottom-12 right-2 h-24 w-32 rounded-lg border-2 border-background-primary shadow-lg z-10'
              : 'h-full w-full'
          )}
        />
      )}

      {!hasVideo && (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className={clsx(
              'flex h-20 w-20 items-center justify-center rounded-full bg-brand-primary text-3xl text-white',
              participant.isSpeaking && 'ring-4 ring-text-positive'
            )}
          >
            {participant.displayName[0]?.toUpperCase() || '?'}
          </div>
        </div>
      )}

      {participant.isScreenSharing && !isLocal && (
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleScreenShareAudio(participant.identity);
            }}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              screenShareAudioEnabled
                ? 'bg-brand-primary text-white'
                : 'bg-black/50 text-white hover:bg-black/70'
            )}
            title={screenShareAudioEnabled ? 'Mute Screen Audio' : 'Enable Screen Audio'}
          >
            {screenShareAudioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            <Maximize size={18} />
          </button>
        </div>
      )}


      {/* Name overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 z-20">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">
            {participant.displayName}
            {isLocal && ' (You)'}
          </span>
          {participant.isMuted && (
            <MicOff size={14} className="text-text-danger flex-shrink-0" />
          )}
          {isLocallyMuted && !isLocal && (
            <span title="Locally muted">
              <VolumeX size={14} className="text-text-warning flex-shrink-0" />
            </span>
          )}
          {participant.isScreenSharing && (
            <MonitorUp size={14} className="text-brand-primary flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}

function VideoTileWithContextMenu({ participant, isLocal, isFocused, onClick }: VideoTileProps) {
  if (isLocal) {
    return (
      <VideoTile
        participant={participant}
        isLocal={isLocal}
        isFocused={isFocused}
        onClick={onClick}
      />
    );
  }
  return (
    <ParticipantContextMenu
      participantIdentity={participant.identity}
      participantName={participant.displayName}
    >
      <div>
        <VideoTile
          participant={participant}
          isLocal={isLocal}
          isFocused={isFocused}
          onClick={onClick}
        />
      </div>
    </ParticipantContextMenu>
  );
}

export function VoiceVideoOverlay() {
  const {
    isConnected,
    participants,
    localParticipant,
    showVideoOverlay,
    setShowVideoOverlay,
    isMuted,
    isDeafened,
    isVideoEnabled,
    isScreenSharing,
    showScreenPicker,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
    startScreenShareWithSource,
    setShowScreenPicker,
    disconnect,
  } = useVoiceStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [focusedParticipant, setFocusedParticipant] = useState<string | null>(null);

  const screenPickerDialog = (
    <ScreenPickerDialog
      open={showScreenPicker}
      onOpenChange={setShowScreenPicker}
      onSelect={startScreenShareWithSource}
    />
  );

  if (!isConnected || !localParticipant || !showVideoOverlay) {
    return screenPickerDialog;
  }

  const allParticipants = [localParticipant, ...Array.from(participants.values())];

  // Support multiple screen sharers
  const screenSharers = allParticipants.filter(p => p.isScreenSharing);
  const screenSharer = screenSharers.length === 1 ? screenSharers[0] : null;
  const effectiveFocus = focusedParticipant || screenSharer?.identity;

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-lg bg-background-floating px-4 py-2 shadow-lg hover:bg-background-accent"
      >
        <Maximize2 size={16} />
        <span className="text-sm">Show Video</span>
        <span className="rounded bg-brand-primary px-1.5 py-0.5 text-xs text-white">
          {allParticipants.length}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-4 z-50 flex flex-col rounded-xl bg-background-primary shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-background-tertiary bg-background-secondary px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-text-positive" />
          <span className="font-medium">Voice Channel</span>
          <span className="text-sm text-text-muted">
            {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="rounded p-1.5 hover:bg-background-accent"
            title="Minimize"
          >
            <Minimize2 size={18} />
          </button>
          <button
            onClick={() => setShowVideoOverlay(false)}
            className="rounded p-1.5 hover:bg-background-accent"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className={clsx(
            'grid gap-4 h-full',
            allParticipants.length === 1 && 'grid-cols-1',
            allParticipants.length === 2 && 'grid-cols-2',
            allParticipants.length >= 3 && allParticipants.length <= 4 && 'grid-cols-2 grid-rows-2',
            allParticipants.length > 4 && 'grid-cols-3 auto-rows-fr'
          )}
          style={{ minHeight: '300px' }}
        >
          {allParticipants.map((participant, idx) => (
            <VideoTileWithContextMenu
              key={participant.identity}
              participant={participant}
              isLocal={idx === 0}
              isFocused={effectiveFocus === participant.identity && allParticipants.length > 2}
              onClick={() => setFocusedParticipant(
                focusedParticipant === participant.identity ? null : participant.identity
              )}
            />
          ))}
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-3 py-4 bg-background-secondary border-t border-background-tertiary">
        <button
          onClick={toggleMute}
          className={clsx(
            'rounded-full p-3 transition-colors',
            isMuted
              ? 'bg-text-danger text-white'
              : 'bg-background-tertiary text-text-normal hover:bg-background-accent'
          )}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button
          onClick={toggleDeafen}
          className={clsx(
            'rounded-full p-3 transition-colors',
            isDeafened
              ? 'bg-text-danger text-white'
              : 'bg-background-tertiary text-text-normal hover:bg-background-accent'
          )}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
        >
          {isDeafened ? <VolumeX size={20} /> : <Headphones size={20} />}
        </button>
        <button
          onClick={toggleVideo}
          className={clsx(
            'rounded-full p-3 transition-colors',
            isVideoEnabled
              ? 'bg-brand-primary text-white'
              : 'bg-background-tertiary text-text-normal hover:bg-background-accent'
          )}
          title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>
        <button
          onClick={toggleScreenShare}
          className={clsx(
            'rounded-full p-3 transition-colors',
            isScreenSharing
              ? 'bg-brand-primary text-white'
              : 'bg-background-tertiary text-text-normal hover:bg-background-accent'
          )}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          <Monitor size={20} />
        </button>
        <button
          onClick={() => {
            setShowVideoOverlay(false);
            disconnect();
          }}
          className="rounded-full p-3 bg-text-danger text-white hover:bg-red-600 transition-colors"
          title="Leave Call"
        >
          <PhoneOff size={20} />
        </button>
      </div>

      {screenPickerDialog}
    </div>
  );
}