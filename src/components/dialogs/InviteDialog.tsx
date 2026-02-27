import { useState, useEffect } from 'react';
import { X, Copy, Check, Link, Clock, Users, RefreshCw } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { api } from '../../services/api';
import { useGuildsStore } from '../../store/guilds';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guildId: string;
}

interface Invite {
  id: string;
  code: string;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  createdAt: string;
  url: string;
}

export function InviteDialog({ open, onOpenChange, guildId }: InviteDialogProps) {
  const guilds = useGuildsStore((state) => state.guilds);
  const guild = guilds.find((g) => g.id === guildId);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Settings for new invite
  const [maxUses, setMaxUses] = useState<number | ''>('');
  const [maxAge, setMaxAge] = useState<number>(86400); // 24 hours default

  const maxAgeOptions = [
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' },
    { value: 21600, label: '6 hours' },
    { value: 43200, label: '12 hours' },
    { value: 86400, label: '1 day' },
    { value: 604800, label: '7 days' },
    { value: 0, label: 'Never' },
  ];

  const maxUsesOptions = [
    { value: '', label: 'No limit' },
    { value: 1, label: '1 use' },
    { value: 5, label: '5 uses' },
    { value: 10, label: '10 uses' },
    { value: 25, label: '25 uses' },
    { value: 50, label: '50 uses' },
    { value: 100, label: '100 uses' },
  ];

  useEffect(() => {
    if (open && guildId) {
      loadInvites();
    }
  }, [open, guildId]);

  const loadInvites = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getInvites(guildId);
      setInvites(data);
    } catch (err: any) {
      console.error('Failed to load invites:', err);
      // Don't show error if user doesn't have permission - just show empty
      if (err.response?.status !== 403) {
        setError('Failed to load invites');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createInvite = async () => {
    setIsCreating(true);
    setError('');
    try {
      const newInvite = await api.createInvite(guildId, {
        maxUses: maxUses === '' ? undefined : maxUses,
        maxAge: maxAge === 0 ? undefined : maxAge,
      });
      setInvites([newInvite, ...invites]);
      copyToClipboard(newInvite.code, newInvite.url);
      setShowSettings(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create invite');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteInvite = async (inviteId: string) => {
    try {
      await api.deleteInvite(guildId, inviteId);
      setInvites(invites.filter((inv) => inv.id !== inviteId));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete invite');
    }
  };

  const copyToClipboard = (code: string, url?: string) => {
    const textToCopy = url || `https://conact.app/invite/${code}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (diffMs < 0) return 'Expired';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;

    const minutes = Math.floor(diffMs / (1000 * 60));
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background-primary shadow-xl outline-none">
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="text-xl font-bold text-text-normal">
                Invite people to {guild?.name}
              </Dialog.Title>
              <Dialog.Close className="text-text-muted hover:text-text-normal">
                <X size={24} />
              </Dialog.Close>
            </div>

            {error && (
              <div className="mb-4 rounded bg-text-danger/10 p-3 text-sm text-text-danger">
                {error}
              </div>
            )}

            {/* Quick invite section */}
            <div className="mb-6">
              <div className="mb-2 text-sm text-text-muted">
                Share this link with others to grant access to this server
              </div>

              {invites.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded bg-background-tertiary px-3 py-2 text-text-normal">
                    <code className="text-sm">conact.app/invite/{invites[0].code}</code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(invites[0].code, invites[0].url)}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    {copiedCode === invites[0].code ? (
                      <>
                        <Check size={16} />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={createInvite}
                  disabled={isCreating}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Link size={16} />
                  {isCreating ? 'Creating...' : 'Generate Invite Link'}
                </button>
              )}
            </div>

            {/* Settings toggle */}
            <div className="mb-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-sm text-brand-primary hover:underline"
              >
                {showSettings ? 'Hide settings' : 'Edit invite link settings'}
              </button>
            </div>

            {/* Invite settings */}
            {showSettings && (
              <div className="mb-6 rounded-lg bg-background-secondary p-4">
                <h4 className="mb-3 text-sm font-semibold text-text-normal">
                  Create New Invite
                </h4>

                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">
                      Expire after
                    </label>
                    <select
                      value={maxAge}
                      onChange={(e) => setMaxAge(Number(e.target.value))}
                      className="input w-full"
                    >
                      {maxAgeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">
                      Max uses
                    </label>
                    <select
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value === '' ? '' : Number(e.target.value))}
                      className="input w-full"
                    >
                      {maxUsesOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={createInvite}
                  disabled={isCreating}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} className={isCreating ? 'animate-spin' : ''} />
                  {isCreating ? 'Creating...' : 'Generate New Link'}
                </button>
              </div>
            )}

            {/* Existing invites list */}
            {invites.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-text-muted">
                  Active Invites ({invites.length})
                </h4>
                <div className="max-h-48 overflow-y-auto rounded-lg bg-background-secondary">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between border-b border-background-tertiary p-3 last:border-b-0"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-text-normal">{inv.code}</code>
                          <button
                            onClick={() => copyToClipboard(inv.code, inv.url)}
                            className="text-text-muted hover:text-text-normal"
                          >
                            {copiedCode === inv.code ? (
                              <Check size={14} className="text-text-positive" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <Users size={12} />
                            {inv.uses}{inv.maxUses ? `/${inv.maxUses}` : ''} uses
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatExpiry(inv.expiresAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteInvite(inv.id)}
                        className="ml-2 text-text-muted hover:text-text-danger"
                        title="Delete invite"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="py-4 text-center text-text-muted">
                Loading invites...
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
