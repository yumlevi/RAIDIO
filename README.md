# RAIDIO — AI Music Radio

Real-time AI-generated music radio powered by [ACE-Step](https://github.com/ace-step/ACE-Step).

![RAIDIO Demo](docs/Animation.gif)

## Features

- **Real-time radio** with WebSocket streaming — all listeners hear the same music in sync
- **AI music generation** via Vibe mode (LLM-assisted) and Create mode (manual control)
- **Auto-DJ** with configurable styles: explore, similar, consistent
- **Dynamic accent colors** that shift with album art
- **Audio visualizer** with multiple shapes and color schemes
- **Live chat** between listeners
- **Skip voting** system (50% threshold)
- **Admin controls** for generation settings, LLM provider, Auto-DJ config
- **Song queue and history** with crossfade transitions
- **LAN access** — share with anyone on your network
- **Cloudflare Tunnel** support for public sharing (Windows)

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Backend:** Express, TypeScript, better-sqlite3
- **Music Generation:** ACE-Step API
- **LLM:** Claude (Anthropic) or vLLM (OpenAI-compatible)
- **Real-time:** WebSocket (ws)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [ACE-Step](https://github.com/ace-step/ACE-Step) running locally (API mode on port 39871)

## Setup

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Copy environment config
cp server/.env.example .env
# Edit .env with your settings (API keys, radio secret, etc.)
```

## Running

### Option 1: Start backend + frontend (ACE-Step already running)

**Windows:**
```
start.bat
```

**Linux/macOS:**
```bash
./start.sh
```

### Option 2: Start everything including ACE-Step

**Windows:**
```
start-all.bat
```

**Linux/macOS:**
```bash
./start-all.sh
```

### Manual start

```bash
# Terminal 1: ACE-Step API
cd path/to/ACE-Step
uv run acestep-api --port 39871

# Terminal 2: Backend
cd server && npm run dev

# Terminal 3: Frontend
npm run dev
```

Open http://localhost:1869 in your browser.

## Docker Deployment

### Quick Start

```bash
docker compose up -d
```

This builds and starts RAIDIO on port 3001. ACE-Step must run separately (needs GPU).

### Configuration

Edit `docker-compose.yml` environment variables or mount a `.env` file:
- `ACESTEP_API_URL` — point to your ACE-Step API (default: `host.docker.internal:39871`)
- `RADIO_OWNER_SECRET` — admin access secret
- `CLAUDE_API_KEY` — optional, for Vibe mode
- `TRUST_PROXY=1` — set automatically in Docker

Data persists via Docker volumes (`raidio-data` for DB, `raidio-audio` for generated files).

### Reverse Proxy

See `nginx.example.conf` for nginx configuration with:
- SSL termination
- WebSocket upgrade for `/api/radio/ws`
- Proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`)

## Configuration

### Environment Variables (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `ACESTEP_API_URL` | `http://localhost:39871` | ACE-Step API endpoint |
| `RADIO_OWNER_SECRET` | `default-radio-secret` | Secret for admin access |
| `CLAUDE_API_KEY` | | Anthropic API key (for Vibe mode) |
| `VLLM_ENDPOINT_URL` | | vLLM endpoint URL (alternative to Claude) |
| `VLLM_MODEL` | | vLLM model name |

### Admin Settings

Navigate to `/admin` or click the admin gear icon to configure:

- Generation parameters (inference steps, guidance scale, audio format, etc.)
- LLM provider (Claude or vLLM) for Vibe mode
- Auto-DJ behavior (style, BPM range, duration range, fade settings)
- Audio post-processing (high/low pass filters)

### Claiming Admin

1. Set `RADIO_OWNER_SECRET` in your `.env` file
2. Open Settings in the app
3. Enter the secret in the "Claim Admin Access" field

## Architecture

```
raidio/
├── components/          # React components
│   ├── RadioPage.tsx    # Main radio interface
│   ├── AdminSettingsPage.tsx
│   ├── AudioVisualizer.tsx
│   ├── RadioQueue.tsx
│   ├── RadioListeners.tsx
│   └── ...
├── context/             # React contexts
│   ├── RadioContext.tsx  # WebSocket state management
│   └── ThemeContext.tsx  # Theme + accent colors
├── services/
│   └── api.ts           # Frontend API client
├── server/
│   ├── src/
│   │   ├── routes/      # Express routes (generate, songs, radio)
│   │   ├── services/    # Business logic
│   │   │   ├── llm/     # LLM provider abstraction (Claude, vLLM)
│   │   │   ├── radioState.ts
│   │   │   ├── radioStream.ts
│   │   │   └── acestep.ts
│   │   └── db/          # SQLite database
│   ├── prompts/         # LLM prompt templates
│   └── public/audio/    # Generated audio files
├── Dockerfile           # Docker build
├── docker-compose.yml   # Docker Compose config
├── nginx.example.conf   # Reverse proxy example
├── App.tsx              # App shell
├── types.ts             # Shared TypeScript types
└── start.bat            # One-click startup (Windows)
```

## License

MIT
