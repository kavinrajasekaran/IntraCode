import fs from 'fs';
import path from 'path';
import os from 'os';
// ---------------------------------------------------------------------------
// Signal detection
// ---------------------------------------------------------------------------
const AI_SIGNAL_FILES = [
    '.mcp.json',
    '.multi-agent-broker.db',
    'AGENTS.md',
    'AGENT.md',
    '.cursor',
    '.windsurfrules',
    '.github/copilot-instructions.md',
];
function detectSignals(dirPath) {
    const has = (rel) => {
        try {
            fs.accessSync(path.join(dirPath, rel));
            return true;
        }
        catch {
            return false;
        }
    };
    return {
        hasMcpJson: has('.mcp.json'),
        hasInterAgentDb: has('.multi-agent-broker.db'),
        hasAgentsMd: has('AGENTS.md') || has('AGENT.md'),
        hasCursorRules: has('.cursor') && fs.existsSync(path.join(dirPath, '.cursor')) && fs.statSync(path.join(dirPath, '.cursor')).isDirectory(),
        hasWindsurfRules: has('.windsurfrules'),
        hasCopilotInstructions: has('.github/copilot-instructions.md'),
    };
}
function hasAnySignal(signals) {
    return Object.values(signals).some(Boolean);
}
function readMcpConfig(dirPath) {
    const mcpPath = path.join(dirPath, '.mcp.json');
    try {
        const raw = fs.readFileSync(mcpPath, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function getLastModified(dirPath) {
    try {
        const stat = fs.statSync(dirPath);
        return stat.mtimeMs;
    }
    catch {
        return 0;
    }
}
// ---------------------------------------------------------------------------
// Directory scanner
// ---------------------------------------------------------------------------
function scanDirectory(dirPath, depth) {
    if (depth < 0)
        return [];
    let entries;
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const projects = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        // Skip hidden dirs, node_modules, common build dirs
        if (entry.name.startsWith('.'))
            continue;
        if (['node_modules', 'dist', 'build', '__pycache__', '.git', 'vendor', 'target'].includes(entry.name))
            continue;
        const fullPath = path.join(dirPath, entry.name);
        const signals = detectSignals(fullPath);
        if (hasAnySignal(signals)) {
            const mcpConfig = readMcpConfig(fullPath);
            projects.push({
                name: entry.name,
                path: fullPath,
                signals,
                mcpConfig,
                mcpServerCount: mcpConfig?.mcpServers ? Object.keys(mcpConfig.mcpServers).length : 0,
                hasInterAgentData: signals.hasInterAgentDb,
                lastModified: getLastModified(fullPath),
            });
        }
        else if (depth > 0) {
            // Only recurse deeper if no top-level signal found (avoid scanning into projects)
            const subProjects = scanDirectory(fullPath, depth - 1);
            projects.push(...subProjects);
        }
    }
    return projects;
}
// ---------------------------------------------------------------------------
// Root scan — searches common development directories
// ---------------------------------------------------------------------------
const SCAN_ROOTS = [
    { path: path.join(os.homedir(), 'Desktop', 'Projects'), depth: 1 },
    { path: path.join(os.homedir(), 'Desktop'), depth: 1 },
    { path: path.join(os.homedir(), 'Projects'), depth: 1 },
    { path: path.join(os.homedir(), 'projects'), depth: 1 },
    { path: path.join(os.homedir(), 'code'), depth: 1 },
    { path: path.join(os.homedir(), 'Code'), depth: 1 },
    { path: path.join(os.homedir(), 'dev'), depth: 1 },
    { path: path.join(os.homedir(), 'workspace'), depth: 1 },
    { path: path.join(os.homedir(), 'Documents'), depth: 2 },
];
let cachedProjects = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds
export function scanForProjects(additionalRoots = []) {
    const now = Date.now();
    if (cachedProjects && now - cacheTime < CACHE_TTL) {
        return cachedProjects;
    }
    const seen = new Set();
    const all = [];
    const roots = [
        ...SCAN_ROOTS,
        ...additionalRoots.map(p => ({ path: p, depth: 1 })),
    ];
    for (const root of roots) {
        if (!fs.existsSync(root.path))
            continue;
        const found = scanDirectory(root.path, root.depth);
        for (const p of found) {
            if (!seen.has(p.path)) {
                seen.add(p.path);
                all.push(p);
            }
        }
    }
    // Sort: most recently modified first
    all.sort((a, b) => b.lastModified - a.lastModified);
    cachedProjects = all;
    cacheTime = now;
    return all;
}
export function invalidateProjectCache() {
    cachedProjects = null;
    cacheTime = 0;
}
