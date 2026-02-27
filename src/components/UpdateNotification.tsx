import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw, X, CheckCircle } from 'lucide-react';
import type { UpdateInfo, UpdateProgress } from '../electron.d';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export function UpdateNotification() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  const navigate = useNavigate();

  // Only render in Electron environment
  const isElectron = !!window.electronAPI?.onUpdateAvailable;

  useEffect(() => {
    if (!isElectron) return;

    // Get current app version
    window.electronAPI?.getAppVersion().then(setCurrentVersion);

    // Set up event listeners
    const cleanupFns: Array<() => void> = [];

    cleanupFns.push(
      window.electronAPI!.onUpdateChecking(() => {
        setStatus('checking');
        setError(null);
      })
    );

    cleanupFns.push(
      window.electronAPI!.onUpdateAvailable((info) => {
        setStatus('available');
        setUpdateInfo(info);
        setDismissed(false);
      })
    );

    cleanupFns.push(
      window.electronAPI!.onUpdateNotAvailable(() => {
        setStatus('idle');
      })
    );

    cleanupFns.push(
      window.electronAPI!.onUpdateProgress((prog) => {
        setStatus('downloading');
        setProgress(prog);
      })
    );

    cleanupFns.push(
      window.electronAPI!.onUpdateDownloaded((info) => {
        setStatus('ready');
        setUpdateInfo(info);
        setProgress(null);
      })
    );

    cleanupFns.push(
      window.electronAPI!.onUpdateError((err) => {
        setStatus('error');
        setError(err);
      })
    );

    // Re-check after listeners are attached (fixes startup race)
    setTimeout(() => {
      window.electronAPI?.checkForUpdate();
    }, 300);

    return () => {
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, [isElectron]);

  const handleDownload = useCallback(() => {
    window.electronAPI?.downloadUpdate();
  }, []);

  const handleInstall = useCallback(() => {
    window.electronAPI?.installUpdate();
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't render if not in Electron or dismissed
  if (!isElectron || dismissed) return null;

  // Don't show anything in idle or checking state
  if (status === 'idle' || status === 'checking') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-lg bg-background-secondary border border-background-accent shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-background-tertiary">
          <div className="flex items-center gap-2">
            {status === 'ready' ? (
              <CheckCircle size={18} className="text-text-positive" />
            ) : status === 'error' ? (
              <X size={18} className="text-text-danger" />
            ) : (
              <Download size={18} className="text-brand-primary" />
            )}
            <span className="font-semibold text-text-normal text-sm">
              {status === 'available' && 'Update Available'}
              {status === 'downloading' && 'Downloading Update'}
              {status === 'ready' && 'Ready to Install'}
              {status === 'error' && 'Update Error'}
            </span>
          </div>
          {status !== 'downloading' && (
            <button
              onClick={handleDismiss}
              className="p-1 rounded hover:bg-background-accent text-text-muted hover:text-text-normal transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          {status === 'available' && updateInfo && (
            <>
              <p className="text-text-muted text-sm mb-3">
                Version <span className="text-text-normal font-medium">{updateInfo.version}</span> is available.
                {currentVersion && (
                  <span className="text-text-muted"> (Current: {currentVersion})</span>
                )}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="btn btn-primary flex-1 text-sm"
                >
                  <Download size={14} className="mr-1.5" />
                  Download Update
                </button>

                <button
                  onClick={() => navigate('/settings')}
                  className="btn btn-secondary flex-1 text-sm border border-background-accent hover:bg-background-accent"
                >
                  View in Settings
                </button>
              </div>

              <p className="text-[10px] text-text-muted text-center mt-2">
                or check changelog &amp; install later
              </p>
            </>
          )}

          {status === 'downloading' && progress && (
            <>
              <div className="mb-2">
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span>Downloading...</span>
                  <span>{Math.round(progress.percent)}%</span>
                </div>
                <div className="h-2 bg-background-accent rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-primary transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-text-muted">
                {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                {progress.bytesPerSecond > 0 && (
                  <span className="ml-2">({formatBytes(progress.bytesPerSecond)}/s)</span>
                )}
              </p>
            </>
          )}

          {status === 'ready' && updateInfo && (
            <>
              <p className="text-text-muted text-sm mb-3">
                Version <span className="text-text-normal font-medium">{updateInfo.version}</span> has been downloaded and is ready to install.
              </p>
              <button
                onClick={handleInstall}
                className="btn btn-primary w-full text-sm"
              >
                <RefreshCw size={14} className="mr-1.5" />
                Restart & Install
              </button>
              <p className="text-xs text-text-muted mt-2 text-center">
                The app will restart to apply the update
              </p>
            </>
          )}

          {status === 'error' && error && (
            <p className="text-text-danger text-sm">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}