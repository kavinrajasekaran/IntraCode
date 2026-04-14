import http from 'http';
import url from 'url';
import { getOrientation, createTask, claimTask, updateTask, logFailure, checkFailures, registerArtifact, storeMemory, getMemory, searchMemories, deleteMemory, startSession, endSession, listTasks, listFailures, listArtifacts, listWorkingMemory, listMemories, readMemos, leaveMemo, logDecision, logProgress, addTask, } from './tools.js';
import { getDashboardHTML } from './dashboard.js';
// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DEFAULT_PORT = 3737;
const PORT = parseInt(process.env.INTERAGENT_PORT ?? process.argv[2] ?? String(DEFAULT_PORT), 10);
// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function reply(res, data, status = 200) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(body);
}
function html(res, content) {
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
    });
    res.end(content);
}
async function readBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
            try {
                resolve(raw ? JSON.parse(raw) : {});
            }
            catch {
                reject(new Error('Invalid JSON'));
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
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
    const parsedUrl = url.parse(req.url ?? '/', true);
    const pathname = parsedUrl.pathname ?? '/';
    try {
        // ── Dashboard (serve at root) ─────────────────────────
        if (pathname === '/' && req.method === 'GET') {
            html(res, getDashboardHTML(PORT));
            return;
        }
        // ── REST API ──────────────────────────────────────────
        if (pathname === '/api/health' && req.method === 'GET') {
            reply(res, { status: 'ok', port: PORT, version: '2.0.0', mode: 'standalone' });
        }
        else if (pathname === '/api/orientation' && req.method === 'GET') {
            reply(res, getOrientation());
        }
        else if (pathname === '/api/tasks' && req.method === 'GET') {
            reply(res, listTasks());
        }
        else if (pathname === '/api/tasks/create' && req.method === 'POST') {
            reply(res, createTask(await readBody(req)));
        }
        else if (pathname === '/api/tasks/claim' && req.method === 'POST') {
            reply(res, claimTask(await readBody(req)));
        }
        else if (pathname === '/api/tasks/update' && req.method === 'POST') {
            reply(res, updateTask(await readBody(req)));
        }
        else if (pathname === '/api/failures' && req.method === 'GET') {
            reply(res, listFailures());
        }
        else if (pathname === '/api/failures/log' && req.method === 'POST') {
            reply(res, logFailure(await readBody(req)));
        }
        else if (pathname === '/api/failures/check' && req.method === 'POST') {
            reply(res, checkFailures(await readBody(req)));
        }
        else if (pathname === '/api/artifacts' && req.method === 'GET') {
            reply(res, listArtifacts());
        }
        else if (pathname === '/api/artifacts/register' && req.method === 'POST') {
            reply(res, registerArtifact(await readBody(req)));
        }
        else if (pathname === '/api/working-memory' && req.method === 'GET') {
            reply(res, listWorkingMemory());
        }
        else if (pathname === '/api/memories' && req.method === 'GET') {
            reply(res, listMemories());
        }
        else if (pathname === '/api/memories/store' && req.method === 'POST') {
            reply(res, storeMemory(await readBody(req)));
        }
        else if (pathname === '/api/memories/get' && req.method === 'POST') {
            reply(res, getMemory(await readBody(req)));
        }
        else if (pathname === '/api/memories/search' && req.method === 'POST') {
            reply(res, searchMemories(await readBody(req)));
        }
        else if (pathname === '/api/memories/delete' && req.method === 'POST') {
            reply(res, deleteMemory(await readBody(req)));
        }
        else if (pathname === '/api/sessions/start' && req.method === 'POST') {
            reply(res, startSession(await readBody(req)));
        }
        else if (pathname === '/api/sessions/end' && req.method === 'POST') {
            reply(res, endSession(await readBody(req)));
        }
        else if (pathname === '/api/decisions/log' && req.method === 'POST') {
            reply(res, logDecision(await readBody(req)));
        }
        else if (pathname === '/api/progress/log' && req.method === 'POST') {
            reply(res, logProgress(await readBody(req)));
        }
        else if (pathname === '/api/tasks/add' && req.method === 'POST') {
            reply(res, addTask(await readBody(req)));
        }
        else if (pathname === '/api/memos' && req.method === 'GET') {
            reply(res, readMemos({}));
        }
        else if (pathname === '/api/memos/leave' && req.method === 'POST') {
            reply(res, leaveMemo(await readBody(req)));
        }
        else {
            reply(res, { error: 'Not Found' }, 404);
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        reply(res, { error: msg }, 400);
    }
});
// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
server.listen(PORT, '127.0.0.1', () => {
    const dim = '\x1b[2m';
    const bold = '\x1b[1m';
    const purple = '\x1b[35m';
    const green = '\x1b[32m';
    const reset = '\x1b[0m';
    const cyan = '\x1b[36m';
    console.log('');
    console.log(`  ${purple}${bold}⛓  InterAgent Broker${reset}  ${dim}v2.0.0${reset}`);
    console.log('');
    console.log(`  ${green}→${reset} Dashboard:  ${cyan}http://127.0.0.1:${PORT}${reset}`);
    console.log(`  ${green}→${reset} REST API:   ${cyan}http://127.0.0.1:${PORT}/api${reset}`);
    console.log(`  ${green}→${reset} Health:     ${cyan}http://127.0.0.1:${PORT}/api/health${reset}`);
    console.log('');
    console.log(`  ${dim}Workspace: ${process.env.INTERAGENT_WORKSPACE_ROOT || process.cwd()}${reset}`);
    console.log(`  ${dim}Press Ctrl+C to stop${reset}`);
    console.log('');
});
process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
