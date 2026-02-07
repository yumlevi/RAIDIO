/**
 * ACE-Step music provider — implements MusicProvider by wrapping the ACE-Step
 * REST API (preferred) with a Python-spawn fallback.
 */

import { writeFile, mkdir, copyFile, rm, access } from 'fs/promises';
import { spawn, execSync } from 'child_process';
import { existsSync, createWriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { config } from '../../config/index.js';
import type {
  MusicProvider,
  MusicGenerationRequest,
  MusicJobResult,
  AceStepProviderSettings,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIO_DIR = path.join(__dirname, '../../../public/audio');

// ---------------------------------------------------------------------------
// Utility: get audio duration via ffprobe
// ---------------------------------------------------------------------------
function getAudioDuration(filePath: string): number {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf-8', timeout: 10000 },
    );
    const duration = parseFloat(result.trim());
    return isNaN(duration) ? 0 : Math.round(duration);
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Utility: resolve ACE-Step install path
// ---------------------------------------------------------------------------
function resolveAceStepPath(): string {
  const envPath = process.env.ACESTEP_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
  }
  return path.resolve(__dirname, '../../../../models/ACE-Step-1.5');
}

// ---------------------------------------------------------------------------
// Utility: resolve Python binary (exported for /format endpoint)
// ---------------------------------------------------------------------------
export function resolvePythonPath(baseDir: string): string {
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }
  const isWindows = process.platform === 'win32';
  const pythonExe = isWindows ? 'python.exe' : 'python';

  const portablePath = path.join(baseDir, 'python_embeded', pythonExe);
  if (existsSync(portablePath)) return portablePath;

  if (isWindows) return path.join(baseDir, '.venv', 'Scripts', pythonExe);
  return path.join(baseDir, '.venv', 'bin', 'python');
}

// ---------------------------------------------------------------------------
// ACE-Step Provider
// ---------------------------------------------------------------------------

export class AceStepProvider implements MusicProvider {
  readonly name = 'acestep';
  readonly displayName = 'ACE-Step 1.5';

  private apiUrl: string;
  private aceStepDir = resolveAceStepPath();
  private scriptsDir = path.join(__dirname, '../../../scripts');
  private pythonScript = path.join(this.scriptsDir, 'simple_generate.py');

