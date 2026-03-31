"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let brokerProcess = null;
let statusBarItem;
let pollTimer;
// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function getNonce() {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++)
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    return text;
}
function getPort() {
    return vscode.workspace.getConfiguration('intercode').get('brokerPort', 3737);
}
function resolveBrokerPath() {
    const configured = vscode.workspace.getConfiguration('intercode').get('brokerPath', '');
    if (configured && fs.existsSync(configured))
        return configured;
    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
        for (const f of folders) {
            const candidate = path.join(f.uri.fsPath, 'dist', 'api-server.js');
            if (fs.existsSync(candidate))
                return candidate;
        }
    }
    // Relative to extension installation: extension/out/extension.js → InterCode/dist/api-server.js
    const fromExtension = path.join(__dirname, '..', '..', 'dist', 'api-server.js');
    if (fs.existsSync(fromExtension))
        return fromExtension;
    return null;
}
// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------
function setStatus(online) {
    if (online) {
        statusBarItem.text = '$(circle-filled) InterCode';
        statusBarItem.tooltip = `InterCode Broker running on port ${getPort()} — click to open dashboard`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
    }
    else {
        statusBarItem.text = '$(circle-outline) InterCode';
        statusBarItem.tooltip = 'InterCode Broker offline — click to open dashboard';
        statusBarItem.color = undefined;
        statusBarItem.backgroundColor = undefined;
    }
}
// ---------------------------------------------------------------------------
// Health check + polling
// ---------------------------------------------------------------------------
async function checkIsRunning(port) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' },
            signal: AbortSignal.timeout(1000)
        });
        return res.status === 200;
    }
    catch (err) {
        return false;
    }
}
async function checkIsRunningWithRetry(port, attempts, delayMs) {
    for (let i = 0; i < attempts; i++) {
        if (await checkIsRunning(port)) {
            return true;
        }
        await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
}
async function syncStatus() {
    const running = await checkIsRunning(getPort());
    setStatus(running);
}
function startPolling() {
    if (pollTimer)
        return;
    pollTimer = setInterval(syncStatus, 4000);
}
function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
    }
}
// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------
async function startBrokerServer(showPanel = true) {
    const port = getPort();
    // Already running externally (or from a previous extension activation)?
    if (await checkIsRunning(port)) {
        setStatus(true);
        if (showPanel)
            BrokerPanel.createOrShow(port);
        return;
    }
    // Already have a managed child process
    if (brokerProcess) {
        if (showPanel)
            BrokerPanel.createOrShow(port);
        return;
    }
    const brokerPath = resolveBrokerPath();
    if (!brokerPath) {
        if (showPanel) {
            vscode.window.showErrorMessage('InterCode: Cannot find api-server.js. ' +
                'Set intercode.brokerPath in settings to the absolute path of dist/api-server.js.');
            BrokerPanel.createOrShow(port); // open panel anyway so user can see config hint
        }
        return;
    }
    brokerProcess = (0, child_process_1.spawn)('node', [brokerPath, String(port)], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    brokerProcess.stderr?.on('data', (d) => process.stderr.write(`[InterCode] ${d}`));
    brokerProcess.stdout?.on('data', (d) => process.stdout.write(`[InterCode] ${d}`));
    brokerProcess.on('exit', async (code) => {
        brokerProcess = null;
        if (code !== 0 && code !== null) {
            // Give any existing broker instance (other IDE, MCP, etc.) a moment to respond.
            const alreadyRunning = await checkIsRunningWithRetry(port, 5, 400);
            if (alreadyRunning) {
                setStatus(true);
                // Another IDE owns this port — silently attach.
            }
            else {
                setStatus(false);
                // Only surface the warning when the user explicitly tried to start the server.
                if (showPanel) {
                    vscode.window.showWarningMessage(`InterCode Broker failed to start. Is port ${port} already in use by a non-broker process?`);
                }
            }
        }
        else {
            setStatus(false);
        }
    });
    // Open the panel immediately so the webview's own retry loop takes over.
    // The webview polls every 400ms for up to 15s on its own.
    if (showPanel)
        BrokerPanel.createOrShow(port);
    // Still sync status bar in background.
    checkIsRunningWithRetry(port, 15, 400).then(started => setStatus(started));
}
function stopBrokerServer() {
    if (brokerProcess) {
        brokerProcess.kill();
        brokerProcess = null;
    }
    setStatus(false);
}
// ---------------------------------------------------------------------------
// Webview panel
// ---------------------------------------------------------------------------
class BrokerPanel {
    static current;
    panel;
    disposables = [];
    static createOrShow(port) {
        // We need extensionUri — store it at activation time
        const uri = BrokerPanel._extensionUri;
        if (!uri)
            return;
        if (BrokerPanel.current) {
            BrokerPanel.current.panel.reveal(vscode.ViewColumn.One);
            return;
        }
        const panel = vscode.window.createWebviewPanel('intercodeBroker', 'InterCode Broker', vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true });
        BrokerPanel.current = new BrokerPanel(panel, uri, port);
    }
    static _extensionUri;
    constructor(panel, extensionUri, port) {
        this.panel = panel;
        this.panel.webview.html = this.buildHtml(extensionUri, port);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }
    buildHtml(extensionUri, port) {
        const mediaPath = path.join(extensionUri.fsPath, 'media', 'index.html');
        const nonce = getNonce();
        let html = fs.readFileSync(mediaPath, 'utf8');
        html = html.replace(/API_PORT/g, String(port));
        html = html.replace(/CSP_NONCE/g, nonce);
        return html;
    }
    dispose() {
        BrokerPanel.current = undefined;
        this.panel.dispose();
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }
}
// ---------------------------------------------------------------------------
// Activate / Deactivate
// ---------------------------------------------------------------------------
function activate(context) {
    BrokerPanel._extensionUri = context.extensionUri;
    // Status bar — always visible, click = start+open dashboard
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'intercode.openBroker';
    setStatus(false);
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(vscode.commands.registerCommand('intercode.openBroker', () => startBrokerServer(true)), vscode.commands.registerCommand('intercode.startServer', () => startBrokerServer(false)), vscode.commands.registerCommand('intercode.stopServer', stopBrokerServer));
    // Start polling to keep status badge in sync
    startPolling();
    context.subscriptions.push({ dispose: stopPolling });
    // Auto-start silently
    if (vscode.workspace.getConfiguration('intercode').get('autoStart', true)) {
        startBrokerServer(false);
    }
}
function deactivate() {
    stopPolling();
    stopBrokerServer();
}
