/**
 * ACPX TypeScript Types
 * 
 * Type definitions matching acpx's exported types for dashboard integration.
 * These types are the foundation for all integration with AcpRuntimeManager.
 */

// ============================================================================
// Utility Types
// ============================================================================

/**
 * A value that can be either synchronous or asynchronous.
 */
export type MaybePromise<T> = T | Promise<T>;

// ============================================================================
// Session Types
// ============================================================================

/**
 * Primary session storage type containing all session metadata and conversation history.
 */
export interface SessionRecord {
  /** Schema version identifier */
  schema: "acpx.session.v1";
  /** Unique record identifier */
  acpxRecordId: string;
  /** ACP protocol session ID */
  acpSessionId: string;
  /** Agent-specific session ID */
  agentSessionId?: string;
  /** Command used to start agent */
  agentCommand: string;
  /** Working directory */
  cwd: string;
  /** Optional session name */
  name?: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  lastUsedAt: string;
  /** Last event sequence number */
  lastSeq: number;
  /** Last request ID */
  lastRequestId?: string;
  /** Event log metadata */
  eventLog: SessionEventLog;
  /** Session closed flag */
  closed?: boolean;
  /** ISO timestamp when closed */
  closedAt?: string;
  /** Process ID */
  pid?: number;
  /** ISO timestamp */
  agentStartedAt?: string;
  /** ISO timestamp */
  lastPromptAt?: string;
  /** Agent exit code */
  lastAgentExitCode?: number | null;
  /** Agent exit signal */
  lastAgentExitSignal?: NodeJS.Signals | null;
  /** ISO timestamp */
  lastAgentExitAt?: string;
  /** Agent disconnect reason */
  lastAgentDisconnectReason?: string;
  /** Protocol version */
  protocolVersion?: number;
  /** Agent capabilities */
  agentCapabilities?: AgentCapabilities;
  /** Session title */
  title?: string | null;
  /** Conversation messages */
  messages: SessionMessage[];
  /** ISO timestamp */
  updated_at: string;
  /** Cumulative token usage */
  cumulative_token_usage: SessionTokenUsage;
  /** Per-request token usage */
  request_token_usage: Record<string, SessionTokenUsage>;
  /** acpx-specific state */
  acpx?: SessionAcpxState;
}

/**
 * Union type for conversation messages.
 */
export type SessionMessage =
  | { User: SessionUserMessage }
  | { Agent: SessionAgentMessage }
  | "Resume";

/**
 * User message content.
 */
export interface SessionUserMessage {
  id: string;
  content: SessionUserContent[];
}

/**
 * Agent message content.
 */
export interface SessionAgentMessage {
  content: SessionAgentContent[];
  tool_results: Record<string, SessionToolResult>;
  reasoning_details?: unknown;
}

/**
 * Union type for user message content.
 */
export type SessionUserContent =
  | { Text: string }
  | { Mention: { uri: string; content: string } }
  | { Image: SessionMessageImage };

/**
 * Union type for agent message content.
 */
export type SessionAgentContent =
  | { Text: string }
  | { Thinking: { text: string; signature?: string | null } }
  | { RedactedThinking: string }
  | { ToolUse: SessionToolUse };

/**
 * Image in a session message.
 */
export interface SessionMessageImage {
  source: string;
  size?: { width: number; height: number } | null;
}

/**
 * Tool use in a session message.
 */
export interface SessionToolUse {
  id: string;
  name: string;
  raw_input: string;
  input: unknown;
  is_input_complete: boolean;
  thought_signature?: string | null;
}

/**
 * Tool result in a session message.
 */
export interface SessionToolResult {
  tool_use_id: string;
  tool_name: string;
  is_error: boolean;
  content: SessionToolResultContent;
  output?: unknown;
}

/**
 * Union type for tool result content.
 */
export type SessionToolResultContent =
  | { Text: string }
  | { Image: SessionMessageImage };

/**
 * Token usage statistics.
 */
export interface SessionTokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Event log metadata.
 */
