import { Settings, Mic, MicOff, Headphones, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useVoiceStore } from '../store/voice';
import { clsx } from 'clsx';
export function UserPanel() {
const navigate = useNavigate();
const user = useAuthStore((state) => state.user);
const { isMuted, isDeafened, toggleMute, toggleDeafen, isConnected } = useVoiceStore();
if (!user) return null;
return (
<div className="flex items-center gap-2 bg-background-floating p-2">
{/* User info */}
<button className="flex flex-1 items-center gap-2 rounded px-1 py-0.5 hover:bg-background-accent">
<div className="relative">
<div className="avatar h-8 w-8 text-sm">
{user.avatarUrl ? (
<img src={user.avatarUrl} alt="" className="h-full w-full rounded-full" />
            ) : (
user.displayName?.[0]?.toUpperCase() || 'U'
            )}
</div>
<div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background-floating bg-status-online" />
</div>
<div className="flex-1 text-left">
<div className="text-sm font-medium leading-tight">{user.displayName}</div>
<div className="text-xs text-text-muted">Online</div>
</div>
</button>
{/* Voice controls - only show when connected */}
{isConnected && (
<>
<button
onClick={toggleMute}
className={clsx(
'rounded p-1.5 hover:bg-background-accent',
isMuted && 'text-text-danger'
            )}
title={isMuted ? 'Unmute' : 'Mute'}
>
{isMuted ? <MicOff size={18} /> : <Mic size={18} />}
</button>
<button
onClick={toggleDeafen}
className={clsx(
'rounded p-1.5 hover:bg-background-accent',
isDeafened && 'text-text-danger'
            )}
title={isDeafened ? 'Undeafen' : 'Deafen'}
>
{isDeafened ? <VolumeX size={18} /> : <Headphones size={18} />}
</button>
</>
      )}
{/* Settings */}
<button
onClick={() => navigate('/settings')}
className="rounded p-1.5 hover:bg-background-accent"
title="User Settings"
>
<Settings size={18} />
</button>
</div>
  );
}