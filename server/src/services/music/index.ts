/**
 * Music Provider Factory + provider-agnostic job queue.
 *
 * Public API mirrors the old acestep.ts exports so consumers can migrate
 * import-by-import.
 */

import type {
  MusicProvider,
  MusicGenerationRequest,
  MusicGenerationResult,
} from './types.js';
import { AceStepProvider } from './provider-acestep.js';

// Re-export types for convenience
export type {
  MusicProvider,
  MusicGenerationRequest,
  MusicGenerationResult,
  MusicJobResult,
  AceStepProviderSettings,
} from './types.js';

// Re-export resolvePythonPath (needed by /format endpoint)
export { resolvePythonPath } from './provider-acestep.js';

// ---------------------------------------------------------------------------
// Singleton provider
// ---------------------------------------------------------------------------

let activeProvider: MusicProvider = new AceStepProvider();

export function initMusicProvider(name?: string, url?: string): MusicProvider {
  switch (name) {
    case 'acestep':
    default:
      activeProvider = new AceStepProvider(url);
      break;
  }
  console.log(`[Music] Initialized provider: ${activeProvider.displayName}`);
  return activeProvider;
}

export function setMusicProviderUrl(url: string): void {
  if (activeProvider instanceof AceStepProvider) {
    activeProvider.setApiUrl(url);
  }
}

export function getMusicProviderUrl(): string {
  if (activeProvider instanceof AceStepProvider) {
    return activeProvider.getApiUrl();
  }
  return '';
}

export function getMusicProvider(): MusicProvider {
  return activeProvider;
}

// ---------------------------------------------------------------------------
// Job queue (provider-agnostic — GPU can only handle one job at a time)
// ---------------------------------------------------------------------------

interface ActiveJob {
  request: MusicGenerationRequest;
  startTime: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  taskId?: string; // provider's task ID
  result?: MusicGenerationResult;
  error?: string;
  rawResponse?: unknown;
  queuePosition?: number;
}

interface JobStatus {
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  queuePosition?: number;
  etaSeconds?: number;
  result?: MusicGenerationResult;
  error?: string;
}

const activeJobs = new Map<string, ActiveJob>();
const jobQueue: string[] = [];
let isProcessingQueue = false;

async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (jobQueue.length > 0) {
    const jobId = jobQueue[0];
    const job = activeJobs.get(jobId);

    if (job && job.status === 'queued') {
      try {
        await processGeneration(jobId, job);
      } catch (error) {
        console.error(`Queue processing error for ${jobId}:`, error);
      }
    }

    jobQueue.shift();
    jobQueue.forEach((id, index) => {
      const queuedJob = activeJobs.get(id);
      if (queuedJob) queuedJob.queuePosition = index + 1;
    });
  }

  isProcessingQueue = false;
}