export interface SessionEventLog {
  active_path: string;
  segment_count: number;
  max_segment_bytes: number;
  max_segments: number;
  last_write_at?: string;
  last_write_error?: string | null;
}

/**
 * acpx-specific session state.
 */
export interface SessionAcpxState {
  reset_on_next_ensure?: boolean;
  current_mode_id?: string;
  desired_mode_id?: string;
  current_model_id?: string;
  available_models?: string[];
  available_commands?: string[];
  config_options?: SessionConfigOption[];
  session_options?: {
    model?: string;
    allowed_tools?: string[];
    max_turns?: number;
  };
}

/**
 * Permission statistics.
 */
export interface PermissionStats {
  requested: number;
  approved: number;
  denied: number;
  cancelled: number;
}

/**
 * Client operation tracking.
 */
export interface ClientOperation {
  method: ClientOperationMethod;
  status: ClientOperationStatus;
  summary: string;
  details?: string;
  timestamp: string;
}

export type ClientOperationMethod =
  | "fs/read_text_file"
  | "fs/write_text_file"
  | "terminal/create"
  | "terminal/output"
  | "terminal/wait_for_exit"
  | "terminal/kill"
  | "terminal/release";

export type ClientOperationStatus = "running" | "completed" | "failed";

// ============================================================================
// Constants and Enums
// ============================================================================

/**
 * Exit codes for acpx operations.
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  USAGE: 2,
  TIMEOUT: 3,
  NO_SESSION: 4,
  PERMISSION_DENIED: 5,
  INTERRUPTED: 130,
} as const;

export const OUTPUT_FORMATS = ["text", "json", "quiet"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const PERMISSION_MODES = ["approve-all", "approve-reads", "deny-all"] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

export const AUTH_POLICIES = ["skip", "fail"] as const;
export type AuthPolicy = (typeof AUTH_POLICIES)[number];

export const NON_INTERACTIVE_PERMISSION_POLICIES = ["deny", "fail"] as const;
export type NonInteractivePermissionPolicy = (typeof NON_INTERACTIVE_PERMISSION_POLICIES)[number];

export const SESSION_RESUME_POLICIES = ["allow-new", "same-session-only"] as const;
export type SessionResumePolicy = (typeof SESSION_RESUME_POLICIES)[number];

export const OUTPUT_STREAMS = ["prompt", "control"] as const;
export type OutputStream = (typeof OUTPUT_STREAMS)[number];

export type AcpJsonRpcMessage = AnyMessage;
export type AcpMessageDirection = "outbound" | "inbound";

// ============================================================================
// Flow Types
// ============================================================================

/**
 * The main union type for flow node definitions.
 * Each node type has a `nodeType` discriminator.
 */
export type FlowNodeDefinition =
  | AcpNodeDefinition
  | ComputeNodeDefinition
  | ActionNodeDefinition
  | CheckpointNodeDefinition;

/**
 * Node for ACP (Agent Client Protocol) interactions.
 */
export interface AcpNodeDefinition extends FlowNodeCommon {
  nodeType: "acp";
  profile?: string;
  cwd?: string | ((context: FlowNodeContext) => MaybePromise<string | undefined>);
  session?: {
    handle?: string;
    isolated?: boolean;
  };
  prompt: (context: FlowNodeContext) => MaybePromise<PromptInput | string>;
  parse?: (text: string, context: FlowNodeContext) => MaybePromise<unknown>;
}

/**
 * Node for pure computation.
 */
export interface ComputeNodeDefinition extends FlowNodeCommon {
  nodeType: "compute";
  run: (context: FlowNodeContext) => MaybePromise<unknown>;
}

/**
 * Union type for action nodes - either function-based or shell-based.
 */
export type ActionNodeDefinition = FunctionActionNodeDefinition | ShellActionNodeDefinition;

/**
 * Function-based action node.
 */
export interface FunctionActionNodeDefinition extends FlowNodeCommon {
  nodeType: "action";
  run: (context: FlowNodeContext) => MaybePromise<unknown>;
}

/**
 * Shell-based action node.
 */
