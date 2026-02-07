import { spawn, ChildProcess } from 'child_process';
import { createReadStream, statSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PassThrough, Readable } from 'stream';
import { radioManager, RadioSong } from './radioState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIO_DIR = path.join(__dirname, '../../public/audio');

interface StreamClient {
  id: string;
  stream: PassThrough;
  connectedAt: Date;
}

class RadioStreamer {
  private clients: Map<string, StreamClient> = new Map();
  private currentStream: Readable | null = null;
  private ffmpegProcess: ChildProcess | null = null;
  private isStreaming = false;
  private currentSongId: string | null = null;

  constructor() {
    // Listen for song changes from radio manager
    this.startStreamLoop();
  }

  private async startStreamLoop() {
    console.log('[RadioStream] Starting stream loop...');

    // Check every second for song changes
    setInterval(() => {
      const currentSong = radioManager.getPublicState().currentSong;

      if (currentSong && currentSong.id !== this.currentSongId) {
        console.log('[RadioStream] Song changed to:', currentSong.title);
        this.currentSongId = currentSong.id;
        this.streamSong(currentSong);
      } else if (!currentSong && this.currentSongId) {
        console.log('[RadioStream] No song playing, stopping stream');
        this.currentSongId = null;
        this.stopCurrentStream();
      }
    }, 1000);
  }

  private getLocalPath(audioUrl: string): string | null {
    // Convert /audio/path to local filesystem path
    if (audioUrl.startsWith('/audio/')) {
      const relativePath = audioUrl.replace('/audio/', '');
      const fullPath = path.join(AUDIO_DIR, relativePath);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }

  private stopCurrentStream() {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }
    this.currentStream = null;
    this.isStreaming = false;
  }

  private async streamSong(song: RadioSong) {
    this.stopCurrentStream();

    const localPath = this.getLocalPath(song.audioUrl);

    if (!localPath) {
      console.error('[RadioStream] Cannot find local file for:', song.audioUrl);
      return;
    }

    console.log('[RadioStream] Streaming file:', localPath);
    this.isStreaming = true;

    // Calculate fade times from settings
    const settings = radioManager.getSettings();
    const FADE_IN_DURATION = settings.autoDjFadeIn ?? 2;
    const FADE_OUT_DURATION = settings.autoDjFadeOut ?? 3;
    const songDuration = song.duration || 180; // Default to 3 minutes if unknown
    const fadeOutStart = Math.max(0, songDuration - FADE_OUT_DURATION);

    // Build audio filter for crossfade effect
    const audioFilter = `afade=t=in:st=0:d=${FADE_IN_DURATION},afade=t=out:st=${fadeOutStart}:d=${FADE_OUT_DURATION}`;
    console.log('[RadioStream] Audio filter:', audioFilter, `(duration: ${songDuration}s)`);

    try {
      // Use ffmpeg to convert to constant bitrate MP3 stream with fade effects
      this.ffmpegProcess = spawn('ffmpeg', [
        '-re',              // Read input at native frame rate (real-time)
        '-i', localPath,    // Input file
        '-vn',              // No video
        '-af', audioFilter, // Audio filter for fade in/out
        '-acodec', 'libmp3lame',  // MP3 codec
        '-ab', '128k',      // 128kbps bitrate
        '-ar', '44100',     // 44.1kHz sample rate
        '-ac', '2',         // Stereo
        '-f', 'mp3',        // Output format
        '-'                 // Output to stdout
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.currentStream = this.ffmpegProcess.stdout as Readable;

      this.ffmpegProcess.stderr?.on('data', (data) => {
        // Only log errors, not progress
        const msg = data.toString();
        if (msg.includes('Error') || msg.includes('error')) {
          console.error('[RadioStream] ffmpeg error:', msg);
        }
      });

      this.ffmpegProcess.on('close', (code) => {
        console.log('[RadioStream] ffmpeg process closed with code:', code);
        this.isStreaming = false;

        // If song ended naturally, trigger next song
        if (code === 0) {
          console.log('[RadioStream] Song finished, advancing to next...');
          radioManager.playNext();
        }
      });

      this.ffmpegProcess.on('error', (err) => {
        console.error('[RadioStream] ffmpeg process error:', err);
        this.isStreaming = false;
      });

      // Pipe to all connected clients
      if (this.currentStream) {
        this.currentStream.on('data', (chunk) => {
          this.broadcastChunk(chunk);
        });

        this.currentStream.on('end', () => {
          console.log('[RadioStream] Stream ended');
        });

        this.currentStream.on('error', (err) => {
          console.error('[RadioStream] Stream error:', err);
        });
      }

    } catch (error) {
      console.error('[RadioStream] Error starting stream:', error);
      this.isStreaming = false;
    }
  }

  private broadcastChunk(chunk: Buffer) {
    this.clients.forEach((client, id) => {
      try {
        if (!client.stream.destroyed) {
          client.stream.write(chunk);
        } else {
          this.removeClient(id);
        }
      } catch (err) {
        console.error('[RadioStream] Error writing to client:', id, err);
        this.removeClient(id);
      }
    });
  }

  addClient(id: string): PassThrough {
    const stream = new PassThrough();
    const client: StreamClient = {
      id,
      stream,
      connectedAt: new Date(),
    };

    this.clients.set(id, client);
    console.log('[RadioStream] Client connected:', id, '- Total clients:', this.clients.size);

    return stream;
  }

  removeClient(id: string) {
    const client = this.clients.get(id);
    if (client) {
      try {
        client.stream.end();
      } catch (err) {
        // Ignore errors when ending stream
      }
      this.clients.delete(id);
      console.log('[RadioStream] Client disconnected:', id, '- Total clients:', this.clients.size);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  isActive(): boolean {
    return this.isStreaming;
  }

  // Generate M3U playlist
  generatePlaylist(baseUrl: string): string {
    const state = radioManager.getPublicState();
    const lines = [
      '#EXTM3U',
      '#EXTINF:-1,RAIDIO - AI Music Stream',
      `${baseUrl}/api/radio/stream`,
    ];

    return lines.join('\n');
  }

  // Generate extended M3U with current song info
  generateExtendedPlaylist(baseUrl: string): string {
    const state = radioManager.getPublicState();
    const currentSong = state.currentSong;

    const lines = [
      '#EXTM3U',
      `#EXTINF:-1,${currentSong ? `${currentSong.title} - ${currentSong.creator || 'Unknown'}` : 'RAIDIO'}`,
      `${baseUrl}/api/radio/stream`,
    ];

    return lines.join('\n');
  }
}

// Singleton instance
export const radioStreamer = new RadioStreamer();
