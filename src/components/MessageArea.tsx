import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Smile, Send, Image } from 'lucide-react';
import { matrixService } from '../services/matrix';
import { useGuildsStore } from '../store/guilds';
import { useAuthStore } from '../store/auth';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import * as sdk from 'matrix-js-sdk';
import { EmojiPicker } from './EmojiPicker';
import { GifPicker, GifData } from './GifPicker';

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

export function MessageArea() {
  const { channelId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const guilds = useGuildsStore((state) => state.guilds);
  const currentGuild = guilds.find((g) => g.channels.some((c) => c.id === channelId));
  const currentChannel = currentGuild?.channels.find((c) => c.id === channelId);
  const user = useAuthStore((state) => state.user);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? 'auto' : 'smooth',
    });
  }, []);

  const getTxnIdFromEvent = useCallback((event: sdk.MatrixEvent): string | undefined => {
    const anyEvent = event as any;
    const unsigned = (event.getUnsigned?.() as any) || {};

    // 1) Standard-Felder
    const directTxn = anyEvent.getTxnId?.() || unsigned.transaction_id || unsigned.txn_id;
    if (directTxn) return directTxn;

    // 2) Fallback für Matrix Local-Echo Event-IDs:
    // "~!roomId:server:conact-123..."
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

      // Handle image messages (including GIFs)
      if (clearContent?.msgtype === 'm.image') {
        imageUrl = clearContent.url;
        // Convert mxc:// URLs to http URLs
        if (imageUrl?.startsWith('mxc://')) {
          const client = matrixService.getClient();
          if (client) {
            imageUrl = client.mxcUrlToHttp(imageUrl) || imageUrl;
          }
        }
        // If it's still a regular URL (like from Giphy), use it directly
        if (!imageUrl?.startsWith('mxc://') && clearContent.url) {
          imageUrl = clearContent.url;
        }
        imageWidth = clearContent.info?.w;
        imageHeight = clearContent.info?.h;
      }

      const txnId = getTxnIdFromEvent(event);

      // Matrix SDK Local Echo setzt event.status (sending/sent/etc.)
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

  // Initial load
  useEffect(() => {
    if (!currentChannel?.matrixRoomId) return;

    setIsLoading(true);
    setMessages([]);

    const loadMessages = async () => {
      try {
        const { messages: matrixMessages } = await matrixService.getMessages(currentChannel.matrixRoomId, 50);

        const formattedMessages = matrixMessages.map(eventToMessage);

        // Dedupe by event id
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
  }, [currentChannel?.matrixRoomId, eventToMessage, scrollToBottom]);

  // Live timeline + decrypt updates
  useEffect(() => {
    if (!currentChannel?.matrixRoomId) return;

    const client = matrixService.getClient();
    if (!client) return;

    const unsubscribe = matrixService.onRoomTimeline(
      (event: sdk.MatrixEvent, room: sdk.Room | undefined, toStartOfTimeline: boolean | undefined) => {
        if (!room || room.roomId !== currentChannel.matrixRoomId) return;
        if (toStartOfTimeline) return;

        const eventType = event.getType();
        if (eventType !== 'm.room.message' && eventType !== 'm.room.encrypted') return;

        const newMessage = eventToMessage(event);

        setMessages((prev) => {
          const next = [...prev];

          // 1) Bereits vorhandenes Event (gleiche eventId) -> updaten
          if (newMessage.id) {
            const sameEventIndex = next.findIndex((m) => m.id === newMessage.id);
            if (sameEventIndex >= 0) {
              next[sameEventIndex] = { ...next[sameEventIndex], ...newMessage };
              return next;
            }
          }

          // 2) Local Echo <-> Remote Echo über txnId zusammenführen
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

          // 3) Neue Nachricht
          next.push(newMessage);
          return next;
        });

        scrollToBottom(true);
      }
    );

    const handleDecrypted = (event: sdk.MatrixEvent) => {
      const room = client.getRoom(event.getRoomId() || '');
      if (!room || room.roomId !== currentChannel.matrixRoomId) return;

      const clearContent = event.getContent();
      if (!clearContent?.msgtype?.startsWith('m.')) return;

      const newMessage = eventToMessage(event);

      setMessages((prev) => {
        const next = [...prev];

        // 1) Update via eventId
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

        // 2) Fallback via txnId (local echo case)
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

        // 3) Falls noch nicht vorhanden -> anhängen
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
  }, [currentChannel?.matrixRoomId, eventToMessage, scrollToBottom]);

  // Auto-scroll
  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;

    const container = messagesContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    const latestMessage = messages[messages.length - 1];
    const isOwnMessage = latestMessage?.isOwn;

    if (isOwnMessage || isAtBottom) {
      scrollToBottom(true);
    }
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!inputValue.trim() || !currentChannel?.matrixRoomId) return;

    const content = inputValue.trim();
    const roomId = currentChannel.matrixRoomId;

    // Dynamische txnId (NICHT hardcoded)
    const txnId = `conact-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Input direkt leeren (UX)
    // WICHTIG: Kein eigenes optimisticMessage hinzufügen -> Matrix SDK macht Local Echo selbst
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
    if (!currentChannel?.matrixRoomId) return;

    try {
      await matrixService.sendImageFromUrl(
        currentChannel.matrixRoomId,
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

  if (!currentChannel) {
    return (
      <div className='flex flex-1 items-center justify-center text-text-muted'>
        Select a channel to start chatting
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col min-h-0'>
      <div
        ref={messagesContainerRef}
        className='flex-1 overflow-y-auto p-4 scrollbar-thin min-h-0'
      >
        {isLoading ? (
          <div className='flex items-center justify-center py-8'>
            <div className='text-text-muted'>Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-8'>
            <div className='text-4xl mb-2'>👋</div>
            <div className='text-xl font-semibold'>
              Welcome to #{currentChannel.name}!
            </div>
            <div className='text-text-muted'>
              This is the start of the #{currentChannel.name} channel.
            </div>
          </div>
        ) : (
          <div className='space-y-2'>
            {messages.map((message) => (
              <div
                key={message.id}
                className='group flex gap-4 rounded px-4 py-1 hover:bg-background-secondary'
              >
                <div className='avatar h-10 w-10 flex-shrink-0 text-sm'>
                  {message.senderName[0]?.toUpperCase()}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-baseline gap-2'>
                    <span className='font-medium text-text-normal hover:underline cursor-pointer'>
                      {message.senderName}
                    </span>
                    <span className='text-xs text-text-muted'>
                      {formatDistanceToNow(message.timestamp, {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div
                    className={clsx(
                      'text-text-normal break-words',
                      message.isPending && 'opacity-60'
                    )}
                  >
                    {message.decryptionError ? (
                      <span className='text-red-400 italic'>🔒 {message.decryptionError}</span>
                    ) : message.isDecrypting ? (
                      <span className='text-text-muted italic'>🔓 Decrypting...</span>
                    ) : message.imageUrl ? (
                      <img
                        src={message.imageUrl}
                        alt={message.content || 'Image'}
                        className='max-w-md max-h-80 rounded-lg mt-1'
                        style={{
                          width: message.imageWidth ? Math.min(message.imageWidth, 400) : 'auto',
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

      <div className='flex-shrink-0 p-4'>
        <div className='relative flex items-center gap-2 rounded-lg bg-background-accent px-4 py-2'>
          <button className='text-text-muted hover:text-text-normal'>
            <Plus size={20} />
          </button>
          <input
            ref={inputRef}
            type='text'
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${currentChannel.name}`}
            className='flex-1 bg-transparent text-text-normal placeholder-text-muted outline-none'
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
            title='GIFs'
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
            title='Emoji'
          >
            <Smile size={20} />
          </button>
          {inputValue.trim() && (
            <button
              onClick={handleSend}
              className='text-brand-primary hover:text-brand-hover'
            >
              <Send size={20} />
            </button>
          )}

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <EmojiPicker
              onEmojiSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}

          {/* GIF Picker */}
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