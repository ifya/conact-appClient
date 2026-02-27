import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User, Shield, Bell, Palette, Keyboard, LogOut, Mic, Volume2, Video, Play, Square, Info, Download, RefreshCw, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useDeviceStore } from '../../store/voice';
import { matrixService } from '../../services/matrix';

const settingsSections = [
  { id: 'account', label: 'My Account', icon: User },
  { id: 'voice-video', label: 'Voice & Video', icon: Mic },
  { id: 'privacy', label: 'Privacy & Safety', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'keybinds', label: 'Keybinds', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeSection, setActiveSection] = useState('account');
  const { devices, settings, refreshDevices, setSelectedAudioInput, setSelectedAudioOutput, setSelectedVideoInput, setNoiseSuppression } = useDeviceStore();

  // Refresh devices when Voice & Video section is opened
  useEffect(() => {
    if (activeSection === 'voice-video') {
      refreshDevices();
    }
  }, [activeSection, refreshDevices]);

  const audioInputDevices = devices.filter(d => d.kind === 'audioinput');
  const audioOutputDevices = devices.filter(d => d.kind === 'audiooutput');
  const videoInputDevices = devices.filter(d => d.kind === 'videoinput');

  // Microphone test state
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Speaker test state
  const [isSpeakerTesting, setIsSpeakerTesting] = useState(false);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  // App version and update state
  const [appVersion, setAppVersion] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'upToDate' | 'error'>('idle');
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateError, setUpdateError] = useState<string>('');
  const isElectron = !!window.electronAPI?.getAppVersion;

  // Get app version on mount
  useEffect(() => {
    if (isElectron) {
      window.electronAPI?.getAppVersion().then(setAppVersion);

      // Set up update event listeners
      const cleanups: Array<() => void> = [];

      cleanups.push(
        window.electronAPI!.onUpdateChecking(() => setUpdateStatus('checking'))
      );
      cleanups.push(
        window.electronAPI!.onUpdateAvailable((info) => {
          setUpdateStatus('available');
          setUpdateVersion(info.version);
        })
      );
      cleanups.push(
        window.electronAPI!.onUpdateNotAvailable(() => setUpdateStatus('upToDate'))
      );
      cleanups.push(
        window.electronAPI!.onUpdateProgress((progress) => {
          setUpdateStatus('downloading');
          setUpdateProgress(progress.percent);
        })
      );
      cleanups.push(
        window.electronAPI!.onUpdateDownloaded((info) => {
          setUpdateStatus('ready');
          setUpdateVersion(info.version);
        })
      );
      cleanups.push(
        window.electronAPI!.onUpdateError((err) => {
          setUpdateStatus('error');
          setUpdateError(err);
        })
      );

      return () => cleanups.forEach(fn => fn());
    }
  }, [isElectron]);

  const handleCheckForUpdates = useCallback(() => {
    setUpdateStatus('checking');
    setUpdateError('');
    window.electronAPI?.checkForUpdate();
  }, []);

  const handleDownloadUpdate = useCallback(() => {
    window.electronAPI?.downloadUpdate();
  }, []);

  const handleInstallUpdate = useCallback(() => {
    window.electronAPI?.installUpdate();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMicTest();
      stopSpeakerTest();
    };
  }, []);

  const startMicTest = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: settings.selectedAudioInput
          ? { deviceId: { exact: settings.selectedAudioInput } }
          : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      // Create audio context and analyser
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsMicTesting(true);

      // Start level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        const normalizedLevel = Math.min(100, (average / 128) * 100);
        setMicLevel(normalizedLevel);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (error) {
      console.error('Failed to start mic test:', error);
    }
  }, [settings.selectedAudioInput]);

  const stopMicTest = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsMicTesting(false);
    setMicLevel(0);
  }, []);

  const startSpeakerTest = useCallback(async () => {
    try {
      // Create a test tone using Web Audio API
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note

      // Create a gentle envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.9);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 1);

      setIsSpeakerTesting(true);

      // Auto-stop after tone finishes
      setTimeout(() => {
        setIsSpeakerTesting(false);
        audioContext.close();
      }, 1000);
    } catch (error) {
      console.error('Failed to play test sound:', error);
      setIsSpeakerTesting(false);
    }
  }, []);

  const stopSpeakerTest = useCallback(() => {
    if (testAudioRef.current) {
      testAudioRef.current.pause();
      testAudioRef.current = null;
    }
    setIsSpeakerTesting(false);
  }, []);

  const handleLogout = () => {
    matrixService.destroy();
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-full bg-background-tertiary">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 overflow-y-auto bg-background-secondary p-4">
        <nav className="space-y-1">
          <div className="mb-2 px-2 text-xs font-bold uppercase text-text-muted">
            User Settings
          </div>
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`sidebar-item w-full ${
                  activeSection === section.id ? 'active' : ''
                }`}
              >
                <Icon size={18} />
                <span>{section.label}</span>
              </button>
            );
          })}

          <div className="my-4 h-px bg-background-accent" />

          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-text-danger hover:text-text-danger"
          >
            <LogOut size={18} />
            <span>Log Out</span>
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl">
          {/* Close button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-background-accent text-text-muted hover:bg-background-accent hover:text-text-normal"
          >
            <X size={20} />
          </button>

          {activeSection === 'account' && (
            <div>
              <h2 className="mb-6 text-xl font-bold text-text-normal">My Account</h2>

              {/* Profile card */}
              <div className="rounded-lg bg-background-secondary overflow-hidden">
                {/* Banner */}
                <div className="h-24 bg-brand-primary" />

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-end gap-4">
                      <div className="avatar -mt-12 h-20 w-20 border-4 border-background-secondary text-2xl">
                        {user?.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="h-full w-full rounded-full" />
                        ) : (
                          user?.displayName?.[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="pb-1">
                        <div className="text-lg font-bold text-text-normal">
                          {user?.displayName}
                        </div>
                        <div className="text-sm text-text-muted">
                          {user?.matrixUserId}
                        </div>
                      </div>
                    </div>
                    <button className="btn btn-primary text-sm">
                      Edit User Profile
                    </button>
                  </div>

                  {/* Info sections */}
                  <div className="mt-6 space-y-4 rounded-lg bg-background-primary p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase text-text-muted">
                          Username
                        </div>
                        <div className="text-text-normal">
                          {user?.matrixUserId?.split(':')[0].substring(1)}
                        </div>
                      </div>
                      <button className="btn btn-secondary text-sm">Edit</button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase text-text-muted">
                          Display Name
                        </div>
                        <div className="text-text-normal">{user?.displayName}</div>
                      </div>
                      <button className="btn btn-secondary text-sm">Edit</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Password & Authentication */}
              <div className="mt-8">
                <h3 className="mb-4 text-sm font-bold uppercase text-text-muted">
                  Password and Authentication
                </h3>
                <button className="btn btn-primary">Change Password</button>
              </div>

              {/* Account Removal */}
              <div className="mt-8">
                <h3 className="mb-4 text-sm font-bold uppercase text-text-muted">
                  Account Removal
                </h3>
                <button className="btn btn-danger">Delete Account</button>
                <p className="mt-2 text-sm text-text-muted">
                  Deleting your account is permanent and cannot be undone.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div>
              <h2 className="mb-6 text-xl font-bold text-text-normal">Appearance</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase text-text-muted">Theme</h3>
                  <div className="flex gap-4">
                    <button className="flex flex-col items-center gap-2 rounded-lg border-2 border-brand-primary p-4">
                      <div className="h-16 w-24 rounded bg-background-primary" />
                      <span className="text-sm text-text-normal">Dark</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 rounded-lg border-2 border-transparent p-4 hover:border-background-accent">
                      <div className="h-16 w-24 rounded bg-gray-200" />
                      <span className="text-sm text-text-normal">Light</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase text-text-muted">
                    Message Display
                  </h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3">
                      <input type="radio" name="display" defaultChecked className="accent-brand-primary" />
                      <span className="text-text-normal">Cozy</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="radio" name="display" className="accent-brand-primary" />
                      <span className="text-text-normal">Compact</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'voice-video' && (
            <div>
              <h2 className="mb-6 text-xl font-bold text-text-normal">Voice & Video</h2>

              <div className="space-y-8">
                {/* Voice Settings */}
                <div>
                  <h3 className="mb-4 text-sm font-bold uppercase text-text-muted">Voice Settings</h3>

                  <div className="space-y-4">
                    {/* Input Device */}
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-text-normal">
                        <Mic size={16} />
                        Input Device
                      </label>
                      <select
                        value={settings.selectedAudioInput || ''}
                        onChange={(e) => setSelectedAudioInput(e.target.value || null)}
                        className="input"
                      >
                        <option value="">Default</option>
                        {audioInputDevices.map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </option>
                        ))}
                      </select>

                      {/* Mic Test */}
                      <div className="mt-3">
                        <button
                          onClick={isMicTesting ? stopMicTest : startMicTest}
                          className={`btn text-sm ${isMicTesting ? 'btn-danger' : 'btn-secondary'}`}
                        >
                          {isMicTesting ? (
                            <>
                              <Square size={14} className="mr-1.5" />
                              Stop Test
                            </>
                          ) : (
                            <>
                              <Play size={14} className="mr-1.5" />
                              Test Microphone
                            </>
                          )}
                        </button>
                        {isMicTesting && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-text-muted w-12">Level:</span>
                              <div className="flex-1 h-2 bg-background-accent rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-text-positive transition-all duration-75"
                                  style={{ width: `${micLevel}%` }}
                                />
                              </div>
                              <span className="text-xs text-text-muted w-10 text-right">
                                {Math.round(micLevel)}%
                              </span>
                            </div>
                            <p className="text-xs text-text-muted mt-1">
                              Speak into your microphone to see the level
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Output Device */}
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-text-normal">
                        <Volume2 size={16} />
                        Output Device
                      </label>
                      <select
                        value={settings.selectedAudioOutput || ''}
                        onChange={(e) => setSelectedAudioOutput(e.target.value || null)}
                        className="input"
                      >
                        <option value="">Default</option>
                        {audioOutputDevices.map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </option>
                        ))}
                      </select>

                      {/* Speaker Test */}
                      <div className="mt-3">
                        <button
                          onClick={startSpeakerTest}
                          disabled={isSpeakerTesting}
                          className="btn btn-secondary text-sm"
                        >
                          {isSpeakerTesting ? (
                            <>
                              <Volume2 size={14} className="mr-1.5 animate-pulse" />
                              Playing...
                            </>
                          ) : (
                            <>
                              <Play size={14} className="mr-1.5" />
                              Test Speakers
                            </>
                          )}
                        </button>
                        <p className="text-xs text-text-muted mt-1">
                          Click to play a test tone
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audio Processing */}
                <div>
                  <h3 className="mb-4 text-sm font-bold uppercase text-text-muted">Audio Processing</h3>

                  <div className="space-y-4">
                    {/* Noise Suppression */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-text-normal">Noise Suppression</div>
                        <div className="text-xs text-text-muted">
                          Reduce background noise from your microphone
                        </div>
                      </div>
                      <button
                        onClick={() => setNoiseSuppression(!settings.noiseSuppression)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          settings.noiseSuppression ? 'bg-brand-primary' : 'bg-background-accent'
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                            settings.noiseSuppression ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Video Settings */}
                <div>
                  <h3 className="mb-4 text-sm font-bold uppercase text-text-muted">Video Settings</h3>

                  <div className="space-y-4">
                    {/* Camera */}
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-text-normal">
                        <Video size={16} />
                        Camera
                      </label>
                      <select
                        value={settings.selectedVideoInput || ''}
                        onChange={(e) => setSelectedVideoInput(e.target.value || null)}
                        className="input"
                      >
                        <option value="">Default</option>
                        {videoInputDevices.map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Refresh Button */}
                <div>
                  <button
                    onClick={() => refreshDevices()}
                    className="btn btn-secondary text-sm"
                  >
                    Refresh Devices
                  </button>
                  <p className="mt-2 text-xs text-text-muted">
                    Click to detect newly connected devices
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'about' && (
            <div>
              <h2 className="mb-6 text-xl font-bold text-text-normal">About Conact</h2>

              <div className="space-y-6">
                {/* Version Info */}
                <div className="rounded-lg bg-background-secondary p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-xl bg-brand-primary flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">C</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-normal">Conact</h3>
                      <p className="text-sm text-text-muted">
                        Version {appVersion || 'Web'}
                      </p>
                    </div>
                  </div>

                  {isElectron && (
                    <div className="space-y-3">
                      {/* Update Status Display */}
                      {updateStatus === 'idle' && (
                        <button
                          onClick={handleCheckForUpdates}
                          className="btn btn-secondary text-sm"
                        >
                          <RefreshCw size={14} className="mr-1.5" />
                          Check for Updates
                        </button>
                      )}

                      {updateStatus === 'checking' && (
                        <div className="flex items-center gap-2 text-text-muted text-sm">
                          <RefreshCw size={14} className="animate-spin" />
                          Checking for updates...
                        </div>
                      )}

                      {updateStatus === 'upToDate' && (
                        <div className="flex items-center gap-2 text-text-positive text-sm">
                          <CheckCircle size={14} />
                          You're up to date!
                          <button
                            onClick={handleCheckForUpdates}
                            className="ml-2 text-text-muted hover:text-text-normal"
                          >
                            <RefreshCw size={12} />
                          </button>
                        </div>
                      )}

                      {updateStatus === 'available' && (
                        <div className="space-y-2">
                          <p className="text-sm text-text-normal">
                            Version <span className="font-semibold text-brand-primary">{updateVersion}</span> is available!
                          </p>
                          <button
                            onClick={handleDownloadUpdate}
                            className="btn btn-primary text-sm"
                          >
                            <Download size={14} className="mr-1.5" />
                            Download Update
                          </button>
                        </div>
                      )}

                      {updateStatus === 'downloading' && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-text-muted">
                            <span>Downloading update...</span>
                            <span>{Math.round(updateProgress)}%</span>
                          </div>
                          <div className="h-2 bg-background-accent rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-primary transition-all duration-300"
                              style={{ width: `${updateProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {updateStatus === 'ready' && (
                        <div className="space-y-2">
                          <p className="text-sm text-text-positive">
                            Update {updateVersion} is ready to install!
                          </p>
                          <button
                            onClick={handleInstallUpdate}
                            className="btn btn-primary text-sm"
                          >
                            <RefreshCw size={14} className="mr-1.5" />
                            Restart & Install
                          </button>
                          <p className="text-xs text-text-muted">
                            The app will restart to apply the update
                          </p>
                        </div>
                      )}

                      {updateStatus === 'error' && (
                        <div className="space-y-2">
                          <p className="text-sm text-text-danger">{updateError}</p>
                          <button
                            onClick={handleCheckForUpdates}
                            className="btn btn-secondary text-sm"
                          >
                            <RefreshCw size={14} className="mr-1.5" />
                            Try Again
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!isElectron && (
                    <p className="text-sm text-text-muted">
                      You're using the web version. Download the desktop app for automatic updates.
                    </p>
                  )}
                </div>

                {/* Credits */}
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase text-text-muted">Credits</h3>
                  <div className="rounded-lg bg-background-secondary p-4">
                    <p className="text-sm text-text-normal">
                      Developed by <span className="text-brand-primary">Alisan Guendogan</span>
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Built with Electron, React, LiveKit, and Matrix
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Mit viel Support von CanoMilano,KorayGee und Kaan The Kid
                    </p>
                  </div>
                </div>

                {/* Links */}
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase text-text-muted">Links</h3>
                  <div className="space-y-2">
                    <a
                      href="https://cx.guendogan-consulting.de"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-brand-primary hover:underline"
                    >
                      Website
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection !== 'account' && activeSection !== 'appearance' && activeSection !== 'voice-video' && activeSection !== 'about' && (
            <div>
              <h2 className="mb-6 text-xl font-bold text-text-normal">
                {settingsSections.find((s) => s.id === activeSection)?.label}
              </h2>
              <p className="text-text-muted">Settings for this section coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
