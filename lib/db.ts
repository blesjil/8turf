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

// Create properties table
db.run(`
  CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES user(id)
  )
`);

// Create units table
db.run(`
  CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    unit_label TEXT NOT NULL,
    bedrooms INTEGER NOT NULL DEFAULT 0 CHECK (bedrooms >= 0),
    bathrooms REAL NOT NULL DEFAULT 1 CHECK (bathrooms >= 0),
    rent_amount INTEGER NOT NULL CHECK (rent_amount >= 0),
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (property_id) REFERENCES properties(id)
  )
`);

// Create tenants table
db.run(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    rent_amount INTEGER NOT NULL CHECK (rent_amount >= 0),
    lease_start_date TEXT NOT NULL,
    lease_end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (unit_id) REFERENCES units(id)
  )
`);

// Create rent_payments table
db.run(`
  CREATE TABLE IF NOT EXISTS rent_payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    period TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
    paid_date TEXT NOT NULL,
    method TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
  )
`);

// Create indexes
db.run(`CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_unit_id ON tenants(unit_id)`);
db.run(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_active_unit ON tenants(unit_id) WHERE is_active = 1`,
);
db.run(`CREATE INDEX IF NOT EXISTS idx_rent_payments_tenant_id ON rent_payments(tenant_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_rent_payments_unit_id ON rent_payments(unit_id)`);
db.run(
  `CREATE INDEX IF NOT EXISTS idx_rent_payments_tenant_period ON rent_payments(tenant_id, period)`,
);
db.run(`CREATE INDEX IF NOT EXISTS idx_rent_payments_period ON rent_payments(period)`);

// Auto-update updated_at columns
db.run(`
  CREATE TRIGGER IF NOT EXISTS update_properties_timestamp AFTER UPDATE ON properties
  BEGIN UPDATE properties SET updated_at = datetime('now') WHERE id = NEW.id; END
`);
db.run(`
  CREATE TRIGGER IF NOT EXISTS update_units_timestamp AFTER UPDATE ON units
  BEGIN UPDATE units SET updated_at = datetime('now') WHERE id = NEW.id; END
`);
db.run(`
  CREATE TRIGGER IF NOT EXISTS update_tenants_timestamp AFTER UPDATE ON tenants
  BEGIN UPDATE tenants SET updated_at = datetime('now') WHERE id = NEW.id; END
`);
db.run(`
  CREATE TRIGGER IF NOT EXISTS update_rent_payments_timestamp AFTER UPDATE ON rent_payments
  BEGIN UPDATE rent_payments SET updated_at = datetime('now') WHERE id = NEW.id; END
`);

export { db };
