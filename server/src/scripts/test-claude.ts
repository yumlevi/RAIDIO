import { generateWithLLM, initLLMProvider, isLLMConfigured } from '../services/llm/index.js';
import { config } from '../config/index.js';

async function testLLM() {
  console.log('=== LLM API Test ===\n');

  // Initialize Claude provider for this test
  initLLMProvider('claude', {
    temperature: 1.0,
    maxTokens: 4096,
    model: config.claude.model,
  });

  // Check if configured
  console.log('LLM configured:', isLLMConfigured());
  console.log('API Key (first 10 chars):', config.claude.apiKey?.slice(0, 10) + '...');
  console.log('Model:', config.claude.model);
  console.log('');

  if (!isLLMConfigured()) {
    console.error('ERROR: No CLAUDE_API_KEY found in .env');
    process.exit(1);
  }

  // Test request
  const testPrompt = 'A chill lo-fi hip hop beat for studying, with soft piano and vinyl crackle. Instrumental only.';

  console.log('Test prompt:', testPrompt);
  console.log('\nSending request to LLM...\n');

  try {
    const startTime = Date.now();
    const result = await generateWithLLM({ userPrompt: testPrompt });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`Response received in ${elapsed}s:\n`);
    console.log(JSON.stringify(result, null, 2));

    // Validate response
    console.log('\n=== Validation ===');
    console.log('song_title:', result.song_title ? '✓' : '✗ MISSING');
    console.log('prompt:', result.prompt ? '✓' : '✗ MISSING');
    console.log('lyrics:', result.lyrics !== undefined ? '✓' : '✗ MISSING');
    console.log('audio_duration:', result.audio_duration ? '✓' : '✗ MISSING');
    console.log('bpm:', result.bpm ? '✓' : '✗ MISSING');
    console.log('key_scale:', result.key_scale ? '✓' : '✗ MISSING');
    console.log('time_signature:', result.time_signature ? '✓' : '✗ MISSING');

  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

testLLM();
