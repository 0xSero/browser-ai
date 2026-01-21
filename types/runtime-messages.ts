import type { RunPlan } from "./plan.js";

export const RUNTIME_MESSAGE_SCHEMA_VERSION = 2 as const;

export type RuntimeMessageBase = {
  schemaVersion: typeof RUNTIME_MESSAGE_SCHEMA_VERSION;
  runId: string;
  sessionId: string;
  turnId?: string;
  timestamp: number;
};

export const runStatusPhases = [
  "planning",
  "executing",
  "finalizing",
  "completed",
  "stopped",
  "failed",
] as const;

export type RunPhase = (typeof runStatusPhases)[number];

export type RetryCounts = {
  api: number;
  tool: number;
  finalize: number;
};

export type UserRunStart = RuntimeMessageBase & {
  type: "user_run_start";
  message: string;
};

export type AssistantStreamStart = RuntimeMessageBase & {
  type: "assistant_stream_start";
};

export type AssistantStreamDelta = RuntimeMessageBase & {
  type: "assistant_stream_delta";
  content: string;
  channel?: "text" | "reasoning";
};

export type AssistantStreamStop = RuntimeMessageBase & {
  type: "assistant_stream_stop";
};

export type ToolExecutionStart = RuntimeMessageBase & {
  type: "tool_execution_start";
  tool: string;
  id?: string;
  args: Record<string, unknown>;
};

export type ToolExecutionResult = RuntimeMessageBase & {
  type: "tool_execution_result";
  tool: string;
  id?: string;
  args?: Record<string, unknown>;
  result: unknown;
};

export type PlanUpdate = RuntimeMessageBase & {
  type: "plan_update";
  plan: RunPlan;
};

export type ManualPlanUpdate = RuntimeMessageBase & {
  type: "manual_plan_update";
  steps: Array<{
    title: string;
    status?: "pending" | "running" | "done" | "blocked";
    notes?: string;
  }>;
};

export type RunStatus = RuntimeMessageBase & {
  type: "run_status";
  phase: RunPhase;
  attempts: RetryCounts;
  maxRetries: RetryCounts;
  lastError?: string;
  note?: string;
};

export type AssistantResponse = RuntimeMessageBase & {
  type: "assistant_response";
  content: string;
  thinking?: string | null;
};

export type AssistantFinal = RuntimeMessageBase & {
  type: "assistant_final";
  content: string;
  thinking?: string | null;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  contextUsage?: {
    approxTokens?: number;
    contextLimit?: number;
    percent?: number;
  };
  responseMessages?: Array<Record<string, unknown>>;
};

export type RunError = RuntimeMessageBase & {
  type: "run_error";
  message: string;
};

export type RunWarning = RuntimeMessageBase & {
  type: "run_warning";
  message: string;
};

export type ContextCompacted = RuntimeMessageBase & {
  type: "context_compacted";
  summary: string;
  trimmedCount: number;
  preservedCount: number;
  newSessionId: string;
  contextMessages: Array<Record<string, unknown>>;
  contextUsage?: {
    approxTokens?: number;
    contextLimit?: number;
    percent?: number;
  };
};

export type SubagentStart = RuntimeMessageBase & {
  type: "subagent_start";
  id: string;
  name: string;
  tasks?: string[];
  parentRunId?: string;
};

export type SubagentComplete = RuntimeMessageBase & {
  type: "subagent_complete";
  id: string;
  success: boolean;
  summary?: string;
  parentRunId?: string;
};

export type RuntimeMessage =
  | UserRunStart
  | AssistantStreamStart
  | AssistantStreamDelta
  | AssistantStreamStop
  | ToolExecutionStart
  | ToolExecutionResult
  | PlanUpdate
  | ManualPlanUpdate
  | RunStatus
  | AssistantResponse
  | AssistantFinal
  | RunError
  | RunWarning
  | ContextCompacted
  | SubagentStart
  | SubagentComplete;

export const runtimeMessageTypes = [
  "user_run_start",
  "assistant_stream_start",
  "assistant_stream_delta",
  "assistant_stream_stop",
  "tool_execution_start",
  "tool_execution_result",
  "plan_update",
  "manual_plan_update",
  "run_status",
  "assistant_response",
  "assistant_final",
  "run_error",
  "run_warning",
  "context_compacted",
  "subagent_start",
  "subagent_complete",
] as const;

export type RuntimeMessageType = (typeof runtimeMessageTypes)[number];

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as {
    type?: string;
    schemaVersion?: number;
    runId?: string;
    sessionId?: string;
    timestamp?: number;
  };
  if (message.schemaVersion !== RUNTIME_MESSAGE_SCHEMA_VERSION) return false;
  if (typeof message.type !== "string") return false;
  if (!runtimeMessageTypes.includes(message.type as RuntimeMessageType))
    return false;
  if (typeof message.runId !== "string" || !message.runId) return false;
  if (typeof message.sessionId !== "string" || !message.sessionId) return false;
  if (typeof message.timestamp !== "number") return false;
  return true;
}
