import { contextBridge, ipcRenderer } from 'electron';

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

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  getScreenSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('get-screen-sources'),
  platform: process.platform,

  // Auto-updater API
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  checkForUpdate: (): Promise<{ updateAvailable: boolean; error?: string }> =>
    ipcRenderer.invoke('update-check'),
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdate: () => ipcRenderer.invoke('update-install'),

  // Update event listeners
  onUpdateChecking: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('update-checking', handler);
    return () => ipcRenderer.removeListener('update-checking', handler);
  },
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
    const handler = (_: unknown, info: UpdateInfo) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('update-not-available', handler);
    return () => ipcRenderer.removeListener('update-not-available', handler);
  },
  onUpdateProgress: (callback: (progress: UpdateProgress) => void) => {
    const handler = (_: unknown, progress: UpdateProgress) => callback(progress);
    ipcRenderer.on('update-progress', handler);
    return () => ipcRenderer.removeListener('update-progress', handler);
  },
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => {
    const handler = (_: unknown, info: UpdateInfo) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateError: (callback: (error: string) => void) => {
    const handler = (_: unknown, error: string) => callback(error);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },
});
