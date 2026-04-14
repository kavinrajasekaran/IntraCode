# InterAgent

The shared brain for AI agents. A multi-agent coordination broker that gives every AI tool in your stack — IDE agents, Slack bots, CI pipelines — a shared memory, task queue, and decision log.

## Quick Start

```bash
# In any project directory
npx interagent

# Or install globally
npm install -g interagent
interagent
```

This starts the HTTP API server, opens the web dashboard, and your project is ready for multi-agent coordination.

## How It Works

InterAgent runs as a lightweight local server per project. It provides:

- **MCP Server** — Native integration with Cursor, Windsurf, Claude, and any MCP-compatible IDE
- **HTTP REST API** — For Slack bots, GitHub Actions, CI pipelines, or any external tool
- **Web Dashboard** — Real-time Kanban board, memory viewer, and activity feed
- **SQLite Database** — Zero-config, file-based persistence in your project root

```
┌─────────────────────────────────────────┐
│         InterAgent Server               │
│                                         │
│  ┌──────────┐  ┌────────┐  ┌────────┐  │
│  │ MCP API  │  │ HTTP   │  │ Web    │  │
│  │(for IDEs)│  │REST API│  │ Dash   │  │
│  └──────────┘  └────────┘  └────────┘  │
│           SQLite (per project)          │
└─────────────────────────────────────────┘
        ↑           ↑           ↑
   Cursor/    Slack Bot/    GitHub
   Windsurf   Jira/etc.    Actions
```

## Usage

### CLI Commands

```bash
# Start the server + dashboard (default)
interagent start

# Start with a custom port
interagent start --port 4000

# Start without opening the browser
interagent start --no-open

# Start the MCP server (for IDE integrations via stdio)
interagent mcp

# Check if the server is running
interagent status
```

### MCP Configuration

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "interagent": {
      "command": "npx",
      "args": ["interagent", "mcp"]
    }
  }
}
```

### REST API

All endpoints are available at `http://127.0.0.1:3737/api/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks/create` | Create a task |
| POST | `/api/tasks/claim` | Atomically claim a task |
| POST | `/api/tasks/update` | Update task status |
| GET | `/api/failures` | List logged failures |
| POST | `/api/failures/check` | Full-text search failures |
| GET | `/api/artifacts` | List registered artifacts |
| GET | `/api/memories` | List all memories |
| POST | `/api/memories/store` | Store a memory |
| POST | `/api/memories/search` | Search memories |
| GET | `/api/memos` | Read agent memos |
| POST | `/api/memos/leave` | Leave a memo |

## MCP Tools

When connected via MCP, AI agents get access to these tools:

| Tool | Purpose |
|------|---------|
| `get_orientation` | Get project context, pending tasks, and recent events |
| `claim_task` | Atomically claim a task (prevents conflicts) |
| `update_task` | Update task status and notes |
| `add_task` | Add a new task to the board |
| `log_failure` | Record a dead-end approach |
| `check_failures` | Search past failures before trying something |
| `log_decision` | Record an architectural decision |
| `log_progress` | Log what you just completed |
| `store_memory` | Store persistent project knowledge |
| `search_memories` | Search across all project memories |
| `register_artifact` | Register a file other agents may need |
| `leave_memo` | Leave a message for other agents |
| `read_memos` | Read messages from other agents |
| `start_session` / `end_session` | Track agent work sessions |

## Why InterAgent?

- **No duplicated work** — Agents claim tasks atomically
- **No repeated mistakes** — Failed approaches are logged and searchable
- **Shared context** — Decisions, rules, and knowledge persist across sessions
- **Any tool** — IDE agents, Slack bots, CI, and webhooks all use the same brain
- **Zero config** — `npx interagent` and you're running

## License

MIT
