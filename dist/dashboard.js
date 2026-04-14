// ---------------------------------------------------------------------------
// dashboard.ts — Generates the full HTML for the InterAgent dashboard
// ---------------------------------------------------------------------------
export function getDashboardHTML(port) {
    const API = `http://127.0.0.1:${port}/api`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InterAgent — Broker Dashboard</title>
  <meta name="description" content="Real-time coordination dashboard for autonomous AI coding agents">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #09090f;
      --surface: #111118;
      --card: #18182a;
      --card-hover: #1f1f36;
      --border: rgba(255, 255, 255, 0.06);
      --border-active: rgba(124, 106, 247, 0.3);

      --accent: #7c6af7;
      --accent-soft: rgba(124, 106, 247, 0.12);
      --accent-glow: rgba(124, 106, 247, 0.25);

      --text: #e8eaf0;
      --text-secondary: #8b8fa4;
      --text-dim: #555873;

      --success: #34d399;
      --warning: #fbbf24;
      --danger: #f87171;
      --info: #60a5fa;

      --c-pending: #818cf8;
      --c-progress: #fbbf24;
      --c-done: #34d399;
      --c-failed: #f87171;
      --c-abandoned: #6b7280;

      --radius: 12px;
      --radius-sm: 8px;
      --radius-xs: 6px;
      --shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
      --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-size: 13px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Animated background ────────────────────────────── */
    body::before {
      content: '';
      position: fixed;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(ellipse at 20% 50%, rgba(124, 106, 247, 0.04) 0%, transparent 50%),
                  radial-gradient(ellipse at 80% 20%, rgba(96, 165, 250, 0.03) 0%, transparent 50%),
                  radial-gradient(ellipse at 50% 80%, rgba(52, 211, 153, 0.02) 0%, transparent 50%);
      animation: bgDrift 20s ease-in-out infinite alternate;
      pointer-events: none;
      z-index: 0;
    }
    @keyframes bgDrift {
      0% { transform: translate(0, 0) rotate(0deg); }
      100% { transform: translate(-5%, 3%) rotate(2deg); }
    }

    body > * { position: relative; z-index: 1; }

    /* ── Header ─────────────────────────────────────────── */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 24px;
      background: rgba(17, 17, 24, 0.8);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      gap: 16px;
    }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .logo {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 50%, #60a5fa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .version-badge {
      padding: 3px 8px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      background: var(--accent-soft);
      color: var(--accent);
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      transition: var(--transition);
    }
    .status-badge.online  { background: rgba(52, 211, 153, 0.12); color: var(--success); }
    .status-badge.offline { background: rgba(248, 113, 113, 0.12); color: var(--danger); }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    .status-badge.online .status-dot { animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    .header-actions { display: flex; gap: 8px; align-items: center; }

    .workspace-label {
      font-size: 11px;
      color: var(--text-dim);
      font-family: 'SF Mono', 'Fira Code', monospace;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 6px;
      border: 1px solid var(--border);
    }

    /* ── Buttons ─────────────────────────────────────────── */
    .btn {
      padding: 7px 16px;
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      transition: var(--transition);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn:active { transform: scale(0.97); }
    .btn-primary {
      background: var(--accent);
      color: #fff;
      box-shadow: 0 2px 12px var(--accent-glow);
    }
    .btn-primary:hover {
      background: #6d5de8;
      box-shadow: 0 4px 20px var(--accent-glow);
      transform: translateY(-1px);
    }
    .btn-ghost {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .btn-ghost:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border-color: rgba(255, 255, 255, 0.12);
    }
    .btn-sm { padding: 5px 12px; font-size: 11px; border-radius: var(--radius-xs); }
    .btn-xs { padding: 3px 8px; font-size: 10px; border-radius: 5px; }

    /* ── Stats bar ───────────────────────────────────────── */
    .stats-bar {
      display: flex;
      gap: 1px;
      padding: 0 24px;
      background: rgba(17, 17, 24, 0.5);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .stat {
      flex: 1;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .stat-icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .stat-icon.pending   { background: rgba(129, 140, 248, 0.12); }
    .stat-icon.progress  { background: rgba(251, 191, 36, 0.12); }
    .stat-icon.done      { background: rgba(52, 211, 153, 0.12); }
    .stat-icon.agents    { background: rgba(124, 106, 247, 0.12); }

    /* ── Main layout ────────────────────────────────────── */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    /* ── Kanban ──────────────────────────────────────────── */
    .kanban-wrap {
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 16px 20px;
      min-height: 0;
    }
    .kanban-wrap::-webkit-scrollbar { height: 6px; }
    .kanban-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    .kanban { display: flex; gap: 12px; height: 100%; min-width: fit-content; }

    .col {
      width: 260px;
      flex-shrink: 0;
      background: var(--surface);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: var(--transition);
    }
    .col:hover { border-color: rgba(255, 255, 255, 0.1); }

    .col-head {
      padding: 10px 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .col[data-s="pending"]     .col-head { color: var(--c-pending);  background: rgba(129, 140, 248, 0.08); }
    .col[data-s="in-progress"] .col-head { color: var(--c-progress); background: rgba(251, 191, 36, 0.08); }
    .col[data-s="done"]        .col-head { color: var(--c-done);     background: rgba(52, 211, 153, 0.08); }
    .col[data-s="failed"]      .col-head { color: var(--c-failed);   background: rgba(248, 113, 113, 0.08); }
    .col[data-s="abandoned"]   .col-head { color: var(--c-abandoned);background: rgba(107, 114, 128, 0.08); }

    .cnt {
      background: rgba(255, 255, 255, 0.08);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
    }

    .cards {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cards::-webkit-scrollbar { width: 3px; }
    .cards::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }

    .card {
      background: var(--card);
      border-radius: 10px;
      border: 1px solid var(--border);
      padding: 12px 14px;
      cursor: default;
      transition: var(--transition);
    }
    .card:hover {
      background: var(--card-hover);
      border-color: var(--border-active);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    }
    .card-id {
      font-size: 10px;
      color: var(--text-dim);
      margin-bottom: 4px;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .card-title { font-weight: 600; line-height: 1.5; margin-bottom: 6px; font-size: 12.5px; }
    .card-agent {
      font-size: 11px;
      color: var(--accent);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .card-date { font-size: 10px; color: var(--text-dim); margin-bottom: 8px; }
    .card-btns { display: flex; gap: 5px; flex-wrap: wrap; }

    .b-claim  { background: rgba(129, 140, 248, 0.15); color: #a5b4fc; border: 1px solid rgba(129, 140, 248, 0.2); }
    .b-claim:hover  { background: rgba(129, 140, 248, 0.25); }
    .b-update { background: rgba(251, 191, 36, 0.12); color: #fcd34d; border: 1px solid rgba(251, 191, 36, 0.2); }
    .b-update:hover { background: rgba(251, 191, 36, 0.22); }

    .empty {
      text-align: center;
      padding: 24px 12px;
      color: var(--text-dim);
      font-size: 11px;
      font-style: italic;
    }

    /* ── Bottom panel ────────────────────────────────────── */
    .bottom {
      flex-shrink: 0;
      height: 230px;
      border-top: 1px solid var(--border);
      background: rgba(17, 17, 24, 0.6);
      backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
    }
    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--border);
      padding: 0 20px;
      flex-shrink: 0;
      gap: 2px;
    }
    .tab {
      padding: 9px 16px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-dim);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      transition: var(--transition);
      position: relative;
    }
    .tab:hover { color: var(--text-secondary); }
    .tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    .tab-badge {
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 9px;
      font-weight: 700;
      background: rgba(248, 113, 113, 0.15);
      color: var(--danger);
    }

    .tab-content {
      display: none;
      overflow-y: auto;
      padding: 12px 20px;
      flex: 1;
      flex-direction: column;
      gap: 8px;
    }
    .tab-content.active { display: flex; }
    .tab-content::-webkit-scrollbar { width: 3px; }
    .tab-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 3px; }

    /* ── Search ──────────────────────────────────────────── */
    .search-row { display: flex; gap: 8px; flex-shrink: 0; margin-bottom: 6px; }
    input[type="text"], input[type="number"], textarea, select {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xs);
      padding: 8px 12px;
      color: var(--text);
      font-size: 12px;
      outline: none;
      font-family: inherit;
      transition: var(--transition);
      width: 100%;
    }
    input:focus, textarea:focus, select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    input::placeholder, textarea::placeholder { color: var(--text-dim); }
    textarea { resize: vertical; min-height: 60px; }
    select { cursor: pointer; }
    select option { background: var(--card); color: var(--text); }

    /* ── Items ───────────────────────────────────────────── */
    .item {
      background: var(--card);
      border-radius: var(--radius-sm);
      padding: 10px 14px;
      font-size: 12px;
      border-left: 3px solid var(--border);
      transition: var(--transition);
    }
    .item:hover { background: var(--card-hover); }
    .item.fail { border-left-color: var(--c-failed); }
    .item.art  { border-left-color: var(--accent); }
    .item.mem  { border-left-color: var(--c-pending); }
    .item.generic-mem { border-left-color: var(--c-progress); }
    .item.memo-item { border-left-color: var(--info); }
    .item.memo-item.blocker { border-left-color: var(--danger); }
    .item.memo-item.warning { border-left-color: var(--warning); }
    .item-title { font-weight: 600; margin-bottom: 3px; }
    .item-sub { color: var(--text-secondary); font-size: 11px; margin-top: 3px; line-height: 1.5; }
    .item-path {
      color: var(--text-dim);
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 10px;
      margin-top: 3px;
    }
    .item-meta { color: var(--text-dim); font-size: 10px; margin-top: 5px; display: flex; gap: 8px; align-items: center; }
    .tags-row { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
    .tag {
      padding: 2px 7px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 9px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    /* ── Modal ───────────────────────────────────────────── */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      opacity: 1;
      transition: opacity 0.2s;
    }
    .overlay.hidden { display: none; opacity: 0; }
    .modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px 28px;
      width: 420px;
      max-width: 92vw;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
      animation: modalIn 0.2s ease-out;
    }
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal h3 {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .field label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .modal-btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

    /* ── Toast ───────────────────────────────────────────── */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px 18px;
      font-size: 12px;
      z-index: 200;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.3s, transform 0.3s;
      max-width: 360px;
      line-height: 1.5;
      box-shadow: var(--shadow);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
    .toast.err { border-left: 3px solid var(--danger); }
    .toast.ok  { border-left: 3px solid var(--success); }

    /* ── Scrollbar global ───────────────────────────────── */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }

    /* ── Responsive ─────────────────────────────────────── */
    @media (max-width: 768px) {
      header { padding: 10px 16px; }
      .kanban-wrap { padding: 12px; }
      .col { width: 220px; }
      .bottom { height: 200px; }
      .workspace-label { display: none; }
    }
  </style>
</head>
<body>

<!-- Header -->
<header>
  <div class="header-left">
    <span class="logo">InterAgent</span>
    <span class="version-badge">v2.0</span>
    <span id="statusBadge" class="status-badge offline">
      <span class="status-dot"></span>
      <span id="statusText">Connecting…</span>
    </span>
  </div>
  <div class="header-actions">
    <span class="workspace-label" id="workspaceLabel" title="Workspace root">—</span>
    <button class="btn btn-ghost btn-sm" onclick="refresh()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      Refresh
    </button>
    <button class="btn btn-primary btn-sm" onclick="openModal('newTask')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Task
    </button>
  </div>
</header>

<!-- Stats Bar -->
<div class="stats-bar">
  <div class="stat">
    <div class="stat-icon pending">📋</div>
    <div><div class="stat-value" id="stat-pending">0</div><div class="stat-label">Pending</div></div>
  </div>
  <div class="stat">
    <div class="stat-icon progress">⚡</div>
    <div><div class="stat-value" id="stat-progress">0</div><div class="stat-label">In Progress</div></div>
  </div>
  <div class="stat">
    <div class="stat-icon done">✓</div>
    <div><div class="stat-value" id="stat-done">0</div><div class="stat-label">Completed</div></div>
  </div>
  <div class="stat">
    <div class="stat-icon agents">🤖</div>
    <div><div class="stat-value" id="stat-agents">0</div><div class="stat-label">Active Agents</div></div>
  </div>
</div>

<!-- Main Content -->
<div class="main">
  <!-- Kanban -->
  <div class="kanban-wrap">
    <div class="kanban">
      <div class="col" data-s="pending">
        <div class="col-head">Pending<span class="cnt" id="cnt-pending">0</span></div>
        <div class="cards" id="col-pending"></div>
      </div>
      <div class="col" data-s="in-progress">
        <div class="col-head">In Progress<span class="cnt" id="cnt-in-progress">0</span></div>
        <div class="cards" id="col-in-progress"></div>
      </div>
      <div class="col" data-s="done">
        <div class="col-head">Done<span class="cnt" id="cnt-done">0</span></div>
        <div class="cards" id="col-done"></div>
      </div>
      <div class="col" data-s="failed">
        <div class="col-head">Failed<span class="cnt" id="cnt-failed">0</span></div>
        <div class="cards" id="col-failed"></div>
      </div>
      <div class="col" data-s="abandoned">
        <div class="col-head">Abandoned<span class="cnt" id="cnt-abandoned">0</span></div>
        <div class="cards" id="col-abandoned"></div>
      </div>
    </div>
  </div>

  <!-- Bottom Tabs -->
  <div class="bottom">
    <div class="tab-bar">
      <button class="tab active" onclick="showTab('failures')">Failures</button>
      <button class="tab" onclick="showTab('artifacts')">Artifacts</button>
      <button class="tab" onclick="showTab('generic-memories')">Memories</button>
      <button class="tab" onclick="showTab('memos')">
        Memos<span class="tab-badge" id="memo-badge" style="display:none">0</span>
      </button>
      <button class="tab" onclick="showTab('memory')">Activity</button>
    </div>
    <div id="tab-failures" class="tab-content active">
      <div class="search-row">
        <input id="failQ" type="text" placeholder="Search past failures…" onkeydown="if(event.key==='Enter')searchFail()">
        <button class="btn btn-ghost btn-sm" onclick="searchFail()">Search</button>
        <button class="btn btn-ghost btn-sm" onclick="loadFail()">All</button>
      </div>
      <div id="failList"></div>
    </div>
    <div id="tab-artifacts" class="tab-content">
      <div id="artList"></div>
    </div>
    <div id="tab-generic-memories" class="tab-content">
      <div class="search-row">
        <input id="memQ" type="text" placeholder="Search knowledge, decisions, rules…" onkeydown="if(event.key==='Enter')searchMemories()">
        <button class="btn btn-ghost btn-sm" onclick="searchMemories()">Search</button>
        <button class="btn btn-ghost btn-sm" onclick="loadMemories()">All</button>
      </div>
      <div id="genericMemList"></div>
    </div>
    <div id="tab-memos" class="tab-content">
      <div id="memoList"></div>
    </div>
    <div id="tab-memory" class="tab-content">
      <div id="memList"></div>
    </div>
  </div>
</div>

<!-- New Task Modal -->
<div id="overlay-newTask" class="overlay hidden" onclick="closeModal('newTask',event)">
  <div class="modal" onclick="event.stopPropagation()">
    <h3>📋 Create New Task</h3>
    <div class="field"><label>Title</label><input id="nt-title" type="text" placeholder="What needs to be done?"></div>
    <div class="field"><label>Reasoning (optional)</label><textarea id="nt-reason" placeholder="Why is this task important?"></textarea></div>
    <div class="modal-btns">
      <button class="btn btn-ghost btn-sm" onclick="closeModal('newTask')">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="createTask()">Create Task</button>
    </div>
  </div>
</div>

<!-- Claim Task Modal -->
<div id="overlay-claim" class="overlay hidden" onclick="closeModal('claim',event)">
  <div class="modal" onclick="event.stopPropagation()">
    <h3>🤖 Claim Task <span id="claim-id" style="color:var(--text-dim)"></span></h3>
    <div class="field"><label>Your Agent Name</label><input id="claim-agent" type="text" placeholder="e.g. Cursor, Windsurf, Antigravity"></div>
    <div class="modal-btns">
      <button class="btn btn-ghost btn-sm" onclick="closeModal('claim')">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="submitClaim()">Claim</button>
    </div>
  </div>
</div>

<!-- Update Task Modal -->
<div id="overlay-update" class="overlay hidden" onclick="closeModal('update',event)">
  <div class="modal" onclick="event.stopPropagation()">
    <h3>✏️ Update Task <span id="update-id" style="color:var(--text-dim)"></span></h3>
    <div class="field"><label>Agent Name</label><input id="upd-agent" type="text" placeholder="e.g. Cursor"></div>
    <div class="field">
      <label>New Status</label>
      <select id="upd-status">
        <option value="pending">Pending</option>
        <option value="in-progress">In Progress</option>
        <option value="done">Done</option>
        <option value="failed">Failed</option>
        <option value="abandoned">Abandoned</option>
      </select>
    </div>
    <div class="field"><label>Notes (optional)</label><textarea id="upd-notes" placeholder="What happened?"></textarea></div>
    <div class="modal-btns">
      <button class="btn btn-ghost btn-sm" onclick="closeModal('update')">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="submitUpdate()">Update</button>
    </div>
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
  const API = '${API}';
  let claimTaskId = null;
  let updateTaskId = null;

  // ── Fetch helpers ──────────────────────────────────────
  async function get(path) {
    const r = await fetch(API + path);
    return r.json();
  }
  async function post(path, body) {
    const r = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  // ── Toast ──────────────────────────────────────────────
  let toastTimer;
  function toast(msg, ok = true) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (ok ? 'ok' : 'err');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.className = 'toast', 3500);
  }

  // ── Formatting ─────────────────────────────────────────
  function fmt(dt) {
    if (!dt) return '';
    const iso = dt.replace(' ', 'T') + (dt.endsWith('Z') ? '' : 'Z');
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;

    // Relative time for recent events
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';

    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Status ─────────────────────────────────────────────
  async function checkHealth() {
    try {
      const data = await get('/health');
      const b = document.getElementById('statusBadge');
      b.className = 'status-badge online';
      document.getElementById('statusText').textContent = 'Online';
    } catch {
      const b = document.getElementById('statusBadge');
      b.className = 'status-badge offline';
      document.getElementById('statusText').textContent = 'Offline';
    }
  }

  // ── Stats ──────────────────────────────────────────────
  function updateStats(tasks) {
    const pending = tasks.filter(t => t.status === 'pending').length;
    const progress = tasks.filter(t => t.status === 'in-progress').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const agents = new Set(tasks.filter(t => t.assigned_agent).map(t => t.assigned_agent)).size;

    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-progress').textContent = progress;
    document.getElementById('stat-done').textContent = done;
    document.getElementById('stat-agents').textContent = agents;
  }

  // ── Kanban ─────────────────────────────────────────────
  function renderKanban(tasks) {
    updateStats(tasks);
    const cols = { 'pending': [], 'in-progress': [], 'done': [], 'failed': [], 'abandoned': [] };
    tasks.forEach(t => (cols[t.status] ?? cols['abandoned']).push(t));
    for (const [status, items] of Object.entries(cols)) {
      document.getElementById('cnt-' + status).textContent = items.length;
      const el = document.getElementById('col-' + status);
      if (!items.length) { el.innerHTML = '<div class="empty">No tasks</div>'; continue; }
      el.innerHTML = items.map(t => \`
        <div class="card">
          <div class="card-id">#\${t.id}</div>
          <div class="card-title">\${esc(t.title)}</div>
          \${t.assigned_agent ? \`<div class="card-agent">🤖 \${esc(t.assigned_agent)}</div>\` : ''}
          <div class="card-date">\${fmt(t.created_at)}</div>
          <div class="card-btns">
            \${status === 'pending' ? \`<button class="btn btn-xs b-claim" onclick="openClaim(\${t.id})">Claim</button>\` : ''}
            <button class="btn btn-xs b-update" onclick="openUpdate(\${t.id}, '\${status}')">Update</button>
          </div>
        </div>\`).join('');
    }
  }

  // ── Bottom tabs ────────────────────────────────────────
  const tabNames = ['failures','artifacts','generic-memories','memos','memory'];
  function showTab(name) {
    document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', tabNames[i] === name));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    if (name === 'artifacts') loadArtifacts();
    if (name === 'memory')    loadMemory();
    if (name === 'failures')  loadFail();
    if (name === 'generic-memories') loadMemories();
    if (name === 'memos')     loadMemos();
  }

  // ── Failures ───────────────────────────────────────────
  function renderFail(items) {
    const el = document.getElementById('failList');
    if (!items.length) { el.innerHTML = '<div class="empty">No failures logged yet — that\\'s a good thing.</div>'; return; }
    el.innerHTML = items.map(f => \`
      <div class="item fail">
        <div class="item-title">\${esc(f.approach)}</div>
        <div class="item-sub">\${esc(f.reason)}</div>
        <div class="item-meta"><span>🤖 \${esc(f.agent_name)}</span><span>\${fmt(f.created_at)}</span></div>
      </div>\`).join('');
  }
  async function loadFail() {
    const d = await get('/failures');
    renderFail(d.failures ?? []);
  }
  async function searchFail() {
    const q = document.getElementById('failQ').value.trim();
    if (!q) { loadFail(); return; }
    const d = await post('/failures/check', { query: q });
    renderFail(d.results ?? []);
  }

  // ── Artifacts ──────────────────────────────────────────
  async function loadArtifacts() {
    const d = await get('/artifacts');
    const el = document.getElementById('artList');
    const items = d.artifacts ?? [];
    if (!items.length) { el.innerHTML = '<div class="empty">No artifacts registered.</div>'; return; }
    el.innerHTML = items.map(a => \`
      <div class="item art">
        <div class="item-title">\${esc(a.name)}</div>
        <div class="item-path">\${esc(a.path)}</div>
        <div class="item-sub">\${esc(a.description)}</div>
        <div class="item-meta"><span>🤖 \${esc(a.agent_name)}</span><span>\${fmt(a.created_at)}</span></div>
      </div>\`).join('');
  }

  // ── Working Memory (Activity) ──────────────────────────
  async function loadMemory() {
    const d = await get('/working-memory');
    const el = document.getElementById('memList');
    const items = d.events ?? [];
    if (!items.length) { el.innerHTML = '<div class="empty">No activity yet.</div>'; return; }
    el.innerHTML = items.map(m => \`
      <div class="item mem">
        <div class="item-title">\${esc(m.event_description)}</div>
        <div class="item-meta"><span>🤖 \${esc(m.agent_name)}</span><span>\${fmt(m.created_at)}</span></div>
      </div>\`).join('');
  }

  // ── Memories ───────────────────────────────────────────
  function renderMemories(items) {
    const el = document.getElementById('genericMemList');
    if (!items.length) { el.innerHTML = '<div class="empty">No memories stored.</div>'; return; }
    el.innerHTML = items.map(m => {
      const tags = m.tags ? JSON.parse(m.tags) : [];
      return \`
      <div class="item generic-mem">
        <div class="item-title">\${esc(m.key)}</div>
        <div class="item-sub" style="white-space:pre-wrap">\${esc(m.content)}</div>
        \${tags.length ? \`<div class="tags-row">\${tags.map(t => \`<span class="tag">\${esc(t)}</span>\`).join('')}</div>\` : ''}
        <div class="item-meta"><span>🤖 \${esc(m.agent_name)}</span><span>\${fmt(m.updated_at)}</span></div>
      </div>\`;
    }).join('');
  }
  async function loadMemories() {
    const d = await get('/memories');
    renderMemories(d.memories ?? []);
  }
  async function searchMemories() {
    const q = document.getElementById('memQ').value.trim();
    if (!q) { loadMemories(); return; }
    const d = await post('/memories/search', { query: q });
    renderMemories(d.results ?? []);
  }

  // ── Memos ──────────────────────────────────────────────
  async function loadMemos() {
    const d = await get('/memos');
    const el = document.getElementById('memoList');
    const items = d.memos ?? [];
    const badge = document.getElementById('memo-badge');
    if (d.blockers > 0) {
      badge.style.display = 'inline';
      badge.textContent = d.blockers;
    } else {
      badge.style.display = 'none';
    }
    if (!items.length) { el.innerHTML = '<div class="empty">No memos — agents are working independently.</div>'; return; }
    el.innerHTML = items.map(m => \`
      <div class="item memo-item \${m.urgency}">
        <div class="item-title">\${esc(m.message)}</div>
        <div class="item-meta">
          <span>🤖 \${esc(m.author)}</span>
          <span class="tag" style="text-transform:uppercase">\${esc(m.urgency)}</span>
          <span>\${fmt(m.created)}</span>
        </div>
      </div>\`).join('');
  }

  // ── Modals ─────────────────────────────────────────────
  function openModal(name) { document.getElementById('overlay-' + name).classList.remove('hidden'); }
  function closeModal(name, evt) {
    if (evt && evt.target !== document.getElementById('overlay-' + name)) return;
    document.getElementById('overlay-' + name).classList.add('hidden');
  }

  async function createTask() {
    const title  = document.getElementById('nt-title').value.trim();
    const reason = document.getElementById('nt-reason').value.trim();
    if (!title) { toast('Title is required.', false); return; }
    const d = await post('/tasks/create', { title, reasoning: reason || undefined });
    if (d.error) { toast(d.error, false); return; }
    toast('Task #' + d.task.id + ' created.');
    document.getElementById('nt-title').value = '';
    document.getElementById('nt-reason').value = '';
    closeModal('newTask');
    refresh();
  }

  function openClaim(id) {
    claimTaskId = id;
    document.getElementById('claim-id').textContent = '#' + id;
    document.getElementById('claim-agent').value = '';
    openModal('claim');
  }
  async function submitClaim() {
    const agent_name = document.getElementById('claim-agent').value.trim();
    if (!agent_name) { toast('Agent name required.', false); return; }
    const d = await post('/tasks/claim', { task_id: claimTaskId, agent_name });
    if (d.error) { toast(d.error, false); return; }
    toast('Task #' + claimTaskId + ' claimed by ' + agent_name + '.');
    closeModal('claim');
    refresh();
  }

  function openUpdate(id, status) {
    updateTaskId = id;
    document.getElementById('update-id').textContent = '#' + id;
    document.getElementById('upd-status').value = status;
    document.getElementById('upd-agent').value = '';
    document.getElementById('upd-notes').value = '';
    openModal('update');
  }
  async function submitUpdate() {
    const agent_name = document.getElementById('upd-agent').value.trim();
    const status     = document.getElementById('upd-status').value;
    const notes      = document.getElementById('upd-notes').value.trim();
    if (!agent_name) { toast('Agent name required.', false); return; }
    const d = await post('/tasks/update', { task_id: updateTaskId, status, agent_name, notes: notes || undefined });
    if (d.error) { toast(d.error, false); return; }
    toast('Task #' + updateTaskId + ' → ' + status);
    closeModal('update');
    refresh();
  }

  // ── Refresh ────────────────────────────────────────────
  async function refresh() {
    await checkHealth();
    try {
      const d = await get('/tasks');
      renderKanban(d.tasks ?? []);
      loadFail();
      loadMemos();

      // Update workspace label
      const o = await get('/orientation');
      if (o.global_context) {
        const lines = o.global_context.split('\\n');
        const first = lines.find(l => l.trim().length > 0) || '';
        document.getElementById('workspaceLabel').textContent = first.replace(/^#\\s*/, '').slice(0, 50);
        document.getElementById('workspaceLabel').title = first;
      }
    } catch (e) {
      // Server might be down
    }
  }

  // ── Keyboard shortcuts ─────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden'));
    }
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      openModal('newTask');
    }
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      refresh();
    }
  });

  // ── Boot ───────────────────────────────────────────────
  refresh();
  setInterval(refresh, 6000);
</script>
</body>
</html>`;
}
