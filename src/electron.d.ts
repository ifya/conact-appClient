// src/electron.d.ts
export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
}

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface IElectronAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  getScreenSources: () => Promise<ScreenSource[]>;
  platform: string;

  // Auto-updater API
  getAppVersion: () => Promise<string>;
  checkForUpdate: () => Promise<{ updateAvailable: boolean; error?: string }>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;

  // Update event listeners (return cleanup function)
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateNotAvailable: (callback: () => void) => () => void;
  onUpdateProgress: (callback: (progress: UpdateProgress) => void) => () => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateError: (callback: (error: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}