import fs from 'fs';
import path from 'path';
import db from './db.js';
import {
  CreateTaskSchema,
  ClaimTaskSchema,
  UpdateTaskSchema,
  LogFailureSchema,
  CheckFailuresSchema,
  RegisterArtifactSchema,
} from './schema.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function insertEvent(agent_name: string, event_description: string): void {
  db.prepare(
    'INSERT INTO working_memory (agent_name, event_description) VALUES (?, ?)'
  ).run(agent_name, event_description);
}

function safeRun<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`DB error: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Tool: create_task
// ---------------------------------------------------------------------------

export function createTask(rawInput: unknown): object {
  const { title, reasoning } = CreateTaskSchema.parse(rawInput);
  return safeRun(() => {
    const info = db
      .prepare('INSERT INTO tasks (title, reasoning) VALUES (?, ?)')
      .run(title, reasoning ?? null);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
    return { success: true, task };
  });
}

// ---------------------------------------------------------------------------
// List helpers (used by HTTP API / extension dashboard)
// ---------------------------------------------------------------------------

export function listTasks(): object {
  return safeRun(() => ({
    tasks: db.prepare('SELECT * FROM tasks ORDER BY id ASC').all(),
  }));
}

export function listFailures(): object {
  return safeRun(() => ({
    failures: db.prepare('SELECT * FROM failure_log ORDER BY id DESC LIMIT 50').all(),
  }));
}

export function listArtifacts(): object {
  return safeRun(() => ({
    artifacts: db.prepare('SELECT * FROM artifact_registry ORDER BY id DESC').all(),
  }));
}

export function listWorkingMemory(): object {
  return safeRun(() => ({
    events: db.prepare('SELECT * FROM working_memory ORDER BY id DESC LIMIT 50').all(),
  }));
}

// ---------------------------------------------------------------------------

export function getOrientation(): object {
  return safeRun(() => {
    const contextPath = path.resolve(process.cwd(), 'CONTEXT.md');
    let global_context = '';
    try {
      global_context = fs.readFileSync(contextPath, 'utf8');
    } catch {
      // File doesn't exist — return empty string
    }

    const pending_tasks = db
      .prepare(
        `SELECT id, title, status, assigned_agent, created_at
         FROM tasks
         WHERE status = 'pending'
         ORDER BY id ASC
         LIMIT 5`
      )
      .all();

    const recent_events = db
      .prepare(
        `SELECT id, agent_name, event_description, created_at
         FROM working_memory
         ORDER BY id DESC
         LIMIT 5`
      )
      .all();

    return { global_context, pending_tasks, recent_events };
  });
}

// ---------------------------------------------------------------------------
// Tool: claim_task
// ---------------------------------------------------------------------------

export function claimTask(rawInput: unknown): object {
  const { task_id, agent_name } = ClaimTaskSchema.parse(rawInput);

  return safeRun(() => {
    const result = db
      .prepare(
        `UPDATE tasks
         SET status = 'in-progress', assigned_agent = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending'`
      )
      .run(agent_name, task_id);

    if (result.changes === 0) {
      throw new Error(
        `Task ${task_id} is already claimed, does not exist, or is not in 'pending' status.`
      );
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task_id);
    insertEvent(agent_name, `Claimed task #${task_id}.`);

    return { success: true, task };
  });
}

// ---------------------------------------------------------------------------
// Tool: update_task
// ---------------------------------------------------------------------------

export function updateTask(rawInput: unknown): object {
  const { task_id, status, agent_name, notes } = UpdateTaskSchema.parse(rawInput);

  return safeRun(() => {
    const result = db
      .prepare(
        `UPDATE tasks
         SET status = ?, assigned_agent = ?, reasoning = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(status, agent_name, notes ?? null, task_id);

    if (result.changes === 0) {
      throw new Error(`Task ${task_id} not found.`);
    }

    insertEvent(
      agent_name,
      `Updated task #${task_id} to status '${status}'.${notes ? ' Notes: ' + notes : ''}`
    );

    return { success: true };
  });
}

// ---------------------------------------------------------------------------
// Tool: log_failure
// ---------------------------------------------------------------------------

export function logFailure(rawInput: unknown): object {
  const { approach, reason, agent_name } = LogFailureSchema.parse(rawInput);

  return safeRun(() => {
    const info = db
      .prepare(
        'INSERT INTO failure_log (agent_name, approach, reason) VALUES (?, ?, ?)'
      )
      .run(agent_name, approach, reason);

    insertEvent(
      agent_name,
      `Logged failure (id=${info.lastInsertRowid}): approach="${approach.slice(0, 60)}..."`
    );

    return { success: true, failure_id: info.lastInsertRowid };
  });
}

// ---------------------------------------------------------------------------
// Tool: check_failures
// ---------------------------------------------------------------------------

export function checkFailures(rawInput: unknown): object {
  const { query } = CheckFailuresSchema.parse(rawInput);

  return safeRun(() => {
    const rows = db
      .prepare(
        `SELECT fl.id, fl.agent_name, fl.approach, fl.reason, fl.created_at
         FROM failure_search fs
         JOIN failure_log fl ON fl.id = fs.rowid
         WHERE failure_search MATCH ?
         LIMIT 3`
      )
      .all(query);

    return { results: rows };
  });
}

// ---------------------------------------------------------------------------
// Tool: register_artifact
// ---------------------------------------------------------------------------

export function registerArtifact(rawInput: unknown): object {
  const { name, path: artifactPath, description, agent_name } =
    RegisterArtifactSchema.parse(rawInput);

  return safeRun(() => {
    const info = db
      .prepare(
        `INSERT INTO artifact_registry (agent_name, name, path, description)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           agent_name  = excluded.agent_name,
           name        = excluded.name,
           description = excluded.description,
           created_at  = CURRENT_TIMESTAMP`
      )
      .run(agent_name, name, artifactPath, description);

    insertEvent(agent_name, `Registered artifact '${name}' at '${artifactPath}'.`);

    return { success: true, artifact_id: info.lastInsertRowid };
  });
}
