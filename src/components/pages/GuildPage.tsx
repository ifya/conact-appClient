import { useParams } from 'react-router-dom';
import { Hash, Users, Bell, Pin, Search, Inbox, HelpCircle } from 'lucide-react';
import { useGuildsStore } from '../../store/guilds';
import { MessageArea } from '../MessageArea';
import { MemberList } from '../MemberList';
import { useState } from 'react';

export function GuildPage() {
  const { guildId, channelId } = useParams();
  const guilds = useGuildsStore((state) => state.guilds);
  const currentGuild = guilds.find((g) => g.id === guildId);
  const currentChannel = currentGuild?.channels.find((c) => c.id === channelId);

  const [showMembers, setShowMembers] = useState(true);

  if (!currentGuild) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Guild not found
      </div>
    );
  }

  if (!currentChannel) {
    return (
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">👋</div>
            <h2 className="text-xl font-semibold text-text-normal">
              Welcome to {currentGuild.name}!
            </h2>
            <p className="text-text-muted mt-2">
              Select a channel from the sidebar to start chatting
            </p>
          </div>
        </div>
        <MemberList guildId={guildId!} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Channel header */}
      <header className="flex h-12 items-center justify-between border-b border-background-tertiary px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Hash size={20} className="text-text-muted" />
          <span className="font-semibold text-text-normal">{currentChannel.name}</span>
          {currentChannel.topic && (
            <>
              <div className="mx-2 h-6 w-px bg-background-accent" />
              <span className="text-sm text-text-muted truncate max-w-md">
                {currentChannel.topic}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button className="text-text-muted hover:text-text-normal">
            <Bell size={20} />
          </button>
          <button className="text-text-muted hover:text-text-normal">
            <Pin size={20} />
          </button>
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={`${showMembers ? 'text-text-normal' : 'text-text-muted'} hover:text-text-normal`}
          >
            <Users size={20} />
          </button>

          <div className="flex items-center gap-1 rounded bg-background-tertiary px-2">
            <input
              type="text"
              placeholder="Search"
              className="w-32 bg-transparent py-1 text-sm text-text-normal placeholder-text-muted outline-none"
            />
            <Search size={16} className="text-text-muted" />
          </div>

          <button className="text-text-muted hover:text-text-normal">
            <Inbox size={20} />
          </button>
          <button className="text-text-muted hover:text-text-normal">
            <HelpCircle size={20} />
          </button>
        </div>
      </header>

      {/* Content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <MessageArea />
        {showMembers && <MemberList guildId={guildId!} />}
      </div>
    </div>
  );
}
