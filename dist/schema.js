import { z } from 'zod';
export const CreateTaskSchema = z.object({
    title: z.string().min(1).describe('The title/description of the new task.'),
    reasoning: z.string().optional().describe('Optional reasoning or context for this task.'),
});
export const ClaimTaskSchema = z.object({
    task_id: z.number().int().positive().describe('The ID of the task to claim.'),
    agent_name: z.string().min(1).describe('The name of the agent claiming the task.'),
});
export const UpdateTaskSchema = z.object({
    task_id: z.number().int().positive().describe('The ID of the task to update.'),
    status: z
        .enum(['pending', 'in-progress', 'done', 'failed', 'abandoned'])
        .describe('The new status for the task.'),
    agent_name: z.string().min(1).describe('The name of the agent updating the task.'),
    notes: z.string().optional().describe('Optional notes or reasoning for the status change.'),
});
export const LogFailureSchema = z.object({
    approach: z.string().min(1).describe('The approach or method that was tried and failed.'),
    reason: z.string().min(1).describe('The reason the approach failed.'),
    agent_name: z.string().min(1).describe('The name of the agent logging the failure.'),
});
export const CheckFailuresSchema = z.object({
    query: z.string().min(1).describe('A full-text search query to match against past failures.'),
});
export const RegisterArtifactSchema = z.object({
    name: z.string().min(1).describe('A short, human-readable name for the artifact.'),
    path: z.string().min(1).describe('The absolute or relative path to the artifact file.'),
    description: z.string().min(1).describe('A description of what this artifact is and its purpose.'),
    agent_name: z.string().min(1).describe('The name of the agent registering the artifact.'),
});
export const StoreMemorySchema = z.object({
    key: z.string().min(1).describe('A unique identifier for this memory (e.g. "auth-architecture").'),
    content: z.string().min(1).describe('The actual knowledge, rule, or decision to store.'),
    tags: z.array(z.string()).optional().describe('Optional tags for categorization (e.g. ["auth", "backend"]).'),
    agent_name: z.string().min(1).describe('The name of the agent storing the memory.'),
});
export const GetMemorySchema = z.object({
    key: z.string().min(1).describe('The unique key of the memory to fetch.'),
});
export const SearchMemoriesSchema = z.object({
    query: z.string().min(1).describe('Full-text search query across keys, content, and tags.'),
});
export const DeleteMemorySchema = z.object({
    key: z.string().min(1).describe('The unique key of the memory to delete.'),
});
export const StartSessionSchema = z.object({
    agent_name: z.string().min(1).describe('The name of the agent starting a session.'),
    goal: z.string().min(1).describe('The high-level goal of this working session.'),
});
export const EndSessionSchema = z.object({
    agent_name: z.string().min(1).describe('The name of the agent ending their session.'),
    status: z.enum(['completed', 'failed']).describe('The outcome of the session.'),
});
export const LogDecisionSchema = z.object({
    key: z.string().min(1).describe('Short unique slug for this decision, e.g. "use-postgres".'),
    decision: z.string().min(1).describe('What was decided.'),
    rationale: z.string().optional().describe('Why this decision was made.'),
    agent_name: z.string().min(1).describe('The agent making the decision.'),
});
export const LogProgressSchema = z.object({
    agent_name: z.string().min(1).describe('The name of the agent logging progress.'),
    summary: z.string().min(1).describe('A short description of what was just completed or accomplished.'),
});
export const AddTaskSchema = z.object({
    title: z.string().min(1).describe('Title of the new task to add to the board.'),
    reasoning: z.string().optional().describe('Why this task is needed.'),
    agent_name: z.string().min(1).describe('The agent creating the task.'),
});
export const LeaveMemoSchema = z.object({
    agent_name: z.string().min(1).describe('The agent leaving the memo.'),
    message: z.string().min(1).describe('The memo content.'),
    urgency: z.enum(['info', 'warning', 'blocker']).describe('Urgency level for this memo.'),
});
export const ReadMemosSchema = z.object({
    urgency_filter: z.enum(['info', 'warning', 'blocker']).optional().describe('Filter memos by urgency.'),
});
