import Database from 'better-sqlite3';
import path from 'path';
// Resolve the project root relative to the VS Code workspace or active shell
const projectRoot = process.env.INTERAGENT_WORKSPACE_ROOT || process.cwd();
const dbPath = path.resolve(projectRoot, '.multi-agent-broker.db');
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
    created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
    updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS decision_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    summary TEXT NOT NULL,
    alternatives TEXT,
    created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS failure_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    approach TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
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
    created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS working_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT,
    event_description TEXT,
    created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    status TEXT CHECK(status IN ('active', 'completed', 'failed')) DEFAULT 'active',
    goal TEXT,
    started_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
    ended_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,
    agent_name TEXT,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
    updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS memories_search USING fts5(
    key,
    content,
    tags,
    content='memories',
    content_rowid='id'
  );

  CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_search(rowid, key, content, tags) VALUES (new.id, new.key, new.content, new.tags);
  END;
  CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_search(memories_search, rowid, key, content, tags) VALUES ('delete', old.id, old.key, old.content, old.tags);
  END;
  CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_search(memories_search, rowid, key, content, tags) VALUES ('delete', old.id, old.key, old.content, old.tags);
    INSERT INTO memories_search(rowid, key, content, tags) VALUES (new.id, new.key, new.content, new.tags);
  END;
`);
export default db;
