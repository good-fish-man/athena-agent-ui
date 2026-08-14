// Generated from Athena Protocol v4. Do not hand-edit downstream copies.
export const ATHENA_PROTOCOL = 'athena.agent.v4' as const;

export type RiskLevel = 'R0' | 'R1' | 'R2' | 'R3';
export type PolicyDecision = 'ALLOW' | 'ASK_USER' | 'BLOCK';
export type TaskStatus =
  | 'CREATED' | 'PLANNING' | 'RUNNING' | 'WAITING_OBSERVATION'
  | 'WAITING_APPROVAL' | 'WAITING_USER' | 'VERIFYING' | 'RETRY_WAIT'
  | 'PAUSED' | 'CANCELLING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ObservationStatus =
  | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
  | 'BLOCKED' | 'WAITING_APPROVAL' | 'WAITING_USER';

export interface Policy {
  risk: RiskLevel;
  decision: PolicyDecision;
  approval_id?: string;
  reason?: string;
  constraints?: Record<string, unknown>;
}

export interface ExpectedObservation {
  kind?: string;
  predicates?: Record<string, unknown>;
  timeout_ms?: number;
}

export interface Action {
  protocol: typeof ATHENA_PROTOCOL;
  type: 'ACTION';
  task_id: string;
  step_id: string;
  action_id: string;
  trace_id?: string;
  agent_build_id?: string;
  run_manifest_id?: string;
  decision_id?: string;
  device_id?: string;
  capability_instance_id?: string;
  session_id?: string;
  sequence: number;
  revision: number;
  idempotency_key: string;
  issued_at: string;
  deadline: string;
  capability: string;
  operation?: string;
  target?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
  policy: Policy;
  expected_observation?: ExpectedObservation;
}

export interface Envelope<T = unknown> {
  protocol: typeof ATHENA_PROTOCOL;
  type: string;
  message_id: string;
  trace_id?: string;
  task_id?: string;
  revision?: number;
  occurred_at: string;
  payload: T;
}

export interface DecisionRequest {
  protocol: typeof ATHENA_PROTOCOL;
  type: 'DECISION_REQUEST';
  decision_id: string;
  task_id: string;
  step_id: string;
  revision: number;
  intent?: Record<string, unknown>;
  world_slice?: Record<string, unknown>;
  capability_ids?: string[];
  requested_at: string;
}

export interface DecisionResponse {
  protocol: typeof ATHENA_PROTOCOL;
  type: 'DECISION_RESPONSE';
  decision_id: string;
  task_id: string;
  step_id: string;
  revision: number;
  summary?: string;
  proposal?: Action;
  wait_state?: string;
  metadata?: Record<string, unknown>;
  decided_at: string;
}

export interface EvidenceRef {
  evidence_id: string;
  kind: string;
  uri?: string;
  mime_type?: string;
  sha256?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorDetail {
  code?: string;
  message: string;
  operation?: string;
  retryable?: boolean;
  cause?: ErrorDetail;
  details?: Record<string, unknown>;
}

export interface WorldMutation {
  operation: 'set' | 'remove' | 'merge';
  path: string;
  value?: unknown;
}

export interface WorldPatch {
  base_revision: number;
  mutations: WorldMutation[];
}

export interface Observation {
  protocol: typeof ATHENA_PROTOCOL;
  type: 'OBSERVATION';
  observation_id: string;
  task_id: string;
  step_id: string;
  action_id: string;
  trace_id?: string;
  agent_build_id?: string;
  run_manifest_id?: string;
  device_id?: string;
  session_id?: string;
  sequence: number;
  revision: number;
  status: ObservationStatus;
  started_at?: string;
  finished_at?: string;
  observed_at: string;
  summary?: string;
  state?: Record<string, unknown>;
  evidence?: EvidenceRef[];
  world_patch?: WorldPatch;
  error?: string;
  error_detail?: ErrorDetail;
}

export interface Progress {
  protocol: typeof ATHENA_PROTOCOL;
  type: 'PROGRESS';
  task_id: string;
  step_id: string;
  action_id: string;
  trace_id?: string;
  device_id?: string;
  session_id?: string;
  sequence: number;
  revision: number;
  capability?: string;
  stage?: string;
  message?: string;
  progress?: number;
  bytes?: number;
  total?: number;
  state?: Record<string, unknown>;
  sent_at: string;
}

export interface Cancel {
  protocol: typeof ATHENA_PROTOCOL;
  type: 'CANCEL';
  task_id: string;
  step_id?: string;
  action_id?: string;
  trace_id?: string;
  sequence: number;
  revision: number;
  reason?: string;
  sent_at: string;
}

export interface TaskStep {
  step_id: string;
  task_id: string;
  ordinal: number;
  status: string;
  title?: string;
  capability?: string;
  operation?: string;
  target?: Record<string, unknown>;
  input?: Record<string, unknown>;
  expected_observation?: ExpectedObservation;
  attempt?: number;
  created_at: string;
  updated_at: string;
}

export interface TaskSession {
  task_id: string;
  parent_task_id?: string;
  conversation_id?: string;
  trace_id?: string;
  user_id: string;
  device_id: string;
  goal?: string;
  status: TaskStatus;
  sequence: number;
  revision: number;
  current_step_id?: string;
  active_sessions?: Record<string, string>;
  steps?: TaskStep[];
  actions?: Action[];
  observations?: Observation[];
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error_detail?: ErrorDetail;
}

export interface TaskEvent {
  event_id: string;
  protocol: typeof ATHENA_PROTOCOL;
  type: string;
  aggregate: 'task' | 'step' | 'action' | 'observation' | 'world' | 'device';
  aggregate_id: string;
  task_id?: string;
  step_id?: string;
  action_id?: string;
  trace_id?: string;
  sequence: number;
  revision: number;
  occurred_at: string;
  payload?: Record<string, unknown>;
}

export interface WorldState {
  task_id: string;
  revision: number;
  state: Record<string, unknown>;
  updated_at: string;
}

export interface CapabilityInstance {
  instance_id: string;
  capability: string;
  version?: string;
  operations?: string[];
  modalities?: string[];
  metadata?: Record<string, unknown>;
}

export interface Approval {
  approval_id: string;
  task_id: string;
  step_id: string;
  action_id: string;
  owner_id: string;
  risk: RiskLevel;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  summary?: string;
  scope?: Record<string, unknown>;
  revision: number;
  trace_id?: string;
  decided_by?: string;
  reason?: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  decided_at?: string;
}

export interface Artifact {
  artifact_id: string;
  task_id: string;
  step_id?: string;
  owner_id: string;
  kind: string;
  uri: string;
  mime_type?: string;
  size?: number;
  sha256?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}
