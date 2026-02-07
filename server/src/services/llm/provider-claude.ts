import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { LLMProvider, LLMGenerateRequest, LLMSongData } from './types.js';
import { buildPrompt } from './prompts.js';

function parseJsonResponse(responseText: string): LLMSongData {
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  return JSON.parse(jsonStr) as LLMSongData;
}

export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude';
  private client: Anthropic | null = null;
  private resolvedApiKey: string;

  constructor(runtimeApiKey?: string) {
    // Runtime key (from admin settings) takes priority over .env
    this.resolvedApiKey = runtimeApiKey || config.claude.apiKey;
  }

  private getClient(): Anthropic | null {
    if (!this.resolvedApiKey) return null;
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.resolvedApiKey });
    }
    return this.client;
  }

  isConfigured(): boolean {
    return !!this.resolvedApiKey;
  }

  async generate(request: LLMGenerateRequest): Promise<LLMSongData> {
    const client = this.getClient();

    if (!client) {
      console.log('[Claude] No API key configured, skipping generation');
      return {};
    }

    if (!request.userPrompt || !request.userPrompt.trim()) {
      console.log('[Claude] No user prompt provided, skipping generation');
      return {};
    }

    try {
      const promptMode = request.isInstructMode ? 'INSTRUCT' : 'STANDARD';
      console.log(`[Claude] Using ${promptMode} prompt`);

      if (request.isInstructMode && request.previousData) {
        console.log('[Claude] Previous data:', JSON.stringify(request.previousData).slice(0, 200));
      }

      const systemPrompt = await buildPrompt(
        request.userPrompt,
        request.isInstructMode,
        request.previousData as Record<string, unknown> | undefined,
      );

      const model = request.model || config.claude.model;
      const maxTokens = request.maxTokens || 4096;
      const temperature = request.temperature ?? 1.0;

      console.log('[Claude] Sending generation request:', {
        userPrompt: request.userPrompt.slice(0, 100),
        model,
        maxTokens,
        temperature,
      });

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        console.error('[Claude] No text content in response');
        return {};
      }

      const responseText = textContent.text.trim();

      try {
        const result = parseJsonResponse(responseText);

        console.log('[Claude] Generation result:', {
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
      } catch (parseError) {
        console.error('[Claude] Failed to parse response as JSON:', responseText.slice(0, 500));
        return {};
      }
    } catch (error) {
      console.error('[Claude] Generation error:', error);
      return {};
    }
  }
}
