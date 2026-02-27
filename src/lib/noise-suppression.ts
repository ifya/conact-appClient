import type { TrackProcessor, AudioProcessorOptions } from 'livekit-client';
import { Track } from 'livekit-client';
import { NoiseSuppressionProcessor } from '@shiguredo/noise-suppression';

type AudioTrackProcessor = TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>;

/**
 * RNNoise-based noise suppression processor for LiveKit
 * Uses @shiguredo/noise-suppression which implements RNNoise with Insertable Streams
 */
export class RNNoiseProcessor implements AudioTrackProcessor {
  name = 'rnnoise-processor';

  private noiseProcessor: NoiseSuppressionProcessor | null = null;

  processedTrack?: MediaStreamTrack;

  /**
   * Check if noise suppression is supported in this browser
   */
  static isSupported(): boolean {
    return NoiseSuppressionProcessor.isSupported();
  }

  async init(opts: AudioProcessorOptions): Promise<void> {
    // Clean up any previous instance
    await this.destroy();

    try {
      // Check browser support
      if (!NoiseSuppressionProcessor.isSupported()) {
        console.warn('RNNoise: Noise suppression not supported in this browser');
        // Fall back to original track without processing
        this.processedTrack = opts.track;
        return;
      }

      this.noiseProcessor = new NoiseSuppressionProcessor();

      // Start processing the audio track
      // Cast to any because the library uses MediaStreamAudioTrack which is a subset of MediaStreamTrack
      const processedAudioTrack = await this.noiseProcessor.startProcessing(
        opts.track as any
      );

      this.processedTrack = processedAudioTrack;
      console.log('RNNoise: Noise suppression initialized successfully');
    } catch (error) {
      console.error('RNNoise: Failed to initialize noise suppression:', error);
      // Fall back to original track on error
      this.processedTrack = opts.track;
      this.noiseProcessor = null;
    }
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.init(opts);
  }

  async destroy(): Promise<void> {
    if (this.noiseProcessor) {
      try {
        this.noiseProcessor.stopProcessing();
      } catch {
        // Ignore errors during cleanup
      }
      this.noiseProcessor = null;
    }
    this.processedTrack = undefined;
  }
}

// Create a new instance each time to avoid stale state
export function getRNNoiseProcessor(): RNNoiseProcessor {
  return new RNNoiseProcessor();
}

// Re-export for checking support
export const isNoiseSuppresionSupported = RNNoiseProcessor.isSupported;
