import { useState, useEffect } from 'react';
import { X, Monitor, AppWindow } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { clsx } from 'clsx';

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
}

interface ScreenPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sourceId: string) => void;
}

export function ScreenPickerDialog({ open, onOpenChange, onSelect }: ScreenPickerDialogProps) {
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'screens' | 'windows'>('screens');

  useEffect(() => {
    if (open) {
      loadSources();
    }
  }, [open]);

  const loadSources = async () => {
    setIsLoading(true);
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.getScreenSources) {
        const screenSources = await electronAPI.getScreenSources();
        setSources(screenSources);
        // Auto-select first screen if available
        const firstScreen = screenSources.find((s: ScreenSource) => s.id.startsWith('screen:'));
        if (firstScreen) {
          setSelectedId(firstScreen.id);
        }
      }
    } catch (error) {
      console.error('Failed to get screen sources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = () => {
    if (selectedId) {
      onSelect(selectedId);
      onOpenChange(false);
    }
  };

  const screens = sources.filter(s => s.id.startsWith('screen:'));
  const windows = sources.filter(s => s.id.startsWith('window:'));
  const displayedSources = activeTab === 'screens' ? screens : windows;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background-primary p-0 shadow-xl outline-none z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-xl font-bold text-text-normal">
                Share Your Screen
              </Dialog.Title>
              <Dialog.Close className="text-text-muted hover:text-text-normal">
                <X size={24} />
              </Dialog.Close>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-background-accent">
              <button
                onClick={() => setActiveTab('screens')}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 -mb-px border-b-2 transition-colors',
                  activeTab === 'screens'
                    ? 'border-brand-primary text-text-normal'
                    : 'border-transparent text-text-muted hover:text-text-normal'
                )}
              >
                <Monitor size={18} />
                Screens ({screens.length})
              </button>
              <button
                onClick={() => setActiveTab('windows')}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 -mb-px border-b-2 transition-colors',
                  activeTab === 'windows'
                    ? 'border-brand-primary text-text-normal'
                    : 'border-transparent text-text-muted hover:text-text-normal'
                )}
              >
                <AppWindow size={18} />
                Windows ({windows.length})
              </button>
            </div>

            {/* Source Grid */}
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-text-muted">
                  Loading sources...
                </div>
              ) : displayedSources.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-text-muted">
                  No {activeTab} available
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {displayedSources.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => setSelectedId(source.id)}
                      className={clsx(
                        'flex flex-col rounded-lg border-2 overflow-hidden transition-all hover:border-brand-primary',
                        selectedId === source.id
                          ? 'border-brand-primary ring-2 ring-brand-primary/30'
                          : 'border-background-accent'
                      )}
                    >
                      <div className="aspect-video bg-background-tertiary relative">
                        <img
                          src={source.thumbnail}
                          alt={source.name}
                          className="w-full h-full object-contain"
                        />
                        {selectedId === source.id && (
                          <div className="absolute inset-0 bg-brand-primary/20 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-background-secondary">
                        <div className="flex items-center gap-2">
                          {source.appIcon ? (
                            <img src={source.appIcon} alt="" className="w-4 h-4" />
                          ) : (
                            <Monitor size={14} className="text-text-muted" />
                          )}
                          <span className="text-sm text-text-normal truncate">
                            {source.name}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-background-accent">
              <button
                onClick={() => onOpenChange(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={!selectedId}
                className="btn btn-primary"
              >
                Share
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
