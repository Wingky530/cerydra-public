import client from '../src/lib/turso';

await client.execute(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    created_at INTEGER NOT NULL
  )
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS watch_history (
    anime_id         TEXT NOT NULL,
    anime_name       TEXT NOT NULL DEFAULT '',
    episode          TEXT NOT NULL,
    thumbnail        TEXT NOT NULL DEFAULT '',
    current_time     REAL DEFAULT 0,
    duration         REAL DEFAULT 0,
    progress_seconds REAL DEFAULT 0,
    timestamp        INTEGER NOT NULL,
    UNIQUE(anime_id, episode)
  )
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS cache_index (
    key       TEXT PRIMARY KEY,
    anime_id  TEXT NOT NULL,
    episode   TEXT,
    type      TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
)
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS presence (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    activity_type TEXT NOT NULL,
    anime_title TEXT,
    episode_number INTEGER,
    episode_title TEXT,
    duration INTEGER,
    position INTEGER,
    status TEXT NOT NULL DEFAULT 'idle',
    updated_at INTEGER NOT NULL
  )
`);

try {
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_cache_anime ON cache_index(anime_id)`);
} catch {
  // index may already exist
}

await client.execute(`
  CREATE TABLE IF NOT EXISTS schedule_cache (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week  TEXT NOT NULL,
    anime_id     TEXT NOT NULL,
    title        TEXT NOT NULL,
    episode      INTEGER,
    air_time_jst TEXT,
    air_time_wib TEXT,
    status       TEXT NOT NULL DEFAULT 'waiting',
    score        REAL,
    watchers     INTEGER,
    cover_url    TEXT,
    source       TEXT NOT NULL DEFAULT 'anilist',
    cached_at    INTEGER NOT NULL,
    UNIQUE(day_of_week, anime_id)
  )
`);

// Add airing_timestamp column to schedule_cache if missing
try {
  await client.execute(`ALTER TABLE schedule_cache ADD COLUMN airing_timestamp INTEGER`);
  console.log('Migration: added airing_timestamp column to schedule_cache.');
} catch {
  // column already exists
}

// Add media_status column to schedule_cache if missing
try {
  await client.execute(`ALTER TABLE schedule_cache ADD COLUMN media_status TEXT`);
  console.log('Migration: added media_status column to schedule_cache.');
} catch {
  // column already exists
}

// Add user isolation to watch_history
const tableInfo = await client.execute("PRAGMA table_info(watch_history)");
const hasUserId = tableInfo.rows.some(r => r.name === 'user_id');
if (!hasUserId) {
  await client.execute(`
    CREATE TABLE watch_history_new (
      user_id           TEXT NOT NULL DEFAULT '',
      anime_id         TEXT NOT NULL,
      anime_name       TEXT NOT NULL DEFAULT '',
      episode          TEXT NOT NULL,
      thumbnail        TEXT NOT NULL DEFAULT '',
      current_time     REAL DEFAULT 0,
      duration         REAL DEFAULT 0,
      progress_seconds REAL DEFAULT 0,
      timestamp        INTEGER NOT NULL,
      UNIQUE(user_id, anime_id, episode)
    )
  `);
  await client.execute(`INSERT OR IGNORE INTO watch_history_new SELECT '', * FROM watch_history`);
  await client.execute('DROP TABLE watch_history');
  await client.execute('ALTER TABLE watch_history_new RENAME TO watch_history');
  console.log('Migration complete: user_id column added to watch_history.');
} else {
  console.log('Migration complete: user_id already exists.');
}
// Add available_on_cerydra column to schedule_cache if missing
try {
  await client.execute(`ALTER TABLE schedule_cache ADD COLUMN available_on_cerydra INTEGER DEFAULT 0`);
  console.log('Migration: added available_on_cerydra column to schedule_cache.');
} catch {
  // column already exists
}

// Add anilist_id to watch_history if missing
try {
  await client.execute(`ALTER TABLE watch_history ADD COLUMN anilist_id INTEGER`);
  console.log('Migration: added anilist_id column to watch_history.');
} catch {
  // column already exists
}

// Clear stale schedule cache so re-fetch uses updated filters & title enrichment
try {
  const del = await client.execute(`DELETE FROM schedule_cache`);
  if (del.rowsAffected > 0) {
    console.log(`Migration: cleared ${del.rowsAffected} stale schedule_cache entries.`);
  }
} catch {
  // table may not exist yet
}

client.close();
