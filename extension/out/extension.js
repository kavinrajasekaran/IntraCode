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
    if (configured)
        return configured;
    // Auto-detect: look relative to workspace folders
    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
        for (const f of folders) {
            const candidate = path.join(f.uri.fsPath, 'dist', 'api-server.js');
            if (fs.existsSync(candidate))
                return candidate;
        }
    }
    // Last resort: relative to extension output dir (extension/out → IntraCode/dist)
    const fromExtension = path.join(__dirname, '..', '..', 'dist', 'api-server.js');
    if (fs.existsSync(fromExtension))
        return fromExtension;
    return null;
}
function setStatus(online) {
    statusBarItem.text = online ? '$(circle-filled) IntraCode Broker' : '$(circle-outline) IntraCode Broker';
    statusBarItem.tooltip = online ? `Broker running on port ${getPort()}` : 'Broker stopped — click to start';
    statusBarItem.backgroundColor = online
        ? undefined
        : new vscode.ThemeColor('statusBarItem.warningBackground');
}
function startBrokerServer() {
    if (brokerProcess)
        return;
    const brokerPath = resolveBrokerPath();
    if (!brokerPath) {
        vscode.window.showErrorMessage('IntraCode: Could not find dist/api-server.js. Run `npm run build` in the broker directory first, or set intracode.brokerPath in settings.');
        return;
    }
    brokerProcess = (0, child_process_1.spawn)('node', [brokerPath, String(getPort())], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    brokerProcess.stdout?.on('data', (d) => process.stdout.write(`[Broker] ${d}`));
    brokerProcess.stderr?.on('data', (d) => process.stderr.write(`[Broker] ${d}`));
    brokerProcess.on('exit', (code) => {
        brokerProcess = null;
        setStatus(false);
        if (code !== 0 && code !== null) {
            vscode.window.showWarningMessage(`IntraCode Broker exited (code ${code}).`);
        }
    });
    setStatus(true);
    vscode.window.showInformationMessage(`IntraCode Broker started on port ${getPort()}.`);
}
function stopBrokerServer() {
    if (!brokerProcess)
        return;
    brokerProcess.kill();
    brokerProcess = null;
    setStatus(false);
    vscode.window.showInformationMessage('IntraCode Broker stopped.');
}
// --------------------------------------------------------------------------
// Webview Panel
// --------------------------------------------------------------------------
class BrokerPanel {
    static current;
    panel;
    disposables = [];
    static createOrShow(extensionUri, port) {
        if (BrokerPanel.current) {
            BrokerPanel.current.panel.reveal(vscode.ViewColumn.One);
            return;
        }
        const panel = vscode.window.createWebviewPanel('intracodeBroker', 'IntraCode Broker', vscode.ViewColumn.One, { enableScripts: true });
        BrokerPanel.current = new BrokerPanel(panel, extensionUri, port);
    }
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
// --------------------------------------------------------------------------
// Activate
// --------------------------------------------------------------------------
function activate(context) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'intracode.openBroker';
    statusBarItem.show();
    setStatus(false);
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(vscode.commands.registerCommand('intracode.openBroker', () => BrokerPanel.createOrShow(context.extensionUri, getPort())), vscode.commands.registerCommand('intracode.startServer', startBrokerServer), vscode.commands.registerCommand('intracode.stopServer', stopBrokerServer));
    if (vscode.workspace.getConfiguration('intracode').get('autoStart', true)) {
        startBrokerServer();
    }
}
function deactivate() {
    stopBrokerServer();
}