export interface ShellActionNodeDefinition extends FlowNodeCommon {
  nodeType: "action";
  exec: (context: FlowNodeContext) => MaybePromise<ShellActionExecution>;
  parse?: (result: ShellActionResult, context: FlowNodeContext) => MaybePromise<unknown>;
}

/**
 * Checkpoint node for flow control.
 */
export interface CheckpointNodeDefinition extends FlowNodeCommon {
  nodeType: "checkpoint";
  summary?: string;
  run?: (context: FlowNodeContext) => MaybePromise<unknown>;
}

/**
 * Base properties shared by all node types.
 */
export interface FlowNodeCommon {
  timeoutMs?: number;
  heartbeatMs?: number;
  statusDetail?: string;
}

/**
 * Union type for flow edges - simple or switch-based.
 */
export type FlowEdge =
  | { from: string; to: string }
  | { from: string; switch: { on: string; cases: Record<string, string> } };

/**
 * Context provided to flow node execution.
 */
export interface FlowNodeContext<TInput = unknown> {
  input: TInput;
  outputs: Record<string, unknown>;
  results: Record<string, FlowNodeResult>;
  state: FlowRunState;
  services: Record<string, unknown>;
}

/**
 * Complete state of a flow run.
 */
export interface FlowRunState {
  runId: string;
  flowName: string;
  runTitle?: string;
  flowPath?: string;
  /** ISO timestamp */
  startedAt: string;
  /** ISO timestamp */
  finishedAt?: string;
  /** ISO timestamp */
  updatedAt: string;
  status: "running" | "waiting" | "completed" | "failed" | "timed_out";
  input: unknown;
  outputs: Record<string, unknown>;
  results: Record<string, FlowNodeResult>;
  steps: FlowStepRecord[];
  sessionBindings: Record<string, FlowSessionBinding>;
  currentNode?: string;
  currentAttemptId?: string;
  currentNodeType?: FlowNodeDefinition["nodeType"];
  currentNodeStartedAt?: string;
  lastHeartbeatAt?: string;
  statusDetail?: string;
  waitingOn?: string;
  error?: string;
}

/**
 * Result of a flow node execution.
 */
export interface FlowNodeResult {
  attemptId: string;
  nodeId: string;
  nodeType: FlowNodeDefinition["nodeType"];
  outcome: FlowNodeOutcome;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  output?: unknown;
  error?: string;
}

export type FlowNodeOutcome = "ok" | "timed_out" | "failed" | "cancelled";

/**
 * Record of a single step in a flow run.
 */
export interface FlowStepRecord {
  attemptId: string;
  nodeId: string;
  nodeType: FlowNodeDefinition["nodeType"];
  outcome: FlowNodeOutcome;
  startedAt: string;
  finishedAt: string;
  promptText: string | null;
  rawText: string | null;
  output: unknown;
  error?: string;
  session: FlowSessionBinding | null;
  agent: {
    agentName: string;
    agentCommand: string;
    cwd: string;
  } | null;
  trace?: FlowStepTrace;
}

/**
 * Binding between a flow and a session.
 */
export interface FlowSessionBinding {
  key: string;
  handle: string;
  bundleId: string;
  name: string;
  profile?: string;
  agentName: string;
  agentCommand: string;
  cwd: string;
  acpxRecordId: string;
  acpSessionId: string;
  agentSessionId?: string;
}

/**
 * Flow definition structure.
 */
export interface FlowDefinition {
  name: string;
  run?: FlowRunDefinition;
  permissions?: FlowPermissionRequirements;
  startAt: string;
  nodes: Record<string, FlowNodeDefinition>;
  edges: FlowEdge[];
}

export interface FlowRunDefinition<TInput = unknown> {
  title?: string | ((context: {
    input: TInput;
    flowName: string;
    flowPath?: string;
  }) => MaybePromise<string | undefined>);
}

export interface FlowPermissionRequirements {
  requiredMode: PermissionMode;
  requireExplicitGrant?: boolean;
  reason?: string;
}

/**
 * Shell action execution configuration.
 */
