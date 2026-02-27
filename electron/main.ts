import { app, BrowserWindow, shell, ipcMain, desktopCapturer } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';

let mainWindow: BrowserWindow | null = null;

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

//const isDev = process.env.NODE_ENV === 'development';
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 500,
    frame: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1f22',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Check for updates only in production
  if (!isDev) {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Failed to check for updates:', err);
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for window controls
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

// Screen capture sources for screen sharing
ipcMain.handle('get-screen-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });

  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    appIcon: source.appIcon?.toDataURL() || null,
  }));
});

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  mainWindow?.webContents.send('update-checking');
});

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-available', {
    version: info.version,
    releaseDate: info.releaseDate,
  });
});

autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('update-not-available');
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('update-progress', {
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    transferred: progress.transferred,
    total: progress.total,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-downloaded', {
    version: info.version,
  });
});

autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('update-error', err.message);
});

// IPC handlers for update actions
ipcMain.handle('update-check', async () => {
  if (isDev) {
    return { updateAvailable: false };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { updateAvailable: !!result?.updateInfo };
  } catch (err) {
    console.error('Update check failed:', err);
    return { updateAvailable: false, error: String(err) };
  }
});

ipcMain.handle('update-download', () => {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error('Download failed:', err);
    mainWindow?.webContents.send('update-error', err.message);
  });
});

ipcMain.handle('update-install', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