async function processGeneration(jobId: string, job: ActiveJob): Promise<void> {
  job.status = 'running';
  const provider = activeProvider;
  const request = job.request;
  const audioFormat = request.audioFormat ?? 'mp3';

  console.log(`Job ${jobId}: Using ${provider.displayName}`, {
    prompt: request.prompt.slice(0, 50),
    duration: request.duration,
  });

  try {
    const { taskId } = await provider.submitJob(request);
    job.taskId = taskId;
    console.log(`Job ${jobId}: Submitted as task ${taskId}`);

    // Poll for result
    const apiResult = await provider.pollJobResult(taskId);

    if (!apiResult.audioPaths?.length) {
      throw new Error('No audio files generated');
    }

    // Download audio files that need downloading (REST API paths)
    const audioUrls: string[] = [];
    let actualDuration = 0;
    const AUDIO_DIR = (await import('path')).join(
      (await import('path')).dirname((await import('url')).fileURLToPath(import.meta.url)),
      '../../../public/audio',
    );

    for (const apiAudioPath of apiResult.audioPaths) {
      // If it's already a local /audio/ path, use it directly
      if (apiAudioPath.startsWith('/audio/')) {
        audioUrls.push(apiAudioPath);
        if (audioUrls.length === 1) {
          const { execSync } = await import('child_process');
          const localPath = (await import('path')).join(AUDIO_DIR, apiAudioPath.replace('/audio/', ''));
          try {
            const dur = parseFloat(
              execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${localPath}"`, { encoding: 'utf-8', timeout: 10000 }).trim(),
            );
            actualDuration = isNaN(dur) ? 0 : Math.round(dur);
          } catch { /* ignore */ }
        }
        continue;
      }

      // Remote path — download
      const ext = apiAudioPath.includes('.flac') ? '.flac' : `.${audioFormat}`;
      const filename = `${jobId}_${audioUrls.length}${ext}`;
      const destPath = (await import('path')).join(AUDIO_DIR, filename);

      await provider.downloadAudio(apiAudioPath, destPath);

      if (audioUrls.length === 0) {
        const { execSync } = await import('child_process');
        try {
          const dur = parseFloat(
            execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${destPath}"`, { encoding: 'utf-8', timeout: 10000 }).trim(),
          );
          actualDuration = isNaN(dur) ? 0 : Math.round(dur);
        } catch { /* ignore */ }
      }

      audioUrls.push(`/audio/${filename}`);
    }

    const finalDuration = actualDuration > 0
      ? actualDuration
      : (apiResult.metas?.duration || request.duration || 60);

    job.status = 'succeeded';
    job.result = {
      audioUrls,
      duration: finalDuration,
      bpm: apiResult.metas?.bpm || request.bpm,
      keyScale: apiResult.metas?.keyscale || request.keyScale,
      timeSignature: apiResult.metas?.timesignature || request.timeSignature,
      status: 'succeeded',
    };
    console.log(`Job ${jobId}: Completed with ${audioUrls.length} audio files`);
  } catch (error) {
    console.error(`Job ${jobId}: Generation failed`, error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Generation failed';
  }
}

// ---------------------------------------------------------------------------
// Public API (matches old acestep.ts signatures for easy migration)
// ---------------------------------------------------------------------------

export async function generateMusic(request: MusicGenerationRequest): Promise<{ jobId: string }> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const job: ActiveJob = {
    request,
    startTime: Date.now(),
    status: 'queued',
    queuePosition: jobQueue.length + 1,
  };

  activeJobs.set(jobId, job);
  jobQueue.push(jobId);
  console.log(`Job ${jobId}: Queued at position ${job.queuePosition}`);

  processQueue().catch(err => console.error('Queue processing error:', err));
  return { jobId };
}

export async function getMusicJobStatus(jobId: string): Promise<JobStatus> {
  const job = activeJobs.get(jobId);
  if (!job) return { status: 'failed', error: 'Job not found' };

  if (job.status === 'succeeded' && job.result) {
    return { status: 'succeeded', result: job.result };
  }
  if (job.status === 'failed') {
    return { status: 'failed', error: job.error || 'Generation failed' };
  }

  const elapsed = Math.floor((Date.now() - job.startTime) / 1000);
  if (job.status === 'queued') {
    return {
      status: 'queued',
      queuePosition: job.queuePosition,
      etaSeconds: (job.queuePosition || 1) * 180,
    };
  }
  return { status: 'running', etaSeconds: Math.max(0, 180 - elapsed) };
}

export function getMusicJobRawResponse(jobId: string): unknown | null {
  return activeJobs.get(jobId)?.rawResponse || null;
}

export async function getMusicAudioStream(audioPath: string): Promise<Response> {
  return activeProvider.getAudioStream(audioPath);
}

export async function downloadMusicAudio(remoteUrl: string, songId: string): Promise<string> {
  const { mkdir, writeFile } = await import('fs/promises');
  const audioDir = (await import('path')).join(
    (await import('path')).dirname((await import('url')).fileURLToPath(import.meta.url)),
    '../../../public/audio',
  );
  await mkdir(audioDir, { recursive: true });

  const response = await activeProvider.getAudioStream(remoteUrl);
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = remoteUrl.includes('.flac') ? '.flac' : '.mp3';
  const filename = `${songId}${ext}`;
  const filepath = (await import('path')).join(audioDir, filename);

  await writeFile(filepath, buffer);
  return `/audio/${filename}`;
}

export async function downloadMusicAudioToBuffer(remoteUrl: string): Promise<{ buffer: Buffer; size: number }> {
  const response = await activeProvider.getAudioStream(remoteUrl);
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, size: buffer.length };
}

export function cleanupMusicJob(jobId: string): void {
  activeJobs.delete(jobId);
}

export function cleanupOldMusicJobs(maxAgeMs = 3600000): void {
  const now = Date.now();
  for (const [jobId, job] of activeJobs) {
    if (now - job.startTime > maxAgeMs) activeJobs.delete(jobId);
  }
}

