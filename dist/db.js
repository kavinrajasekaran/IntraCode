import Database from 'better-sqlite3';
import path from 'path';
// Instantiate the database
const dbPath = path.resolve(process.cwd(), '.multi-agent-broker.db');
const db = new Database(dbPath);
// Initialization: Enable WAL mode and optimal synchronous setting
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'in-progress', 'done', 'failed', 'abandoned')) DEFAULT 'pending',
    assigned_agent TEXT,
    reasoning TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS decision_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    summary TEXT NOT NULL,
    alternatives TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS failure_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    approach TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS failure_search USING fts5(
    approach,
    reason,
    content='failure_log',
    content_rowid='id'
  );

  -- Triggers to keep FTS5 table synced with failure_log inserts/deletes/updates
  CREATE TRIGGER IF NOT EXISTS failure_log_ai AFTER INSERT ON failure_log BEGIN
    INSERT INTO failure_search(rowid, approach, reason) VALUES (new.id, new.approach, new.reason);
  END;

  CREATE TRIGGER IF NOT EXISTS failure_log_ad AFTER DELETE ON failure_log BEGIN
    INSERT INTO failure_search(failure_search, rowid, approach, reason) VALUES ('delete', old.id, old.approach, old.reason);
  END;

  CREATE TRIGGER IF NOT EXISTS failure_log_au AFTER UPDATE ON failure_log BEGIN
    INSERT INTO failure_search(failure_search, rowid, approach, reason) VALUES ('delete', old.id, old.approach, old.reason);
    INSERT INTO failure_search(rowid, approach, reason) VALUES (new.id, new.approach, new.reason);
  END;

  CREATE TABLE IF NOT EXISTS artifact_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT,
    name TEXT,
    path TEXT UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS working_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT,
    event_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
export default db;