export interface ShellActionExecution {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  shell?: boolean | string;
  allowNonZeroExit?: boolean;
  timeoutMs?: number;
}

/**
 * Shell action execution result.
 */
export interface ShellActionResult {
  command: string;
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  combinedOutput: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
}

// ============================================================================
// Flow Trace & Artifact Types
// ============================================================================

/**
 * Reference to a flow artifact.
 */
export interface FlowArtifactRef {
  path: string;
  mediaType: string;
  bytes: number;
  sha256: string;
}

/**
 * Trace of a conversation within a flow.
 */
export interface FlowConversationTrace {
  sessionId: string;
  messageStart: number;
  messageEnd: number;
  eventStartSeq: number;
  eventEndSeq: number;
}

/**
 * Receipt for an action execution.
 */
export interface FlowActionReceipt {
  actionType: "shell" | "function";
  command?: string;
  args?: string[];
  cwd?: string;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  durationMs?: number;
}

/**
 * Trace information for a flow step.
 */
export interface FlowStepTrace {
  sessionId?: string;
  promptArtifact?: FlowArtifactRef;
  rawResponseArtifact?: FlowArtifactRef;
  outputArtifact?: FlowArtifactRef;
  outputInline?: unknown;
  stdoutArtifact?: FlowArtifactRef;
  stderrArtifact?: FlowArtifactRef;
  conversation?: FlowConversationTrace;
  action?: FlowActionReceipt;
}

/**
 * Event in a flow trace.
 */
export interface FlowTraceEvent {
  seq: number;
  at: string;
  scope: "run" | "node" | "acp" | "action" | "session" | "artifact";
  type: string;
  runId: string;
  nodeId?: string;
  attemptId?: string;
  sessionId?: string;
  artifact?: FlowArtifactRef;
  payload: Record<string, unknown>;
}

// ============================================================================
// Flow Manifest Types
// ============================================================================

/**
 * Manifest for a flow run bundle.
 */
export interface FlowRunManifest {
  schema: "acpx.flow-run-bundle.v1";
  runId: string;
  flowName: string;
  runTitle?: string;
  flowPath?: string;
  startedAt: string;
  finishedAt?: string;
  status: FlowRunState["status"];
  traceSchema: "acpx.flow-trace-event.v1";
  paths: {
    flow: string;
    trace: string;
    runProjection: string;
    liveProjection: string;
    stepsProjection: string;
    sessionsDir: string;
    artifactsDir: string;
  };
  sessions: FlowManifestSessionEntry[];
}

/**
 * Session entry in a flow manifest.
 */
export interface FlowManifestSessionEntry {
  id: string;
  handle: string;
  bindingPath: string;
  recordPath: string;
  eventsPath: string;
}

/**
 * Snapshot of a flow definition.
 */
export interface FlowDefinitionSnapshot {
  schema: "acpx.flow-definition-snapshot.v1";
  name: string;
  run?: { hasTitle?: boolean };
  permissions?: FlowPermissionRequirements;
  startAt: string;
  nodes: Record<string, FlowNodeSnapshot>;
  edges: FlowEdge[];
}

/**
 * Snapshot of a flow node.
 */
export interface FlowNodeSnapshot extends FlowNodeCommon {
  nodeType: FlowNodeDefinition["nodeType"];
  profile?: string;
  session?: { handle?: string; isolated?: boolean };
  cwd?: { mode: "default" | "static" | "dynamic"; value?: string };
  summary?: string;
  actionExecution?: "function" | "shell";
  hasPrompt?: boolean;
  hasParse?: boolean;
  hasRun?: boolean;
  hasExec?: boolean;
}

// ============================================================================
// Permission Types
// ============================================================================

/**
 * Permission mode hierarchy ranking.
 */
export const PERMISSION_MODE_RANK: Record<PermissionMode, number> = {
  "deny-all": 0,
  "approve-reads": 1,
  "approve-all": 2,
} as const;

/**
 * Kind of tool being used.
 */
export type ToolKind = "read" | "search" | "edit" | "delete" | "move" | "execute" | "fetch" | "think" | "other";