export async function checkMusicHealth(): Promise<boolean> {
  if (activeProvider instanceof AceStepProvider) {
    return (activeProvider as AceStepProvider).checkHealth();
  }
  return activeProvider.isAvailable();
}

export async function discoverMusicEndpoints(): Promise<unknown> {
  if (activeProvider instanceof AceStepProvider) {
    return (activeProvider as AceStepProvider).discoverEndpoints();
  }
  return { provider: activeProvider.name };
}

export function resetMusicApiCache(): void {
  if (activeProvider instanceof AceStepProvider) {
    (activeProvider as AceStepProvider).resetApiCache();
  }
}

// ---------------------------------------------------------------------------
// Helper: build MusicGenerationRequest from flat params (old-style callers)
// ---------------------------------------------------------------------------

/**
 * Convert old-style flat GenerationParams (with customMode, style, songDescription, etc.)
 * into the new MusicGenerationRequest format.
 */
export function buildMusicRequest(params: Record<string, unknown>): MusicGenerationRequest {
  const customMode = params.customMode as boolean | undefined;
  const style = params.style as string | undefined;
  const songDescription = params.songDescription as string | undefined;
  const caption = style || 'pop music';
  const prompt = customMode ? caption : (songDescription || caption);

  // Collect ACE-Step-specific fields into providerSettings
  const providerSettings: Record<string, unknown> = {};
  const providerKeys = [
    'inferenceSteps', 'guidanceScale', 'shift', 'inferMethod', 'thinking',
    'lmTemperature', 'lmCfgScale', 'lmTopK', 'lmTopP', 'lmNegativePrompt',
    'useCotCaption', 'constrainedDecoding',
    'referenceAudioUrl', 'sourceAudioUrl', 'audioCodes',
    'repaintingStart', 'repaintingEnd', 'instruction', 'audioCoverStrength',
    'taskType', 'useAdg', 'cfgIntervalStart', 'cfgIntervalEnd', 'customTimesteps',
    'useCotMetas', 'useCotLanguage', 'constrainedDecodingDebug', 'allowLmBatch',
    'getScores', 'getLrc', 'scoreScale', 'lmBatchChunkSize', 'trackName',
    'completeTrackClasses', 'isFormatCaption',
  ];
  for (const key of providerKeys) {
    if (params[key] !== undefined) providerSettings[key] = params[key];
  }

  return {
    prompt,
    lyrics: (params.lyrics as string) || '',
    instrumental: (params.instrumental as boolean) || false,
    vocalLanguage: params.vocalLanguage as string | undefined,
    duration: params.duration as number | undefined,
    bpm: params.bpm as number | undefined,
    keyScale: params.keyScale as string | undefined,
    timeSignature: params.timeSignature as string | undefined,
    audioFormat: params.audioFormat as 'mp3' | 'flac' | undefined,
    batchSize: params.batchSize as number | undefined,
    randomSeed: params.randomSeed as boolean | undefined,
    seed: params.seed as number | undefined,
    providerSettings,
  };
}

// ---------------------------------------------------------------------------
// Backward-compatible aliases (old acestep.ts function names)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use generateMusic() with MusicGenerationRequest.
 * Accepts old flat GenerationParams and auto-converts.
 */
export async function generateMusicViaAPI(params: Record<string, unknown>): Promise<{ jobId: string }> {
  return generateMusic(buildMusicRequest(params));
}
/** @deprecated Use getMusicJobStatus() */
export const getJobStatus = getMusicJobStatus;
/** @deprecated Use getMusicAudioStream() */
export const getAudioStream = getMusicAudioStream;
/** @deprecated Use downloadMusicAudioToBuffer() */
export const downloadAudioToBuffer = downloadMusicAudioToBuffer;
/** @deprecated Use getMusicJobRawResponse() */
export const getJobRawResponse = getMusicJobRawResponse;
/** @deprecated Use cleanupMusicJob() */
export const cleanupJob = cleanupMusicJob;
/** @deprecated Use checkMusicHealth() */
export const checkSpaceHealth = checkMusicHealth;
/** @deprecated Use discoverMusicEndpoints() */
export const discoverEndpoints = discoverMusicEndpoints;
/** @deprecated Use resetMusicApiCache() */
export const resetClient = resetMusicApiCache;
