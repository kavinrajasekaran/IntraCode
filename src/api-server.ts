import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getOrientation, createTask, claimTask, updateTask,
  logFailure, checkFailures, registerArtifact,
  storeMemory, getMemory, searchMemories, deleteMemory, startSession, endSession,
  listTasks, listFailures, listArtifacts, listWorkingMemory, listMemories,
  readMemos, leaveMemo
} from './tools.js';

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

// ---------------------------------------------------------------------------
// Dashboard HTML — loaded once at startup
// ---------------------------------------------------------------------------

function loadDashboardHtml(): string {
  // Try to find the dashboard HTML file relative to the dist directory
  const candidates = [
    path.join(__dirname, '..', 'dashboard', 'index.html'),
    path.join(__dirname, '..', 'standalone-dashboard.html'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8');
    }
  }

  // Fallback: return a redirect message
  return `<!DOCTYPE html><html><body>
    <h1>Dashboard not found</h1>
    <p>The dashboard HTML file could not be located. API is still accessible at /api/*</p>
  </body></html>`;
}

let dashboardHtml: string | null = null;

function getDashboardHtml(port: number): string {
  if (!dashboardHtml) {
    dashboardHtml = loadDashboardHtml();
  }
  // Replace the port placeholder if present
  return dashboardHtml.replace(/API_PORT/g, String(port));
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function startApiServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    const url = req.url ?? '/';

    try {
      // ── Dashboard routes ────────────────────────────────────
      if (url === '/' || url === '/dashboard' || url === '/dashboard/') {
        const html = getDashboardHtml(port);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.end(html);
        return;
      }

      // ── API routes ──────────────────────────────────────────
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
// Direct execution (backwards compat: `node dist/api-server.js [port]`)
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
