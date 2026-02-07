import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Load .env from project root (parent of server directory)
const __filename_init = fileURLToPath(import.meta.url);
const __dirname_init = path.dirname(__filename_init);
dotenv.config({ path: path.join(__dirname_init, '../../.env') });
import cron from 'node-cron';
import { config } from './config/index.js';
import { runCleanupJob, cleanupDeletedSongs } from './services/cleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import songsRoutes from './routes/songs.js';
import generateRoutes from './routes/generate.js';
import radioRoutes, { setupRadioWebSocket } from './routes/radio.js';
import { pool } from './db/pool.js';
import './db/migrate.js';
import { radioManager } from './services/radioState.js';

const app = express();

// Trust reverse proxy headers (X-Forwarded-For, X-Forwarded-Proto)
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers — minimal for LAN / plain HTTP compatibility
app.use(helmet({
  contentSecurityPolicy: false,
  strictTransportSecurity: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());

// Serve static audio files
app.use('/audio', express.static(path.join(__dirname, '../public/audio')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'RAIDIO API' });
});

// Image proxy for CORS
app.get('/api/proxy/image', async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ error: 'URL required' });
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch image' });
      return;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// Routes
app.use('/api/songs', songsRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/radio', radioRoutes);

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
  const frontendDir = path.join(__dirname, '../../dist');
  app.use(express.static(frontendDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Schedule cleanup job to run daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('Running scheduled cleanup job...');
  try {
    await runCleanupJob();
    await cleanupDeletedSongs();
  } catch (error) {
    console.error('Cleanup job failed:', error);
  }
});

// Create HTTP server explicitly (needed for WebSocket)
const server = createServer(app);

// Create WebSocket server for radio
const wss = new WebSocketServer({ server, path: '/api/radio/ws' });
setupRadioWebSocket(wss);

// Initialize LLM provider from saved radio settings
radioManager.initLLMFromSettings();

// Start server on all interfaces for LAN access
server.listen(config.port, '0.0.0.0', () => {
  console.log(`RAIDIO Server running on http://localhost:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`ACE-Step API: ${config.acestep.apiUrl}`);
  console.log(`Radio WebSocket: ws://localhost:${config.port}/api/radio/ws`);

  // Show LAN access info
  import('os').then(os => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`LAN access: http://${net.address}:${config.port}`);
        }
      }
    }
  });
});
