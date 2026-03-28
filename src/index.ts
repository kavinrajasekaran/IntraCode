import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  getOrientation,
  claimTask,
  updateTask,
  logFailure,
  checkFailures,
  registerArtifact,
} from './tools.js';

// ---------------------------------------------------------------------------
// Server definition
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'multi-agent-broker', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

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
