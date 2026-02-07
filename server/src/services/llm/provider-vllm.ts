import { LLMProvider, LLMGenerateRequest, LLMSongData } from './types.js';
import { buildPrompt, getAudioAnalysisPromptTemplate } from './prompts.js';

interface VLLMConfig {
  endpointUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  supportsAudio: boolean;
}

let vllmConfig: VLLMConfig | null = null;

export function configureVLLM(cfg: VLLMConfig): void {
  vllmConfig = cfg;
}

/**
 * Build the chat completions URL from the configured endpoint.
 * If the URL already ends with /chat/completions, use it as-is.
 * Otherwise append the appropriate path segments.
 */
function buildChatCompletionsUrl(endpointUrl: string): string {
  const url = endpointUrl.replace(/\/+$/, '');
  if (url.endsWith('/chat/completions')) {
    return url;
  }
  if (url.endsWith('/v1')) {
    return `${url}/chat/completions`;
  }
  return `${url}/v1/chat/completions`;
}

/**
 * Strip <think>...</think> tags from thinking-model responses (e.g. Qwen3).
 * Handles both complete and unclosed think blocks.
 */
function stripThinkTags(text: string): string {
  // Try to strip complete <think>...</think> blocks (greedy to get all thinking)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
  if (cleaned.trim()) {
    return cleaned.trim();
  }

  // Handle unclosed <think> tag (model put everything in thinking, or response was cut off)
  const openIdx = text.indexOf('<think>');
  if (openIdx !== -1) {
    // Look for content after the think block — might not have closing tag
    const closeIdx = text.lastIndexOf('</think>');
    if (closeIdx !== -1) {
      cleaned = text.slice(closeIdx + '</think>'.length).trim();
      if (cleaned) return cleaned;
      // If nothing after closing tag, extract content from inside the think block
      return text.slice(openIdx + '<think>'.length, closeIdx).trim();
    }
    // No closing tag at all — strip the opening tag and use the content
    return text.slice(openIdx + '<think>'.length).trim();
  }

  return text;
}

function parseJsonResponse(responseText: string): LLMSongData {
  // First strip thinking tags if present
  let cleaned = stripThinkTags(responseText);

  // Try to extract JSON from markdown code blocks
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  }

  // Fall back to finding any JSON object
  if (!cleaned.startsWith('{')) {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      cleaned = objMatch[0];
    }
  }

  try {
    return JSON.parse(cleaned) as LLMSongData;
  } catch (parseError) {
    console.error('[vLLM] JSON parse failed. Cleaned text preview:', cleaned.slice(0, 300));
    console.error('[vLLM] Raw response preview:', responseText.slice(0, 300));
    throw new Error(`Failed to parse LLM response as JSON: ${(parseError as Error).message}`);
  }
}

export class VLLMProvider implements LLMProvider {
  readonly name = 'vllm';

  isConfigured(): boolean {
    return !!(vllmConfig?.endpointUrl && vllmConfig?.model);
  }

  async generate(request: LLMGenerateRequest): Promise<LLMSongData> {
    if (!vllmConfig || !this.isConfigured()) {
      console.log('[vLLM] Not configured, skipping generation');
      return {};
    }

    // Audio analysis mode
    if (request.audioBuffer && request.audioMimeType) {
      return this.analyzeAudio(request);
    }

    if (!request.userPrompt || !request.userPrompt.trim()) {
      console.log('[vLLM] No user prompt provided, skipping generation');
      return {};
    }

    const promptMode = request.isInstructMode ? 'INSTRUCT' : 'STANDARD';
    console.log(`[vLLM] Using ${promptMode} prompt`);

    const systemPrompt = await buildPrompt(
      request.userPrompt,
      request.isInstructMode,
      request.previousData as Record<string, unknown> | undefined,
    );

    const model = request.model || vllmConfig.model;
    const maxTokens = request.maxTokens || vllmConfig.maxTokens || 4096;
    const temperature = request.temperature ?? vllmConfig.temperature ?? 0.7;

    const url = buildChatCompletionsUrl(vllmConfig.endpointUrl);

    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[vLLM] Sending generation request (attempt ${attempt}/${MAX_RETRIES}):`, {
        url,
        model,
        maxTokens,
        temperature,
        userPrompt: request.userPrompt.slice(0, 100),
      });

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            messages: [
              {
                role: 'user',
                content: systemPrompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`vLLM API error ${response.status}: ${errorText.slice(0, 500)}`);
        }

        const data = await response.json() as {
          choices?: Array<{
            message?: { content?: string };
          }>;
        };

        const responseText = data.choices?.[0]?.message?.content?.trim();
        if (!responseText) {
          throw new Error('vLLM returned no text content in response');
        }

        const result = parseJsonResponse(responseText);

        console.log('[vLLM] Generation result:', {
          song_title: result.song_title,
          prompt: result.prompt?.slice(0, 80),
          hasLyrics: !!result.lyrics,
          lyricsLength: result.lyrics?.length || 0,
          audio_duration: result.audio_duration,
          bpm: result.bpm,
          key_scale: result.key_scale,
          time_signature: result.time_signature,
        });

        return result;
      } catch (err) {
        lastError = err as Error;
        if (attempt < MAX_RETRIES) {
          console.warn(`[vLLM] Attempt ${attempt} failed: ${lastError.message}. Retrying...`);
        }
      }
    }

    throw lastError!;
  }

  private async analyzeAudio(request: LLMGenerateRequest): Promise<LLMSongData> {
    if (!vllmConfig || !request.audioBuffer || !request.audioMimeType) {
      return {};
    }

    if (!vllmConfig.supportsAudio) {
      console.log('[vLLM] Audio analysis not supported (supportsAudio is false)');
      return {};
    }

    const audioAnalysisPrompt = await getAudioAnalysisPromptTemplate();
    const base64Audio = request.audioBuffer.toString('base64');

    // Determine MIME type for data URI
    const mimeType = request.audioMimeType;

    console.log('[vLLM] Sending audio analysis request:', {
      endpoint: vllmConfig.endpointUrl,
      model: vllmConfig.model,
      audioMimeType: mimeType,
      audioSize: request.audioBuffer.length,
    });

    const url = buildChatCompletionsUrl(vllmConfig.endpointUrl);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: vllmConfig.model,
        max_tokens: vllmConfig.maxTokens || 4096,
        temperature: vllmConfig.temperature ?? 0.7,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'audio_url',
                audio_url: {
                  url: `data:${mimeType};base64,${base64Audio}`,
                },
              },
              {
                type: 'text',
                text: audioAnalysisPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`vLLM audio analysis API error ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };

    const responseText = data.choices?.[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('vLLM returned no text content in audio analysis response');
    }

    const result = parseJsonResponse(responseText);

    console.log('[vLLM] Audio analysis result:', {
      song_title: result.song_title,
      prompt: result.prompt?.slice(0, 80),
      hasLyrics: !!result.lyrics,
      audio_duration: result.audio_duration,
      bpm: result.bpm,
      key_scale: result.key_scale,
      time_signature: result.time_signature,
    });

    return result;
  }
}
