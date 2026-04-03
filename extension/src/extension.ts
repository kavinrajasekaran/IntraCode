import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

let brokerProcess: ChildProcess | null = null;
let statusBarItem: vscode.StatusBarItem;
let pollTimer: ReturnType<typeof setInterval> | undefined;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}

function getPort(): number {
  return vscode.workspace.getConfiguration('interagent').get<number>('brokerPort', 3737);
}

function resolveBrokerPath(): string | null {
  const configured = vscode.workspace.getConfiguration('interagent').get<string>('brokerPath', '');
  if (configured && fs.existsSync(configured)) return configured;

  const folders = vscode.workspace.workspaceFolders;
  if (folders) {
    for (const f of folders) {
      const candidate = path.join(f.uri.fsPath, 'dist', 'api-server.js');
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  // Relative to extension installation: extension/out/extension.js → InterAgent/dist/api-server.js
  const fromExtension = path.join(__dirname, '..', '..', 'dist', 'api-server.js');
  if (fs.existsSync(fromExtension)) return fromExtension;

  return null;
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function setStatus(online: boolean) {
  if (online) {
    statusBarItem.text = '$(circle-filled) InterAgent';
    statusBarItem.tooltip = `InterAgent Broker running on port ${getPort()} — click to open dashboard`;
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
  } else {
    statusBarItem.text = '$(circle-outline) InterAgent';
    statusBarItem.tooltip = 'InterAgent Broker offline — click to open dashboard';
    statusBarItem.color = undefined;
    statusBarItem.backgroundColor = undefined;
  }
}

// ---------------------------------------------------------------------------
// Health check + polling
// ---------------------------------------------------------------------------

async function checkIsRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, {
      headers: { 'Cache-Control': 'no-cache' }
    }, (res) => {
      res.resume(); // consume response data to free up memory
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function checkIsRunningWithRetry(port: number, attempts: number, delayMs: number): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await checkIsRunning(port)) { return true; }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function syncStatus() {
  const running = await checkIsRunning(getPort());
  setStatus(running);
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(syncStatus, 4000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = undefined; }
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

async function startBrokerServer(showPanel = true) {
  const port = getPort();

  // Already running externally (or from a previous extension activation)?
  if (await checkIsRunning(port)) {
    setStatus(true);
    if (showPanel) BrokerPanel.createOrShow(port);
    return;
  }

  // Already have a managed child process
  if (brokerProcess) {
    if (showPanel) BrokerPanel.createOrShow(port);
    return;
  }

  const brokerPath = resolveBrokerPath();
  if (!brokerPath) {
    if (showPanel) {
      vscode.window.showErrorMessage(
        'InterAgent: Cannot find api-server.js. ' +
        'Set interagent.brokerPath in settings to the absolute path of dist/api-server.js.'
      );
      BrokerPanel.createOrShow(port); // open panel anyway so user can see config hint
    }
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  brokerProcess = spawn('node', [brokerPath, String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: workspaceRoot,
    env: { ...process.env, INTERAGENT_WORKSPACE_ROOT: workspaceRoot },
  });

  brokerProcess.stderr?.on('data', (d) => process.stderr.write(`[InterAgent] ${d}`));
  brokerProcess.stdout?.on('data', (d) => process.stdout.write(`[InterAgent] ${d}`));

  brokerProcess.on('exit', async (code) => {
    brokerProcess = null;
    if (code !== 0 && code !== null) {
      // Give any existing broker instance (other IDE, MCP, etc.) a moment to respond.
      const alreadyRunning = await checkIsRunningWithRetry(port, 5, 400);
      if (alreadyRunning) {
        setStatus(true);
        // Another IDE owns this port — silently attach.
      } else {
        setStatus(false);
        // Only surface the warning when the user explicitly tried to start the server.
        if (showPanel) {
          vscode.window.showWarningMessage(
            `InterAgent Broker failed to start. Is port ${port} already in use by a non-broker process?`
          );
        }
      }
    } else {
      setStatus(false);
    }
  });

  // Open the panel immediately so the webview's own retry loop takes over.
  // The webview polls every 400ms for up to 15s on its own.
  if (showPanel) BrokerPanel.createOrShow(port);

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
  static current: BrokerPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(port: number) {
    // We need extensionUri — store it at activation time
    const uri = BrokerPanel._extensionUri;
    if (!uri) return;

    if (BrokerPanel.current) {
      BrokerPanel.current.panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'interagentBroker', 'InterAgent Broker',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    BrokerPanel.current = new BrokerPanel(panel, uri, port);
  }

  static _extensionUri: vscode.Uri | undefined;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, port: number) {
    this.panel = panel;
    this.panel.webview.html = this.buildHtml(extensionUri, port);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private buildHtml(extensionUri: vscode.Uri, port: number): string {
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

export function activate(context: vscode.ExtensionContext) {
  BrokerPanel._extensionUri = context.extensionUri;

  // Status bar — always visible, click = start+open dashboard
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'interagent.openBroker';
  setStatus(false);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('interagent.openBroker', () => startBrokerServer(true)),
    vscode.commands.registerCommand('interagent.startServer', () => startBrokerServer(false)),
    vscode.commands.registerCommand('interagent.stopServer', stopBrokerServer),
  );

  // Start polling to keep status badge in sync
  startPolling();
  context.subscriptions.push({ dispose: stopPolling });

  // Auto-start silently
  if (vscode.workspace.getConfiguration('interagent').get<boolean>('autoStart', true)) {
    startBrokerServer(false);
  }
}

export function deactivate() {
  stopPolling();
  stopBrokerServer();
}
