import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { radioManager, RadioSong, RadioSettings, InstructParams } from '../services/radioState.js';
import { radioStreamer } from '../services/radioStream.js';
import { config } from '../config/index.js';

const router = express.Router();

/** Extract a useful message from fetch errors (Node buries the real cause). */
function getFetchErrorMessage(error: unknown, abortMessage: string): string {
  if (!(error instanceof Error)) return 'Unknown error';
  if (error.name === 'AbortError') return abortMessage;
  // Node's fetch wraps the real error (ECONNREFUSED etc.) in error.cause
  const cause = (error as Error & { cause?: Error }).cause;
  if (cause?.message) {
    // Clean up Node's verbose messages like "connect ECONNREFUSED 192.168.1.191:8009"
    return cause.message;
  }
  return error.message;
}

// Map to track which listener ID belongs to which WebSocket
const wsToListenerId = new Map<WebSocket, string>();

// GET /api/radio/stream.m3u - M3U playlist file
router.get('/stream.m3u', (req, res) => {
  const protocol = req.secure ? 'https' : 'http';
  const baseUrl = `${protocol}://${req.get('host')}`;

  res.setHeader('Content-Type', 'audio/x-mpegurl');
  res.setHeader('Content-Disposition', 'inline; filename="aceradio.m3u"');
  res.send(radioStreamer.generatePlaylist(baseUrl));
});

// GET /api/radio/stream - Live MP3 audio stream
router.get('/stream', (req, res) => {
  const clientId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log('[Radio Route] Stream client connecting:', clientId);

  // Set headers for streaming
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.setHeader('icy-name', 'RAIDIO');
  res.setHeader('icy-description', 'AI-Generated Music Radio - RAIDIO');
  res.setHeader('icy-genre', 'AI Music');
  res.setHeader('icy-br', '128');

  // Get a stream for this client
  const clientStream = radioStreamer.addClient(clientId);

  // Pipe the stream to the response
  clientStream.pipe(res);

  // Handle client disconnect
  req.on('close', () => {
    console.log('[Radio Route] Stream client disconnected:', clientId);
    radioStreamer.removeClient(clientId);
  });

  req.on('error', (err) => {
    console.error('[Radio Route] Stream client error:', clientId, err);
    radioStreamer.removeClient(clientId);
  });
});

// GET /api/radio/state - Get current radio state (REST fallback)
router.get('/state', (_req, res) => {
  res.json(radioManager.getPublicState());
});

// GET /api/radio/settings - Get admin settings (for generation)
router.get('/settings', (_req, res) => {
  res.json({ settings: radioManager.getSanitizedSettings() });
});

// POST /api/radio/settings - Update admin settings (owner only)
router.post('/settings', (req, res) => {
  const { listenerId, settings } = req.body as { listenerId: string; settings: Partial<RadioSettings> };

  if (!listenerId || !radioManager.isOwner(listenerId)) {
    res.status(403).json({ error: 'Only the owner can update settings' });
    return;
  }

  radioManager.updateSettings(settings);
  res.json({ success: true, settings: radioManager.getSanitizedSettings() });
});

// POST /api/radio/claim-owner - Authenticate as owner
router.post('/claim-owner', (req, res) => {
  const { listenerId, secret } = req.body as { listenerId: string; secret: string };

  if (!listenerId || !secret) {
    res.status(400).json({ error: 'listenerId and secret are required' });
    return;
  }

  const success = radioManager.claimOwner(listenerId, secret);
  if (success) {
    res.json({ success: true, isOwner: true });
  } else {
    res.status(403).json({ error: 'Invalid secret or listener not found' });
  }
});

