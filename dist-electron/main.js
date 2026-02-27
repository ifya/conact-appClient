"use strict";

// electron/main.ts
var import_electron = require("electron");
var import_electron_updater = require("electron-updater");
var import_path = require("path");
var mainWindow = null;
import_electron_updater.autoUpdater.autoDownload = false;
import_electron_updater.autoUpdater.autoInstallOnAppQuit = true;
var isDev = !import_electron.app.isPackaged;
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 500,
    frame: false,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#1e1f22",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: (0, import_path.join)(__dirname, "preload.js")
    }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile((0, import_path.join)(__dirname, "../dist/index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    import_electron.shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron.app.whenReady().then(() => {
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  if (!isDev) {
    import_electron_updater.autoUpdater.checkForUpdates().catch((err) => {
      console.error("Failed to check for updates:", err);
    });
  }
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
import_electron.ipcMain.handle("window-minimize", () => {
  mainWindow?.minimize();
});
import_electron.ipcMain.handle("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
import_electron.ipcMain.handle("window-close", () => {
  mainWindow?.close();
});
import_electron.ipcMain.handle("window-is-maximized", () => {
  return mainWindow?.isMaximized() ?? false;
});
import_electron.ipcMain.handle("get-screen-sources", async () => {
  const sources = await import_electron.desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true
  });
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    appIcon: source.appIcon?.toDataURL() || null
  }));
});
import_electron_updater.autoUpdater.on("checking-for-update", () => {
  mainWindow?.webContents.send("update-checking");
});
import_electron_updater.autoUpdater.on("update-available", (info) => {
  mainWindow?.webContents.send("update-available", {
    version: info.version,
    releaseDate: info.releaseDate
  });
});
import_electron_updater.autoUpdater.on("update-not-available", () => {
  mainWindow?.webContents.send("update-not-available");
});
import_electron_updater.autoUpdater.on("download-progress", (progress) => {
  mainWindow?.webContents.send("update-progress", {
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    transferred: progress.transferred,
    total: progress.total
  });
});
import_electron_updater.autoUpdater.on("update-downloaded", (info) => {
  mainWindow?.webContents.send("update-downloaded", {
    version: info.version
  });
});
import_electron_updater.autoUpdater.on("error", (err) => {
  mainWindow?.webContents.send("update-error", err.message);
});
import_electron.ipcMain.handle("update-check", async () => {
  if (isDev) {
    return { updateAvailable: false };
  }
  try {
    const result = await import_electron_updater.autoUpdater.checkForUpdates();
    return { updateAvailable: !!result?.updateInfo };
  } catch (err) {
    console.error("Update check failed:", err);
    return { updateAvailable: false, error: String(err) };
  }
});
import_electron.ipcMain.handle("update-download", () => {
  import_electron_updater.autoUpdater.downloadUpdate().catch((err) => {
    console.error("Download failed:", err);
    mainWindow?.webContents.send("update-error", err.message);
  });
});
import_electron.ipcMain.handle("update-install", () => {
  import_electron_updater.autoUpdater.quitAndInstall(false, true);
});
import_electron.ipcMain.handle("get-app-version", () => {
  return import_electron.app.getVersion();
});
