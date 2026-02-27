// src/components/layout/TitleBar.tsx
import { Minus, Square, X, Copy } from 'lucide-react';
import { useState } from 'react';

export const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  // Only render window controls in Electron
  const isElectron = !!window.electronAPI;

  const handleMaximize = async () => {
    await window.electronAPI?.maximize();
    const status = await window.electronAPI?.isMaximized();
    setIsMaximized(status ?? false);
  };

  return (
    <div className="h-8 bg-[#1e1f22] flex items-center select-none border-b border-black/20 titlebar">
      {/* Draggable Area - This makes the window movable */}
      <div className="flex-1 h-full flex items-center px-4">
        <span className="text-xs font-semibold text-zinc-400">Conact</span>
      </div>

      {/* Window Controls - Must be 'no-drag' to be clickable */}
      {isElectron && (
        <div className="flex h-full no-drag">
          <button
            onClick={() => window.electronAPI?.minimize()}
            className="px-4 h-full flex items-center hover:bg-white/10 transition-colors"
          >
            <Minus className="w-4 h-4 text-zinc-400" />
          </button>

          <button
            onClick={handleMaximize}
            className="px-4 h-full flex items-center hover:bg-white/10 transition-colors"
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 text-zinc-400" />
            ) : (
              <Square className="w-3 h-3 text-zinc-400" />
            )}
          </button>

          <button
            onClick={() => window.electronAPI?.close()}
            className="px-4 h-full flex items-center hover:bg-red-500 group transition-colors"
          >
            <X className="w-4 h-4 text-zinc-400 group-hover:text-white" />
          </button>
        </div>
      )}
    </div>
  );
};