import { LLMProvider, LLMGenerateRequest, LLMSongData } from './types.js';
import { ClaudeProvider } from './provider-claude.js';
import { VLLMProvider, configureVLLM } from './provider-vllm.js';

export type { LLMSongData, LLMGenerateRequest, LLMProvider } from './types.js';

let activeProvider: LLMProvider | null = null;

/**
 * Initialize (or re-initialize) the active LLM provider based on settings.
 */
export function initLLMProvider(providerName: 'claude' | 'vllm', settings?: {
  // Claude-specific
  apiKey?: string;
  // vLLM-specific
  endpointUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  supportsAudio?: boolean;
}): void {
  if (providerName === 'claude') {
    activeProvider = new ClaudeProvider(settings?.apiKey);
    console.log('[LLM] Initialized Claude provider');
  } else if (providerName === 'vllm') {
    configureVLLM({
      endpointUrl: settings?.endpointUrl || process.env.VLLM_ENDPOINT_URL || '',
      model: settings?.model || process.env.VLLM_MODEL || '',
      temperature: settings?.temperature ?? 0.7,
      maxTokens: settings?.maxTokens ?? 4096,
      supportsAudio: settings?.supportsAudio ?? false,
    });
    activeProvider = new VLLMProvider();
    console.log('[LLM] Initialized vLLM provider:', {
      endpointUrl: settings?.endpointUrl || process.env.VLLM_ENDPOINT_URL,
      model: settings?.model || process.env.VLLM_MODEL,
      supportsAudio: settings?.supportsAudio ?? false,
    });
  } else {
    console.warn('[LLM] Unknown provider:', providerName);
    activeProvider = null;
  }
}

/**
 * Check if any LLM provider is currently configured and ready.
 */
export function isLLMConfigured(): boolean {
  return activeProvider?.isConfigured() ?? false;
}

/**
 * Get the name of the active provider.
 */
export function getActiveProviderName(): string | null {
  return activeProvider?.name ?? null;
}

/**
 * Generate song data using the active LLM provider.
 * Returns empty object if no provider is configured.
 */
export async function generateWithLLM(request: LLMGenerateRequest): Promise<LLMSongData> {
  if (!activeProvider) {
    console.log('[LLM] No active provider, skipping generation');
    return {};
  }

  if (!activeProvider.isConfigured()) {
    console.log(`[LLM] Provider ${activeProvider.name} is not configured, skipping generation`);
    return {};
  }

  return activeProvider.generate(request);
}
