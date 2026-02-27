import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { useGuildsStore } from '../../store/guilds';

interface InviteInfo {
  code: string;
  guild: {
    id: string;
    name: string;
    description?: string;
    iconUrl?: string;
    memberCount: number;
  };
  expiresAt?: string;
}

export function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const addGuild = useGuildsStore((state) => state.addGuild);

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!code) return;

    api
      .getInviteInfo(code)
      .then(setInviteInfo)
      .catch((err) => {
        setError(err.response?.data?.error?.message || 'Invalid or expired invite');
      })
      .finally(() => setIsLoading(false));
  }, [code]);

  const handleJoin = async () => {
    if (!code || !isAuthenticated) return;

    setIsJoining(true);
    try {
      const { guild } = await api.redeemInvite(code);
      // Add guild to store
      addGuild(guild);
      // Invalidate guilds query so it refetches
      await queryClient.invalidateQueries({ queryKey: ['guilds'] });
      navigate(`/channels/${guild.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to join server');
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-tertiary">
        <div className="text-text-muted">Loading invite...</div>
      </div>
    );
  }

  if (error || !inviteInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-tertiary p-4">
        <div className="w-full max-w-md rounded-lg bg-background-secondary p-8 text-center shadow-xl">
          <div className="text-4xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-text-normal mb-2">
            Invalid Invite
          </h1>
          <p className="text-text-muted mb-6">
            {error || 'This invite may be expired or invalid.'}
          </p>
          <Link to="/" className="btn btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-tertiary p-4">
      <div className="w-full max-w-md rounded-lg bg-background-secondary p-8 shadow-xl">
        <div className="text-center">
          <p className="text-text-muted mb-4">You've been invited to join</p>

          {/* Server icon */}
          <div className="mx-auto mb-4 avatar h-20 w-20 text-2xl">
            {inviteInfo.guild.iconUrl ? (
              <img
                src={inviteInfo.guild.iconUrl}
                alt=""
                className="h-full w-full rounded-full"
              />
            ) : (
              inviteInfo.guild.name
                .split(' ')
                .map((word) => word[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            )}
          </div>

          {/* Server name */}
          <h1 className="text-2xl font-bold text-text-normal mb-2">
            {inviteInfo.guild.name}
          </h1>

          {/* Description */}
          {inviteInfo.guild.description && (
            <p className="text-text-muted mb-4">{inviteInfo.guild.description}</p>
          )}

          {/* Member count */}
          <div className="flex items-center justify-center gap-4 text-sm text-text-muted mb-6">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-status-online" />
              <span>Online</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-status-offline" />
              <span>{inviteInfo.guild.memberCount} Members</span>
            </div>
          </div>

          {/* Action buttons */}
          {isAuthenticated ? (
            <button
              onClick={handleJoin}
              disabled={isJoining}
              className="btn btn-primary w-full py-3"
            >
              {isJoining ? 'Joining...' : 'Accept Invite'}
            </button>
          ) : (
            <div className="space-y-3">
              <Link to="/login" className="btn btn-primary block w-full py-3">
                Log In to Join
              </Link>
              <Link
                to="/register"
                className="btn btn-secondary block w-full py-3"
              >
                Create an Account
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
