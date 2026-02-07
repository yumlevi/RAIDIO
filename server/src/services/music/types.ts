/**
 * Music Provider Abstraction — common types for all music generation providers.
 */

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface MusicProvider {
  /** Short identifier, e.g. 'acestep' */
  readonly name: string;
  /** Human-readable name, e.g. 'ACE-Step 1.5' */
  readonly displayName: string;

  /** Check whether this provider's backend is reachable */
  isAvailable(): Promise<boolean>;

  /** Submit a generation job and return an opaque task ID */
  submitJob(request: MusicGenerationRequest): Promise<{ taskId: string }>;

  /** Poll for the result of a previously submitted job */
  pollJobResult(taskId: string): Promise<MusicJobResult>;

  /** Download a remote audio file to a local path */
  downloadAudio(remotePath: string, destPath: string): Promise<void>;

  /** Get a streamable Response for an audio path */
  getAudioStream(audioPath: string): Promise<Response>;

  /** Return default provider-specific settings */
  getDefaultSettings(): Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Generation request (provider-agnostic)
// ---------------------------------------------------------------------------

export interface MusicGenerationRequest {
  // --- Universal content ---
  prompt: string;
  lyrics: string;
  instrumental: boolean;
  vocalLanguage?: string;

  // --- Universal music parameters ---
  duration?: number;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;

  // --- Universal output ---
  audioFormat?: 'mp3' | 'flac';
  batchSize?: number;
  randomSeed?: boolean;
  seed?: number;

  // --- Provider-specific opaque bag ---
  providerSettings?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Generation result
// ---------------------------------------------------------------------------

export interface MusicGenerationResult {
  audioUrls: string[];
  duration: number;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Job polling result
// ---------------------------------------------------------------------------

export interface MusicJobResult {
  /** 0 = processing, 1 = done, 2 = failed */
  status: number;
  audioPaths: string[];
  metas?: {
    bpm?: number;
    duration?: number;
    genres?: string;
    keyscale?: string;
    timesignature?: string;
  };
}

// ---------------------------------------------------------------------------
// ACE-Step provider-specific settings (typed shape for providerSettings)
// ---------------------------------------------------------------------------

export interface AceStepProviderSettings {
  // Inference
  inferenceSteps?: number;
  guidanceScale?: number;
  shift?: number;
  inferMethod?: 'ode' | 'sde';
  thinking?: boolean;

  // Internal LM
  lmTemperature?: number;
  lmCfgScale?: number;
  lmTopK?: number;
  lmTopP?: number;
  lmNegativePrompt?: string;
  useCotCaption?: boolean;
  constrainedDecoding?: boolean;

  // Expert / advanced
  referenceAudioUrl?: string;
  sourceAudioUrl?: string;
  audioCodes?: string;
  repaintingStart?: number;
  repaintingEnd?: number;
  instruction?: string;
  audioCoverStrength?: number;
  taskType?: string;
  useAdg?: boolean;
  cfgIntervalStart?: number;
  cfgIntervalEnd?: number;
  customTimesteps?: string;
  useCotMetas?: boolean;
  useCotLanguage?: boolean;
  constrainedDecodingDebug?: boolean;
  allowLmBatch?: boolean;
  getScores?: boolean;
  getLrc?: boolean;
  scoreScale?: number;
  lmBatchChunkSize?: number;
  trackName?: string;
  completeTrackClasses?: string[];
  isFormatCaption?: boolean;
}
