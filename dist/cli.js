#!/usr/bin/env node
import { startApiServer } from './api-server.js';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const command = args[0] || 'start';
function getFlag(name, fallback) {
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1])
        return args[idx + 1];
    return fallback;
}
const hasFlag = (name) => args.includes(name);
// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------
const HELP = `
  ⛓  InterAgent — Shared brain for AI agents

  Usage:
    interagent [command] [options]

  Commands:
    start       Start the HTTP API server + web dashboard (default)
    mcp         Start the MCP stdio server (for IDE integrations)
    status      Check if the broker is running

  Options:
    --port, -p  HTTP port (default: 3737)
    --dir, -d   Project/workspace directory (default: current directory)
    --no-open   Don't auto-open the dashboard in the browser
    --help, -h  Show this help message

  Examples:
    interagent                    # Start server on port 3737
    interagent start --port 4000  # Custom port
    interagent mcp                # Start MCP server for IDE
    interagent start --no-open    # Start without opening browser
`;
if (hasFlag('--help') || hasFlag('-h')) {
    console.log(HELP);
    process.exit(0);
}
// ---------------------------------------------------------------------------
// Resolve options
// ---------------------------------------------------------------------------
const port = parseInt(getFlag('--port', getFlag('-p', '3737')), 10);
const workspaceDir = path.resolve(getFlag('--dir', getFlag('-d', process.cwd())));
const autoOpen = !hasFlag('--no-open');
// Set workspace root for the DB module
process.env.INTERAGENT_WORKSPACE_ROOT = workspaceDir;
// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function commandStart() {
    const chalk = await tryImportChalk();
    printBanner(chalk);
    const server = startApiServer(port);
    server.on('listening', () => {
        const url = `http://127.0.0.1:${port}`;
        const dashUrl = `${url}/dashboard`;
        console.log('');
        if (chalk) {
            console.log(`  ${chalk.green('●')} HTTP API   ${chalk.cyan(url + '/api')}`);
            console.log(`  ${chalk.green('●')} Dashboard  ${chalk.cyan(dashUrl)}`);
            console.log(`  ${chalk.dim('●')} Workspace  ${chalk.dim(workspaceDir)}`);
            console.log(`  ${chalk.dim('●')} Database   ${chalk.dim(path.join(workspaceDir, '.multi-agent-broker.db'))}`);
        }
        else {
            console.log(`  ● HTTP API   ${url}/api`);
            console.log(`  ● Dashboard  ${dashUrl}`);
            console.log(`  ● Workspace  ${workspaceDir}`);
            console.log(`  ● Database   ${path.join(workspaceDir, '.multi-agent-broker.db')}`);
        }
        console.log('');
        if (chalk) {
            console.log(`  ${chalk.dim('Press Ctrl+C to stop.')}`);
        }
        else {
            console.log('  Press Ctrl+C to stop.');
        }
        console.log('');
        if (autoOpen) {
            openBrowser(dashUrl);
        }
    });
}
async function commandMcp() {
    // Dynamic import to avoid loading MCP SDK when not needed
    await import('./index.js');
}
async function commandStatus() {
    try {
        const resp = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (resp.ok) {
            console.log(`InterAgent broker is running on port ${port}.`);
            process.exit(0);
        }
        else {
            console.log(`InterAgent broker returned status ${resp.status}.`);
            process.exit(1);
        }
    }
    catch {
        console.log(`InterAgent broker is not running on port ${port}.`);
        process.exit(1);
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function printBanner(chalk) {
    if (chalk) {
        console.log('');
        console.log(`  ${chalk.bold.magenta('⛓  InterAgent')} ${chalk.dim('v1.0.0')}`);
        console.log(`  ${chalk.dim('The shared brain for your AI agents')}`);
    }
    else {
        console.log('');
        console.log('  ⛓  InterAgent v1.0.0');
        console.log('  The shared brain for your AI agents');
    }
}
function openBrowser(url) {
    try {
        const platform = process.platform;
        if (platform === 'darwin') {
            execSync(`open "${url}"`, { stdio: 'ignore' });
        }
        else if (platform === 'win32') {
            execSync(`start "" "${url}"`, { stdio: 'ignore' });
        }
        else {
            execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
        }
    }
    catch {
        // Silently fail if we can't open the browser
    }
}
async function tryImportChalk() {
    // Chalk is optional — used for pretty output but not required
    try {
        const mod = await import('chalk');
        return mod.default || mod;
    }
    catch {
        return null;
    }
}
// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------
switch (command) {
    case 'start':
        commandStart();
        break;
    case 'mcp':
        commandMcp();
        break;
    case 'status':
        commandStatus();
        break;
    default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
}