// POST /api/radio/test-music-provider - Test music provider connectivity (owner only)
router.post('/test-music-provider', async (req, res) => {
  const { listenerId, url } = req.body as { listenerId: string; url: string };

  if (!listenerId || !radioManager.isOwner(listenerId)) {
    res.status(403).json({ error: 'Only the owner can test connections' });
    return;
  }

  if (!url) {
    res.json({ success: false, message: 'No URL provided' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${url.replace(/\/+$/, '')}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      res.json({ success: false, message: `Server returned ${response.status}` });
      return;
    }

    const data = await response.json() as Record<string, unknown>;
    const isHealthy = data.status === 'ok' || data.healthy === true || (data.data as Record<string, unknown>)?.status === 'ok';

    if (isHealthy) {
      res.json({ success: true, message: 'Connected — service is healthy' });
    } else {
      res.json({ success: false, message: 'Server responded but health check failed' });
    }
  } catch (error: unknown) {
    const message = getFetchErrorMessage(error, 'Connection timed out (5s)');
    res.json({ success: false, message });
  }
});

// POST /api/radio/test-llm - Test LLM provider connectivity (owner only)
router.post('/test-llm', async (req, res) => {
  const { listenerId, provider, settings } = req.body as {
    listenerId: string;
    provider: string;
    settings?: Record<string, unknown>;
  };

  if (!listenerId || !radioManager.isOwner(listenerId)) {
    res.status(403).json({ error: 'Only the owner can test connections' });
    return;
  }

  try {
    if (provider === 'claude') {
      // Use runtime API key from settings, fall back to .env
      const currentSettings = radioManager.getSettings();
      const apiKey = (settings?.apiKey as string) || currentSettings.llmClaudeSettings?.apiKey || config.claude.apiKey;
      if (!apiKey) {
        res.json({ success: false, message: 'No Claude API key configured. Enter one in the settings above.' });
        return;
      }

      // Try a minimal API call to verify the key works
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        res.json({ success: true, message: 'Claude API key is valid' });
      } else {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
        const errorMsg = (errorData.error as Record<string, unknown>)?.message || `API returned ${response.status}`;
        res.json({ success: false, message: String(errorMsg) });
      }
    } else if (provider === 'vllm') {
      const endpointUrl = (settings?.endpointUrl as string) || '';
      if (!endpointUrl) {
        res.json({ success: false, message: 'No endpoint URL provided' });
        return;
      }

      // Extract base URL from the chat completions endpoint to call /v1/models
      const baseUrl = endpointUrl.replace(/\/v1\/chat\/completions\/?$/, '').replace(/\/+$/, '');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${baseUrl}/v1/models`, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json() as { data?: Array<{ id: string }> };
        const models = data.data?.map((m: { id: string }) => m.id) || [];
        const modelName = (settings?.model as string) || '';
        if (modelName && models.length > 0 && !models.includes(modelName)) {
          res.json({ success: true, message: `Connected (${models.length} model(s) available, but "${modelName}" not found — available: ${models.join(', ')})` });
        } else {
          res.json({ success: true, message: `Connected — ${models.length} model(s) available` });
        }
      } else {
        res.json({ success: false, message: `Server returned ${response.status}` });
      }
    } else {
      res.json({ success: false, message: `Unknown provider: ${provider}` });
    }
  } catch (error: unknown) {
    const message = getFetchErrorMessage(error, 'Connection timed out');
    res.json({ success: false, message });
  }
});

// POST /api/radio/queue - Add song to queue (called when generation completes)
router.post('/queue', (req, res) => {
  // Support both old format (just song) and new format (song + genParams)
  const body = req.body as Record<string, unknown>;
  const hasSongProp = 'song' in body && body.song && typeof body.song === 'object';

  const songData = hasSongProp ? (body.song as RadioSong) : (body as unknown as RadioSong);
  const generationParams = hasSongProp ? (body.genParams as {
    customMode: boolean;
    songDescription?: string;
    lyrics?: string;
    style?: string;
    title?: string;
    instrumental?: boolean;
    vocalLanguage?: string;
    instructMode?: boolean;
    instructParams?: InstructParams;
    llmData?: {
      song_title?: string;
      prompt?: string;
      lyrics?: string;
      audio_duration?: number;
      bpm?: number;
      key_scale?: string;
      time_signature?: string;
    };
  } | undefined) : undefined;

  if (!songData || !songData.id || !songData.audioUrl) {
    res.status(400).json({ error: 'Invalid song data' });
    return;
  }

  // Ensure all required fields
  const radioSong: RadioSong = {
    id: songData.id,
    title: songData.title || 'Untitled',
    lyrics: songData.lyrics || '',
    style: songData.style || '',
    coverUrl: songData.coverUrl || `https://picsum.photos/seed/${songData.id}/400/400`,
    audioUrl: songData.audioUrl,
    duration: songData.duration || 0,
    creator: songData.creator,
    createdAt: new Date(songData.createdAt || Date.now()),
  };

  radioManager.addToQueue(radioSong, generationParams, true); // true = user generated
  res.json({ success: true, queuePosition: radioManager.getPublicState().queue.length });
});

// WebSocket handler setup
export function setupRadioWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    let listenerId: string | null = null;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as {
          type: string;
          payload?: Record<string, unknown>;
        };

        switch (message.type) {
          case 'join': {
            const name = (message.payload?.name as string) || 'Anonymous';
            listenerId = radioManager.addListener(ws, name);
            wsToListenerId.set(ws, listenerId);

            // Send join confirmation with listener ID
            ws.send(JSON.stringify({
              type: 'joined',
              payload: { listenerId },
            }));
            break;
          }

          case 'skip-vote': {
            if (listenerId) {
              const skipped = radioManager.voteSkip(listenerId);
              ws.send(JSON.stringify({
                type: 'skip-vote-result',
                payload: { voted: true, skipped },
              }));
            }
            break;
          }

          case 'owner-skip': {
            if (listenerId) {
              const success = radioManager.ownerSkip(listenerId);
              ws.send(JSON.stringify({
                type: 'owner-skip-result',
                payload: { success },
              }));
            }
            break;
          }

          case 'claim-owner': {
            const secret = message.payload?.secret as string;
            if (listenerId && secret) {
              const success = radioManager.claimOwner(listenerId, secret);
              ws.send(JSON.stringify({
                type: 'claim-owner-result',
                payload: { success, isOwner: success },
              }));
            }
            break;
          }

          case 'update-settings': {
            const settings = message.payload?.settings as Partial<RadioSettings>;
            if (listenerId && settings && radioManager.isOwner(listenerId)) {
              radioManager.updateSettings(settings);
              ws.send(JSON.stringify({
                type: 'update-settings-result',
                payload: { success: true },
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'update-settings-result',
                payload: { success: false, error: 'Not authorized' },
              }));
            }
            break;
          }

          case 'get-state': {
            ws.send(JSON.stringify({
              type: 'state',
              payload: radioManager.getPublicState(),
            }));
            break;
          }

          case 'chat-message': {
            const chatMessage = message.payload?.message as string;
            if (listenerId && chatMessage && chatMessage.trim()) {
              radioManager.broadcastChatMessage(listenerId, chatMessage.trim());
            }
            break;
          }

          case 'requeue-song': {
            const songId = message.payload?.songId as string;
            if (listenerId && songId) {
              const success = radioManager.requeueFromHistory(songId, listenerId);
              ws.send(JSON.stringify({
                type: 'requeue-result',
                payload: { success, songId },
              }));
            }
            break;
          }

          case 'dj-style-vote': {
            const djStyle = message.payload?.style as string;
            if (listenerId && ['explore', 'similar', 'consistent'].includes(djStyle)) {
              const success = radioManager.voteDjStyle(listenerId, djStyle as 'explore' | 'similar' | 'consistent');
              ws.send(JSON.stringify({
                type: 'dj-style-vote-result',
                payload: { voted: success, style: djStyle },
              }));
            }
            break;
          }

          default:
            console.warn('Unknown WebSocket message type:', message.type);
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      if (listenerId) {
        radioManager.removeListener(listenerId);
        wsToListenerId.delete(ws);
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      if (listenerId) {
        radioManager.removeListener(listenerId);
        wsToListenerId.delete(ws);
      }
    });
  });
}

export default router;
