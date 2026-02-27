import { ReactNode } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Volume2, VolumeX, Volume1, Bell } from 'lucide-react';
import { useVoiceStore } from '../store/voice';
import { clsx } from 'clsx';

interface ParticipantContextMenuProps {
  children: ReactNode;
  participantIdentity: string;
  participantName: string;
  isLocal?: boolean;
}

export function ParticipantContextMenu({
  children,
  participantIdentity,
  participantName,
  isLocal,
}: ParticipantContextMenuProps) {
  const {
    getUserVolume,
    isUserLocallyMuted,
    setUserVolume,
    toggleLocalMute,
    sendPing,
  } = useVoiceStore();

  // Don't show context menu for local participant
  if (isLocal) {
    return <>{children}</>;
  }

  const volume = getUserVolume(participantIdentity);
  const isMuted = isUserLocallyMuted(participantIdentity);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value, 10);
    setUserVolume(participantIdentity, newVolume);
  };

  const VolumeIcon = isMuted ? VolumeX : volume >= 50 ? Volume2 : Volume1;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        {children}
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-[220px] rounded-lg bg-background-floating p-2 shadow-xl border border-background-accent z-[100]"
        >
          {/* Header */}
          <div className="px-2 py-1.5 mb-1">
            <span className="text-sm font-medium text-text-normal">
              {participantName}
            </span>
          </div>

          <ContextMenu.Separator className="h-px bg-background-accent my-1" />

          {/* Volume Slider */}
          <div className="px-2 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                <VolumeIcon size={14} />
                User Volume
              </span>
              <span className="text-xs text-text-muted">
                {isMuted ? 'Muted' : `${volume}%`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              disabled={isMuted}
              className={clsx(
                'w-full h-1.5 rounded-full appearance-none cursor-pointer',
                'bg-background-accent',
                '[&::-webkit-slider-thumb]:appearance-none',
                '[&::-webkit-slider-thumb]:w-3',
                '[&::-webkit-slider-thumb]:h-3',
                '[&::-webkit-slider-thumb]:rounded-full',
                '[&::-webkit-slider-thumb]:bg-brand-primary',
                '[&::-webkit-slider-thumb]:cursor-pointer',
                '[&::-webkit-slider-thumb]:transition-transform',
                '[&::-webkit-slider-thumb]:hover:scale-110',
                '[&::-moz-range-thumb]:w-3',
                '[&::-moz-range-thumb]:h-3',
                '[&::-moz-range-thumb]:rounded-full',
                '[&::-moz-range-thumb]:bg-brand-primary',
                '[&::-moz-range-thumb]:border-0',
                '[&::-moz-range-thumb]:cursor-pointer',
                isMuted && 'opacity-50 cursor-not-allowed'
              )}
            />
            {/* Volume markers */}
            <div className="flex justify-between mt-1 text-[10px] text-text-muted">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <ContextMenu.Separator className="h-px bg-background-accent my-1" />

          {/* Mute Toggle */}
          <ContextMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              toggleLocalMute(participantIdentity);
            }}
            className={clsx(
              'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer outline-none',
              'hover:bg-background-accent',
              isMuted ? 'text-text-danger' : 'text-text-normal'
            )}
          >
            {isMuted ? (
              <>
                <VolumeX size={16} />
                <span className="text-sm">Unmute User</span>
              </>
            ) : (
              <>
                <VolumeX size={16} />
                <span className="text-sm">Mute User</span>
              </>
            )}
          </ContextMenu.Item>

          {/* Reset Volume */}
          {volume !== 100 && !isMuted && (
            <ContextMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setUserVolume(participantIdentity, 100);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer outline-none hover:bg-background-accent text-text-muted"
            >
              <Volume2 size={16} />
              <span className="text-sm">Reset Volume to 100%</span>
            </ContextMenu.Item>
          )}

          <ContextMenu.Separator className="h-px bg-background-accent my-1" />

          {/* Ping User */}
          <ContextMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              sendPing(participantIdentity);
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer outline-none hover:bg-background-accent text-brand-primary"
          >
            <Bell size={16} />
            <span className="text-sm">Ping User</span>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
