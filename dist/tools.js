import fs from 'fs';
import path from 'path';
import db from './db.js';
import { CreateTaskSchema, ClaimTaskSchema, UpdateTaskSchema, LogFailureSchema, CheckFailuresSchema, RegisterArtifactSchema, StoreMemorySchema, GetMemorySchema, SearchMemoriesSchema, DeleteMemorySchema, StartSessionSchema, EndSessionSchema, LogDecisionSchema, LogProgressSchema, AddTaskSchema, LeaveMemoSchema, ReadMemosSchema, } from './schema.js';
// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function insertEvent(agent_name, event_description) {
    db.prepare('INSERT INTO working_memory (agent_name, event_description) VALUES (?, ?)').run(agent_name, event_description);
}
function safeRun(fn) {
    try {
        return fn();
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`DB error: ${msg}`);
    }
}
// ---------------------------------------------------------------------------
// Tool: create_task
// ---------------------------------------------------------------------------
export function createTask(rawInput) {
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
export function listTasks() {
    return safeRun(() => ({
        tasks: db.prepare('SELECT * FROM tasks ORDER BY id ASC').all(),
    }));
}
export function listFailures() {
    return safeRun(() => ({
        failures: db.prepare('SELECT * FROM failure_log ORDER BY id DESC LIMIT 50').all(),
    }));
}
export function listArtifacts() {
    return safeRun(() => ({
        artifacts: db.prepare('SELECT * FROM artifact_registry ORDER BY id DESC').all(),
    }));
}
export function listWorkingMemory() {
    return safeRun(() => ({
        events: db.prepare('SELECT * FROM working_memory ORDER BY id DESC LIMIT 50').all(),
    }));
}
// ---------------------------------------------------------------------------
export function getOrientation() {
    return safeRun(() => {
        const contextPath = path.resolve(process.cwd(), 'CONTEXT.md');
        let global_context = '';
        try {
            global_context = fs.readFileSync(contextPath, 'utf8');
        }
        catch {
            // File doesn't exist — return empty string
        }
        const pending_tasks = db
            .prepare(`SELECT id, title, status, assigned_agent, created_at
         FROM tasks
         WHERE status = 'pending'
         ORDER BY id ASC
         LIMIT 5`)
            .all();
        const recent_events = db
            .prepare(`SELECT id, agent_name, event_description, created_at
         FROM working_memory
         ORDER BY id DESC
         LIMIT 5`)
            .all();
        return { global_context, pending_tasks, recent_events };
    });
}
// ---------------------------------------------------------------------------
// Tool: claim_task
// ---------------------------------------------------------------------------
export function claimTask(rawInput) {
    const { task_id, agent_name } = ClaimTaskSchema.parse(rawInput);
    return safeRun(() => {
        const result = db
            .prepare(`UPDATE tasks
         SET status = 'in-progress', assigned_agent = ?, updated_at = DATETIME('now', 'localtime')
         WHERE id = ? AND status = 'pending'`)
            .run(agent_name, task_id);
        if (result.changes === 0) {
            throw new Error(`Task ${task_id} is already claimed, does not exist, or is not in 'pending' status.`);
        }
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task_id);
        insertEvent(agent_name, `Claimed task #${task_id}.`);
        return { success: true, task };
    });
}
// ---------------------------------------------------------------------------
// Tool: update_task
// ---------------------------------------------------------------------------
export function updateTask(rawInput) {
    const { task_id, status, agent_name, notes } = UpdateTaskSchema.parse(rawInput);
    return safeRun(() => {
        const result = db
            .prepare(`UPDATE tasks
         SET status = ?, assigned_agent = ?, reasoning = ?, updated_at = DATETIME('now', 'localtime')
         WHERE id = ?`)
            .run(status, agent_name, notes ?? null, task_id);
        if (result.changes === 0) {
            throw new Error(`Task ${task_id} not found.`);
        }
        insertEvent(agent_name, `Updated task #${task_id} to status '${status}'.${notes ? ' Notes: ' + notes : ''}`);
        return { success: true };
    });
}
// ---------------------------------------------------------------------------
// Tool: log_failure
// ---------------------------------------------------------------------------
export function logFailure(rawInput) {
    const { approach, reason, agent_name } = LogFailureSchema.parse(rawInput);
    return safeRun(() => {
        const info = db
            .prepare('INSERT INTO failure_log (agent_name, approach, reason) VALUES (?, ?, ?)')
            .run(agent_name, approach, reason);
        insertEvent(agent_name, `Logged failure (id=${info.lastInsertRowid}): approach="${approach.slice(0, 60)}..."`);
        return { success: true, failure_id: info.lastInsertRowid };
    });
}
// ---------------------------------------------------------------------------
// Tool: check_failures
// ---------------------------------------------------------------------------
export function checkFailures(rawInput) {
    const { query } = CheckFailuresSchema.parse(rawInput);
    return safeRun(() => {
        const rows = db
            .prepare(`SELECT fl.id, fl.agent_name, fl.approach, fl.reason, fl.created_at
         FROM failure_search fs
         JOIN failure_log fl ON fl.id = fs.rowid
         WHERE failure_search MATCH ?
         LIMIT 3`)
            .all(query);
        return { results: rows };
    });
}
// ---------------------------------------------------------------------------
// Tool: register_artifact
// ---------------------------------------------------------------------------
export function registerArtifact(rawInput) {
    const { name, path: artifactPath, description, agent_name } = RegisterArtifactSchema.parse(rawInput);
    return safeRun(() => {
        const info = db
            .prepare(`INSERT INTO artifact_registry (agent_name, name, path, description)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           agent_name  = excluded.agent_name,
           name        = excluded.name,
           description = excluded.description,
           created_at  = DATETIME('now', 'localtime')`)
            .run(agent_name, name, artifactPath, description);
        insertEvent(agent_name, `Registered artifact '${name}' at '${artifactPath}'.`);
        return { success: true, artifact_id: info.lastInsertRowid };
    });
}
// ---------------------------------------------------------------------------
// Tool: store_memory
// ---------------------------------------------------------------------------
export function storeMemory(rawInput) {
    const { key, content, tags, agent_name } = StoreMemorySchema.parse(rawInput);
    return safeRun(() => {
        const tagsString = tags ? JSON.stringify(tags) : null;
        const info = db
            .prepare(`INSERT INTO memories (key, content, tags, agent_name)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           content = excluded.content,
           tags = excluded.tags,
           agent_name = excluded.agent_name,
           updated_at = DATETIME('now', 'localtime')`)
            .run(key, content, tagsString, agent_name);
        insertEvent(agent_name, `Stored memory: ${key}`);
        return { success: true, memory_id: info.lastInsertRowid };
    });
}
// ---------------------------------------------------------------------------
// Tool: get_memory
// ---------------------------------------------------------------------------
export function getMemory(rawInput) {
    const { key } = GetMemorySchema.parse(rawInput);
    return safeRun(() => {
        const memory = db.prepare('SELECT * FROM memories WHERE key = ?').get(key);
        if (!memory) {
            throw new Error(`Memory with key '${key}' not found.`);
        }
        return { success: true, memory };
    });
}
// ---------------------------------------------------------------------------
// Tool: search_memories
// ---------------------------------------------------------------------------
export function searchMemories(rawInput) {
    const { query } = SearchMemoriesSchema.parse(rawInput);
    return safeRun(() => {
        const rows = db
            .prepare(`SELECT m.id, m.key, m.content, m.tags, m.agent_name, m.updated_at
         FROM memories_search ms
         JOIN memories m ON m.id = ms.rowid
         WHERE memories_search MATCH ?
         ORDER BY bm25(memories_search)
         LIMIT 10`)
            .all(query);
        return { results: rows };
    });
}
// ---------------------------------------------------------------------------
// Tool: delete_memory
// ---------------------------------------------------------------------------
export function deleteMemory(rawInput) {
    const { key } = DeleteMemorySchema.parse(rawInput);
    return safeRun(() => {
        const info = db.prepare('DELETE FROM memories WHERE key = ?').run(key);
        if (info.changes === 0) {
            throw new Error(`Memory with key '${key}' not found.`);
        }
        return { success: true };
    });
}
// ---------------------------------------------------------------------------
// Tool: start_session
// ---------------------------------------------------------------------------
export function startSession(rawInput) {
    const { agent_name, goal } = StartSessionSchema.parse(rawInput);
    return safeRun(() => {
        const info = db
            .prepare('INSERT INTO sessions (agent_name, goal) VALUES (?, ?)')
            .run(agent_name, goal);
        insertEvent(agent_name, `Started session: ${goal}`);
        return { success: true, session_id: info.lastInsertRowid };
    });
}
// ---------------------------------------------------------------------------
// Tool: end_session
// ---------------------------------------------------------------------------
export function endSession(rawInput) {
    const { agent_name, status } = EndSessionSchema.parse(rawInput);
    return safeRun(() => {
        // End all active sessions for this agent
        const info = db
            .prepare(`UPDATE sessions SET status = ?, ended_at = DATETIME('now', 'localtime')
         WHERE agent_name = ? AND status = 'active'`)
            .run(status, agent_name);
        insertEvent(agent_name, `Ended active session(s) with status: ${status}`);
        return { success: true, updated_sessions: info.changes };
    });
}
// ---------------------------------------------------------------------------
// Additional list helper for HTTP API
// ---------------------------------------------------------------------------
export function listMemories() {
    return safeRun(() => ({
        memories: db.prepare('SELECT * FROM memories ORDER BY updated_at DESC').all(),
    }));
}
// ---------------------------------------------------------------------------
// Tool: log_decision
// ---------------------------------------------------------------------------
export function logDecision(rawInput) {
    const { key, decision, rationale, agent_name } = LogDecisionSchema.parse(rawInput);
    const content = rationale ? `${decision}\n\nRationale: ${rationale}` : decision;
    return safeRun(() => {
        db.prepare(`
      INSERT INTO memories (key, content, tags, agent_name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        content    = excluded.content,
        tags       = excluded.tags,
        agent_name = excluded.agent_name,
        updated_at = DATETIME('now', 'localtime')
    `).run(key, content, JSON.stringify(['decision']), agent_name);
        insertEvent(agent_name, `Logged decision: ${key}`);
        return { success: true, key };
    });
}
// ---------------------------------------------------------------------------
// Tool: log_progress
// ---------------------------------------------------------------------------
export function logProgress(rawInput) {
    const { agent_name, summary } = LogProgressSchema.parse(rawInput);
    return safeRun(() => {
        insertEvent(agent_name, summary);
        return { success: true };
    });
}
// ---------------------------------------------------------------------------
// Tool: add_task
// ---------------------------------------------------------------------------
export function addTask(rawInput) {
    const { title, reasoning, agent_name } = AddTaskSchema.parse(rawInput);
    return safeRun(() => {
        const info = db
            .prepare('INSERT INTO tasks (title, reasoning) VALUES (?, ?)')
            .run(title, reasoning ?? null);
        insertEvent(agent_name, `Created task: "${title}"`);
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
        return { success: true, task };
    });
}
// ---------------------------------------------------------------------------
// Tool: leave_memo
// ---------------------------------------------------------------------------
export function leaveMemo(rawInput) {
    const { agent_name, message, urgency } = LeaveMemoSchema.parse(rawInput);
    const key = `agent/memo/${Date.now().toString(36)}`;
    return safeRun(() => {
        db.prepare(`
      INSERT INTO memories (key, content, tags, agent_name)
      VALUES (?, ?, ?, ?)
    `).run(key, message, JSON.stringify(['memo', urgency]), agent_name);
        insertEvent(agent_name, `Left ${urgency} memo: "${message.slice(0, 50)}..."`);
        return { success: true, key };
    });
}
// ---------------------------------------------------------------------------
// Tool: read_memos
// ---------------------------------------------------------------------------
export function readMemos(rawInput) {
    const { urgency_filter } = ReadMemosSchema.parse(rawInput);
    return safeRun(() => {
        const mems = db.prepare(`SELECT * FROM memories WHERE tags LIKE '%"memo"%' ORDER BY updated_at DESC`).all();
        // Parse tags and filter
        const parsed = mems.map((m) => ({
            ...m,
            parsedTags: JSON.parse(m.tags ?? '[]')
        }));
        let results = parsed;
        if (urgency_filter) {
            results = parsed.filter(m => m.parsedTags.includes(urgency_filter));
        }
        const output = results.map(m => {
            const urgency = m.parsedTags.find((t) => ['blocker', 'warning', 'info'].includes(t)) || 'info';
            return {
                key: m.key,
                author: m.agent_name,
                urgency,
                message: m.content,
                created: m.updated_at
            };
        });
        const blockers = output.filter(m => m.urgency === 'blocker').length;
        return {
            totalMemos: output.length,
            blockers,
            memos: output,
            hint: blockers > 0 ? `${blockers} BLOCKER(s) require attention.` : 'Review memos and proceed.'
        };
    });
}
