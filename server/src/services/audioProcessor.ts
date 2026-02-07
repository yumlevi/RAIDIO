import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export interface AudioProcessingOptions {
  highPass?: number;      // Hz, 0 to disable
  lowPass1?: number;      // Hz, 0 to disable (gentle roll-off, 2 poles = 12dB/octave)
  lowPass2?: number;      // Hz, 0 to disable (steep roll-off, 4 poles = 24dB/octave)
}

/**
 * Check if ffmpeg is available
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Process audio buffer with ffmpeg filters using temp files (more reliable on Windows)
 * @param inputBuffer - Input audio buffer (mp3 or flac)
 * @param options - Filter options
 * @param format - Output format ('mp3' or 'flac')
 * @returns Processed audio buffer
 */
export async function processAudio(
  inputBuffer: Buffer,
  options: AudioProcessingOptions,
  format: 'mp3' | 'flac' = 'mp3'
): Promise<Buffer> {
  // Build filter chain
  const filters: string[] = [];

  // High pass filter (gentle roll-off with 2 poles = 12dB/octave)
  if (options.highPass && options.highPass > 0) {
    filters.push(`highpass=f=${options.highPass}:poles=2`);
  }

  // Low pass filter 1 (gentle roll-off with 2 poles = 12dB/octave)
  if (options.lowPass1 && options.lowPass1 > 0) {
    filters.push(`lowpass=f=${options.lowPass1}:poles=2`);
  }

  // Low pass filter 2 (steep roll-off - chain two 2-pole filters for 24dB/octave)
  if (options.lowPass2 && options.lowPass2 > 0) {
    filters.push(`lowpass=f=${options.lowPass2}:poles=2`);
    filters.push(`lowpass=f=${options.lowPass2}:poles=2`);
  }

  // If no filters, return original buffer
  if (filters.length === 0) {
    console.log('[AudioProcessor] No filters to apply, returning original');
    return inputBuffer;
  }

  const filterChain = filters.join(',');
  console.log('[AudioProcessor] Applying filters:', filterChain);

  // Create temp directory
  const tempDir = path.join(os.tmpdir(), 'ace-step-audio');
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true });
  }

  // Generate unique temp file names
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const inputExt = format === 'flac' ? '.flac' : '.mp3';
  const outputExt = format === 'flac' ? '.flac' : '.mp3';
  const inputPath = path.join(tempDir, `input_${timestamp}_${random}${inputExt}`);
  const outputPath = path.join(tempDir, `output_${timestamp}_${random}${outputExt}`);

  try {
    // Write input buffer to temp file
    await writeFile(inputPath, inputBuffer);

    // Build ffmpeg command
    const codecArgs = format === 'flac'
      ? ['-c:a', 'flac']
      : ['-c:a', 'libmp3lame', '-q:a', '2']; // High quality MP3

    const args = [
      '-y',                       // Overwrite output
      '-i', inputPath,            // Input file
      '-af', filterChain,         // Apply audio filters
      ...codecArgs,               // Output codec
      outputPath                  // Output file
    ];

    // Run ffmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';

      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(err);
      });
    });

    // Read output file
    const outputBuffer = await readFile(outputPath);

    console.log('[AudioProcessor] Processing complete:', {
      inputSize: inputBuffer.length,
      outputSize: outputBuffer.length,
      filters: filterChain
    });

    return outputBuffer;
  } finally {
    // Cleanup temp files
    try {
      if (existsSync(inputPath)) await unlink(inputPath);
    } catch { /* ignore cleanup errors */ }
    try {
      if (existsSync(outputPath)) await unlink(outputPath);
    } catch { /* ignore cleanup errors */ }
  }
}

/**
 * Process audio with settings from RadioSettings
 */
export async function processAudioWithSettings(
  inputBuffer: Buffer,
  settings: {
    audioPostProcess?: boolean;
    audioHighPass?: number;
    audioLowPass1?: number;
    audioLowPass2?: number;
    audioFormat?: 'mp3' | 'flac';
  }
): Promise<Buffer> {
  // Skip if post-processing is disabled
  if (!settings.audioPostProcess) {
    console.log('[AudioProcessor] Post-processing disabled, skipping');
    return inputBuffer;
  }

  // Check if ffmpeg is available
  const ffmpegAvailable = await checkFfmpegAvailable();
  if (!ffmpegAvailable) {
    console.warn('[AudioProcessor] ffmpeg not found, skipping post-processing');
    return inputBuffer;
  }

  try {
    return await processAudio(
      inputBuffer,
      {
        highPass: settings.audioHighPass,
        lowPass1: settings.audioLowPass1,
        lowPass2: settings.audioLowPass2,
      },
      settings.audioFormat || 'mp3'
    );
  } catch (error) {
    console.error('[AudioProcessor] Processing failed, returning original:', error);
    return inputBuffer;
  }
}