  // API availability cache (check once per session)
  private apiAvailableCache: boolean | null = null;
  private apiCheckPromise: Promise<boolean> | null = null;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || config.acestep.apiUrl;
  }

  setApiUrl(url: string): void {
    this.apiUrl = url;
    this.resetApiCache();
    console.log(`[ACE-Step] API URL updated to: ${url}`);
  }

  getApiUrl(): string {
    return this.apiUrl;
  }

  // ------ MusicProvider interface ------

  async isAvailable(): Promise<boolean> {
    if (this.apiAvailableCache !== null) return this.apiAvailableCache;
    if (this.apiCheckPromise) return this.apiCheckPromise;

    this.apiCheckPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${this.apiUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          this.apiAvailableCache =
            data.status === 'ok' || data.healthy === true || data.data?.status === 'ok';
          console.log(`[ACE-Step] API available at ${this.apiUrl}: ${this.apiAvailableCache}`);
          return this.apiAvailableCache;
        }
        this.apiAvailableCache = false;
        return false;
      } catch {
        console.log(`[ACE-Step] API not available at ${this.apiUrl}, will use Python spawn`);
        this.apiAvailableCache = false;
        return false;
      } finally {
        this.apiCheckPromise = null;
      }
    })();

    return this.apiCheckPromise;
  }

  resetApiCache(): void {
    this.apiAvailableCache = null;
    this.apiCheckPromise = null;
  }

  async submitJob(request: MusicGenerationRequest): Promise<{ taskId: string }> {
    const useApi = await this.isAvailable();

    if (useApi) {
      return this.submitToApi(request);
    }
    // Python spawn: generate synchronously and store audio, return a synthetic task id
    return this.submitViaPython(request);
  }

  async pollJobResult(taskId: string): Promise<MusicJobResult> {
    // Python-spawn results are stored in pythonResults map
    const pyResult = this.pythonResults.get(taskId);
    if (pyResult) {
      return pyResult;
    }
    // Otherwise poll the REST API
    return this.pollApiResult(taskId);
  }

  async downloadAudio(remotePath: string, destPath: string): Promise<void> {
    const url = remotePath.startsWith('/v1/audio')
      ? `${this.apiUrl}${remotePath}`
      : `${this.apiUrl}/v1/audio?path=${encodeURIComponent(remotePath)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`);

    const body = response.body;
    if (!body) throw new Error('No response body');

    await mkdir(path.dirname(destPath), { recursive: true });
    const fileStream = createWriteStream(destPath);
    const reader = body.getReader();
    const nodeStream = new (await import('stream')).Readable({
      async read() {
        const { done, value } = await reader.read();
        if (done) this.push(null);
        else this.push(Buffer.from(value));
      },
    });
    await pipeline(nodeStream, fileStream);
  }

  async getAudioStream(audioPath: string): Promise<Response> {
    if (audioPath.startsWith('http')) return fetch(audioPath);

    if (audioPath.startsWith('/audio/')) {
      const localPath = path.join(AUDIO_DIR, audioPath.replace('/audio/', ''));
      try {
        const { readFile } = await import('fs/promises');
        const buffer = await readFile(localPath);
        const ext = localPath.endsWith('.flac') ? 'flac' : 'mpeg';
        return new Response(buffer, {
          status: 200,
          headers: { 'Content-Type': `audio/${ext}` },
        });
      } catch {
        return new Response(null, { status: 404 });
      }
    }

    const url = `${this.apiUrl}/v1/audio?path=${encodeURIComponent(audioPath)}`;
    return fetch(url);
  }

  getDefaultSettings(): Record<string, unknown> {
    return {
      inferenceSteps: 8,
      guidanceScale: 7.0,
      shift: 3.0,
      inferMethod: 'ode',
      thinking: false,
      lmTemperature: 0.85,
      lmCfgScale: 2.0,
      lmTopK: 0,
      lmTopP: 0.9,
      lmNegativePrompt: 'NO USER INPUT',
      useCotCaption: false,
      constrainedDecoding: false,
    };
  }

  // ------ Health / discovery helpers (backward compat) ------

  async checkHealth(): Promise<boolean> {
    try {
      await access(this.pythonScript);
      return true;
    } catch {
      return false;
    }
  }

  async discoverEndpoints(): Promise<unknown> {
    return { provider: 'acestep-local', endpoint: this.apiUrl };
  }

  // ------ Private: REST API path ------

  private async submitToApi(request: MusicGenerationRequest): Promise<{ taskId: string }> {
    const ps = (request.providerSettings ?? {}) as AceStepProviderSettings;

    const useInternalLM = ps.thinking || ps.useCotCaption || ps.constrainedDecoding;

    const body: Record<string, unknown> = {
      prompt: request.prompt,
      lyrics: request.instrumental ? '' : request.lyrics,
      audio_duration: request.duration ?? 60,
      batch_size: request.batchSize ?? 1,
      inference_steps: ps.inferenceSteps ?? 8,
      guidance_scale: ps.guidanceScale ?? 10.0,
      audio_format: request.audioFormat ?? 'mp3',
      vocal_language: request.vocalLanguage || 'en',
      use_random_seed: request.randomSeed !== false,
      shift: ps.shift ?? 3.0,
      thinking: ps.thinking ?? false,
      use_cot_caption: ps.useCotCaption ?? false,
      use_cot_language: ps.thinking ? true : false,
      use_cot_metas: ps.thinking ? true : false,
    };

    if (ps.constrainedDecoding !== undefined) body.constrained_decoding = ps.constrainedDecoding;

    if (request.bpm && request.bpm > 0) body.bpm = request.bpm;
    if (request.keyScale) body.key_scale = request.keyScale;
    if (request.timeSignature) body.time_signature = request.timeSignature;
    if (request.seed !== undefined && request.seed >= 0 && !request.randomSeed) {
      body.seed = request.seed;
      body.use_random_seed = false;
    }
    if (ps.taskType && ps.taskType !== 'text2music') body.task_type = ps.taskType;
    if (ps.audioCodes) body.audio_code_string = ps.audioCodes;
    if (ps.repaintingStart !== undefined && ps.repaintingStart > 0) body.repainting_start = ps.repaintingStart;
    if (ps.repaintingEnd !== undefined && ps.repaintingEnd > 0) body.repainting_end = ps.repaintingEnd;
    if (ps.audioCoverStrength !== undefined && ps.audioCoverStrength !== 1.0) body.audio_cover_strength = ps.audioCoverStrength;
    if (ps.instruction) body.instruction = ps.instruction;

    if (useInternalLM) {
      if (ps.lmTemperature !== undefined) body.lm_temperature = ps.lmTemperature;
      if (ps.lmCfgScale !== undefined) body.lm_cfg_scale = ps.lmCfgScale;
      if (ps.lmTopK !== undefined && ps.lmTopK > 0) body.lm_top_k = ps.lmTopK;
      if (ps.lmTopP !== undefined) body.lm_top_p = ps.lmTopP;
      if (ps.thinking) {
        if (ps.useCotCaption !== undefined) body.use_cot_caption = ps.useCotCaption;
        if (ps.useCotLanguage !== undefined) body.use_cot_language = ps.useCotLanguage;
        if (ps.useCotMetas !== undefined) body.use_cot_metas = ps.useCotMetas;
      }
    }
    if (ps.useAdg) body.use_adg = true;
    if (ps.cfgIntervalStart !== undefined && ps.cfgIntervalStart > 0) body.cfg_interval_start = ps.cfgIntervalStart;
    if (ps.cfgIntervalEnd !== undefined && ps.cfgIntervalEnd < 1.0) body.cfg_interval_end = ps.cfgIntervalEnd;

    if (ps.referenceAudioUrl) {
      let refAudioPath = ps.referenceAudioUrl;
      if (refAudioPath.startsWith('/audio/')) {
        refAudioPath = path.join(AUDIO_DIR, refAudioPath.replace('/audio/', ''));
      }
      body.reference_audio_path = refAudioPath;
    }
    if (ps.sourceAudioUrl) {
      let srcAudioPath = ps.sourceAudioUrl;
      if (srcAudioPath.startsWith('/audio/')) {
        srcAudioPath = path.join(AUDIO_DIR, srcAudioPath.replace('/audio/', ''));
      }
      body.src_audio_path = srcAudioPath;
    }

    const response = await fetch(`${this.apiUrl}/release_task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const taskId = result.data?.task_id || result.data?.job_id || result.job_id || result.task_id;
    if (!taskId) throw new Error('No task ID returned from API');
    return { taskId };
  }

  private async pollApiResult(taskId: string, maxWaitMs = 600000): Promise<MusicJobResult> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < maxWaitMs) {
      const response = await fetch(`${this.apiUrl}/query_result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id_list: [taskId] }),
      });
      if (!response.ok) throw new Error(`API poll error: ${response.status}`);

      const result = await response.json();
      const taskData = result.data?.[0];

      if (!taskData) {
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      if (taskData.status === 1) {
        let resultData;
        try {
          resultData = typeof taskData.result === 'string' ? JSON.parse(taskData.result) : taskData.result;
        } catch {
          resultData = [];
        }
        const audioPaths = Array.isArray(resultData)
          ? resultData.map((r: { file?: string }) => r.file).filter(Boolean)
          : [];
        const metas = resultData[0]?.metas;
        return { status: 1, audioPaths, metas };
      } else if (taskData.status === 2) {
        throw new Error('Generation failed on API side');
      }

      await new Promise(r => setTimeout(r, pollInterval));
    }
    throw new Error('API generation timeout');
  }

  // ------ Private: Python spawn path ------

  /** Stores results from Python spawn jobs so pollJobResult can retrieve them */
  private pythonResults = new Map<string, MusicJobResult>();

  private async submitViaPython(request: MusicGenerationRequest): Promise<{ taskId: string }> {
    const ps = (request.providerSettings ?? {}) as AceStepProviderSettings;
    const taskId = `py_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const jobOutputDir = path.join(this.aceStepDir, 'output', taskId);
    await mkdir(jobOutputDir, { recursive: true });

    const args = [
      '--prompt', request.prompt,
      '--duration', String(request.duration ?? 60),
      '--batch-size', String(request.batchSize ?? 1),
      '--infer-steps', String(ps.inferenceSteps ?? 8),
      '--guidance-scale', String(ps.guidanceScale ?? 10.0),
      '--audio-format', request.audioFormat ?? 'mp3',
      '--output-dir', jobOutputDir,
      '--json',
    ];

    const lyrics = request.instrumental ? '' : request.lyrics;
    if (lyrics) args.push('--lyrics', lyrics);
    if (request.instrumental) args.push('--instrumental');
    if (request.bpm && request.bpm > 0) args.push('--bpm', String(request.bpm));
    if (request.keyScale) args.push('--key-scale', request.keyScale);
    if (request.timeSignature) args.push('--time-signature', request.timeSignature);
    if (request.vocalLanguage) args.push('--vocal-language', request.vocalLanguage);
    if (request.seed !== undefined && request.seed >= 0 && !request.randomSeed) args.push('--seed', String(request.seed));
    if (ps.shift !== undefined) args.push('--shift', String(ps.shift));
    if (ps.taskType && ps.taskType !== 'text2music') args.push('--task-type', ps.taskType);

    if (ps.referenceAudioUrl) {
      let refAudioPath = ps.referenceAudioUrl;
      if (refAudioPath.startsWith('/audio/')) refAudioPath = path.join(AUDIO_DIR, refAudioPath.replace('/audio/', ''));
      args.push('--reference-audio', refAudioPath);
    }
    if (ps.sourceAudioUrl) {
      let srcAudioPath = ps.sourceAudioUrl;
      if (srcAudioPath.startsWith('/audio/')) srcAudioPath = path.join(AUDIO_DIR, srcAudioPath.replace('/audio/', ''));
      args.push('--src-audio', srcAudioPath);
    }
    if (ps.audioCodes) args.push('--audio-codes', ps.audioCodes);
    if (ps.repaintingStart !== undefined && ps.repaintingStart > 0) args.push('--repainting-start', String(ps.repaintingStart));
    if (ps.repaintingEnd !== undefined && ps.repaintingEnd > 0) args.push('--repainting-end', String(ps.repaintingEnd));
    if (ps.audioCoverStrength !== undefined && ps.audioCoverStrength !== 1.0) args.push('--audio-cover-strength', String(ps.audioCoverStrength));
    if (ps.instruction) args.push('--instruction', ps.instruction);
    if (ps.thinking) args.push('--thinking');
    if (ps.lmTemperature !== undefined) args.push('--lm-temperature', String(ps.lmTemperature));
    if (ps.lmCfgScale !== undefined) args.push('--lm-cfg-scale', String(ps.lmCfgScale));
    if (ps.lmTopK !== undefined && ps.lmTopK > 0) args.push('--lm-top-k', String(ps.lmTopK));
    if (ps.lmTopP !== undefined) args.push('--lm-top-p', String(ps.lmTopP));
    if (ps.lmNegativePrompt) args.push('--lm-negative-prompt', ps.lmNegativePrompt);
    if (ps.useCotMetas === false) args.push('--no-cot-metas');
    if (ps.useCotCaption === false) args.push('--no-cot-caption');
    if (ps.useCotLanguage === false) args.push('--no-cot-language');
    if (ps.useAdg) args.push('--use-adg');
    if (ps.cfgIntervalStart !== undefined && ps.cfgIntervalStart > 0) args.push('--cfg-interval-start', String(ps.cfgIntervalStart));
    if (ps.cfgIntervalEnd !== undefined && ps.cfgIntervalEnd < 1.0) args.push('--cfg-interval-end', String(ps.cfgIntervalEnd));

    try {
      const result = await this.runPythonGeneration(args);
      if (!result.success || !result.audio_paths?.length) {
        throw new Error(result.error || 'No audio files generated');
      }

      // Copy audio to public dir and build audioPaths
      const audioPaths: string[] = [];
      for (const srcPath of result.audio_paths) {
        const ext = srcPath.includes('.flac') ? '.flac' : '.mp3';
        const filename = `${taskId}_${audioPaths.length}${ext}`;
        const destPath = path.join(AUDIO_DIR, filename);
        await mkdir(AUDIO_DIR, { recursive: true });
        await copyFile(srcPath, destPath);
        audioPaths.push(`/audio/${filename}`);
      }

      // Cleanup temp output
      try { await rm(jobOutputDir, { recursive: true, force: true }); } catch { /* ignore */ }

      // Get duration from first file
      let duration = 0;
      if (audioPaths.length > 0) {
        const firstFile = path.join(AUDIO_DIR, audioPaths[0].replace('/audio/', ''));
        duration = getAudioDuration(firstFile);
      }

      this.pythonResults.set(taskId, {
        status: 1,
        audioPaths,
        metas: { duration: duration || undefined },
      });
    } catch (error) {
      try { await rm(jobOutputDir, { recursive: true, force: true }); } catch { /* ignore */ }
      this.pythonResults.set(taskId, { status: 2, audioPaths: [] });
      throw error;
    }

    return { taskId };
  }

  private runPythonGeneration(scriptArgs: string[]): Promise<PythonResult> {
    return new Promise((resolve) => {
      const pythonPath = resolvePythonPath(this.aceStepDir);
      const args = [this.pythonScript, ...scriptArgs];

      const proc = spawn(pythonPath, args, {
        cwd: this.aceStepDir,
        env: { ...process.env, CUDA_VISIBLE_DEVICES: '0', ACESTEP_PATH: this.aceStepDir },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        for (const line of data.toString().split('\n')) {
          if (line.trim()) console.log(`[ACE-Step] ${line}`);
        }
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: stderr || `Process exited with code ${code}` });
          return;
        }
        const lines = stdout.split('\n').filter(l => l.trim());
        const jsonLine = lines.find(l => l.startsWith('{'));
        if (!jsonLine) {
          resolve({ success: false, error: 'No JSON output from generation script' });
          return;
        }
        try {
          resolve(JSON.parse(jsonLine));
        } catch {
          resolve({ success: false, error: 'Invalid JSON from generation script' });
        }
      });

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }
}

interface PythonResult {
  success: boolean;
  audio_paths?: string[];
  elapsed_seconds?: number;
  error?: string;
}
