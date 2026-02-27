import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface GifData {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

interface GifPickerProps {
  onGifSelect: (gif: GifData) => void;
  onClose: () => void;
  apiKey: string;
}

export function GifPicker({ onGifSelect, onClose, apiKey }: GifPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [gifs, setGifs] = useState<GifData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchTrending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`
      );
      const data = await response.json();
      if (data.data) {
        setGifs(
          data.data.map((gif: any) => ({
            id: gif.id,
            title: gif.title,
            url: gif.images.original.url,
            previewUrl: gif.images.fixed_width_small.url,
            width: parseInt(gif.images.original.width),
            height: parseInt(gif.images.original.height),
          }))
        );
      }
    } catch (err) {
      setError('Failed to load GIFs');
      console.error('Giphy error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) {
      fetchTrending();
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=20&rating=g`
      );
      const data = await response.json();
      if (data.data) {
        setGifs(
          data.data.map((gif: any) => ({
            id: gif.id,
            title: gif.title,
            url: gif.images.original.url,
            previewUrl: gif.images.fixed_width_small.url,
            width: parseInt(gif.images.original.width),
            height: parseInt(gif.images.original.height),
          }))
        );
      }
    } catch (err) {
      setError('Failed to search GIFs');
      console.error('Giphy search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, fetchTrending]);

  useEffect(() => {
    fetchTrending();
    inputRef.current?.focus();
  }, [fetchTrending]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchGifs(searchTerm);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, searchGifs]);

  const handleGifClick = (gif: GifData) => {
    onGifSelect(gif);
    onClose();
  };

  return (
    <div className="absolute bottom-full right-0 mb-2 z-50">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative w-[400px] h-[450px] bg-background-secondary rounded-lg shadow-xl border border-background-accent overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-background-accent">
          <span className="text-text-normal font-medium">GIFs</span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-normal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="flex items-center gap-2 bg-background-accent rounded-md px-3 py-2">
            <Search size={16} className="text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search GIFs..."
              className="flex-1 bg-transparent text-text-normal placeholder-text-muted outline-none text-sm"
            />
          </div>
        </div>

        {/* GIF Grid */}
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="text-text-muted animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-text-muted">
              {error}
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-text-muted">
              No GIFs found
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleGifClick(gif)}
                  className="relative aspect-video overflow-hidden rounded-md hover:ring-2 hover:ring-brand-primary transition-all"
                >
                  <img
                    src={gif.previewUrl}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Giphy Attribution */}
        <div className="p-2 border-t border-background-accent flex justify-center">
          <span className="text-xs text-text-muted">Powered by GIPHY</span>
        </div>
      </div>
    </div>
  );
}

export type { GifData };
