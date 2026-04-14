import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import {
  getOrientation, createTask, claimTask, updateTask,
  logFailure, checkFailures, registerArtifact,
  storeMemory, getMemory, searchMemories, deleteMemory, startSession, endSession,
  listTasks, listFailures, listArtifacts, listWorkingMemory, listMemories,
  readMemos, leaveMemo
} from './tools.js';
import { scanForProjects, invalidateProjectCache } from './scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reply(res: http.ServerResponse, data: unknown, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function parsePathParam(url: string, prefix: string): string | null {
  if (!url.startsWith(prefix)) return null;
  const encoded = url.slice(prefix.length).split('/')[0];
  try { return decodeURIComponent(encoded); }
  catch { return null; }
}

// ---------------------------------------------------------------------------
// Per-project DB queries (read-only snapshot for the dashboard)
// ---------------------------------------------------------------------------

function getProjectSnapshot(projectPath: string) {
  const dbPath = path.join(projectPath, '.multi-agent-broker.db');
  if (!fs.existsSync(dbPath)) return null;

  try {
    const db = new Database(dbPath, { readonly: true });
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY id ASC').all();
    const memories = db.prepare("SELECT * FROM memories ORDER BY updated_at DESC LIMIT 20").all();
    const failures = db.prepare('SELECT * FROM failure_log ORDER BY id DESC LIMIT 10').all();
    const artifacts = db.prepare('SELECT * FROM artifact_registry ORDER BY id DESC').all();
    const events = db.prepare('SELECT * FROM working_memory ORDER BY id DESC LIMIT 20').all();
    const memos = db.prepare("SELECT * FROM memories WHERE tags LIKE '%\"memo\"%' ORDER BY updated_at DESC").all() as any[];

    const parsedMemos = memos.map((m: any) => {
      const tags: string[] = JSON.parse(m.tags ?? '[]');
      const urgency = tags.find(t => ['blocker', 'warning', 'info'].includes(t)) || 'info';
      return { key: m.key, author: m.agent_name, urgency, message: m.content, created: m.updated_at };
    });

    db.close();

    const tasksByStatus: Record<string, number> = {};
    for (const t of tasks as any[]) {
      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
    }

    return {
      tasks,
      tasksByStatus,
      memories: memories.filter((m: any) => !JSON.parse(m.tags ?? '[]').includes('memo')),
      failures,
      artifacts,
      events,
      memos: parsedMemos,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dashboard HTML
// ---------------------------------------------------------------------------

function loadDashboardHtml(): string {
  const candidates = [
    path.join(__dirname, '..', 'dashboard', 'index.html'),
    path.join(__dirname, '..', 'standalone-dashboard.html'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8');
    }
  }
  return `<!DOCTYPE html><html><body><h1>Dashboard not found</h1></body></html>`;
}

function getDashboardHtml(port: number): string {
  // Read fresh from disk every time — no caching, so edits are instant
  return loadDashboardHtml().replace(/API_PORT/g, String(port));
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function startApiServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    const url = req.url?.split('?')[0] ?? '/';

    try {
      // ── Dashboard ─────────────────────────────────────────
      if (url === '/' || url === '/dashboard' || url === '/dashboard/') {
        const html = getDashboardHtml(port);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(html);
        return;
      }

      // ── Projects API ──────────────────────────────────────
      if (url === '/api/projects' && req.method === 'GET') {
        const projects = scanForProjects();
        reply(res, { projects });
        return;
      }

      if (url === '/api/projects/rescan' && req.method === 'POST') {
        invalidateProjectCache();
        const projects = scanForProjects();
        reply(res, { projects });
        return;
      }

      // /api/projects/:encodedPath/snapshot
      const snapshotPrefix = '/api/projects/';
      if (url.startsWith(snapshotPrefix) && url.endsWith('/snapshot')) {
        const inner = url.slice(snapshotPrefix.length, -'/snapshot'.length);
        try {
          const projectPath = decodeURIComponent(inner);
          const snapshot = getProjectSnapshot(projectPath);
          if (!snapshot) { reply(res, { error: 'No InterAgent database found for this project.' }, 404); return; }
          reply(res, snapshot);
        } catch {
          reply(res, { error: 'Invalid project path' }, 400);
        }
        return;
      }

      // ── Core API (current workspace) ───────────────────────
      if (url === '/api/health' && req.method === 'GET') {
        reply(res, { status: 'ok', port });
      } else if (url === '/api/orientation' && req.method === 'GET') {
        reply(res, getOrientation());
      } else if (url === '/api/tasks' && req.method === 'GET') {
        reply(res, listTasks());
      } else if (url === '/api/tasks/create' && req.method === 'POST') {
        reply(res, createTask(await readBody(req)));
      } else if (url === '/api/tasks/claim' && req.method === 'POST') {
        reply(res, claimTask(await readBody(req)));
      } else if (url === '/api/tasks/update' && req.method === 'POST') {
        reply(res, updateTask(await readBody(req)));
      } else if (url === '/api/failures' && req.method === 'GET') {
        reply(res, listFailures());
      } else if (url === '/api/failures/log' && req.method === 'POST') {
        reply(res, logFailure(await readBody(req)));
      } else if (url === '/api/failures/check' && req.method === 'POST') {
        reply(res, checkFailures(await readBody(req)));
      } else if (url === '/api/artifacts' && req.method === 'GET') {
        reply(res, listArtifacts());
      } else if (url === '/api/artifacts/register' && req.method === 'POST') {
        reply(res, registerArtifact(await readBody(req)));
      } else if (url === '/api/working-memory' && req.method === 'GET') {
        reply(res, listWorkingMemory());
      } else if (url === '/api/memories' && req.method === 'GET') {
        reply(res, listMemories());
      } else if (url === '/api/memories/store' && req.method === 'POST') {
        reply(res, storeMemory(await readBody(req)));
      } else if (url === '/api/memories/search' && req.method === 'POST') {
        reply(res, searchMemories(await readBody(req)));
      } else if (url === '/api/sessions/start' && req.method === 'POST') {
        reply(res, startSession(await readBody(req)));
      } else if (url === '/api/sessions/end' && req.method === 'POST') {
        reply(res, endSession(await readBody(req)));
      } else if (url === '/api/memos' && req.method === 'GET') {
        reply(res, readMemos({}));
      } else if (url === '/api/memos/leave' && req.method === 'POST') {
        reply(res, leaveMemo(await readBody(req)));
      } else {
        reply(res, { error: 'Not Found' }, 404);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      reply(res, { error: msg }, 400);
    }
  });

  server.listen(port, '127.0.0.1');

  process.on('SIGINT', () => { server.close(); process.exit(0); });
  process.on('SIGTERM', () => { server.close(); process.exit(0); });

  return server;
}

// ---------------------------------------------------------------------------
// Direct run compat
// ---------------------------------------------------------------------------
const isDirectRun = process.argv[1] &&
  (process.argv[1].endsWith('api-server.js') || process.argv[1].endsWith('api-server.ts'));

if (isDirectRun) {
  const directPort = parseInt(process.argv[2] ?? '3737', 10);
  const server = startApiServer(directPort);
  server.on('listening', () => {
    process.stdout.write(`[InterAgent Broker] HTTP API listening on http://127.0.0.1:${directPort}\n`);
  });
}