/**
 * Permission decision result.
 */
export type PermissionDecision = "approved" | "denied" | "cancelled";

// ============================================================================
// View Model Types
// ============================================================================

/**
 * Node data for flow visualization.
 */
export interface ViewerNodeData {
  nodeId: string;
  title: string;
  subtitle: string;
  nodeType: FlowStepRecord["nodeType"];
  status: ViewerNodeStatus;
  attempts: number;
  latestAttemptId?: string;
  durationLabel?: string;
  isStart: boolean;
  isTerminal: boolean;
  isDecision: boolean;
  branchCount: number;
  branchLabels: string[];
  isRunOutcomeNode: boolean;
  runOutcomeLabel?: string;
  runOutcomeAccent?: RunOutcomeView["accent"];
  playbackProgress?: number;
}

export type ViewerNodeStatus =
  | "queued"
  | "active"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled";

/**
 * Point in viewer coordinates.
 */
export interface ViewerPoint {
  x: number;
  y: number;
}

/**
 * Edge data for flow visualization.
 */
export interface ViewerEdgeData {
  points?: ViewerPoint[];
  isBackEdge: boolean;
}

/**
 * Graph layout for flow visualization.
 */
export interface ViewerGraphLayout {
  nodePositions: Record<string, ViewerPoint>;
  edgeRoutes: Record<string, {
    points: ViewerPoint[];
    isBackEdge: boolean;
  }>;
}

// ============================================================================
// Playback Types
// ============================================================================

/**
 * Segment in a playback timeline.
 */
export interface PlaybackSegment {
  stepIndex: number;
  nodeId: string;
  nodeType: FlowStepRecord["nodeType"];
  startMs: number;
  endMs: number;
  durationMs: number;
}

/**
 * Timeline for playback.
 */
export interface PlaybackTimeline {
  segments: PlaybackSegment[];
  totalDurationMs: number;
}

/**
 * Preview state for playback.
 */
export interface PlaybackPreview {
  playheadMs: number;
  activeStepIndex: number;
  nearestStepIndex: number;
  stepProgress: number;
  stepStartMs: number;
  stepEndMs: number;
  totalDurationMs: number;
}

// ============================================================================
// Conversation View Types
// ============================================================================

/**
 * View model for a tool use in conversation.
 */
export interface ConversationToolUseView {
  id: string;
  name: string;
  summary: string;
  raw: unknown;
}

/**
 * View model for a tool result in conversation.
 */
export interface ConversationToolResultView {
  id: string;
  toolName: string;
  status: string;
  preview: string;
  isError: boolean;
  raw: unknown;
}

/**
 * View model for hidden payload in conversation.
 */
export interface ConversationHiddenPayloadView {
  label: string;
  raw: unknown;
}

/**
 * Part of a conversation message.
 */
export type ConversationMessagePart =
  | { type: "text"; text: string }
  | { type: "tool_use"; toolUse: ConversationToolUseView }
  | { type: "tool_result"; toolResult: ConversationToolResultView }
  | { type: "hidden_payload"; payload: ConversationHiddenPayloadView };

/**
 * View model for a selected attempt.
 */
export interface SelectedAttemptView {
  step: FlowStepRecord;
  sessionSourceStep: FlowStepRecord | null;
  sessionFromFallback: boolean;
  sessionRecord: SessionRecord | null;
  sessionEvents: FlowBundledSessionEvent[];
  sessionSlice: Array<{
    index: number;
    role: "user" | "agent" | "unknown";
    title: string;
    highlighted: boolean;
    textBlocks: string[];
    toolUses: ConversationToolUseView[];
    toolResults: ConversationToolResultView[];
    hiddenPayloads: ConversationHiddenPayloadView[];
    parts: ConversationMessagePart[];
  }>;
  rawEventSlice: FlowBundledSessionEvent[];
  traceEvents: FlowTraceEvent[];
}

/**
 * View model for a session list item.
 */
