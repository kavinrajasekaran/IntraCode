import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  getOrientation,
  claimTask,
  updateTask,
  logFailure,
  checkFailures,
  registerArtifact,
  storeMemory,
  getMemory,
  searchMemories,
  deleteMemory,
  startSession,
  endSession,
  logDecision,
  logProgress,
  addTask,
  listTasks,
  listFailures,
  listArtifacts,
  listWorkingMemory,
  listMemories,
  leaveMemo,
  readMemos,
} from './tools.js';

// ---------------------------------------------------------------------------
// Server definition
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'multi-agent-broker', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'interagent://context',
      name: 'Project Context',
      mimeType: 'application/json',
      description: 'The global context, including tasks, active agents, and project rules.',
    },
    {
      uri: 'interagent://working-memory',
      name: 'Working Memory',
      mimeType: 'application/json',
      description: 'The most recent actions taken by agents across the project.',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  if (uri === 'interagent://context') {
    const data = getOrientation();
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
    };
  } else if (uri === 'interagent://working-memory') {
    const data = listWorkingMemory();
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
    };
  }
  throw new Error(`Unknown resource: ${uri}`);
});

// ---------------------------------------------------------------------------
// Tool listing
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_orientation',
      description:
        'Get a situational overview: global project context from CONTEXT.md, the 5 oldest pending tasks, and the 5 most recent working memory events. Call this first when starting a session.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'claim_task',
      description:
        'Atomically claim a pending task. Fails if the task is already in-progress or does not exist. Prevents two agents from working on the same task.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'number', description: 'The ID of the task to claim.' },
          agent_name: { type: 'string', description: 'Identifier for this agent.' },
        },
        required: ['task_id', 'agent_name'],
      },
    },
    {
      name: 'update_task',
      description:
        "Update a task's status (pending | in-progress | done | failed | abandoned) and optionally add notes.",
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'number', description: 'The ID of the task to update.' },
          status: {
            type: 'string',
            enum: ['pending', 'in-progress', 'done', 'failed', 'abandoned'],
            description: 'New status for the task.',
          },
          agent_name: { type: 'string', description: 'Identifier for this agent.' },
          notes: {
            type: 'string',
            description: 'Optional notes or reasoning for the change.',
          },
        },
        required: ['task_id', 'status', 'agent_name'],
      },
    },
    {
      name: 'log_failure',
      description:
        'Record a dead-end approach so other agents can avoid repeating the same mistake. Indexed for full-text search.',
      inputSchema: {
        type: 'object',
        properties: {
          approach: { type: 'string', description: 'The approach that was attempted.' },
          reason: { type: 'string', description: 'Why it failed.' },
          agent_name: { type: 'string', description: 'Identifier for this agent.' },
        },
        required: ['approach', 'reason', 'agent_name'],
      },
    },
    {
      name: 'check_failures',
      description:
        'Full-text search past failures to see if an approach has already been tried and failed. Returns up to 3 matches.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query matched against approach and reason fields.',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'register_artifact',
      description:
        'Register a produced file (code, config, doc) in the shared artifact registry. Upserts on path.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Human-readable name for the artifact.' },
          path: { type: 'string', description: 'File path to the artifact.' },
          description: { type: 'string', description: 'What this artifact is and its purpose.' },
          agent_name: { type: 'string', description: 'Identifier for this agent.' },
        },
        required: ['name', 'path', 'description', 'agent_name'],
      },
    },
    {
      name: 'store_memory',
      description: 'Store a generic piece of knowledge, rule, or architectural decision across sessions. Auto-merges on duplicate keys.',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'A unique identifier for this memory (e.g. "auth-architecture").' },
          content: { type: 'string', description: 'The actual knowledge, rule, or decision to store.' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional tags for categorization (e.g. ["auth", "backend"]).',
          },
          agent_name: { type: 'string', description: 'The name of the agent storing the memory.' },
        },
        required: ['key', 'content', 'agent_name'],
      },
    },
    {
      name: 'get_memory',
      description: 'Fetch exactly one memory by its unique key.',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The unique key of the memory to fetch.' },
        },
        required: ['key'],
      },
    },
    {
      name: 'search_memories',
      description: 'Full-text search across generic project memories (knowledge, decisions, rules). Returns max 10 matches.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Full-text search query across keys, content, and tags.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'delete_memory',
      description: 'Delete a specific generic memory by key.',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The unique key of the memory to delete.' },
        },
        required: ['key'],
      },
    },
    {
      name: 'start_session',
      description: 'Start a new coding/working session. Groups future actions together.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'The name of the agent starting a session.' },
          goal: { type: 'string', description: 'The high-level goal of this working session.' },
        },
        required: ['agent_name', 'goal'],
      },
    },
    {
      name: 'end_session',
      description: 'End your current active session. Doing this is required before ending a ticket.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'The name of the agent ending their session.' },
          status: { type: 'string', enum: ['completed', 'failed'], description: 'The outcome of the session.' },
        },
        required: ['agent_name', 'status'],
      },
    },
    {
      name: 'log_decision',
      description: 'Record an architectural or design decision into the shared memory with a "decision" tag. Use whenever you make a non-obvious technical choice.',
      inputSchema: {
        type: 'object',
        properties: {
          key:       { type: 'string', description: 'Short unique slug, e.g. "use-postgres".' },
          decision:  { type: 'string', description: 'What was decided.' },
          rationale: { type: 'string', description: 'Why this decision was made.' },
          agent_name: { type: 'string', description: 'Identifier for this agent.' },
        },
        required: ['key', 'decision', 'agent_name'],
      },
    },
    {
      name: 'log_progress',
      description: 'Log a short summary of what you just completed. Call this after finishing any meaningful step — writing a function, fixing a bug, completing a refactor, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'Identifier for this agent.' },
          summary: { type: 'string', description: 'What was just completed.' },
        },
        required: ['agent_name', 'summary'],
      },
    },
    {
      name: 'add_task',
      description: 'Add a new task to the shared Kanban board. Use when you discover work that needs to be done but is out of scope for your current task.',
      inputSchema: {
        type: 'object',
        properties: {
          title:      { type: 'string', description: 'Title of the task.' },
          reasoning:  { type: 'string', description: 'Why this task is needed.' },
          agent_name: { type: 'string', description: 'Identifier for this agent.' },
        },
        required: ['title', 'agent_name'],
      },
    },
    {
      name: 'leave_memo',
      description: 'Leave a memo for yourself or the next agent picking up this task. Useful for communicating blockers, logging a warning, or leaving a breadcrumb tail of context.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'Identifier for this agent.' },
          message:    { type: 'string', description: 'The memo content.' },
          urgency:    { type: 'string', enum: ['info', 'warning', 'blocker'], description: 'Urgency level for this memo.' },
        },
        required: ['agent_name', 'message', 'urgency'],
      },
    },
    {
      name: 'read_memos',
      description: 'Read the memos left by other agents across sessions.',
      inputSchema: {
        type: 'object',
        properties: {
          urgency_filter: { type: 'string', enum: ['info', 'warning', 'blocker'], description: 'Filter memos by urgency.' },
        },
      },
    },
  ],
}));

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: object;

    switch (name) {
      case 'get_orientation':
        result = getOrientation();
        break;
      case 'claim_task':
        result = claimTask(args);
        break;
      case 'update_task':
        result = updateTask(args);
        break;
      case 'log_failure':
        result = logFailure(args);
        break;
      case 'check_failures':
        result = checkFailures(args);
        break;
      case 'register_artifact':
        result = registerArtifact(args);
        break;
      case 'store_memory':
        result = storeMemory(args);
        break;
      case 'get_memory':
        result = getMemory(args);
        break;
      case 'search_memories':
        result = searchMemories(args);
        break;
      case 'delete_memory':
        result = deleteMemory(args);
        break;
      case 'start_session':
        result = startSession(args);
        break;
      case 'end_session':
        result = endSession(args);
        break;
      case 'log_decision':
        result = logDecision(args);
        break;
      case 'log_progress':
        result = logProgress(args);
        break;
      case 'add_task':
        result = addTask(args);
        break;
      case 'leave_memo':
        result = leaveMemo(args);
        break;
      case 'read_memos':
        result = readMemos(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only — stdout is owned by the MCP stdio transport
  process.stderr.write('Multi-Agent Broker MCP server started (stdio).\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
