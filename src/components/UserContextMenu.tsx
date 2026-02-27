import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, MessageCircle, UserMinus, Check, Clock } from 'lucide-react';
import { useFriendsStore } from '../store/friends';
import { useDMStore } from '../store/dm';
import { useAuthStore } from '../store/auth';
import { clsx } from 'clsx';

interface UserContextMenuProps {
  userId: string;
  displayName: string;
  matrixUserId?: string;
  position: { x: number; y: number };
  onClose: () => void;
}

type FriendshipStatus = 'none' | 'friends' | 'pending_incoming' | 'pending_outgoing';

export function UserContextMenu({
  userId,
  displayName,
  matrixUserId,
  position,
  onClose,
}: UserContextMenuProps) {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = useAuthStore((state) => state.user);
  const { friends, incomingRequests, outgoingRequests, sendFriendRequest, acceptRequest, removeFriend } = useFriendsStore();
  const { createOrGetThread } = useDMStore();

  // Don't show menu for own user
  const isOwnUser = currentUser?.id === userId;

  // Determine friendship status (friends now have .user property, requests have .user property)
  const getFriendshipStatus = (): FriendshipStatus => {
    if (friends.some((f) => f.user?.id === userId)) {
      return 'friends';
    }
    const incoming = incomingRequests.find((r) => r.user?.id === userId);
    if (incoming) {
      return 'pending_incoming';
    }
    const outgoing = outgoingRequests.find((r) => r.user?.id === userId);
    if (outgoing) {
      return 'pending_outgoing';
    }
    return 'none';
  };

  const friendshipStatus = getFriendshipStatus();
  const incomingRequest = incomingRequests.find((r) => r.user?.id === userId);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200),
    y: Math.min(position.y, window.innerHeight - 200),
  };

  const handleSendMessage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const thread = await createOrGetThread(userId);
      onClose();
      navigate(`/dm/${thread.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFriend = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await sendFriendRequest(userId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send friend request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptFriend = async () => {
    if (!incomingRequest) return;
    setIsLoading(true);
    setError(null);
    try {
      await acceptRequest(incomingRequest.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to accept friend request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await removeFriend(userId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to remove friend');
    } finally {
      setIsLoading(false);
    }
  };

  if (isOwnUser) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg bg-background-tertiary shadow-xl border border-background-accent overflow-hidden"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-background-accent">
        <div className="font-medium text-text-normal truncate">{displayName}</div>
        {matrixUserId && (
          <div className="text-xs text-text-muted truncate">{matrixUserId}</div>
        )}
      </div>

      {/* Actions */}
      <div className="py-1">
        {/* Send Message */}
        <button
          onClick={handleSendMessage}
          disabled={isLoading}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 text-sm text-text-normal hover:bg-background-accent transition-colors',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <MessageCircle size={16} />
          Send Message
        </button>

        {/* Friend Actions based on status */}
        {friendshipStatus === 'none' && (
          <button
            onClick={handleAddFriend}
            disabled={isLoading}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 text-sm text-text-normal hover:bg-background-accent transition-colors',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <UserPlus size={16} />
            Add Friend
          </button>
        )}

        {friendshipStatus === 'pending_outgoing' && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted">
            <Clock size={16} />
            Friend Request Sent
          </div>
        )}

        {friendshipStatus === 'pending_incoming' && (
          <button
            onClick={handleAcceptFriend}
            disabled={isLoading}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 text-sm text-green-400 hover:bg-background-accent transition-colors',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Check size={16} />
            Accept Friend Request
          </button>
        )}

        {friendshipStatus === 'friends' && (
          <button
            onClick={handleRemoveFriend}
            disabled={isLoading}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-background-accent transition-colors',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <UserMinus size={16} />
            Remove Friend
          </button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 border-t border-background-accent">
          <div className="text-xs text-red-400">{error}</div>
        </div>
      )}
    </div>
  );
}
