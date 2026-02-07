import { db } from './pool.js';

const migrations = `
-- Users table (simplified)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Songs table
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lyrics TEXT,
  style TEXT,
  caption TEXT,
  cover_url TEXT,
  audio_url TEXT,
  duration INTEGER,
  bpm INTEGER,
  key_scale TEXT,
  time_signature TEXT,
  tags TEXT DEFAULT '[]',
  is_public INTEGER DEFAULT 0,
  generation_params TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Generation jobs table
CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acestep_task_id TEXT,
  provider_task_id TEXT,
  status TEXT DEFAULT 'pending',
  params TEXT,
  result TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Radio history table (persists across server reboots)
CREATE TABLE IF NOT EXISTS radio_history (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  lyrics TEXT,
  style TEXT,
  cover_url TEXT,
  audio_url TEXT NOT NULL,
  duration INTEGER,
  creator TEXT,
  created_at TEXT,
  played_at TEXT DEFAULT (datetime('now')),
  gen_params TEXT -- JSON blob storing generation parameters
);

-- Radio settings table (single row, persists admin settings)
CREATE TABLE IF NOT EXISTS radio_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  settings TEXT NOT NULL, -- JSON blob storing RadioSettings
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Radio chat history table
CREATE TABLE IF NOT EXISTS radio_chat (
  id TEXT PRIMARY KEY,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_songs_user_id ON songs(user_id);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at);
CREATE INDEX IF NOT EXISTS idx_songs_is_public ON songs(is_public);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON generation_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_radio_history_played_at ON radio_history(played_at);
CREATE INDEX IF NOT EXISTS idx_radio_chat_created_at ON radio_chat(created_at);
`;

function migrate(): void {
  console.log('Running SQLite database migrations...');

  try {
    // Execute the entire migration script at once
    db.exec(migrations);
    console.log('Migrations completed successfully!');
  } catch (error) {
    // Check if it's just "already exists" errors
    const errorMsg = String(error);
    if (errorMsg.includes('already exists')) {
      console.log('Tables already exist, migrations completed!');
    } else {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}

// Incremental migrations for existing databases
function migrateIncremental(): void {
  try {
    // Add provider_task_id column if it doesn't exist
    const jobCols = db.prepare("PRAGMA table_info(generation_jobs)").all() as Array<{ name: string }>;
    if (!jobCols.some(c => c.name === 'provider_task_id')) {
      db.exec("ALTER TABLE generation_jobs ADD COLUMN provider_task_id TEXT");
      console.log('Added provider_task_id column to generation_jobs');
    }

    // Drop stale columns from songs table (features removed)
    const songCols = db.prepare("PRAGMA table_info(songs)").all() as Array<{ name: string }>;
    const staleCols = ['has_video', 'video_url', 'like_count', 'view_count', 'is_featured'];
    for (const col of staleCols) {
      if (songCols.some(c => c.name === col)) {
        db.exec(`ALTER TABLE songs DROP COLUMN ${col}`);
        console.log(`Dropped stale column ${col} from songs`);
      }
    }
  } catch (error) {
    console.error('Incremental migration failed:', error);
  }
}

// Run migrations
migrate();
migrateIncremental();
