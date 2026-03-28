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
