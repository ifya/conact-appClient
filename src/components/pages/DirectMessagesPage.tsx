import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Search, UserPlus, Check, X, Plus, Smile, Send, Image, MessageCircle } from 'lucide-react';
import { useFriendsStore } from '../../store/friends';
import { useDMStore } from '../../store/dm';
import { useAuthStore } from '../../store/auth';
import { matrixService } from '../../services/matrix';
import { api } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import * as sdk from 'matrix-js-sdk';
import { EmojiPicker } from '../EmojiPicker';
import { GifPicker, GifData } from '../GifPicker';

const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isOwn: boolean;
  isDecrypting?: boolean;
  decryptionError?: string;
  isPending?: boolean;
  txnId?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}

type FriendsTab = 'all' | 'pending' | 'add';

export function DirectMessagesPage() {
  const { threadId, conversationId } = useParams();
  const navigate = useNavigate();
  const activeThreadId = threadId || conversationId;

  const [activeTab, setActiveTab] = useState<FriendsTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addFriendUsername, setAddFriendUsername] = useState('');
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [addFriendSuccess, setAddFriendSuccess] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { friends, incomingRequests, outgoingRequests, acceptRequest, declineRequest, sendFriendRequest, startPolling, stopPolling } = useFriendsStore();
  const { threads, fetchThreads, createOrGetThread } = useDMStore();
  const user = useAuthStore((state) => state.user);

  // Message state for DM view
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId);

  // Start polling for real-time updates and fetch DM threads
  useEffect(() => {
    startPolling();
    fetchThreads();
    return () => stopPolling();
  }, [startPolling, stopPolling, fetchThreads]);

  // Search for users to add as friends
  useEffect(() => {
    if (activeTab !== 'add' || !addFriendUsername.trim()) {
      setSearchResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchUsers(addFriendUsername);
        // Filter out current user and existing friends
        const filtered = results.filter(
          (u: any) =>
            u.id !== user?.id &&
            !friends.some((f) => f.user?.id === u.id)
        );
        setSearchResults(filtered);
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [addFriendUsername, activeTab, user?.id, friends]);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? 'auto' : 'smooth',
    });
  }, []);

  const getTxnIdFromEvent = useCallback((event: sdk.MatrixEvent): string | undefined => {
    const anyEvent = event as any;
    const unsigned = (event.getUnsigned?.() as any) || {};
    const directTxn = anyEvent.getTxnId?.() || unsigned.transaction_id || unsigned.txn_id;
    if (directTxn) return directTxn;

    const eventId = event.getId?.();
    if (eventId && eventId.startsWith('~')) {
      const lastColon = eventId.lastIndexOf(':');
      if (lastColon > -1 && lastColon < eventId.length - 1) {
        return eventId.slice(lastColon + 1);
      }
    }
    return undefined;
  }, []);

  const eventToMessage = useCallback(
    (event: sdk.MatrixEvent): Message => {
      const isEncrypted = event.isEncrypted();
      const decryptionFailure = event.isDecryptionFailure?.();
      const clearContent = event.getContent();

      let content = clearContent?.body || '';
      let decryptionError: string | undefined;
      let imageUrl: string | undefined;
      let imageWidth: number | undefined;
      let imageHeight: number | undefined;

      if (decryptionFailure) {
        decryptionError = 'Unable to decrypt message';
        content = '';
      }

      if (clearContent?.msgtype === 'm.image') {
        imageUrl = clearContent.url;
        if (imageUrl?.startsWith('mxc://')) {
          const client = matrixService.getClient();
          if (client) {
            imageUrl = client.mxcUrlToHttp(imageUrl) || imageUrl;
          }
        }
        if (!imageUrl?.startsWith('mxc://') && clearContent.url) {
          imageUrl = clearContent.url;
        }
        imageWidth = clearContent.info?.w;
        imageHeight = clearContent.info?.h;
      }

      const txnId = getTxnIdFromEvent(event);
      const matrixStatus = (event as any).status;
      const isPending = matrixStatus != null;

      return {
        id: event.getId() || '',
        senderId: event.getSender() || '',
        senderName: event.getSender()?.split(':')[0].substring(1) || 'Unknown',
        content,
        timestamp: new Date(event.getTs()),
        isOwn: event.getSender() === user?.matrixUserId,
        isDecrypting: isEncrypted && !clearContent?.body && !decryptionFailure,
        decryptionError,
        txnId,
        isPending,
        imageUrl,
        imageWidth,
        imageHeight,
      };
    },
    [user?.matrixUserId, getTxnIdFromEvent]
  );

  // Load messages for active DM thread
  useEffect(() => {
    if (!activeThread?.matrixRoomId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessages([]);

    const loadMessages = async () => {
      try {
        const { messages: matrixMessages } = await matrixService.getMessages(activeThread.matrixRoomId, 50);
        const formattedMessages = matrixMessages.map(eventToMessage);

        const seen = new Set<string>();
        const deduped = formattedMessages.filter((m) => {
          if (!m.id) return true;
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });

        setMessages(deduped);
        setTimeout(() => scrollToBottom(true), 50);
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [activeThread?.matrixRoomId, eventToMessage, scrollToBottom]);

  // Live timeline updates for DM
  useEffect(() => {
    if (!activeThread?.matrixRoomId) return;

    const client = matrixService.getClient();
    if (!client) return;

    const unsubscribe = matrixService.onRoomTimeline(
      (event: sdk.MatrixEvent, room: sdk.Room | undefined, toStartOfTimeline: boolean | undefined) => {
        if (!room || room.roomId !== activeThread.matrixRoomId) return;
        if (toStartOfTimeline) return;

        const eventType = event.getType();
        if (eventType !== 'm.room.message' && eventType !== 'm.room.encrypted') return;

        const newMessage = eventToMessage(event);

        setMessages((prev) => {
          const next = [...prev];

          if (newMessage.id) {
            const sameEventIndex = next.findIndex((m) => m.id === newMessage.id);
            if (sameEventIndex >= 0) {
              next[sameEventIndex] = { ...next[sameEventIndex], ...newMessage };
              return next;
            }
          }

          if (newMessage.txnId) {
            const sameTxnIndex = next.findIndex((m) => m.txnId && m.txnId === newMessage.txnId);
            if (sameTxnIndex >= 0) {
              next[sameTxnIndex] = {
                ...next[sameTxnIndex],
                ...newMessage,
                id: newMessage.id || next[sameTxnIndex].id,
              };
              return next;
            }
          }

          next.push(newMessage);
          return next;
        });

        scrollToBottom(true);
      }
    );

    const handleDecrypted = (event: sdk.MatrixEvent) => {
      const room = client.getRoom(event.getRoomId() || '');
      if (!room || room.roomId !== activeThread.matrixRoomId) return;

      const clearContent = event.getContent();
      if (!clearContent?.msgtype?.startsWith('m.')) return;

      const newMessage = eventToMessage(event);

      setMessages((prev) => {
        const next = [...prev];

        if (newMessage.id) {
          const sameEventIndex = next.findIndex((m) => m.id === newMessage.id);
          if (sameEventIndex >= 0) {
            next[sameEventIndex] = {
              ...next[sameEventIndex],
              ...newMessage,
              content: clearContent?.body || next[sameEventIndex].content,
              isDecrypting: false,
              decryptionError: event.isDecryptionFailure?.()
                ? 'Unable to decrypt message'
                : undefined,
            };
            return next;
          }
        }

        if (newMessage.txnId) {
          const sameTxnIndex = next.findIndex((m) => m.txnId && m.txnId === newMessage.txnId);
          if (sameTxnIndex >= 0) {
            next[sameTxnIndex] = {
              ...next[sameTxnIndex],
              ...newMessage,
              content: clearContent?.body || next[sameTxnIndex].content,
              isDecrypting: false,
              decryptionError: event.isDecryptionFailure?.()
                ? 'Unable to decrypt message'
                : undefined,
            };
            return next;
          }
        }

        next.push(newMessage);
        return next;
      });

      scrollToBottom(true);
    };

    client.on(sdk.MatrixEventEvent.Decrypted, handleDecrypted);

    return () => {
      unsubscribe();
      client.off(sdk.MatrixEventEvent.Decrypted, handleDecrypted);
    };
  }, [activeThread?.matrixRoomId, eventToMessage, scrollToBottom]);

  const handleSend = async () => {
    if (!inputValue.trim() || !activeThread?.matrixRoomId) return;

    const content = inputValue.trim();
    const roomId = activeThread.matrixRoomId;
    const txnId = `conact-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    setInputValue('');
    scrollToBottom(true);

    try {
      await matrixService.sendMessage(roomId, content, txnId);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputValue((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleGifSelect = async (gif: GifData) => {
    if (!activeThread?.matrixRoomId) return;

    try {
      await matrixService.sendImageFromUrl(
        activeThread.matrixRoomId,
        gif.url,
        gif.title,
        gif.width,
        gif.height
      );
      scrollToBottom(true);
    } catch (error) {
      console.error('Failed to send GIF:', error);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await acceptRequest(friendshipId);
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      await declineRequest(friendshipId);
    } catch (error) {
      console.error('Failed to decline request:', error);
    }
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    setAddFriendError(null);
    setAddFriendSuccess(false);
    try {
      await sendFriendRequest(targetUserId);
      setAddFriendSuccess(true);
      setAddFriendUsername('');
      setSearchResults([]);
    } catch (error: any) {
      setAddFriendError(error.message || 'Failed to send friend request');
    }
  };

  const handleOpenDMWithFriend = async (friendUserId: string) => {
    try {
      const thread = await createOrGetThread(friendUserId);
      navigate(`/dm/${thread.id}`);
    } catch (error) {
      console.error('Failed to open DM:', error);
    }
  };

  // Filter friends by search (friends are FriendListItem with .user property)
  const filteredFriends = friends.filter((friend) =>
    friend.user?.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If viewing a specific DM thread
  if (activeThreadId && activeThread) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        {/* Header */}
        <header className="flex h-12 items-center justify-between border-b border-background-tertiary px-4 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="avatar h-6 w-6 text-xs">
              {activeThread.otherUser?.avatarUrl ? (
                <img
                  src={activeThread.otherUser.avatarUrl}
                  alt=""
                  className="h-full w-full rounded-full"
                />
              ) : (
                activeThread.otherUser?.displayName?.[0]?.toUpperCase() || '?'
              )}
            </div>
            <span className="font-semibold text-text-normal">
              {activeThread.otherUser?.displayName || 'Unknown User'}
            </span>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 scrollbar-thin min-h-0"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-text-muted">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="text-4xl mb-2">
                <div className="avatar h-20 w-20 text-3xl">
                  {activeThread.otherUser?.avatarUrl ? (
                    <img
                      src={activeThread.otherUser.avatarUrl}
                      alt=""
                      className="h-full w-full rounded-full"
                    />
                  ) : (
                    activeThread.otherUser?.displayName?.[0]?.toUpperCase() || '?'
                  )}
                </div>
              </div>
              <div className="text-xl font-semibold">
                {activeThread.otherUser?.displayName || 'Unknown User'}
              </div>
              <div className="text-text-muted">
                This is the beginning of your direct message history with {activeThread.otherUser?.displayName || 'this user'}.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="group flex gap-4 rounded px-4 py-1 hover:bg-background-secondary"
                >
                  <div className="avatar h-10 w-10 flex-shrink-0 text-sm">
                    {message.senderName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-text-normal hover:underline cursor-pointer">
                        {message.senderName}
                      </span>
                      <span className="text-xs text-text-muted">
                        {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    <div
                      className={clsx(
                        'text-text-normal break-words',
                        message.isPending && 'opacity-60'
                      )}
                    >
                      {message.decryptionError ? (
                        <span className="text-red-400 italic">
                          {message.decryptionError}
                        </span>
                      ) : message.isDecrypting ? (
                        <span className="text-text-muted italic">
                          Decrypting...
                        </span>
                      ) : message.imageUrl ? (
                        <img
                          src={message.imageUrl}
                          alt={message.content || 'Image'}
                          className="max-w-md max-h-80 rounded-lg mt-1"
                          style={{
                            width: message.imageWidth
                              ? Math.min(message.imageWidth, 400)
                              : 'auto',
                          }}
                        />
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-4">
          <div className="relative flex items-center gap-2 rounded-lg bg-background-accent px-4 py-2">
            <button className="text-text-muted hover:text-text-normal">
              <Plus size={20} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message @${activeThread.otherUser?.displayName || 'user'}`}
              className="flex-1 bg-transparent text-text-normal placeholder-text-muted outline-none"
            />
            <button
              onClick={() => {
                setShowGifPicker(!showGifPicker);
                setShowEmojiPicker(false);
              }}
              className={clsx(
                'text-text-muted hover:text-text-normal',
                showGifPicker && 'text-brand-primary'
              )}
              title="GIFs"
            >
              <Image size={20} />
            </button>
            <button
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowGifPicker(false);
              }}
              className={clsx(
                'text-text-muted hover:text-text-normal',
                showEmojiPicker && 'text-brand-primary'
              )}
              title="Emoji"
            >
              <Smile size={20} />
            </button>
            {inputValue.trim() && (
              <button
                onClick={handleSend}
                className="text-brand-primary hover:text-brand-hover"
              >
                <Send size={20} />
              </button>
            )}

            {showEmojiPicker && (
              <EmojiPicker
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}

            {showGifPicker && (
              <GifPicker
                apiKey={GIPHY_API_KEY}
                onGifSelect={handleGifSelect}
                onClose={() => setShowGifPicker(false)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Friends page (no active DM)
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="flex h-12 items-center gap-4 border-b border-background-tertiary px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-text-muted" />
          <span className="font-semibold text-text-normal">Friends</span>
        </div>
        <div className="h-6 w-px bg-background-accent" />
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={clsx(
              'px-3 py-1 rounded text-sm',
              activeTab === 'all'
                ? 'bg-background-accent text-text-normal'
                : 'text-text-muted hover:text-text-normal hover:bg-background-secondary'
            )}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={clsx(
              'px-3 py-1 rounded text-sm relative',
              activeTab === 'pending'
                ? 'bg-background-accent text-text-normal'
                : 'text-text-muted hover:text-text-normal hover:bg-background-secondary'
            )}
          >
            Pending
            {incomingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {incomingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={clsx(
              'px-3 py-1 rounded text-sm',
              activeTab === 'add'
                ? 'bg-brand-primary text-white'
                : 'text-brand-primary hover:bg-brand-primary/10'
            )}
          >
            Add Friend
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* All Friends Tab */}
        {activeTab === 'all' && (
          <div>
            {/* Search */}
            <div className="mb-4">
              <div className="flex items-center gap-2 rounded-md bg-background-tertiary px-3 py-2">
                <Search size={16} className="text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="flex-1 bg-transparent text-text-normal placeholder-text-muted outline-none"
                />
              </div>
            </div>

            <h3 className="mb-2 text-xs font-semibold uppercase text-text-muted">
              All Friends — {filteredFriends.length}
            </h3>

            {filteredFriends.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                {friends.length === 0
                  ? "No friends yet. Add some friends to get started!"
                  : "No friends match your search."}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.friendshipId}
                    onClick={() => friend.user?.id && handleOpenDMWithFriend(friend.user.id)}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-background-secondary cursor-pointer group"
                  >
                    <div className="avatar h-10 w-10 text-sm">
                      {friend.user?.avatarUrl ? (
                        <img
                          src={friend.user.avatarUrl}
                          alt=""
                          className="h-full w-full rounded-full"
                        />
                      ) : (
                        friend.user?.displayName?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-text-normal">
                        {friend.user?.displayName}
                      </div>
                      <div className="text-xs text-text-muted">
                        {friend.user?.status || 'Offline'}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        friend.user?.id && handleOpenDMWithFriend(friend.user.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-full hover:bg-background-accent transition-opacity"
                      title="Send Message"
                    >
                      <MessageCircle size={18} className="text-text-muted" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <div>
            {incomingRequests.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase text-text-muted">
                  Incoming — {incomingRequests.length}
                </h3>
                <div className="space-y-1">
                  {incomingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-background-secondary"
                    >
                      <div className="avatar h-10 w-10 text-sm">
                        {request.user?.avatarUrl ? (
                          <img
                            src={request.user.avatarUrl}
                            alt=""
                            className="h-full w-full rounded-full"
                          />
                        ) : (
                          request.user?.displayName?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-text-normal">
                          {request.user?.displayName}
                        </div>
                        <div className="text-xs text-text-muted">
                          Incoming Friend Request
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptRequest(request.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(request.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {outgoingRequests.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-text-muted">
                  Outgoing — {outgoingRequests.length}
                </h3>
                <div className="space-y-1">
                  {outgoingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-background-secondary"
                    >
                      <div className="avatar h-10 w-10 text-sm">
                        {request.user?.avatarUrl ? (
                          <img
                            src={request.user.avatarUrl}
                            alt=""
                            className="h-full w-full rounded-full"
                          />
                        ) : (
                          request.user?.displayName?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-text-normal">
                          {request.user?.displayName}
                        </div>
                        <div className="text-xs text-text-muted">
                          Outgoing Friend Request
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <div className="text-center py-8 text-text-muted">
                No pending friend requests.
              </div>
            )}
          </div>
        )}

        {/* Add Friend Tab */}
        {activeTab === 'add' && (
          <div>
            <h3 className="mb-2 text-lg font-semibold text-text-normal">
              Add Friend
            </h3>
            <p className="mb-4 text-text-muted">
              Search for users by their display name or Matrix ID.
            </p>

            <div className="mb-4">
              <div className="flex items-center gap-2 rounded-md bg-background-tertiary px-3 py-2">
                <input
                  type="text"
                  value={addFriendUsername}
                  onChange={(e) => {
                    setAddFriendUsername(e.target.value);
                    setAddFriendError(null);
                    setAddFriendSuccess(false);
                  }}
                  placeholder="Search for a user..."
                  className="flex-1 bg-transparent text-text-normal placeholder-text-muted outline-none"
                />
                <Search size={16} className="text-text-muted" />
              </div>
            </div>

            {addFriendError && (
              <div className="mb-4 rounded-md bg-red-500/10 p-3 text-red-400">
                {addFriendError}
              </div>
            )}

            {addFriendSuccess && (
              <div className="mb-4 rounded-md bg-green-500/10 p-3 text-green-400">
                Friend request sent successfully!
              </div>
            )}

            {isSearching && (
              <div className="text-center py-4 text-text-muted">
                Searching...
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-background-secondary"
                  >
                    <div className="avatar h-10 w-10 text-sm">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="h-full w-full rounded-full"
                        />
                      ) : (
                        user.displayName?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-text-normal">
                        {user.displayName}
                      </div>
                      <div className="text-xs text-text-muted">
                        {user.matrixUserId}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSendFriendRequest(user.id)}
                      className="flex items-center gap-1 rounded bg-brand-primary px-3 py-1.5 text-sm text-white hover:bg-brand-hover"
                    >
                      <UserPlus size={16} />
                      Send Request
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!isSearching && addFriendUsername && searchResults.length === 0 && (
              <div className="text-center py-4 text-text-muted">
                No users found matching "{addFriendUsername}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
