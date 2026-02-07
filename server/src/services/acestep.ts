/**
 * Backward-compatibility shim — re-exports everything from the new
 * music provider module so existing imports continue to work.
 *
 * New code should import from './music/index.js' directly.
 */

// Re-export public API under old names
export {
  generateMusicViaAPI,
  getJobStatus,
  getAudioStream,
  downloadAudioToBuffer,
  getJobRawResponse,
  cleanupJob,
  checkSpaceHealth,
  discoverEndpoints,
  resetClient,
  resolvePythonPath,
} from './music/index.js';

// Re-export new names too, so gradual migration is possible
export {
  generateMusic,
  getMusicJobStatus,
  getMusicAudioStream,
  downloadMusicAudioToBuffer,
  getMusicJobRawResponse,
  cleanupMusicJob,
  checkMusicHealth,
  discoverMusicEndpoints,
  resetMusicApiCache,
  downloadMusicAudio,
  cleanupOldMusicJobs,
  getMusicProvider,
  initMusicProvider,
} from './music/index.js';

export type {
  MusicProvider,
  MusicGenerationRequest,
  MusicGenerationResult,
  MusicJobResult,
  AceStepProviderSettings,
} from './music/types.js';
