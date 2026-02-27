import { Outlet, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { matrixService } from '../services/matrix';
import { useGuildsStore } from '../store/guilds';
import { useAuthStore } from '../store/auth';
import { GuildSidebar } from './GuildSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { UserPanel } from './UserPanel';
import { VoicePanel } from './VoicePanel';
import { VoiceVideoOverlay } from './VoiceVideoOverlay';
import { TitleBar } from './TitleBar';
import { UpdateNotification } from './UpdateNotification';

export function Layout() {
  const { guildId } = useParams();
  const { setGuilds, setCurrentGuild } = useGuildsStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Fetch guilds
  const { data: guilds, isLoading } = useQuery({
    queryKey: ['guilds'],
    queryFn: () => api.getGuilds(),
    enabled: isAuthenticated,
  });

  // Initialize Matrix client
  useEffect(() => {
    if (isAuthenticated) {
      matrixService.initialize().then(() => {
        matrixService.startSync().catch(console.error);
      });
    }

    return () => {
      matrixService.stopSync();
    };
  }, [isAuthenticated]);

  // Update store when guilds are fetched
  useEffect(() => {
    if (guilds) {
      setGuilds(guilds);
    }
  }, [guilds, setGuilds]);

  // Set current guild when route changes
  useEffect(() => {
    if (guildId && guildId !== '@me') {
      setCurrentGuild(guildId);
    } else {
      setCurrentGuild(null);
    }
  }, [guildId, setCurrentGuild]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-tertiary">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  return (
    // Change: added 'flex-col' to the main wrapper
    <div className="flex flex-col h-screen overflow-hidden bg-background-tertiary">
      
      {/* 1. Title Bar at the very top */}
      <TitleBar />
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background-tertiary">
      {/* Guild sidebar (server list) */}
      <GuildSidebar />

      {/* Channel sidebar */}
      <div className="flex w-60 flex-col bg-background-secondary">
        <ChannelSidebar />
        <VoicePanel />
        <UserPanel />
      </div>

      {/* Main content area */}
      <main className="flex flex-1 flex-col bg-background-primary">
        <Outlet />
      </main>

      {/* Voice/Video overlay */}
      <VoiceVideoOverlay />

      {/* Auto-update notification */}
      <UpdateNotification />
    </div>
    </div>
  );
}
