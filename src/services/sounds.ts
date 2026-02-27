// Sound effects service for Conact
// All volume levels are configurable here (0.0 to 1.0)

export const SOUND_VOLUMES = {
  join: 0.5,    // 50% - when someone joins voice channel
  leave: 0.5,   // 50% - when someone leaves voice channel
  ping: 0.8,    // 80% - ping sound (bypasses deafen)
};

// Get base URL for sound files (works in both web and Electron)
function getBaseUrl(): string {
  // In Electron with file:// protocol, we need to construct path relative to index.html
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    // Get the directory containing index.html
    const path = window.location.pathname;
    const dir = path.substring(0, path.lastIndexOf('/'));
    return `file://${dir}`;
  }
  // In web/dev, use root-relative paths
  return '';
}

// Sound file paths (from public/sounds/)
const SOUND_PATHS = {
  join: '/sounds/conact_join.mp3',
  leave: '/sounds/conact_leave.mp3',
  ping: '/sounds/conact_ping.mp3',
};

function getSoundUrl(soundType: keyof typeof SOUND_PATHS): string {
  return `${getBaseUrl()}${SOUND_PATHS[soundType]}`;
}

// Cache audio elements for reuse
const audioCache: Map<string, HTMLAudioElement> = new Map();

function getAudio(soundType: keyof typeof SOUND_PATHS): HTMLAudioElement {
  let audio = audioCache.get(soundType);
  if (!audio) {
    audio = new Audio(getSoundUrl(soundType));
    audioCache.set(soundType, audio);
  }
  return audio;
}

/**
 * Play a sound effect
 * @param soundType - The type of sound to play
 * @param volumeOverride - Optional volume override (0.0 to 1.0)
 */
function playSound(soundType: keyof typeof SOUND_PATHS, volumeOverride?: number): void {
  try {
    const audio = getAudio(soundType);
    const url = getSoundUrl(soundType);
    console.log(`[Sound] Playing ${soundType} from ${url}`);
    audio.volume = volumeOverride ?? SOUND_VOLUMES[soundType];
    audio.currentTime = 0; // Reset to start
    audio.play().catch((err) => {
      console.warn(`[Sound] Failed to play ${soundType} sound:`, err);
    });
  } catch (err) {
    console.warn(`[Sound] Error playing ${soundType} sound:`, err);
  }
}

/**
 * Play join sound when someone joins the voice channel
 */
export function playJoinSound(): void {
  playSound('join');
}

/**
 * Play leave sound when someone leaves the voice channel
 */
export function playLeaveSound(): void {
  playSound('leave');
}

/**
 * Play ping sound - this bypasses deafen and always plays
 * Used when someone pings you to get your attention
 */
export function playPingSound(): void {
  // Create a new audio element for ping to ensure it always plays
  // even if another sound is playing, and bypasses any mute/deafen
  const audio = new Audio(getSoundUrl('ping'));
  audio.volume = SOUND_VOLUMES.ping;
  audio.play().catch((err) => {
    console.warn('Failed to play ping sound:', err);
  });
}

/**
 * Preload all sounds to avoid delay on first play
 */
export function preloadSounds(): void {
  Object.keys(SOUND_PATHS).forEach((key) => {
    const soundType = key as keyof typeof SOUND_PATHS;
    const audio = getAudio(soundType);
    audio.load();
  });
}
