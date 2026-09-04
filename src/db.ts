import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Db = Database.Database;

export function openDb(dbPath: string): Db {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      clicks INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      clicked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      referrer TEXT,
      user_agent TEXT,
      ip TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
    CREATE INDEX IF NOT EXISTS idx_links_code ON links(code);
  `);
}
