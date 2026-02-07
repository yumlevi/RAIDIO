// Use relative URLs so Vite proxy handles them (enables LAN access)
const API_BASE = '';

// Resolve audio URL based on storage type
export function getAudioUrl(audioUrl: string | undefined | null, songId?: string): string | undefined {
  if (!audioUrl) return undefined;

  // Local storage: already relative, works with proxy
  if (audioUrl.startsWith('/audio/')) {
    return audioUrl;
  }

  // Already a full URL
  return audioUrl;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  username?: string | null;
}

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, username } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (username) {
    headers['X-Username'] = username;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    const errorMessage = error.error || error.message || 'Request failed';
    throw new Error(`${response.status}: ${errorMessage}`);
  }

  return response.json();
}

// Songs API (minimal - just what radio needs)
export interface Song {
  id: string;
  title: string;
  lyrics: string;
  style: string;
  caption?: string;
  cover_url?: string;
  audio_url?: string;
  audioUrl?: string;
  duration?: number;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  tags: string[];
  is_public: boolean;
  user_id?: string;
  created_at: string;
  creator?: string;
}

export const songsApi = {
  deleteSong: (id: string, username: string): Promise<{ success: boolean }> =>
    api(`/api/songs/${id}`, { method: 'DELETE', username }),
};

// Generation API
export interface GenerationParams {
  customMode: boolean;
  songDescription?: string;
  prompt?: string;
  lyrics: string;
  style: string;
  title: string;
  instrumental: boolean;
  vocalLanguage?: string;
  instructMode?: boolean;
  instructParams?: InstructParams;
  llmData?: LLMSongData;
  duration?: number;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  inferenceSteps?: number;
  guidanceScale?: number;
  batchSize?: number;
  randomSeed?: boolean;
  seed?: number;
  thinking?: boolean;
  audioFormat?: 'mp3' | 'flac';
  inferMethod?: 'ode' | 'sde';
  shift?: number;
  lmTemperature?: number;
  lmCfgScale?: number;
  lmTopK?: number;
  lmTopP?: number;
  lmNegativePrompt?: string;
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
}

export interface GenerationJob {
  jobId: string;
  status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed';
  queuePosition?: number;
  etaSeconds?: number;
  result?: {
    audioUrls: string[];
    bpm?: number;
    duration?: number;
    keyScale?: string;
    timeSignature?: string;
  };
  error?: string;
  llmData?: LLMSongData;
}

export const generateApi = {
  startGeneration: (params: GenerationParams, username: string): Promise<GenerationJob> =>
    api('/api/generate', { method: 'POST', body: { ...params, username } }),

  getStatus: (jobId: string, username: string): Promise<GenerationJob> =>
    api(`/api/generate/status/${jobId}`, { username }),

  uploadAudio: async (file: File, username: string): Promise<{ url: string; key: string }> => {
    const formData = new FormData();
    formData.append('audio', file);
    const response = await fetch(`${API_BASE}/api/generate/upload-audio`, {
      method: 'POST',
      headers: { 'X-Username': username },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.details || error.error || 'Upload failed');
    }
    return response.json();
  },

  analyzeAudio: async (file: File, username: string): Promise<{ llmData: LLMSongData }> => {
    const formData = new FormData();
    formData.append('audio', file);
    const response = await fetch(`${API_BASE}/api/generate/analyze-audio`, {
      method: 'POST',
      headers: { 'X-Username': username },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Analysis failed' }));
      throw new Error(error.details || error.error || 'Audio analysis failed');
    }
    return response.json();
  },

  formatInput: (params: {
    caption: string;
    lyrics?: string;
    bpm?: number;
    duration?: number;
    keyScale?: string;
    timeSignature?: string;
    temperature?: number;
    topK?: number;
    topP?: number;
  }, username: string): Promise<{
    success: boolean;
    caption?: string;
    lyrics?: string;
    bpm?: number;
    duration?: number;
    key_scale?: string;
    language?: string;
    time_signature?: string;
    status_message?: string;
    error?: string;
  }> => api('/api/generate/format', { method: 'POST', body: params, username }),
};

// Radio API
export interface RadioSettings {
  inferenceSteps: number;
  guidanceScale: number;
  batchSize: number;
  audioFormat: 'mp3' | 'flac';
  inferMethod: 'ode' | 'sde';
  shift: number;
  thinking: boolean;
  lmTemperature: number;
  lmCfgScale: number;
  lmTopK: number;
  lmTopP: number;
  lmNegativePrompt: string;
  musicProviderUrl?: string;
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
  audioPostProcess?: boolean;
  audioHighPass?: number;
  audioLowPass1?: number;
  audioLowPass2?: number;
}

export interface InstructParams {
  effects: string[];
  customInstruction?: string;
}

export interface LLMSongData {
  song_title?: string;
  prompt?: string;
  lyrics?: string;
  audio_duration?: number;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
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
  createdAt: Date | string;
}

export const radioApi = {
  getState: (): Promise<{
    currentSong: RadioSong | null;
    playbackStartTime: number;
    queue: RadioSong[];
    listeners: Array<{ id: string; name: string }>;
    listenerCount: number;
    skipVotes: number;
    skipRequired: number;
    ownerId: string | null;
    settings: RadioSettings;
  }> => api('/api/radio/state'),

  getSettings: (): Promise<{ settings: RadioSettings }> =>
    api('/api/radio/settings'),

  updateSettings: (listenerId: string, settings: Partial<RadioSettings>): Promise<{ success: boolean; settings: RadioSettings }> =>
    api('/api/radio/settings', { method: 'POST', body: { listenerId, settings } }),

  claimOwner: (listenerId: string, secret: string): Promise<{ success: boolean; isOwner: boolean }> =>
    api('/api/radio/claim-owner', { method: 'POST', body: { listenerId, secret } }),

  testMusicProvider: (listenerId: string, url: string): Promise<{ success: boolean; message: string }> =>
    api('/api/radio/test-music-provider', { method: 'POST', body: { listenerId, url } }),

  testLLM: (listenerId: string, provider: string, settings?: Record<string, unknown>): Promise<{ success: boolean; message: string }> =>
    api('/api/radio/test-llm', { method: 'POST', body: { listenerId, provider, settings } }),

  addToQueue: (song: RadioSong, genParams?: {
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
  }): Promise<{ success: boolean; queuePosition: number }> =>
    api('/api/radio/queue', { method: 'POST', body: { song, genParams } }),
};
