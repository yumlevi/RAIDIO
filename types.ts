export interface Song {
  id: string;
  title: string;
  lyrics: string;
  style: string;
  coverUrl: string;
  duration: string;
  createdAt: Date;
  isGenerating?: boolean;
  queuePosition?: number;
  tags: string[];
  audioUrl?: string;
  isPublic?: boolean;
  userId?: string;
  creator?: string;
}

export interface GenerationParams {
  // Mode
  customMode: boolean;

  // Simple Mode
  songDescription?: string;

  // Custom Mode
  prompt: string;
  lyrics: string;
  style: string;
  title: string;

  // Common
  instrumental: boolean;
  vocalLanguage: string;

  // Music Parameters
  bpm: number;
  keyScale: string;
  timeSignature: string;
  duration: number;

  // Generation Settings
  inferenceSteps: number;
  guidanceScale: number;
  batchSize: number;
  randomSeed: boolean;
  seed: number;
  thinking: boolean;
  audioFormat: 'mp3' | 'flac';
  inferMethod: 'ode' | 'sde';
  shift: number;

  // LM Parameters
  lmTemperature: number;
  lmCfgScale: number;
  lmTopK: number;
  lmTopP: number;
  lmNegativePrompt: string;

  // Expert Parameters
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
  useCotCaption?: boolean;
  useCotLanguage?: boolean;
  autogen?: boolean;
  constrainedDecodingDebug?: boolean;
  allowLmBatch?: boolean;
  getScores?: boolean;
  getLrc?: boolean;
  scoreScale?: number;
  lmBatchChunkSize?: number;
  trackName?: string;
  completeTrackClasses?: string[];
  isFormatCaption?: boolean;
  instructMode?: boolean;
  instructParams?: InstructParams;
  llmData?: LLMSongData;
}

export type AutoDjStyle = 'explore' | 'similar' | 'consistent';

export type View = 'radio' | 'admin';

// Radio types
export interface RadioSettings {
  // Universal generation settings (provider-agnostic)
  batchSize: number;
  audioFormat: 'mp3' | 'flac';
  randomSeed: boolean;
  seed: number;
  duration: number; // -1 for auto

  // Music provider abstraction
  musicProvider?: string;                          // 'acestep' (default)
  musicProviderUrl?: string;                       // API URL for the music provider
  musicProviderSettings?: Record<string, unknown>; // Provider-specific blob

  // Legacy flat fields (kept for backward compat, migrated to musicProviderSettings on load)
  inferenceSteps: number;
  guidanceScale: number;
  inferMethod: 'ode' | 'sde';
  shift: number;
  thinking: boolean;
  lmTemperature: number;
  lmCfgScale: number;
  lmTopK: number;
  lmTopP: number;
  lmNegativePrompt: string;
  useCotCaption?: boolean;
  constrainedDecoding?: boolean;

  // LLM integration
  useLLM?: boolean;
  llmProvider?: 'claude' | 'vllm';
  llmClaudeSettings?: {
    apiKey?: string;
    temperature: number;
    maxTokens: number;
    model: string;
  };
  llmVllmSettings?: {
    endpointUrl: string;
    model: string;
    temperature: number;
    maxTokens: number;
    supportsAudio: boolean;
  };
  // Audio post-processing
  audioPostProcess?: boolean;
  audioHighPass?: number;
  audioLowPass1?: number;
  audioLowPass2?: number;
  // Auto-DJ controls
  autoDjFreshLLM?: boolean;
  autoDjStyle?: AutoDjStyle;
  autoDjStyleLocked?: boolean;
  autoDjPrompt?: string;
  autoDjBpmVariation?: boolean;
  autoDjBpmMin?: number;
  autoDjBpmMax?: number;
  autoDjDurationMin?: number;
  autoDjDurationMax?: number;
  autoDjKeyRandomize?: boolean;
  autoDjForceInstrumental?: boolean;
  autoDjLanguage?: string;
  autoDjMinQueueSize?: number;
  autoDjPreGenSeconds?: number;
  autoDjFadeIn?: number;
  autoDjFadeOut?: number;
  // Interaction mode
  interactionMode?: 'vibe' | 'create';
}

// Instruct mode parameters for LLM enhancement
export interface InstructParams {
  effects: string[];
  customInstruction?: string;
}

// LLM-generated song data (for instruct mode iterations)
export interface LLMSongData {
  song_title?: string;
  prompt?: string;
  lyrics?: string;
  audio_duration?: number;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
}

export interface RadioGenParams {
  customMode: boolean;
  songDescription?: string;
  lyrics?: string;
  style?: string;
  title?: string;
  instrumental?: boolean;
  vocalLanguage?: string;
  instructMode?: boolean;
  instructParams?: InstructParams;
  llmData?: LLMSongData;
}

export interface RadioSong {
  id: string;
  title: string;
  lyrics: string;
  style: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  creator?: string;
  createdAt: Date;
  genParams?: RadioGenParams;
  isAutoDJ?: boolean;
}

export interface RadioListener {
  id: string;
  name: string;
}

export interface RadioChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
}

export interface RadioState {
  currentSong: RadioSong | null;
  playbackStartTime: number;
  queue: RadioSong[];
  history: RadioSong[];
  listeners: RadioListener[];
  listenerCount: number;
  skipVotes: number;
  skipRequired: number;
  djStyleVotes: { explore: number; similar: number; consistent: number };
  djStyleVoteRequired: number;
  ownerId: string | null;
  settings: RadioSettings;
}
