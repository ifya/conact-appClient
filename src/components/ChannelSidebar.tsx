import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Hash, Volume2, ChevronDown, ChevronRight, Plus, Settings, Megaphone, Users, MicOff, UserPlus, LogOut, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useGuildsStore, Channel } from '../store/guilds';
import { useVoiceStore } from '../store/voice';
import { useDMStore } from '../store/dm';
import { useFriendsStore } from '../store/friends';
import { api } from '../services/api';
import { clsx } from 'clsx';
import { InviteDialog } from './dialogs/InviteDialog';
import { ParticipantContextMenu } from './ParticipantContextMenu';
interface GuildMember {
user: {
id: string;
matrixUserId: string;
displayName: string;
avatarUrl?: string;
  };
}
interface VoiceParticipantFromServer {
identity: string;
name: string;
joinedAt: number | null;
audioTrackPublished: boolean;
videoTrackPublished: boolean;
screenSharePublished: boolean;
}
const channelIcons: Record<string, React.ElementType> = {
text: Hash,
voice: Volume2,
announcement: Megaphone,
stage: Users,
};
export function ChannelSidebar() {
const navigate = useNavigate();
const { guildId, channelId } = useParams();
const guilds = useGuildsStore((state) => state.guilds);
const currentGuild = guilds.find((g) => g.id === guildId);
const {
connect,
currentChannelId: voiceChannelId,
currentGuildId: voiceGuildId,
isConnected,
isConnecting,
localParticipant,
participants
  } = useVoiceStore();
const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
const [showGuildMenu, setShowGuildMenu] = useState(false);
const [showInviteDialog, setShowInviteDialog] = useState(false);
const menuRef = useRef<HTMLDivElement>(null);
// Fetch guild members for avatar lookup
const { data: members } = useQuery({
queryKey: ['guildMembers', guildId],
queryFn: () => api.getMembers(guildId!),
enabled: !!guildId,
staleTime: 30000, // 30 seconds
  });
// Fetch voice channel participants for all voice channels in the guild
const voiceChannels = currentGuild?.channels.filter(c => c.type === 'voice' || c.type === 'stage') || [];
const voiceChannelIds = voiceChannels.map(c => c.id);
const { data: voiceParticipantsData } = useQuery({
queryKey: ['voiceParticipants', guildId, voiceChannelIds],
queryFn: async () => {
const results: Record<string, VoiceParticipantFromServer[]> = {};
await Promise.all(
voiceChannelIds.map(async (channelId) => {
try {
const participants = await api.getVoiceParticipants(guildId!, channelId);
results[channelId] = participants;
          } catch {
results[channelId] = [];
          }
        })
      );
return results;
    },
enabled: !!guildId && voiceChannelIds.length > 0,
refetchInterval: 5000, // Poll every 5 seconds for real-time updates
staleTime: 2000,
  });
// Create a map of Matrix user ID -> member data for quick lookup
const memberByMatrixId = useMemo(() => {
const map = new Map<string, GuildMember['user']>();
    (members ?? []).forEach((m: GuildMember) => {
if (m.user?.matrixUserId) {
map.set(m.user.matrixUserId, m.user);
      }
    });
return map;
  }, [members]);
// Close menu when clicking outside
useEffect(() => {
const handleClickOutside = (event: MouseEvent) => {
if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
setShowGuildMenu(false);
      }
    };
document.addEventListener('mousedown', handleClickOutside);
return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
const location = useLocation();
const { threads, fetchThreads } = useDMStore();
const { incomingRequests, startPolling, stopPolling } = useFriendsStore();
const { threadId: activeThreadId } = useParams();

// Start polling for DM threads and friends data when in DM mode
useEffect(() => {
if (!currentGuild) {
fetchThreads();
startPolling();
return () => stopPolling();
}
}, [currentGuild, fetchThreads, startPolling, stopPolling]);

if (!currentGuild) {
const isFriendsPage = location.pathname === '/channels/@me' || location.pathname === '/dm';
const pendingRequestCount = incomingRequests.length;

// Show DM sidebar
return (
<div className="flex h-full flex-1 flex-col">
<div className="flex h-12 items-center border-b border-background-tertiary px-4 shadow-sm">
<button className="input text-left text-text-muted">
            Find or start a conversation
</button>
</div>
<div className="flex-1 overflow-y-auto p-2">
<button
onClick={() => navigate('/channels/@me')}
className={clsx(
'sidebar-item mb-2 w-full',
isFriendsPage && 'active'
)}
>
<Users size={20} />
<span>Friends</span>
{pendingRequestCount > 0 && (
<span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
{pendingRequestCount}
</span>
)}
</button>
<h3 className="px-2 py-1 text-xs font-semibold uppercase text-text-muted">
            Direct Messages
</h3>
{threads.length === 0 ? (
<div className="px-2 py-4 text-center text-sm text-text-muted">
              No direct messages yet
</div>
) : (
<div className="space-y-0.5">
{threads.map((thread) => (
<button
key={thread.id}
onClick={() => navigate(`/dm/${thread.id}`)}
className={clsx(
'sidebar-item w-full',
activeThreadId === thread.id && 'active'
)}
>
<div className="avatar h-8 w-8 text-sm">
{thread.otherUser?.avatarUrl ? (
<img
src={thread.otherUser.avatarUrl}
alt=""
className="h-full w-full rounded-full"
/>
) : (
thread.otherUser?.displayName?.[0]?.toUpperCase() || '?'
)}
</div>
<span className="truncate">
{thread.otherUser?.displayName || 'Unknown User'}
</span>
</button>
))}
</div>
)}
</div>
</div>
    );
  }
// Group channels by category
const categories = currentGuild.channels.filter((c) => c.type === 'category');
const uncategorizedChannels = currentGuild.channels.filter(
    (c) => c.type !== 'category' && !c.parentCategoryId
  );
const toggleCategory = (categoryId: string) => {
setCollapsedCategories((prev) => {
const next = new Set(prev);
if (next.has(categoryId)) {
next.delete(categoryId);
      } else {
next.add(categoryId);
      }
return next;
    });
  };
const handleChannelClick = async (channel: Channel) => {
if (channel.type === 'voice' || channel.type === 'stage') {
// Prevent multiple join attempts while connecting or already connected to this channel
if (isConnecting) {
return;
      }
if (isConnected && voiceChannelId === channel.id) {
return; // Already connected to this channel
      }
try {
const { token, serverUrl } = await api.joinVoiceChannel(currentGuild.id, channel.id);
await connect(token, serverUrl, channel.id, currentGuild.id);
      } catch (error) {
console.error('Failed to join voice channel:', error);
      }
    } else {
navigate(`/channels/${currentGuild.id}/${channel.id}`);
    }
  };
const renderChannel = (channel: Channel) => {
const Icon = channelIcons[channel.type] || Hash;
const isActive = channelId === channel.id;
const isVoiceChannel = channel.type === 'voice' || channel.type === 'stage';
const isThisVoiceChannelConnected = isConnected && voiceChannelId === channel.id && voiceGuildId === guildId;
// Get participants from server API (shows all users in channel, not just when we're connected)
const serverParticipants = voiceParticipantsData?.[channel.id] || [];
// If we're connected to this channel, use local state (more up-to-date) for real-time speaking indicators
// Otherwise use server data
const channelParticipants = isThisVoiceChannelConnected
? [localParticipant, ...Array.from(participants.values())].filter(Boolean)
: serverParticipants.map(p => ({
identity: p.identity,
displayName: p.name,
isSpeaking: false, // Server doesn't track speaking state
isMuted: !p.audioTrackPublished,
isVideoEnabled: p.videoTrackPublished,
isScreenSharing: p.screenSharePublished,
        }));
return (
<div key={channel.id}>
<button
onClick={() => handleChannelClick(channel)}
className={clsx(
'sidebar-item w-full justify-between group',
isActive && 'active',
isThisVoiceChannelConnected && 'bg-brand-primary/20'
          )}
>
<div className="flex items-center gap-1.5">
<Icon size={18} className={isVoiceChannel && isThisVoiceChannelConnected ? 'text-text-positive' : ''} />
<span className="truncate">{channel.name}</span>
</div>
<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
<button className="hover:text-text-normal">
<Settings size={14} />
</button>
</div>
</button>
{/* Show participants in voice channel */}
{isVoiceChannel && channelParticipants.length > 0 && (
<div className="ml-6 mt-1 space-y-1">
{channelParticipants.map((participant, index) => {
// Look up member data by Matrix ID (participant.identity is @user:localhost)
const memberData = memberByMatrixId.get(participant!.identity);
const displayName = memberData?.displayName || participant!.displayName;
const avatarUrl = memberData?.avatarUrl;
// First participant is local when connected, otherwise check against localParticipant
const isLocalUser = isThisVoiceChannelConnected && index === 0;
// Can only control volume for remote participants when connected to this channel
const canControlVolume = isThisVoiceChannelConnected && !isLocalUser;

const participantElement = (
<div
className={clsx(
"flex items-center gap-2 rounded px-2 py-1 text-sm",
canControlVolume && "cursor-context-menu hover:bg-background-accent"
)}
>
<div
className={clsx(
'h-6 w-6 rounded-full flex items-center justify-center text-xs text-white flex-shrink-0 overflow-hidden',
!avatarUrl && 'bg-brand-primary',
participant!.isSpeaking && 'ring-2 ring-text-positive'
)}
>
{avatarUrl ? (
<img
src={avatarUrl}
alt={displayName}
className="h-full w-full object-cover"
/>
) : (
displayName?.[0]?.toUpperCase() || '?'
)}
</div>
<span className="truncate text-text-muted">
{displayName}
{isLocalUser && ' (you)'}
</span>
{participant!.isMuted && (
<MicOff size={14} className="text-text-danger ml-auto flex-shrink-0" />
)}
</div>
);

// Wrap with context menu only for remote participants when connected
if (canControlVolume) {
return (
<ParticipantContextMenu
key={participant!.identity}
participantIdentity={participant!.identity}
participantName={displayName}
>
{participantElement}
</ParticipantContextMenu>
);
}

return <div key={participant!.identity}>{participantElement}</div>;
})}
</div>
)}
</div>
    );
  };
const renderCategory = (category: Channel) => {
const isCollapsed = collapsedCategories.has(category.id);
const childChannels = currentGuild.channels.filter(
      (c) => c.parentCategoryId === category.id
    );
return (
<div key={category.id} className="mt-4">
<button
onClick={() => toggleCategory(category.id)}
className="flex w-full items-center gap-1 px-1 text-xs font-semibold uppercase text-text-muted hover:text-text-normal"
>
{isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
<span className="truncate">{category.name}</span>
<Plus size={14} className="ml-auto opacity-0 hover:opacity-100" />
</button>
{!isCollapsed && (
<div className="mt-1 space-y-0.5 pl-2">
{childChannels.map(renderChannel)}
</div>
        )}
</div>
    );
  };
return (
<div className="flex h-full flex-1 flex-col overflow-hidden">
{/* Guild header with dropdown */}
<div className="relative" ref={menuRef}>
<button
onClick={() => setShowGuildMenu(!showGuildMenu)}
className="flex h-12 w-full items-center justify-between border-b border-background-tertiary px-4 hover:bg-background-accent"
>
<span className="truncate font-semibold">{currentGuild.name}</span>
{showGuildMenu ? <X size={18} /> : <ChevronDown size={18} />}
</button>
{/* Guild dropdown menu */}
{showGuildMenu && (
<div className="absolute left-2 right-2 top-14 z-50 rounded-md bg-background-floating p-1.5 shadow-lg">
<button
onClick={() => {
setShowInviteDialog(true);
setShowGuildMenu(false);
              }}
className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-brand-primary hover:bg-brand-primary hover:text-white"
>
<UserPlus size={16} />
              Invite People
</button>
<div className="my-1 h-px bg-background-accent" />
<button
onClick={() => {
// TODO: Guild settings
setShowGuildMenu(false);
              }}
className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-text-normal hover:bg-background-accent"
>
<Settings size={16} />
              Server Settings
</button>
<div className="my-1 h-px bg-background-accent" />
<button
onClick={async () => {
if (confirm('Are you sure you want to leave this server?')) {
try {
await api.leaveGuild(currentGuild.id);
navigate('/channels/@me');
// Refresh guilds
window.location.reload();
                  } catch (error) {
console.error('Failed to leave guild:', error);
                  }
                }
setShowGuildMenu(false);
              }}
className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-text-danger hover:bg-text-danger hover:text-white"
>
<LogOut size={16} />
              Leave Server
</button>
</div>
        )}
</div>
{/* Invite dialog */}
<InviteDialog
open={showInviteDialog}
onOpenChange={setShowInviteDialog}
guildId={currentGuild.id}
/>
{/* Channel list */}
<div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
{/* Uncategorized channels */}
{uncategorizedChannels.length > 0 && (
<div className="space-y-0.5">
{uncategorizedChannels.map(renderChannel)}
</div>
        )}
{/* Categories and their channels */}
{categories.map(renderCategory)}
</div>
</div>
  );
}