export interface SessionListItemView {
  id: string;
  label: string;
  sessionRecord: SessionRecord;
  sessionSlice: SelectedAttemptView["sessionSlice"];
  isStreamingSource: boolean;
}

/**
 * View model for a run outcome.
 */
export interface RunOutcomeView {
  status: FlowRunState["status"];
  headline: string;
  detail: string;
  shortLabel: string;
  accent: "ok" | "active" | "failed" | "timed_out";
  nodeId: string | null;
  attemptId: string | null;
  isTerminal: boolean;
}

// ============================================================================
// Additional Types (from @agentclientprotocol/sdk)
// ============================================================================

/**
 * Agent capabilities.
 * @see From @agentclientprotocol/sdk
 */
export interface AgentCapabilities {
  [key: string]: unknown;
}

/**
 * Any JSON-RPC message.
 * @see From @agentclientprotocol/sdk
 */
export interface AnyMessage {
  jsonrpc: "2.0";
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP server configuration.
 * @see From @agentclientprotocol/sdk
 */
export interface McpServer {
  [key: string]: unknown;
}

/**
 * Session notification.
 * @see From @agentclientprotocol/sdk
 */
export interface SessionNotification {
  [key: string]: unknown;
}

/**
 * Session configuration option.
 * @see From @agentclientprotocol/sdk
 */
export interface SessionConfigOption {
  [key: string]: unknown;
}

/**
 * Response for setting session config option.
 * @see From @agentclientprotocol/sdk
 */
export interface SetSessionConfigOptionResponse {
  [key: string]: unknown;
}

/**
 * Stop reason for agent.
 * @see From @agentclientprotocol/sdk
 */
export type StopReason = string;

/**
 * Permission option.
 * @see From @agentclientprotocol/sdk
 */
export interface PermissionOption {
  id: string;
  kind: "allow_once" | "allow_always" | "deny_once" | "deny_always";
  label: string;
  detail?: string;
}

/**
 * Request for permission.
 * @see From @agentclientprotocol/sdk
 */
export interface RequestPermissionRequest {
  sessionId: string;
  toolName: string;
  toolTitle?: string;
  toolKind?: ToolKind;
  input: unknown;
  options: PermissionOption[];
  message?: string;
}

/**
 * Response to a permission request.
 * @see From @agentclientprotocol/sdk
 */
export interface RequestPermissionResponse {
  outcome:
    | { outcome: "selected"; optionId: string }
    | { outcome: "cancelled" };
}

/**
 * Prompt input for ACP nodes.
 * @see From ./prompt-content.js
 */
export type PromptInput = unknown;

/**
 * Session agent options.
 * @see From ../session/session.js
 */
export interface SessionAgentOptions {
  model?: string;
  allowedTools?: string[];
  maxTurns?: number;
  [key: string]: unknown;
}

// ============================================================================
// Additional Utility Types
// ============================================================================

/**
 * Bundled session event.
 */
export interface FlowBundledSessionEvent {
  seq: number;
  at: string;
  direction: AcpMessageDirection;
  message: AcpJsonRpcMessage;
}

/**
 * Snapshot of a flow session bundle.
 */
export interface FlowSessionBundleSnapshot {
  binding: FlowSessionBinding;
  record: SessionRecord;
}

/**
 * Resolved flow agent configuration.
 */
export interface ResolvedFlowAgent {
  agentName: string;
  agentCommand: string;
  cwd: string;
}

/**
 * Options for flow runner.
 */
export interface FlowRunnerOptions {
  resolveAgent: (profile?: string) => ResolvedFlowAgent;
  permissionMode: PermissionMode;
  mcpServers?: McpServer[];
  nonInteractivePermissions?: NonInteractivePermissionPolicy;
  authCredentials?: Record<string, string>;
  authPolicy?: AuthPolicy;
  timeoutMs?: number;
  defaultNodeTimeoutMs?: number;
  ttlMs?: number;
  verbose?: boolean;
  suppressSdkConsoleErrors?: boolean;
  sessionOptions?: SessionAgentOptions;
  services?: Record<string, unknown>;
  outputRoot?: string;
}