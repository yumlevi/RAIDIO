import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let systemPromptTemplate: string | null = null;
let instructPromptTemplate: string | null = null;
let audioAnalysisPromptTemplate: string | null = null;

export async function getSystemPromptTemplate(): Promise<string> {
  if (systemPromptTemplate) {
    return systemPromptTemplate;
  }
  const promptPath = path.join(__dirname, '../../../prompts/generation.md');
  systemPromptTemplate = await readFile(promptPath, 'utf-8');
  return systemPromptTemplate;
}

export async function getInstructPromptTemplate(): Promise<string> {
  if (instructPromptTemplate) {
    return instructPromptTemplate;
  }
  const promptPath = path.join(__dirname, '../../../prompts/generation_instruct.md');
  instructPromptTemplate = await readFile(promptPath, 'utf-8');
  return instructPromptTemplate;
}

export async function getAudioAnalysisPromptTemplate(): Promise<string> {
  if (audioAnalysisPromptTemplate) {
    return audioAnalysisPromptTemplate;
  }
  const promptPath = path.join(__dirname, '../../../prompts/audio_analysis.md');
  audioAnalysisPromptTemplate = await readFile(promptPath, 'utf-8');
  return audioAnalysisPromptTemplate;
}

/**
 * Build the full system prompt from template and user input.
 */
export async function buildPrompt(
  userPrompt: string,
  isInstructMode?: boolean,
  previousData?: Record<string, unknown>,
): Promise<string> {
  if (isInstructMode && previousData) {
    const template = await getInstructPromptTemplate();
    const previousDataJson = JSON.stringify(previousData, null, 2);
    return template
      .replace('{prompt}', userPrompt)
      .replace('{previous_data}', previousDataJson);
  }

  const template = await getSystemPromptTemplate();
  return template.replace('{prompt}', userPrompt);
}
