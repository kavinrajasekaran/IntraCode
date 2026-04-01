import Database from 'better-sqlite3';
import path from 'path';
const dbPath = path.join(__dirname, '..', '.multi-agent-broker.db');
const db = new Database(dbPath);
console.log("Seeding Database at", dbPath);
// Clear everything first to start clean testing state?
// Let's not completely drop, just delete
db.prepare('DELETE FROM tasks').run();
db.prepare('DELETE FROM memories').run();
db.prepare('DELETE FROM failure_log').run();
db.prepare('DELETE FROM failure_search').run();
db.prepare('DELETE FROM artifact_registry').run();
db.prepare('DELETE FROM system_events').run();
// Seed Tasks
db.prepare('INSERT INTO tasks (title, reasoning, status, assigned_agent) VALUES (?, ?, ?, ?)').run('Initialize InterAgent MCP Extension logic', 'We need to get the core RPC transport working before the AI can take over.', 'done', 'Cursor');
db.prepare('INSERT INTO tasks (title, reasoning, status, assigned_agent) VALUES (?, ?, ?, ?)').run('Add UI for the Memos Tab', 'Agents need to read and write blockers easily natively in VS Code.', 'done', 'Antigravity');
db.prepare('INSERT INTO tasks (title, reasoning, status) VALUES (?, ?, ?)').run('Implement Semantic Search Memory (Vector DB)', 'FTS5 is okay but we really need true semantic embeddings for the knowledge base.', 'pending');
// Seed Memos
db.prepare(`INSERT INTO memories (key, content, tags, agent_name) VALUES (?, ?, ?, ?)`).run('agent/memo/' + Date.now().toString(36), 'The local SQLite database requires write permissions in the root directory. Ensure __dirname resolution works in the extension host context.', JSON.stringify(['memo', 'info']), 'Antigravity');
db.prepare(`INSERT INTO memories (key, content, tags, agent_name) VALUES (?, ?, ?, ?)`).run('agent/memo/' + (Date.now() + 1).toString(36), 'API Authentication is missing for the Claude MCP connection. I cannot test the smart context injection without tokens.', JSON.stringify(['memo', 'blocker']), 'Cursor');
// Seed generic Memories/Decisions
db.prepare(`INSERT INTO memories (key, content, tags, agent_name) VALUES (?, ?, ?, ?)`).run('arch-decision-sqlite', 'Using better-sqlite3 for local state because it requires zero config, runs synchronously, and fits cleanly inside the VS Code Extension sandboxed storage.', JSON.stringify(['decision', 'architecture']), 'Windsurf');
db.prepare(`INSERT INTO memories (key, content, tags, agent_name) VALUES (?, ?, ?, ?)`).run('code-style-ui', 'Dashboard styling MUST use CSS variables (--c-bg) exclusively to match VS Code dark mode. Do not hardcode #hex values.', JSON.stringify(['rule', 'frontend']), 'Antigravity');
// Seed Artifacts
db.prepare(`INSERT INTO artifact_registry (agent_name, name, path, description) VALUES (?, ?, ?, ?)`).run('Cursor', 'MCP System Prompts', 'AGENTS.md', 'The global alignment document that all AI agents read upon Session Start to understand their behavioral constraints.');
// Seed Failures
db.prepare(`INSERT INTO failure_log (agent_name, approach, reason) VALUES (?, ?, ?)`).run('Claude', 'Using process.cwd() for resolving the SQLite database location.', 'When spawned from inside VS Code, process.cwd() resolves to the root VS Code process directory, crashing the application. Use __dirname relative paths instead.');
console.log("Seeding complete. Enjoy the populated UI!");
