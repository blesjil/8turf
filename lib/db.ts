import { Database } from 'bun:sqlite';

const dbPath = process.env.DB_PATH || 'data/app.db';
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.run('PRAGMA journal_mode = WAL;');
db.run('PRAGMA foreign_keys = ON;');

function columnExists(table: string, column: string): boolean {
  return db
    .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
}

function addColumnIfMissing(table: string, ddl: string): void {
  const column = ddl.trim().split(/\s+/)[0];
  if (!columnExists(table, column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// Create better-auth tables
db.run(`
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expiresAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES user(id)
  )
`);

// Admin plugin columns (idempotent — safe to re-run on every module load)
addColumnIfMissing('user', "role TEXT DEFAULT 'user'");
addColumnIfMissing('user', 'banned INTEGER');
addColumnIfMissing('user', 'banReason TEXT');
addColumnIfMissing('user', 'banExpires TEXT');
addColumnIfMissing('session', 'impersonatedBy TEXT');

db.run(`
  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    accessTokenExpiresAt TEXT,
    refreshTokenExpiresAt TEXT,
    scope TEXT,
    idToken TEXT,
    password TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES user(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Create notes table
db.run(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    public_slug TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES user(id)
  )
`);

// Create indexes
db.run(`CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_notes_public_slug ON notes(public_slug)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_notes_is_public ON notes(is_public)`);

// Auto-update updated_at column on notes update
db.run(`
  CREATE TRIGGER IF NOT EXISTS update_notes_timestamp
  AFTER UPDATE ON notes
  BEGIN
    UPDATE notes SET updated_at = datetime('now') WHERE id = NEW.id;
  END
`);

export { db };
