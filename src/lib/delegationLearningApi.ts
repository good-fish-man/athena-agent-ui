import { API_BASE } from './api';

export type LearningCandidateKind = 'DELEGATION_POLICY' | 'SPECIALIST_PROFILE';
export type LearningRolloutStatus = 'PROPOSED' | 'CANARY' | 'PROMOTED' | 'PAUSED' | 'ROLLED_BACK' | 'DISABLED';
export type LearningBenchmarkMode = 'SINGLE_AGENT' | 'STATIC_SPECIALIST' | 'DYNAMIC_DSO';

export interface DelegationLearningPreference {
  owner_id: string;
  enabled: boolean;
  revision: number;
  updated_by: string;
  updated_at: string;
}

export interface DelegationLearningCandidate {
  candidate_id: string;
  owner_id: string;
  kind: LearningCandidateKind;
  source_experience_refs: string[];
  source_run_refs: string[];
  definition_hash: string;
  created_at: string;
  policy_artifact?: { artifact_id: string; version: string; rules: Array<{ rule_id: string; task_classes: string[] }> };
  profile_artifact?: { artifact_id: string; version: string; role: string; capabilities: string[] };
}

export interface DelegationLearningEvaluation {
  evaluation_id: string;
  candidate_ref: string;
  stage: 'OFFLINE' | 'SHADOW';
  improved_metrics: string[];
  safety_regressed: boolean;
  passed: boolean;
  evaluator_version: string;
  evaluated_at: string;
}

export interface DelegationLearningReview {
  review_id: string;
  candidate_ref: string;
  decision: 'APPROVE' | 'REJECT';
  reasons: string[];
  reviewer_id: string;
  reviewed_at: string;
}

export interface DelegationLearningRollout {
  rollout_id: string;
  candidate_ref: string;
  status: LearningRolloutStatus;
  risk_ceiling: string;
  canary_percent: number;
  fallback_policy_ref: string;
  approved_by: string;
  revision: number;
  updated_at: string;
}

export interface DelegationBenchmarkMetrics {
  sample_count: number;
  quality_score: number;
  safety_score: number;
  recovery_rate: number;
  p95_latency_ms: number;
  average_cost_micros: number;
}

export interface DelegationBenchmarkReport {
  report_id: string;
  candidate_ref: string;
  variants: Array<{ mode: LearningBenchmarkMode; metrics: DelegationBenchmarkMetrics }>;
  safety_passed: boolean;
  primary_improvement: string;
  created_at: string;
}

export interface DelegationEvolutionSnapshot {
  enabled: boolean;
  running: boolean;
  last_scan_at?: string;
  last_success_at?: string;
  scanned_sources: number;
  created_candidates: number;
  last_error?: string;
}

export interface DelegationLearningSnapshot {
  preference: DelegationLearningPreference;
  candidates: DelegationLearningCandidate[];
  evaluations: DelegationLearningEvaluation[];
  reviews: DelegationLearningReview[];
  rollouts: DelegationLearningRollout[];
  benchmarks: DelegationBenchmarkReport[];
  evolution: DelegationEvolutionSnapshot;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || payload.error || `Request failed: ${response.status}`;
    const trace = payload.trace_id || response.headers.get('X-Trace-Id') || response.headers.get('X-Request-Id');
    throw new Error(trace ? `${message} (Trace ID: ${trace})` : message);
  }
  return (payload.data ?? payload) as T;
}

const jsonRequest = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const delegationLearningApi = {
  snapshot: async () => {
    const value = await request<DelegationLearningSnapshot>('/delegation-learning');
    return {
      ...value,
      candidates: Array.isArray(value.candidates) ? value.candidates : [],
      evaluations: Array.isArray(value.evaluations) ? value.evaluations : [],
      reviews: Array.isArray(value.reviews) ? value.reviews : [],
      rollouts: Array.isArray(value.rollouts) ? value.rollouts : [],
      benchmarks: Array.isArray(value.benchmarks) ? value.benchmarks : [],
    };
  },
  preference: (enabled: boolean, expectedRevision: number) => request<DelegationLearningPreference>('/delegation-learning/preference', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, expected_revision: expectedRevision }),
  }),
  review: (candidateID: string, decision: 'APPROVE' | 'REJECT', reasons: string[]) => request<DelegationLearningReview>(`/delegation-learning/candidates/${encodeURIComponent(candidateID)}/review`, jsonRequest({ decision, reasons })),
  shadow: (candidateID: string) => request<DelegationLearningEvaluation>(`/delegation-learning/candidates/${encodeURIComponent(candidateID)}/shadow`, jsonRequest({})),
  canary: (candidateID: string, ownerID: string, percent = 10) => request<DelegationLearningRollout>(`/delegation-learning/candidates/${encodeURIComponent(candidateID)}/canary`, jsonRequest({ allowed_owner_ids: [ownerID], percent })),
  promote: (rolloutID: string) => request<DelegationLearningRollout>(`/delegation-learning/rollouts/${encodeURIComponent(rolloutID)}/promote`, jsonRequest({})),
  disable: (rolloutID: string) => request<DelegationLearningRollout>(`/delegation-learning/rollouts/${encodeURIComponent(rolloutID)}/disable`, jsonRequest({})),
};
