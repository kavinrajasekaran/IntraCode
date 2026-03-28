import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let brokerProcess: ChildProcess | null = null;
let statusBarItem: vscode.StatusBarItem;

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}

function getPort(): number {
  return vscode.workspace.getConfiguration('intracode').get<number>('brokerPort', 3737);
}

function resolveBrokerPath(): string | null {
  const configured = vscode.workspace.getConfiguration('intracode').get<string>('brokerPath', '');
  if (configured) return configured;

  // Auto-detect: look relative to workspace folders
  const folders = vscode.workspace.workspaceFolders;
  if (folders) {
    for (const f of folders) {
      const candidate = path.join(f.uri.fsPath, 'dist', 'api-server.js');
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  // Last resort: relative to extension output dir (extension/out → IntraCode/dist)
  const fromExtension = path.join(__dirname, '..', '..', 'dist', 'api-server.js');
  if (fs.existsSync(fromExtension)) return fromExtension;

  return null;
}

function setStatus(online: boolean) {
  statusBarItem.text = online ? '$(circle-filled) IntraCode Broker' : '$(circle-outline) IntraCode Broker';
  statusBarItem.tooltip = online ? `Broker running on port ${getPort()}` : 'Broker stopped — click to start';
  statusBarItem.backgroundColor = online
    ? undefined
    : new vscode.ThemeColor('statusBarItem.warningBackground');
}

function startBrokerServer() {
  if (brokerProcess) return;

  const brokerPath = resolveBrokerPath();
  if (!brokerPath) {
    vscode.window.showErrorMessage(
      'IntraCode: Could not find dist/api-server.js. Run `npm run build` in the broker directory first, or set intracode.brokerPath in settings.'
    );
    return;
  }

  brokerProcess = spawn('node', [brokerPath, String(getPort())], {
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
  if (!brokerProcess) return;
  brokerProcess.kill();
  brokerProcess = null;
  setStatus(false);
  vscode.window.showInformationMessage('IntraCode Broker stopped.');
}

// --------------------------------------------------------------------------
// Webview Panel
// --------------------------------------------------------------------------

class BrokerPanel {
  static current: BrokerPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri, port: number) {
    if (BrokerPanel.current) {
      BrokerPanel.current.panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'intracodeBroker', 'IntraCode Broker',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    BrokerPanel.current = new BrokerPanel(panel, extensionUri, port);
  }

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

// --------------------------------------------------------------------------
// Activate
// --------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'intracode.openBroker';
  statusBarItem.show();
  setStatus(false);
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('intracode.openBroker', () =>
      BrokerPanel.createOrShow(context.extensionUri, getPort())
    ),
    vscode.commands.registerCommand('intracode.startServer', startBrokerServer),
    vscode.commands.registerCommand('intracode.stopServer', stopBrokerServer),
  );

  if (vscode.workspace.getConfiguration('intracode').get<boolean>('autoStart', true)) {
    startBrokerServer();
  }
}

export function deactivate() {
  stopBrokerServer();
}
