import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Upload, Users } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

interface CreateGuildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InvitePreview {
  code: string;
  guild: {
    id: string;
    name: string;
    description?: string;
    iconUrl?: string;
    memberCount: number;
  };
  expiresAt: string | null;
}

export function CreateGuildDialog({ open, onOpenChange }: CreateGuildDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'choose' | 'create' | 'join'>('choose');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Extract code from URL or plain code
  const extractCode = useCallback((input: string): string => {
    const trimmed = input.trim();
    if (trimmed.includes('/')) {
      return trimmed.split('/').pop() || trimmed;
    }
    return trimmed;
  }, []);

  // Fetch invite preview when code changes
  useEffect(() => {
    const code = extractCode(inviteCode);
    if (code.length >= 6) {
      const timer = setTimeout(async () => {
        setIsLoadingPreview(true);
        setError('');
        try {
          const preview = await api.getInviteInfo(code);
          setInvitePreview(preview);
        } catch (err: any) {
          setInvitePreview(null);
          if (err.response?.status === 404) {
            setError('Invalid or expired invite');
          }
        } finally {
          setIsLoadingPreview(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setInvitePreview(null);
    }
  }, [inviteCode, extractCode]);

  const resetDialog = () => {
    setStep('choose');
    setName('');
    setDescription('');
    setInviteCode('');
    setError('');
    setIsLoading(false);
    setInvitePreview(null);
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Server name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const guild = await api.createGuild({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      // Invalidate and refetch guilds to ensure store is in sync
      await queryClient.invalidateQueries({ queryKey: ['guilds'] });
      handleClose();
      navigate(`/channels/${guild.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Invite code is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Extract code from full URL if pasted
      const code = inviteCode.includes('/')
        ? inviteCode.split('/').pop() || inviteCode
        : inviteCode;

      const { guild } = await api.redeemInvite(code.trim());
      // Invalidate and refetch guilds to ensure store is in sync
      await queryClient.invalidateQueries({ queryKey: ['guilds'] });
      handleClose();
      navigate(`/channels/${guild.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Invalid invite code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background-primary p-0 shadow-xl outline-none">
          {step === 'choose' && (
            <div className="p-4">
              <div className="mb-6 text-center">
                <Dialog.Title className="text-2xl font-bold text-text-normal">
                  Create a server
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-text-muted">
                  Your server is where you and your friends hang out. Make yours
                  and start talking.
                </Dialog.Description>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setStep('create')}
                  className="flex w-full items-center justify-between rounded-lg border border-background-accent p-4 text-left hover:bg-background-secondary"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary text-white">
                      <span className="text-xl">🎮</span>
                    </div>
                    <div>
                      <div className="font-semibold text-text-normal">
                        Create My Own
                      </div>
                    </div>
                  </div>
                  <span className="text-text-muted">→</span>
                </button>
              </div>

              <div className="mt-6 border-t border-background-accent pt-4">
                <h3 className="mb-2 text-center text-lg font-semibold text-text-normal">
                  Have an invite already?
                </h3>
                <button
                  onClick={() => setStep('join')}
                  className="btn btn-secondary w-full"
                >
                  Join a Server
                </button>
              </div>

              <Dialog.Close
                onClick={handleClose}
                className="absolute right-4 top-4 text-text-muted hover:text-text-normal"
              >
                <X size={24} />
              </Dialog.Close>
            </div>
          )}

          {step === 'create' && (
            <div className="p-4">
              <button
                onClick={() => setStep('choose')}
                className="mb-4 text-sm text-text-muted hover:text-text-normal"
              >
                ← Back
              </button>

              <div className="mb-6 text-center">
                <Dialog.Title className="text-2xl font-bold text-text-normal">
                  Customize your server
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-text-muted">
                  Give your new server a personality with a name and an icon.
                  You can always change it later.
                </Dialog.Description>
              </div>

              {error && (
                <div className="mb-4 rounded bg-text-danger/10 p-3 text-sm text-text-danger">
                  {error}
                </div>
              )}

              <div className="mb-4 flex justify-center">
                <button className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-dashed border-text-muted text-text-muted hover:border-text-normal hover:text-text-normal">
                  <Upload size={24} />
                  <span className="mt-1 text-xs">Upload</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-text-muted">
                    Server Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    placeholder="My Awesome Server"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-text-muted">
                    Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input resize-none"
                    rows={3}
                    placeholder="What's your server about?"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep('choose')} className="btn btn-secondary">
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isLoading || !name.trim()}
                  className="btn btn-primary"
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>

              <Dialog.Close
                onClick={handleClose}
                className="absolute right-4 top-4 text-text-muted hover:text-text-normal"
              >
                <X size={24} />
              </Dialog.Close>
            </div>
          )}

          {step === 'join' && (
            <div className="p-4">
              <button
                onClick={() => setStep('choose')}
                className="mb-4 text-sm text-text-muted hover:text-text-normal"
              >
                ← Back
              </button>

              <div className="mb-6 text-center">
                <Dialog.Title className="text-2xl font-bold text-text-normal">
                  Join a Server
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-text-muted">
                  Enter an invite below to join an existing server
                </Dialog.Description>
              </div>

              {error && (
                <div className="mb-4 rounded bg-text-danger/10 p-3 text-sm text-text-danger">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-text-muted">
                  Invite Link <span className="text-text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value);
                    setError('');
                  }}
                  className="input"
                  placeholder="https://conact.app/invite/abc123 or abc123"
                />
              </div>

              {/* Server Preview */}
              {isLoadingPreview && (
                <div className="mt-4 rounded-lg bg-background-secondary p-4 text-center">
                  <div className="text-sm text-text-muted">Loading preview...</div>
                </div>
              )}

              {invitePreview && !isLoadingPreview && (
                <div className="mt-4 rounded-lg bg-background-secondary p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-xl text-white">
                      {invitePreview.guild.iconUrl ? (
                        <img
                          src={invitePreview.guild.iconUrl}
                          alt=""
                          className="h-full w-full rounded-xl object-cover"
                        />
                      ) : (
                        invitePreview.guild.name[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-text-normal">
                        {invitePreview.guild.name}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-text-muted">
                        <Users size={12} />
                        <span>{invitePreview.guild.memberCount} members</span>
                      </div>
                    </div>
                  </div>
                  {invitePreview.guild.description && (
                    <p className="mt-2 text-sm text-text-muted">
                      {invitePreview.guild.description}
                    </p>
                  )}
                </div>
              )}

              {!invitePreview && !isLoadingPreview && !error && (
                <div className="mt-4">
                  <h4 className="mb-2 text-xs font-bold uppercase text-text-muted">
                    Invites should look like
                  </h4>
                  <div className="space-y-1 text-sm text-text-muted">
                    <div>hTKzmak</div>
                    <div>https://conact.app/invite/hTKzmak</div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep('choose')} className="btn btn-secondary">
                  Back
                </button>
                <button
                  onClick={handleJoin}
                  disabled={isLoading || !inviteCode.trim() || (!invitePreview && !isLoadingPreview)}
                  className="btn btn-primary"
                >
                  {isLoading ? 'Joining...' : 'Join Server'}
                </button>
              </div>

              <Dialog.Close
                onClick={handleClose}
                className="absolute right-4 top-4 text-text-muted hover:text-text-normal"
              >
                <X size={24} />
              </Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
