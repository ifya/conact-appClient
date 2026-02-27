import { useNavigate, useParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Plus, Compass, MessageCircle, Volume2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useGuildsStore } from '../store/guilds';
import { CreateGuildDialog } from './dialogs/CreateGuildDialog';
import { api } from '../services/api';
import { clsx } from 'clsx';
export function GuildSidebar() {
const navigate = useNavigate();
const { guildId } = useParams();
const guilds = useGuildsStore((state) => state.guilds);
const [showCreateDialog, setShowCreateDialog] = useState(false);
const isHome = !guildId || guildId === '@me';

// Get all voice channels across all guilds
const allVoiceChannels = useMemo(() => {
  const channels: { guildId: string; channelId: string }[] = [];
  guilds.forEach((guild) => {
    guild.channels
      .filter((c) => c.type === 'voice' || c.type === 'stage')
      .forEach((channel) => {
        channels.push({ guildId: guild.id, channelId: channel.id });
      });
  });
  return channels;
}, [guilds]);

// Query voice participants for all guilds
const { data: voiceActivityByGuild } = useQuery({
  queryKey: ['guildVoiceActivity', allVoiceChannels.map(c => `${c.guildId}:${c.channelId}`).join(',')],
  queryFn: async () => {
    const guildActivity: Record<string, number> = {};
    await Promise.all(
      allVoiceChannels.map(async ({ guildId, channelId }) => {
        try {
          const participants = await api.getVoiceParticipants(guildId, channelId);
          if (participants && participants.length > 0) {
            guildActivity[guildId] = (guildActivity[guildId] || 0) + participants.length;
          }
        } catch {
          // Ignore errors for individual channels
        }
      })
    );
    return guildActivity;
  },
  enabled: allVoiceChannels.length > 0,
  refetchInterval: 10000, // Poll every 10 seconds
  staleTime: 5000,
});

return (
<>
<div className="flex h-full w-[72px] flex-col items-center gap-2 bg-background-tertiary py-3 scrollbar-none overflow-y-auto">
{/* Home button (DMs) */}
<div className="relative mb-2">
<button
onClick={() => navigate('/channels/@me')}
className={clsx(
'flex h-12 w-12 items-center justify-center rounded-[24px] transition-all duration-200',
isHome
                ? 'rounded-[16px] bg-brand-primary text-white'
                : 'bg-background-primary text-text-normal hover:rounded-[16px] hover:bg-brand-primary hover:text-white'
            )}
>
<MessageCircle size={24} />
</button>
{isHome && (
<div className="absolute -left-3 top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-white" />
          )}
</div>
{/* Separator */}
<div className="mx-auto h-0.5 w-8 rounded-full bg-background-accent" />
{/* Guild list */}
{guilds.map((guild) => {
const isActive = guildId === guild.id;
const hasVoiceActivity = voiceActivityByGuild && voiceActivityByGuild[guild.id] > 0;
return (
<div key={guild.id} className="group relative">
<button
onClick={() => navigate(`/channels/${guild.id}`)}
className={clsx(
'flex h-12 w-12 items-center justify-center rounded-[24px] transition-all duration-200',
isActive
                    ? 'rounded-[16px] bg-brand-primary text-white'
                    : 'bg-background-primary text-text-normal hover:rounded-[16px] hover:bg-brand-primary hover:text-white'
                )}
>
{guild.iconUrl ? (
<img
src={guild.iconUrl}
alt={guild.name}
className="h-full w-full rounded-[inherit] object-cover"
/>
                ) : (
<span className="text-sm font-semibold">
{guild.name
                      .split(' ')
                      .map((word) => word[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
</span>
                )}
</button>
{/* Voice activity indicator */}
{hasVoiceActivity && (
<div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background-tertiary">
<Volume2 size={12} className="text-text-positive" />
</div>
              )}
{/* Active indicator */}
<div
className={clsx(
'absolute -left-3 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-white transition-all',
isActive
                    ? 'h-10'
                    : 'h-0 group-hover:h-5'
                )}
/>
{/* Tooltip */}
<div className="pointer-events-none absolute left-full top-1/2 z-50 ml-4 -translate-y-1/2 whitespace-nowrap rounded bg-background-floating px-3 py-2 text-sm font-medium text-text-normal opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
{guild.name}
</div>
</div>
          );
        })}
{/* Separator */}
<div className="mx-auto h-0.5 w-8 rounded-full bg-background-accent" />
{/* Add server button */}
<div className="group relative">
<button
onClick={() => setShowCreateDialog(true)}
className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-background-primary text-text-positive transition-all duration-200 hover:rounded-[16px] hover:bg-text-positive hover:text-white"
>
<Plus size={24} />
</button>
<div className="pointer-events-none absolute left-full top-1/2 z-50 ml-4 -translate-y-1/2 whitespace-nowrap rounded bg-background-floating px-3 py-2 text-sm font-medium text-text-normal opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Add a Server
</div>
</div>
{/* Explore servers button */}
<div className="group relative">
<button
onClick={() => navigate('/guild-discovery')}
className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-background-primary text-text-positive transition-all duration-200 hover:rounded-[16px] hover:bg-text-positive hover:text-white"
>
<Compass size={24} />
</button>
<div className="pointer-events-none absolute left-full top-1/2 z-50 ml-4 -translate-y-1/2 whitespace-nowrap rounded bg-background-floating px-3 py-2 text-sm font-medium text-text-normal opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Explore Servers
</div>
</div>
</div>
<CreateGuildDialog
open={showCreateDialog}
onOpenChange={setShowCreateDialog}
/>
</>
  );
}