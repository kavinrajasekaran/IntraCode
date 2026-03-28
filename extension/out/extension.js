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
const http = __importStar(require("http"));
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
    return vscode.workspace.getConfiguration('intracode').get('brokerPort', 3737);
}
function resolveBrokerPath() {
    const configured = vscode.workspace.getConfiguration('intracode').get('brokerPath', '');
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
    // Relative to extension installation: extension/out/extension.js → IntraCode/dist/api-server.js
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
        statusBarItem.text = '$(circle-filled) IntraCode';
        statusBarItem.tooltip = `IntraCode Broker running on port ${getPort()} — click to open dashboard`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
    }
    else {
        statusBarItem.text = '$(circle-outline) IntraCode';
        statusBarItem.tooltip = 'IntraCode Broker offline — click to open dashboard';
        statusBarItem.color = undefined;
        statusBarItem.backgroundColor = undefined;
    }
}
// ---------------------------------------------------------------------------
// Health check + polling
// ---------------------------------------------------------------------------
function checkIsRunning(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/api/health`, { timeout: 1000 }, (res) => {
            resolve(res.statusCode === 200);
            res.resume();
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
    });
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
async function startBrokerServer() {
    const port = getPort();
    // Already running externally (or from a previous extension activation)?
    if (await checkIsRunning(port)) {
        setStatus(true);
        // Ensure panel is open
        BrokerPanel.createOrShow(port);
        return;
    }
    // Already have a managed child process
    if (brokerProcess) {
        BrokerPanel.createOrShow(port);
        return;
    }
    const brokerPath = resolveBrokerPath();
    if (!brokerPath) {
        vscode.window.showErrorMessage('IntraCode: Cannot find api-server.js. ' +
            'Set intracode.brokerPath in settings to the absolute path of dist/api-server.js.');
        BrokerPanel.createOrShow(port); // open panel anyway so user can see config hint
        return;
    }
    brokerProcess = (0, child_process_1.spawn)('node', [brokerPath, String(port)], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    brokerProcess.stderr?.on('data', (d) => process.stderr.write(`[IntraCode] ${d}`));
    brokerProcess.stdout?.on('data', (d) => process.stdout.write(`[IntraCode] ${d}`));
    brokerProcess.on('exit', async (code) => {
        brokerProcess = null;
        if (code !== 0 && code !== null) {
            // Before showing an error, check if another IDE already owns the port.
            // This is the normal multi-agent scenario (Cursor started it, Antigravity joins it).
            const alreadyRunning = await checkIsRunning(port);
            if (alreadyRunning) {
                setStatus(true);
                // Silently attached — no error shown
            }
            else {
                setStatus(false);
                vscode.window.showWarningMessage(`IntraCode Broker failed to start. Is port ${port} already in use by a non-broker process?`);
            }
        }
        else {
            setStatus(false);
        }
    });
    // Wait a moment, then confirm it really started (or was already running)
    await new Promise((r) => setTimeout(r, 700));
    const started = await checkIsRunning(port);
    setStatus(started);
    BrokerPanel.createOrShow(port);
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
        const panel = vscode.window.createWebviewPanel('intracodeBroker', 'IntraCode Broker', vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true });
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
    statusBarItem.command = 'intracode.openBroker';
    setStatus(false);
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(vscode.commands.registerCommand('intracode.openBroker', startBrokerServer), vscode.commands.registerCommand('intracode.startServer', startBrokerServer), vscode.commands.registerCommand('intracode.stopServer', stopBrokerServer));
    // Start polling to keep status badge in sync
    startPolling();
    context.subscriptions.push({ dispose: stopPolling });
    // Auto-start
    if (vscode.workspace.getConfiguration('intracode').get('autoStart', true)) {
        startBrokerServer();
    }
}
function deactivate() {
    stopPolling();
    stopBrokerServer();
}
