import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // SQLite database
  database: {
    path: process.env.DATABASE_PATH || path.join(__dirname, '../../data/acestep.db'),
  },

  // ACE-Step API (local)
  acestep: {
    apiUrl: process.env.ACESTEP_API_URL || 'http://localhost:39871',
  },

  // Claude API for prompt enhancement
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
  },

  // vLLM / OpenAI-compatible endpoint (alternative to Claude)
  vllm: {
    endpointUrl: process.env.VLLM_ENDPOINT_URL || '',
    model: process.env.VLLM_MODEL || '',
  },

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Storage (local only)
  storage: {
    provider: 'local' as const,
    audioDir: process.env.AUDIO_DIR || path.join(__dirname, '../../public/audio'),
  },

  // Music provider
  music: {
    defaultProvider: process.env.MUSIC_PROVIDER || 'acestep',
  },

  // Radio configuration
  radio: {
    ownerSecret: process.env.RADIO_OWNER_SECRET || 'default-radio-secret',
    skipVotePercent: 0.5, // 50% of listeners needed to skip
    defaultSettings: {
      // Universal
      batchSize: 1,
      audioFormat: 'mp3' as const,
      randomSeed: true,
      seed: -1,
      duration: -1,

      // Music provider
      musicProvider: process.env.MUSIC_PROVIDER || 'acestep',
      musicProviderUrl: process.env.ACESTEP_API_URL || 'http://localhost:39871',
      musicProviderSettings: {
        inferenceSteps: 8,
        guidanceScale: 7.0,
        shift: 3.0,
        inferMethod: 'ode',
        thinking: true,
        lmTemperature: 0.85,
        lmCfgScale: 2.0,
        lmTopK: 0,
        lmTopP: 0.9,
        lmNegativePrompt: 'NO USER INPUT',
        useCotCaption: true,
        constrainedDecoding: true,
      },

      // Legacy flat fields (for backward compat)
      inferenceSteps: 8,
      guidanceScale: 7.0,
      inferMethod: 'ode' as const,
      shift: 3.0,
      thinking: true,
      lmTemperature: 0.85,
      lmCfgScale: 2.0,
      lmTopK: 0,
      lmTopP: 0.9,
      lmNegativePrompt: 'NO USER INPUT',
      useLLM: false,
      llmProvider: 'claude' as const,
      llmClaudeSettings: {
        temperature: 1.0,
        maxTokens: 4096,
        model: 'claude-sonnet-4-20250514',
      },
      llmVllmSettings: {
        endpointUrl: process.env.VLLM_ENDPOINT_URL || '',
        model: process.env.VLLM_MODEL || '',
        temperature: 0.7,
        maxTokens: 4096,
        supportsAudio: false,
      },
      audioPostProcess: true,
      audioHighPass: 30,
      audioLowPass1: 10000,
      audioLowPass2: 14000,
      autoDjFreshLLM: true,
      autoDjStyle: 'similar' as const,
      autoDjPrompt: '',
      autoDjBpmVariation: false,
      autoDjBpmMin: 80,
      autoDjBpmMax: 160,
      autoDjDurationMin: 60,
      autoDjDurationMax: 180,
      autoDjKeyRandomize: false,
      autoDjForceInstrumental: false,
      autoDjLanguage: '',
      autoDjMinQueueSize: 1,
      autoDjPreGenSeconds: 15,
      autoDjFadeIn: 2,
      autoDjFadeOut: 3,
    },
  },
};
