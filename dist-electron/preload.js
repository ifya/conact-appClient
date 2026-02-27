"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => import_electron.ipcRenderer.invoke("window-minimize"),
  maximize: () => import_electron.ipcRenderer.invoke("window-maximize"),
  close: () => import_electron.ipcRenderer.invoke("window-close"),
  isMaximized: () => import_electron.ipcRenderer.invoke("window-is-maximized"),
  getScreenSources: () => import_electron.ipcRenderer.invoke("get-screen-sources"),
  platform: process.platform,
  // Auto-updater API
  getAppVersion: () => import_electron.ipcRenderer.invoke("get-app-version"),
  checkForUpdate: () => import_electron.ipcRenderer.invoke("update-check"),
  downloadUpdate: () => import_electron.ipcRenderer.invoke("update-download"),
  installUpdate: () => import_electron.ipcRenderer.invoke("update-install"),
  // Update event listeners
  onUpdateChecking: (callback) => {
    const handler = () => callback();
    import_electron.ipcRenderer.on("update-checking", handler);
    return () => import_electron.ipcRenderer.removeListener("update-checking", handler);
  },
  onUpdateAvailable: (callback) => {
    const handler = (_, info) => callback(info);
    import_electron.ipcRenderer.on("update-available", handler);
    return () => import_electron.ipcRenderer.removeListener("update-available", handler);
  },
  onUpdateNotAvailable: (callback) => {
    const handler = () => callback();
    import_electron.ipcRenderer.on("update-not-available", handler);
    return () => import_electron.ipcRenderer.removeListener("update-not-available", handler);
  },
  onUpdateProgress: (callback) => {
    const handler = (_, progress) => callback(progress);
    import_electron.ipcRenderer.on("update-progress", handler);
    return () => import_electron.ipcRenderer.removeListener("update-progress", handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_, info) => callback(info);
    import_electron.ipcRenderer.on("update-downloaded", handler);
    return () => import_electron.ipcRenderer.removeListener("update-downloaded", handler);
  },
  onUpdateError: (callback) => {
    const handler = (_, error) => callback(error);
    import_electron.ipcRenderer.on("update-error", handler);
    return () => import_electron.ipcRenderer.removeListener("update-error", handler);
  }
});
