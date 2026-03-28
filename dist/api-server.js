import http from 'http';
import { getOrientation, createTask, claimTask, updateTask, logFailure, checkFailures, registerArtifact, listTasks, listFailures, listArtifacts, listWorkingMemory, } from './tools.js';
const PORT = parseInt(process.argv[2] ?? '3737', 10);
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
    const url = req.url ?? '/';
    try {
        if (url === '/api/health' && req.method === 'GET') {
            reply(res, { status: 'ok', port: PORT });
        }
        else if (url === '/api/orientation' && req.method === 'GET') {
            reply(res, getOrientation());
        }
        else if (url === '/api/tasks' && req.method === 'GET') {
            reply(res, listTasks());
        }
        else if (url === '/api/tasks/create' && req.method === 'POST') {
            reply(res, createTask(await readBody(req)));
        }
        else if (url === '/api/tasks/claim' && req.method === 'POST') {
            reply(res, claimTask(await readBody(req)));
        }
        else if (url === '/api/tasks/update' && req.method === 'POST') {
            reply(res, updateTask(await readBody(req)));
        }
        else if (url === '/api/failures' && req.method === 'GET') {
            reply(res, listFailures());
        }
        else if (url === '/api/failures/log' && req.method === 'POST') {
            reply(res, logFailure(await readBody(req)));
        }
        else if (url === '/api/failures/check' && req.method === 'POST') {
            reply(res, checkFailures(await readBody(req)));
        }
        else if (url === '/api/artifacts' && req.method === 'GET') {
            reply(res, listArtifacts());
        }
        else if (url === '/api/artifacts/register' && req.method === 'POST') {
            reply(res, registerArtifact(await readBody(req)));
        }
        else if (url === '/api/memory' && req.method === 'GET') {
            reply(res, listWorkingMemory());
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
server.listen(PORT, '127.0.0.1', () => {
    process.stdout.write(`[IntraCode Broker] HTTP API listening on http://127.0.0.1:${PORT}\n`);
});
process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
