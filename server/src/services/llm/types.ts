// Shared types for all LLM providers

export interface LLMSongData {
  song_title?: string;
  prompt?: string;        // Maps to caption/style
  lyrics?: string;
  audio_duration?: number;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
}

export interface LLMGenerateRequest {
  userPrompt: string;
  previousData?: LLMSongData;
  isInstructMode?: boolean;
  // Audio analysis
  audioBuffer?: Buffer;
  audioMimeType?: string;
  // Provider settings overrides
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMProvider {
  readonly name: string;
  generate(request: LLMGenerateRequest): Promise<LLMSongData>;
  isConfigured(): boolean;
}

// Settings types for each provider
export interface ClaudeProviderSettings {
  temperature: number;
  maxTokens: number;
  model: string;
}

export interface VLLMProviderSettings {
  endpointUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  supportsAudio: boolean;
}
