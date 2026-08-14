import type {
  Agent,
  BrowserSuggestedAction,
  ControlObservation,
  EvaluationFixture,
  EvaluationResult,
  EvaluationRun,
  EvaluationSuite,
  ExperienceOutcome,
  ExperiencePreference,
  ExperienceRecord,
  ExperienceSearchHit,
  ExperienceSensitivity,
  ExperienceStats,
  ExperienceStatus,
  Demonstration,
  AgentBuild,
  Promotion,
  ShadowResult,
  CanaryMetric,
  CanarySample,
  RunManifest,
  DeploymentRollback,
  DeploymentExposure,
  LearnedSkill,
  LearningCandidate,
  LearningCandidateEvidence,
  LearningCandidateEvaluation,
  KnowledgeClaim,
  KnowledgeContradiction,
  KnowledgeEvidence,
  KnowledgeRetrievalResponse,
  KnowledgeSnapshot,
  OntologyPack,
	PersistentGoal,
	GoalState,
	GoalCheckpoint,
	ScheduleTrigger,
	PluginProvider,
	PluginInvocationTrace,
	PluginPermissionSet,
	OperationsSnapshot,
	BackupManifest,
	GAReadinessReport,
	GoldenJourney,
	GoldenJourneyResult,
} from '../types';
import {
  ATHENA_PROTOCOL,
  type Action as ProtocolAction,
  type Approval,
  type CapabilityInstance,
  type TaskEvent,
  type TaskSession,
  type WorldState,
} from '../generated/athena-protocol-v4';
import i18n from '../i18n';
import {
  MODEL_RUNTIME_MODE,
  resolveRuntimeClientOrigin,
} from './runtimeConstants';
import type { ModelRuntimeMode } from './runtimeConstants';

export const RUNTIME_CLIENT_ORIGIN = resolveRuntimeClientOrigin();
const PUBLIC_PREFIX = import.meta.env.VITE_AGENT_RUNTIME_PUBLIC_PREFIX || '/api/agent-runtime-client/v1';
const RUNTIME_PREFIX = import.meta.env.VITE_AGENT_RUNTIME_API_PREFIX || '/v1';

const joinUrl = (base: string, path: string) =>
  `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

export const API_BASE = joinUrl(RUNTIME_CLIENT_ORIGIN, PUBLIC_PREFIX);
export const RUNTIME_API_BASE = joinUrl(RUNTIME_CLIENT_ORIGIN, RUNTIME_PREFIX);
export const REPORT_API_BASE = API_BASE;

type ErrorPayload = { message?: string; cause?: string; trace_id?: string };

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const url = input instanceof Request ? input.url : String(input);
  try {
    const response = await window.fetch(input, init);
    if (!response.ok) {
      const payload = await response.clone().json().catch(() => ({} as ErrorPayload)) as ErrorPayload;
      console.error('[Athena API] request failed', {
        method,
        url,
        status: response.status,
        traceId: payload.trace_id || response.headers.get('X-Trace-Id') || response.headers.get('X-Request-Id') || '',
        message: payload.message || response.statusText,
        cause: payload.cause || '',
      });
    }
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.info('[Athena API] request canceled', { method, url });
      throw error;
    }
    console.error('[Athena API] network request failed', { method, url, error });
    throw error;
  }
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface RuntimeCapability {
  id: string;
  description: string;
  input?: Record<string, string>;
  output?: string;
  read_only: boolean;
  risk: 'low' | 'medium' | 'high' | string;
  status: 'available' | 'unavailable';
  provider?: string;
  reason?: string;
}

export type RuntimeCapabilityConfig = {
  id: string;
  config?: Record<string, unknown>;
};

export const capabilityApi = {
  async list(): Promise<RuntimeCapability[]> {
    return readJson<RuntimeCapability[]>(await apiFetch(`${RUNTIME_API_BASE}/capabilities`));
  },
};

export interface ExperienceListRequest {
  status?: ExperienceStatus | '';
  outcome?: ExperienceOutcome | '';
  failureClass?: string;
  sensitivity?: ExperienceSensitivity | '';
  query?: string;
  limit?: number;
  offset?: number;
}

export interface ExperienceSearchRequest {
  query?: string;
  task_type?: string;
  domain?: string;
  environment_fingerprint?: string;
  failure_class?: string;
  capability?: string;
  outcome?: ExperienceOutcome | '';
  budget?: {
    max_results?: number;
    max_tokens?: number;
    max_duration_ms?: number;
    max_sensitivity?: ExperienceSensitivity;
  };
}

export const experienceApi = {
  async preference(): Promise<ExperiencePreference> {
    return readJson<ExperiencePreference>(await apiFetch(`${API_BASE}/experience/preferences`));
  },
  async savePreference(value: Pick<ExperiencePreference, 'learning_enabled' | 'retention_days' | 'max_sensitivity'>): Promise<ExperiencePreference> {
    return readJson<ExperiencePreference>(await apiFetch(`${API_BASE}/experience/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    }));
  },
  async list(request: ExperienceListRequest = {}): Promise<{ items: ExperienceRecord[]; total: number; limit: number; offset: number }> {
    const query = new URLSearchParams();
    if (request.status) query.set('status', request.status);
    if (request.outcome) query.set('outcome', request.outcome);
    if (request.failureClass) query.set('failure_class', request.failureClass);
    if (request.sensitivity) query.set('sensitivity', request.sensitivity);
    if (request.query) query.set('query', request.query);
    query.set('limit', String(request.limit || 50));
    query.set('offset', String(request.offset || 0));
    return readJson(await apiFetch(`${API_BASE}/experience?${query}`));
  },
  async find(id: string): Promise<ExperienceRecord> {
    return readJson<ExperienceRecord>(await apiFetch(`${API_BASE}/experience/${encodeURIComponent(id)}`));
  },
  async delete(id: string): Promise<void> {
    await readJson(await apiFetch(`${API_BASE}/experience/${encodeURIComponent(id)}`, { method: 'DELETE' }));
  },
  async export(): Promise<unknown> {
    return readJson(await apiFetch(`${API_BASE}/experience/export`));
  },
  async deleteAll(): Promise<{ deleted: number }> {
    return readJson(await apiFetch(`${API_BASE}/experience`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE ALL EXPERIENCE' }),
    }));
  },
  async search(request: ExperienceSearchRequest): Promise<{ items: ExperienceSearchHit[]; historical_only: true }> {
    return readJson(await apiFetch(`${API_BASE}/experience/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        budget: {
          max_results: request.budget?.max_results || 8,
          max_tokens: request.budget?.max_tokens || 4000,
          max_duration_ms: request.budget?.max_duration_ms || 500,
          max_sensitivity: request.budget?.max_sensitivity || 'SENSITIVE',
        },
      }),
    }));
  },
  async stats(scope: 'mine' | 'all' = 'mine'): Promise<ExperienceStats> {
    return readJson<ExperienceStats>(await apiFetch(`${API_BASE}/experience/stats${scope === 'all' ? '?scope=all' : ''}`));
  },
  async createFixture(experienceId: string, request: { name: string; environment_version: string }): Promise<EvaluationFixture> {
    return readJson<EvaluationFixture>(await apiFetch(`${API_BASE}/experience/${encodeURIComponent(experienceId)}/fixture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }));
  },
  async fixtures(limit = 50): Promise<EvaluationFixture[]> {
    const result = await readJson<{ items: EvaluationFixture[] }>(await apiFetch(`${API_BASE}/evaluation/fixtures?limit=${limit}`));
    return result.items || [];
  },
  async createSuite(request: { name: string; fixture_ids: string[] }): Promise<EvaluationSuite> {
    return readJson<EvaluationSuite>(await apiFetch(`${API_BASE}/evaluation/suites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }));
  },
  async suites(limit = 50): Promise<EvaluationSuite[]> {
    const result = await readJson<{ items: EvaluationSuite[] }>(await apiFetch(`${API_BASE}/evaluation/suites?limit=${limit}`));
    return result.items || [];
  },
  async runSuite(suiteId: string, request: { seed: number; candidate_id?: string; baseline_id?: string }): Promise<{ run: EvaluationRun; results: EvaluationResult[] }> {
    return readJson(await apiFetch(`${API_BASE}/evaluation/suites/${encodeURIComponent(suiteId)}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }));
  },
  async runs(limit = 50): Promise<EvaluationRun[]> {
    const result = await readJson<{ items: EvaluationRun[] }>(await apiFetch(`${API_BASE}/evaluation/runs?limit=${limit}`));
    return result.items || [];
  },
  async results(runId: string): Promise<EvaluationResult[]> {
    const result = await readJson<{ items: EvaluationResult[] }>(await apiFetch(`${API_BASE}/evaluation/runs/${encodeURIComponent(runId)}/results`));
    return result.items || [];
  },
};

export const learningApi = {
  async candidates(params: { kind?: string; status?: string; limit?: number; offset?: number } = {}): Promise<{ items: LearningCandidate[]; total: number }> {
    const query = new URLSearchParams();
    if (params.kind) query.set('kind', params.kind);
    if (params.status) query.set('status', params.status);
    query.set('limit', String(params.limit || 50));
    query.set('offset', String(params.offset || 0));
    return readJson(await apiFetch(`${API_BASE}/learning/candidates?${query}`));
  },
  async candidate(id: string): Promise<{ candidate: LearningCandidate; evidence: LearningCandidateEvidence[]; evaluations: LearningCandidateEvaluation[] }> {
    return readJson(await apiFetch(`${API_BASE}/learning/candidates/${encodeURIComponent(id)}`));
  },
  async generate(request: { kind: 'SKILL' | 'STRATEGY'; id?: string; description?: string; experience_ids?: string[]; minimum_score?: number; preferred_skill?: string }): Promise<LearningCandidate> {
    return readJson(await apiFetch(`${API_BASE}/learning/candidates/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    }));
  },
  async review(id: string, request: { decision: 'APPROVE' | 'REJECT'; note?: string; expected_revision: number }): Promise<LearningCandidate> {
    return readJson(await apiFetch(`${API_BASE}/learning/candidates/${encodeURIComponent(id)}/review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    }));
  },
  async update(id: string, candidate: LearningCandidate): Promise<LearningCandidate> {
    return readJson(await apiFetch(`${API_BASE}/learning/candidates/${encodeURIComponent(id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill: candidate.skill, strategy: candidate.strategy, expected_revision: candidate.revision }),
    }));
  },
  async reevaluate(id: string, expectedRevision: number): Promise<LearningCandidate> {
    return readJson(await apiFetch(`${API_BASE}/learning/candidates/${encodeURIComponent(id)}/re-evaluate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_revision: expectedRevision }),
    }));
  },
  async skills(): Promise<LearnedSkill[]> {
    const value = await readJson<{ items: LearnedSkill[]; activation: 'manual_only' }>(await apiFetch(`${API_BASE}/learning/skills`));
    return value.items || [];
  },
  async demonstrations(): Promise<Demonstration[]> {
    const value = await readJson<{ items: Demonstration[] }>(await apiFetch(`${API_BASE}/learning/demonstrations`));
    return value.items || [];
  },
  async startDemonstration(request: { task_id: string; title: string }): Promise<Demonstration> {
    return readJson(await apiFetch(`${API_BASE}/learning/demonstrations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    }));
  },
  async resumeDemonstration(id: string): Promise<Demonstration> {
    return readJson(await apiFetch(`${API_BASE}/learning/demonstrations/${encodeURIComponent(id)}/resume`, { method: 'POST' }));
  },
  async previewDemonstration(id: string): Promise<Demonstration> {
    return readJson(await apiFetch(`${API_BASE}/learning/demonstrations/${encodeURIComponent(id)}/preview`, { method: 'POST' }));
  },
  async confirmDemonstration(id: string): Promise<Demonstration> {
    return readJson(await apiFetch(`${API_BASE}/learning/demonstrations/${encodeURIComponent(id)}/confirm`, { method: 'POST' }));
  },
  async discardDemonstration(id: string): Promise<Demonstration> {
    return readJson(await apiFetch(`${API_BASE}/learning/demonstrations/${encodeURIComponent(id)}/discard`, { method: 'POST' }));
  },
};

export const evidenceKnowledgeApi = {
  async claims(limit = 100): Promise<KnowledgeClaim[]> {
    const value = await readJson<{ items: KnowledgeClaim[] }>(await apiFetch(`${API_BASE}/knowledge/claims?limit=${limit}`));
    return value.items || [];
  },
  async evidence(limit = 100): Promise<KnowledgeEvidence[]> {
    const value = await readJson<{ items: KnowledgeEvidence[] }>(await apiFetch(`${API_BASE}/knowledge/evidence?limit=${limit}`));
    return value.items || [];
  },
  async contradictions(limit = 100): Promise<KnowledgeContradiction[]> {
    const value = await readJson<{ items: KnowledgeContradiction[] }>(await apiFetch(`${API_BASE}/knowledge/contradictions?unresolved=true&limit=${limit}`));
    return value.items || [];
  },
  async resolveContradiction(id: string, request: { decision: 'KEEP_CLAIM' | 'MARK_UNCERTAIN' | 'RETRACT_ALL'; winning_claim_id?: string; note: string }): Promise<KnowledgeContradiction> {
    return readJson<KnowledgeContradiction>(await apiFetch(`${API_BASE}/knowledge/contradictions/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }));
  },
  async snapshots(limit = 20): Promise<KnowledgeSnapshot[]> {
    const value = await readJson<{ items: KnowledgeSnapshot[] }>(await apiFetch(`${API_BASE}/knowledge/snapshots?limit=${limit}`));
    return value.items || [];
  },
  async retrieve(text: string): Promise<KnowledgeRetrievalResponse> {
    return readJson<KnowledgeRetrievalResponse>(await apiFetch(`${API_BASE}/knowledge/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        scopes: ['USER', 'PUBLIC'],
        max_sensitivity: 'INTERNAL',
        as_of: new Date().toISOString(),
        include_expired: false,
        relation_depth: 1,
        min_evidence_authority: 0.25,
        budget: { max_results: 20, max_tokens: 12000, max_time_ms: 3000 },
      }),
    }));
  },
  async ontologyPacks(): Promise<OntologyPack[]> {
    const value = await readJson<{ items: OntologyPack[] }>(await apiFetch(`${API_BASE}/knowledge/ontology/packs`));
    return value.items || [];
  },
};

export const goalApi = {
  async list(limit = 100): Promise<PersistentGoal[]> {
    const value = await readJson<{ items: PersistentGoal[] }>(await apiFetch(`${API_BASE}/goals?limit=${limit}`));
    return value.items || [];
  },
  async find(id: string): Promise<GoalState> {
    return readJson<GoalState>(await apiFetch(`${API_BASE}/goals/${encodeURIComponent(id)}`));
  },
  async createResearch(request: { agent_id: string; objective: string; success: string; deadline?: string }): Promise<GoalState> {
    const goal = await readJson<PersistentGoal>(await apiFetch(`${API_BASE}/goals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        agent_id: request.agent_id,
        objective: request.objective,
        constraints: ['Use registered capabilities only', 'Do not execute generated code', 'Stop when the bounded budget is exhausted'],
        success_criteria: [{ description: request.success, required: true }],
        deadline: request.deadline || undefined,
      }),
    }));
    return readJson<GoalState>(await apiFetch(`${API_BASE}/goals/${encodeURIComponent(goal.goal_id)}/plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        expected_revision: goal.revision,
        tasks: [
          { task_id: 'research', depth: 1, specialist: 'RESEARCH', objective: request.objective, required_capabilities: ['internet.search', 'internet.fetch'] },
          { task_id: 'synthesis', depth: 2, specialist: 'SYNTHESIS', objective: `Synthesize a verified answer for: ${request.objective}`, depends_on: ['research'] },
        ],
      }),
    }));
  },
  async pause(goal: PersistentGoal): Promise<GoalState> {
    return readJson<GoalState>(await apiFetch(`${API_BASE}/goals/${encodeURIComponent(goal.goal_id)}/pause`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_revision: goal.revision, reason: 'paused by user' }),
    }));
  },
  async resume(goal: PersistentGoal): Promise<{ goal: PersistentGoal }> {
    return readJson(await apiFetch(`${API_BASE}/goals/${encodeURIComponent(goal.goal_id)}/resume`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_revision: goal.revision }),
    }));
  },
  async checkpoints(goalId: string): Promise<GoalCheckpoint[]> {
    const value = await readJson<{ items: GoalCheckpoint[] }>(await apiFetch(`${API_BASE}/goals/${encodeURIComponent(goalId)}/checkpoints?limit=20`));
    return value.items || [];
  },
  async scheduleTriggers(limit = 100): Promise<ScheduleTrigger[]> {
    const value = await readJson<{ items: ScheduleTrigger[] }>(await apiFetch(`${API_BASE}/goals/schedule-triggers?limit=${limit}`));
    return value.items || [];
  },
};

export const deploymentApi = {
  async builds(agentId = ''): Promise<AgentBuild[]> {
    const query = new URLSearchParams({ limit: '100' });
    if (agentId) query.set('agent_id', agentId);
    const value = await readJson<{ items: AgentBuild[] }>(await apiFetch(`${API_BASE}/deployment/builds?${query}`));
    return value.items || [];
  },
  async createBuild(request: { agent_id: string; version: string; risk_level: AgentBuild['risk_level']; prompt_template_versions: Record<string, string>; skill_versions?: Record<string, string>; strategy_versions?: Record<string, string> }): Promise<AgentBuild> {
    return readJson(await apiFetch(`${API_BASE}/deployment/builds`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    }));
  },
  async promotions(agentId = ''): Promise<Promotion[]> {
    const query = new URLSearchParams({ limit: '100' });
    if (agentId) query.set('agent_id', agentId);
    const value = await readJson<{ items: Promotion[] }>(await apiFetch(`${API_BASE}/deployment/promotions?${query}`));
    return value.items || [];
  },
  async propose(buildId: string, canaryPercent = 10): Promise<Promotion> {
    return readJson(await apiFetch(`${API_BASE}/deployment/promotions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ build_id: buildId, canary_percent: canaryPercent }),
    }));
  },
  async transition(promotion: Promotion, targetStatus: Promotion['status'], explicit = false): Promise<Promotion> {
    return readJson(await apiFetch(`${API_BASE}/deployment/promotions/${encodeURIComponent(promotion.promotion_id)}/transition`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_status: targetStatus, expected_revision: promotion.revision, explicit }),
    }));
  },
  async shadow(promotionId: string): Promise<ShadowResult[]> {
    const value = await readJson<{ items: ShadowResult[] }>(await apiFetch(`${API_BASE}/deployment/promotions/${encodeURIComponent(promotionId)}/shadow`));
    return value.items || [];
  },
  async evaluateShadow(promotionId: string, request: { task_id: string; input: Record<string, unknown>; capability_hints?: string[] }): Promise<ShadowResult> {
    return readJson<ShadowResult>(await apiFetch(`${API_BASE}/deployment/promotions/${encodeURIComponent(promotionId)}/shadow/evaluate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
    }));
  },
  async canarySamples(promotionId: string): Promise<CanarySample[]> {
    const value = await readJson<{ items: CanarySample[] }>(await apiFetch(`${API_BASE}/deployment/promotions/${encodeURIComponent(promotionId)}/canary-samples`));
    return value.items || [];
  },
  async metrics(promotionId: string): Promise<CanaryMetric[]> {
    const value = await readJson<{ items: CanaryMetric[] }>(await apiFetch(`${API_BASE}/deployment/promotions/${encodeURIComponent(promotionId)}/metrics`));
    return value.items || [];
  },
  async rollback(promotion: Promotion, reason: string): Promise<{ rollback: DeploymentRollback }> {
    return readJson(await apiFetch(`${API_BASE}/deployment/promotions/${encodeURIComponent(promotion.promotion_id)}/rollback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, expected_revision: promotion.revision }),
    }));
  },
  async setOptOut(agentId: string, optedOut: boolean): Promise<void> {
    await readJson(await apiFetch(`${API_BASE}/deployment/experiment`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: agentId, opted_out: optedOut }),
    }));
  },
  async experiment(agentId: string): Promise<DeploymentExposure | null> {
    const query = new URLSearchParams({ agent_id: agentId });
    const value = await readJson<{ exposure: DeploymentExposure | null }>(await apiFetch(`${API_BASE}/deployment/experiment?${query}`));
    return value.exposure || null;
  },
  async manifests(agentId = ''): Promise<RunManifest[]> {
    const query = new URLSearchParams({ limit: '100' });
    if (agentId) query.set('agent_id', agentId);
    const value = await readJson<{ items: RunManifest[] }>(await apiFetch(`${API_BASE}/deployment/manifests?${query}`));
    return value.items || [];
  },
  async rollbacks(agentId = ''): Promise<DeploymentRollback[]> {
    const query = new URLSearchParams({ limit: '100' });
    if (agentId) query.set('agent_id', agentId);
    const value = await readJson<{ items: DeploymentRollback[] }>(await apiFetch(`${API_BASE}/deployment/rollbacks?${query}`));
    return value.items || [];
  },
};

export const operationsApi = {
  async snapshot(): Promise<OperationsSnapshot> {
    return readJson<OperationsSnapshot>(await apiFetch(`${API_BASE}/operations/health`));
  },
  async backups(): Promise<BackupManifest[]> {
    const value = await readJson<{ items: BackupManifest[] }>(await apiFetch(`${API_BASE}/operations/backups`));
    return value.items || [];
  },
  async readiness(): Promise<GAReadinessReport> {
    return readJson<GAReadinessReport>(await apiFetch(`${API_BASE}/operations/readiness`));
  },
  async goldenJourneys(): Promise<{ items: GoldenJourney[]; last_results: GoldenJourneyResult[] }> {
    return readJson(await apiFetch(`${API_BASE}/operations/golden-journeys`));
  },
  async runGoldenJourneys(): Promise<GoldenJourneyResult[]> {
    const value = await readJson<{ items: GoldenJourneyResult[] }>(await apiFetch(`${API_BASE}/operations/golden-journeys/run`, { method: 'POST' }));
    return value.items || [];
  },
  async createBackup(): Promise<BackupManifest> {
    return readJson<BackupManifest>(await apiFetch(`${API_BASE}/operations/backups`, { method: 'POST' }));
  },
  async verifyBackup(backupId: string): Promise<BackupManifest> {
    return readJson<BackupManifest>(await apiFetch(`${API_BASE}/operations/backups/${encodeURIComponent(backupId)}/verify`, { method: 'POST' }));
  },
  async restoreBackup(backup: BackupManifest, validateOnly: boolean, confirmation = ''): Promise<{ backup: BackupManifest; validate_only: boolean; restored: boolean }> {
    return readJson(await apiFetch(`${API_BASE}/operations/backups/${encodeURIComponent(backup.backup_id)}/restore`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_sha256: backup.manifest_sha256, validate_only: validateOnly, confirmation }),
    }));
  },
};

export const pluginRegistryApi = {
  async list(): Promise<PluginProvider[]> {
    const value = await readJson<{ items: PluginProvider[] }>(await apiFetch(`${API_BASE}/plugins`));
    return value.items || [];
  },
	async install(payload: { manifest: unknown; signature: unknown; sbom: unknown; files?: Record<string, string>; granted_permissions?: PluginPermissionSet; visibility: 'private' | 'public'; activate: boolean }): Promise<PluginProvider> {
    return readJson<PluginProvider>(await apiFetch(`${API_BASE}/plugins/install`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
  },
  async transition(provider: PluginProvider, status: 'ACTIVE' | 'DISABLED' | 'REVOKED', reason = ''): Promise<PluginProvider> {
    const path = `${encodeURIComponent(provider.provider_id)}/${encodeURIComponent(provider.version)}`;
    return readJson<PluginProvider>(await apiFetch(`${API_BASE}/plugins/${path}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, reason, expected_revision: provider.revision }) }));
  },
	async approve(provider: PluginProvider): Promise<PluginProvider> {
		const path = `${encodeURIComponent(provider.provider_id)}/${encodeURIComponent(provider.version)}`;
		return readJson<PluginProvider>(await apiFetch(`${API_BASE}/plugins/${path}/review`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ review_status: 'APPROVED', expected_revision: provider.revision }) }));
	},
	async scan(provider: PluginProvider): Promise<PluginProvider> {
		const path = `${encodeURIComponent(provider.provider_id)}/${encodeURIComponent(provider.version)}`;
		return readJson<PluginProvider>(await apiFetch(`${API_BASE}/plugins/${path}/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_revision: provider.revision }) }));
  },
  async reload(): Promise<Record<string, unknown>> {
    return readJson<Record<string, unknown>>(await apiFetch(`${API_BASE}/plugins/reload`, { method: 'POST' }));
  },
  async audit(limit = 50): Promise<PluginInvocationTrace[]> {
    const value = await readJson<{ items: PluginInvocationTrace[] }>(await apiFetch(`${API_BASE}/plugins/audit?limit=${limit}`));
    return value.items || [];
  },
};

export interface ControlDevice {
  id: string;
  user_id?: string;
  name: string;
  platform: string;
  architecture: string;
  capabilities: string[];
	capability_instances?: CapabilityInstance[];
  online: boolean;
  connected_at?: string;
  last_seen_at?: string;
}

export type ControlTask = TaskSession;
export type ControlApproval = Approval;

export interface ControlApprovalDecision {
	approval: ControlApproval;
	observation?: ControlObservation | null;
	pending_recovery: boolean;
}

export const controlApi = {
  async devices(): Promise<ControlDevice[]> {
    const result = await readJson<{ devices: ControlDevice[] }>(await apiFetch(`${RUNTIME_API_BASE}/control/devices`));
    return result.devices || [];
  },
  async bindDevice(deviceId: string): Promise<void> {
    await readJson(await apiFetch(`${RUNTIME_API_BASE}/control/devices/${encodeURIComponent(deviceId)}/bind`, { method: 'POST' }));
  },
	async approvals(status = 'PENDING'): Promise<ControlApproval[]> {
		const query = status ? `?status=${encodeURIComponent(status)}` : '';
		const result = await readJson<{ approvals: ControlApproval[] }>(await apiFetch(`${RUNTIME_API_BASE}/control/approvals${query}`));
		return result.approvals || [];
	},
	async decideApproval(approvalId: string, approved: boolean, reason = ''): Promise<ControlApprovalDecision> {
		return readJson<ControlApprovalDecision>(await apiFetch(`${RUNTIME_API_BASE}/control/approvals/${encodeURIComponent(approvalId)}/decision`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ approved, reason }),
		}));
	},
  async tasks(conversationId?: string): Promise<ControlTask[]> {
    const query = conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : '';
    const result = await readJson<{ tasks: ControlTask[] }>(await apiFetch(`${RUNTIME_API_BASE}/control/tasks${query}`));
    return result.tasks || [];
  },
	async task(taskId: string): Promise<ControlTask> {
		return readJson<ControlTask>(await apiFetch(`${RUNTIME_API_BASE}/control/tasks/${encodeURIComponent(taskId)}`));
	},
	async taskEvents(taskId: string, after = 0): Promise<TaskEvent[]> {
		const result = await readJson<{ events: TaskEvent[] }>(await apiFetch(`${RUNTIME_API_BASE}/control/tasks/${encodeURIComponent(taskId)}/events?after=${after}`));
		return result.events || [];
	},
	async taskWorld(taskId: string): Promise<WorldState> {
		return readJson<WorldState>(await apiFetch(`${RUNTIME_API_BASE}/control/tasks/${encodeURIComponent(taskId)}/world`));
	},
	async cancelTask(taskId: string, reason = 'user requested cancellation'): Promise<void> {
		await readJson(await apiFetch(`${RUNTIME_API_BASE}/control/tasks/${encodeURIComponent(taskId)}/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reason }),
		}));
	},
	subscribeTaskEvents(taskId: string, after: number, onEvent: (event: TaskEvent) => void, onError?: () => void): () => void {
		const url = `${RUNTIME_API_BASE}/control/tasks/${encodeURIComponent(taskId)}/events/stream?after=${after}`;
		const source = new EventSource(url, { withCredentials: true });
		source.addEventListener('task_event', raw => {
			try {
				onEvent(JSON.parse((raw as MessageEvent<string>).data) as TaskEvent);
			} catch (error) {
				console.warn('[control] ignored malformed task event', error);
			}
		});
		source.onerror = () => onError?.();
		return () => source.close();
	},
	async executeSuggestedAction(action: BrowserSuggestedAction, sessionId: string, deviceId = ''): Promise<ControlObservation> {
		const allowedCapabilities = new Set(['browser.click', 'browser.play', 'browser.pause', 'browser.navigate', 'browser.press']);
    if (action.schema !== 'athena.browser.suggestion.v1' || !allowedCapabilities.has(action.capability)) {
      throw new Error('Unsupported browser suggestion');
    }
    if (!sessionId) {
      throw new Error('The browser session is no longer available');
    }
		const taskId = runtimeControlID('browser-task');
		const stepId = runtimeControlID('browser-step');
		const actionId = runtimeControlID('browser-action');
		const risk = controlRisk(action.risk);
		const issuedAt = new Date();
		const operation = action.capability.includes('.') ? action.capability.split('.').at(-1) : action.capability;
		const protocolAction: ProtocolAction = {
			protocol: ATHENA_PROTOCOL,
			type: 'ACTION',
			task_id: taskId,
			step_id: stepId,
			action_id: actionId,
			session_id: sessionId,
			sequence: 1,
			revision: 1,
			idempotency_key: `${taskId}:${stepId}:${actionId}`,
			issued_at: issuedAt.toISOString(),
			deadline: new Date(issuedAt.getTime() + 60_000).toISOString(),
			capability: action.capability,
			operation,
			arguments: { ...action.arguments },
			policy: {
				risk,
				decision: 'ALLOW',
				reason: 'The signed-in user explicitly selected this browser action in the Athena UI.',
			},
			expected_observation: { kind: action.capability, timeout_ms: 60_000 },
		};
		const response = await apiFetch(`${RUNTIME_API_BASE}/control/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ device_id: deviceId, action: protocolAction }),
    });
    return readJson<ControlObservation>(response);
  },
};

function controlRisk(value: string) {
	switch (String(value || '').toUpperCase()) {
		case 'R1':
		case 'MEDIUM':
			return 'R1' as const;
		case 'R2':
		case 'HIGH':
			return 'R2' as const;
		case 'R3':
		case 'SENSITIVE':
			return 'R3' as const;
		default:
			return 'R0' as const;
	}
}

function runtimeControlID(prefix: string): string {
  const value = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '')
    : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

async function readJson<T = any>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json.message || json.error || `Request failed: ${res.status}`;
    const traceId = json.trace_id || res.headers.get('X-Trace-Id') || res.headers.get('X-Request-Id');
    throw new Error(traceId ? `${message} (Trace ID: ${traceId})` : message);
  }
  return json.data ?? json;
}

export interface AuthResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: { ulid: string; member_code: string; nick_name: string; avatar_url?: string; admin_level?: number };
}

export function resolveRuntimeAssetUrl(path?: string) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  return `${RUNTIME_CLIENT_ORIGIN.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export const authApi = {
  async login(username: string, password: string): Promise<AuthResult> {
    const res = await apiFetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    return readJson<AuthResult>(res);
  },
  async register(username: string, password: string, nickname: string): Promise<AuthResult> {
    const res = await apiFetch(`${API_BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, nickname }) });
    return readJson<AuthResult>(res);
  },
  async me(): Promise<AuthResult['user']> {
    return readJson<AuthResult['user']>(await apiFetch(`${API_BASE}/auth/me`));
  },
  async logout(): Promise<void> {
    await readJson(await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST' }));
  },
  async uploadAvatar(file: File): Promise<AuthResult['user']> {
    const form = new FormData();
    form.append('avatar', file);
    return readJson<AuthResult['user']>(await apiFetch(`${API_BASE}/auth/me/avatar`, { method: 'PUT', body: form }));
  },
};

export interface VoiceAvatarDTO {
  id: string;
  name: string;
  kind: 'image' | 'video';
  url: string;
}

export const voiceAvatarApi = {
  async list(): Promise<VoiceAvatarDTO[]> {
    const res = await readJson<VoiceAvatarDTO[]>(await apiFetch(`${API_BASE}/auth/me/voice-avatars`));
    return (res || []).map(item => ({ ...item, url: resolveRuntimeAssetUrl(item.url) }));
  },
  async upload(file: File): Promise<VoiceAvatarDTO> {
    const form = new FormData();
    form.append('avatar', file);
    const item = await readJson<VoiceAvatarDTO>(await apiFetch(`${API_BASE}/auth/me/voice-avatars`, { method: 'POST', body: form }));
    return { ...item, url: resolveRuntimeAssetUrl(item.url) };
  },
  async remove(id: string): Promise<void> {
    await readJson(await apiFetch(`${API_BASE}/auth/me/voice-avatars/${encodeURIComponent(id)}`, { method: 'DELETE' }));
  },
};

export type PromptAssistantMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface PromptAssistantStreamParams {
  modelId: string;
  messages: PromptAssistantMessage[];
  prompt: string;
  userId: string;
  sessionId: string;
  signal?: AbortSignal;
}

export const promptAssistantApi = {
  // Streams an ad-hoc completion from one of the user's existing models WITHOUT a
  // saved agent, by sending an inline model + messages to the runtime.
  async stream(params: PromptAssistantStreamParams): Promise<Response> {
    const body = {
      prompt: params.prompt,
      request_id: makeId(),
      messages: params.messages,
      models: { default: { extra_fields: { model_id: params.modelId } } },
      context: {
        user_id: params.userId,
        session_id: params.sessionId,
        is_test: true,
      },
      options: { stream: true },
    };
    const res = await apiFetch(`${RUNTIME_API_BASE}/run/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: params.signal,
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || `Failed to run prompt assistant: ${res.status}`);
    }
    return res;
  },
};

export interface AgentMemory {
  ulid: string;
  agent_id: string;
  session_id: string;
  name: string;
  description: string;
  memory_type: string;
  content: string;
  importance: number;
  created_at: number;
  updated_at: number;
}

export const memoryApi = {
  async findAll(params: { agent_id?: string; session_id?: string; limit?: number } = {}): Promise<AgentMemory[]> {
    const res = await apiFetch(`${API_BASE}/memory/all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    return readJson<AgentMemory[]>(res);
  },
  async create(data: Omit<AgentMemory, 'ulid' | 'created_at' | 'updated_at'>): Promise<AgentMemory> {
    const res = await apiFetch(`${API_BASE}/memory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return readJson<AgentMemory>(res);
  },
  async delete(ulid: string): Promise<void> {
    await readJson(await apiFetch(`${API_BASE}/memory/${ulid}`, { method: 'DELETE' }));
  },
  async export(): Promise<unknown> {
    return readJson(await apiFetch(`${API_BASE}/memory/export`));
  },
  async deleteAll(): Promise<{ deleted: number }> {
    return readJson(await apiFetch(`${API_BASE}/memory`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE ALL MEMORY' }),
    }));
  },
};

const localStore = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const makeId = () =>
  `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface Model {
  ulid: string;
  created_at: number;
  updated_at: number;
  created_by: string;
  updated_by: string;
  name: string;
  provider: string;
  baseUrl: string;
  modelType: 'llm' | 'embedding' | 'image' | 'video';
  category: string;
  status: string;
  latency: string;
  contextWindow: string;
  usage: number;
	usageRate?: number;
	usageCount?: number;
	successRate?: number;
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	enabled: boolean;
	runtimeMode: ModelRuntimeMode;
	keyId?: string;
	keyName?: string;
	capabilities?: string;
}

export interface ModelKey {
	ulid: string;
	created_at: number;
	updated_at: number;
	name: string;
	provider: string;
	baseUrl: string;
	keyMask: string;
	hasKey: boolean;
	enabled: boolean;
	modelCount: number;
}

export interface ModelCatalog {
  ulid: string;
  created_at: number;
  updated_at: number;
  provider: string;
  modelType: 'llm' | 'embedding' | 'image' | 'video';
  modelFamily: string;
  modelVersion: string;
  displayName: string;
  defaultBaseUrl: string;
  contextWindow: string;
  isFree: boolean;
  installable: boolean;
  runtime: string;
  downloadSize: string;
  minMemoryGB: number;
  capabilities: string;
  description: string;
  enabled: boolean;
  sort: number;
}

export interface LocalModelEnvironment {
  os: string;
  arch: string;
  memoryGB: number;
  memoryTotalBytes: number;
  memoryAvailableBytes: number;
  storageTotalBytes: number;
  storageAvailableBytes: number;
  runtime: string;
  runtimeInstalled: boolean;
  runtimeRunning: boolean;
  runtimeVersion: string;
  runtimeInstallSupported: boolean;
  modelInstalled: boolean;
  compatible: boolean;
  message: string;
}

export interface MediaGenerationRequest {
  modelId: string;
  mediaType: 'image' | 'video';
  operation?: 'generate';
  prompt: string;
  negativePrompt?: string;
  sourceUrl?: string;
  size?: string;
  quality?: string;
  durationSeconds?: number;
}

export interface MediaGenerationResult {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  mimeType: string;
  providerJobId?: string;
  traceId?: string;
}

export interface MediaGenerationJob {
  ulid: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  modelName: string;
  mediaType: 'image' | 'video';
  prompt: string;
  negativePrompt?: string;
  sourceUrl?: string;
  size?: string;
  quality?: string;
  durationSeconds?: number;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  mediaUrl?: string;
  mimeType?: string;
  providerJobId?: string;
  errorMessage?: string;
  traceId?: string;
  startedAt?: number;
  finishedAt?: number;
}

export const mediaApi = {
  async generate(data: MediaGenerationRequest): Promise<MediaGenerationResult> {
    return readJson<MediaGenerationResult>(await apiFetch(`${RUNTIME_API_BASE}/media/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }));
  },

  async createJob(data: MediaGenerationRequest): Promise<MediaGenerationJob> {
    return readJson<MediaGenerationJob>(await apiFetch(`${RUNTIME_API_BASE}/media/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }));
  },

  async jobs(mediaType?: 'image' | 'video'): Promise<MediaGenerationJob[]> {
    const query = mediaType ? `?mediaType=${mediaType}&limit=100` : '?limit=100';
    return readJson<MediaGenerationJob[]>(await apiFetch(`${RUNTIME_API_BASE}/media/jobs${query}`));
  },

  async job(id: string): Promise<MediaGenerationJob> {
    return readJson<MediaGenerationJob>(await apiFetch(`${RUNTIME_API_BASE}/media/jobs/${encodeURIComponent(id)}`));
  },

  async deleteJob(id: string): Promise<void> {
    await readJson(await apiFetch(`${RUNTIME_API_BASE}/media/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }));
  },
};

export interface LocalModelInstallJob {
  jobId: string;
  catalogId: string;
  modelVersion: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string;
  progress: number;
  message: string;
  error?: string;
}

export interface ModelTrainingEnvironment {
  os: string;
  arch: string;
  backend: string;
  supported: boolean;
  pythonInstalled: boolean;
  dependenciesReady: boolean;
  acceleratorAvailable: boolean;
  message: string;
}

export interface ModelTrainingJob {
  ulid: string;
  createdAt: number;
  updatedAt: number;
  mode: 'fine_tune' | 'distill';
  name: string;
  studentModelId: string;
  studentModelName: string;
  teacherModelId: string;
  teacherModelName: string;
  datasetOriginalName: string;
  outputName: string;
  outputModelId: string;
  backend: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
  stage: string;
  progress: number;
  sampleCount: number;
  configJson: string;
  metricsJson: string;
  logText?: string;
  errorMsg?: string;
  startedAt: number;
  finishedAt: number;
}

export interface ConfigDocument {
  content: string;
  path: string;
}

export interface ConfigStatus {
  app_config_file: string;
  skills_config_file: string;
  restart_supported: boolean;
}

export interface RuntimeConfigStatus {
  service: string;
  pid: number;
  runtime_config_file: string;
  skills_config_file: string;
  restart_supported: boolean;
}

export interface PortConflict {
  port: number;
  protocol: string;
  pid: number;
  command: string;
  service?: string;
  managed: boolean;
  same_service: boolean;
}

export interface ConfigSaveResult {
  message: string;
  path: string;
  restart_required: boolean;
}

export const configApi = {
  async getAppConfig(): Promise<ConfigDocument> {
    return readJson<ConfigDocument>(await apiFetch(`${API_BASE}/config/app`));
  },

  async saveAppConfig(content: string): Promise<ConfigSaveResult> {
    const res = await apiFetch(`${API_BASE}/config/app`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return readJson<ConfigSaveResult>(res);
  },

  async getSkillsConfig(): Promise<ConfigDocument> {
    return readJson<ConfigDocument>(await apiFetch(`${API_BASE}/config/skills`));
  },

  async saveSkillsConfig(content: string): Promise<ConfigSaveResult> {
    const res = await apiFetch(`${API_BASE}/config/skills`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return readJson<ConfigSaveResult>(res);
  },

  async getStatus(): Promise<ConfigStatus> {
    return readJson<ConfigStatus>(await apiFetch(`${API_BASE}/config/status`));
  },

  async checkRestart(target: 'client' | 'runtime'): Promise<{ target: string; conflicts: PortConflict[] }> {
    return readJson(await apiFetch(`${API_BASE}/config/restart/check?target=${target}`));
  },

  async restart(killPids: number[] = []): Promise<void> {
    await readJson(await apiFetch(`${API_BASE}/config/restart`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kill_pids: killPids }),
    }));
  },

  async getRuntimeConfig(): Promise<ConfigDocument> {
    return readJson<ConfigDocument>(await apiFetch(`${API_BASE}/config/runtime`));
  },

  async saveRuntimeConfig(content: string): Promise<ConfigSaveResult> {
    return readJson<ConfigSaveResult>(await apiFetch(`${API_BASE}/config/runtime`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
    }));
  },

  async getRuntimeSkillsConfig(): Promise<ConfigDocument> {
    return readJson<ConfigDocument>(await apiFetch(`${API_BASE}/config/runtime/skills`));
  },

  async saveRuntimeSkillsConfig(content: string): Promise<ConfigSaveResult> {
    return readJson<ConfigSaveResult>(await apiFetch(`${API_BASE}/config/runtime/skills`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
    }));
  },

  async getRuntimeStatus(): Promise<RuntimeConfigStatus> {
    return readJson<RuntimeConfigStatus>(await apiFetch(`${API_BASE}/config/runtime/status`));
  },

  async restartRuntime(killPids: number[] = []): Promise<void> {
    await readJson(await apiFetch(`${API_BASE}/config/runtime/restart`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kill_pids: killPids }),
    }));
  },
};

export const modelApi = {
  async create(data: {
    name: string;
    provider: string;
    baseUrl: string;
	keyId: string;
    modelType: 'llm' | 'embedding' | 'image' | 'video';
    category: string;
    contextWindow?: string;
	capabilities?: string;
  }): Promise<{ ulid: string }> {
    const res = await apiFetch(`${API_BASE}/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to create model');
    }
    return json.data;
  },

  async update(ulid: string, data: {
    name?: string;
    provider?: string;
    baseUrl?: string;
	keyId?: string;
    modelType?: 'llm' | 'embedding' | 'image' | 'video';
    category?: string;
    status?: string;
    latency?: string;
    contextWindow?: string;
	capabilities?: string;
  }): Promise<void> {
    const res = await apiFetch(`${API_BASE}/model/${ulid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || 'Failed to update model');
    }
  },

  async delete(ulid: string): Promise<void> {
    const res = await apiFetch(`${API_BASE}/model/${ulid}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || 'Failed to delete model');
    }
  },

  async findById(ulid: string): Promise<Model> {
    const res = await apiFetch(`${API_BASE}/model/${ulid}`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find model');
    }
    // API returns object directly, not wrapped in {data: ...}
    return json.data || json;
  },

  async findAll(modelType?: 'llm' | 'embedding' | 'image' | 'video', includeDisabled = false): Promise<Model[]> {
    const res = await apiFetch(`${API_BASE}/model/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelType }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find models');
    }
    // API returns array directly, not wrapped in {data: [...]}
		const models: Model[] = Array.isArray(json) ? json : (json.data || []);
		return includeDisabled ? models : models.filter(model => model.enabled !== false && model.runtimeMode !== MODEL_RUNTIME_MODE.OFF);
  },

	async findAdminAll(): Promise<Model[]> {
		return readJson<Model[]>(await apiFetch(`${API_BASE}/model/admin/all`));
	},

	async updateEnabled(ulid: string, enabled: boolean): Promise<void> {
		await readJson(await apiFetch(`${API_BASE}/model/${ulid}/enabled`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled }),
		}));
	},

	async updateRuntimeMode(ulid: string, runtimeMode: ModelRuntimeMode): Promise<void> {
		await readJson(await apiFetch(`${API_BASE}/model/${ulid}/runtime-mode`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ runtimeMode }),
		}));
	},

  async findCatalog(params?: { modelType?: 'llm' | 'embedding' | 'image' | 'video'; provider?: string }): Promise<ModelCatalog[]> {
    const search = new URLSearchParams();
    if (params?.modelType) search.set('modelType', params.modelType);
    if (params?.provider) search.set('provider', params.provider);
    const qs = search.toString();
    const res = await apiFetch(`${API_BASE}/model/catalog${qs ? `?${qs}` : ''}`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find model catalog');
    }
    return Array.isArray(json) ? json : (json.data || []);
  },

  async localEnvironment(catalogId: string): Promise<LocalModelEnvironment> {
    return readJson<LocalModelEnvironment>(await apiFetch(`${API_BASE}/model/catalog/${catalogId}/environment`));
  },

  async installLocal(catalogId: string): Promise<{ jobId: string }> {
    return readJson<{ jobId: string }>(await apiFetch(`${API_BASE}/model/catalog/${catalogId}/install`, { method: 'POST' }));
  },

  async installJob(jobId: string): Promise<LocalModelInstallJob> {
    return readJson<LocalModelInstallJob>(await apiFetch(`${API_BASE}/model/install/${jobId}`));
  },

  async trainingEnvironment(): Promise<ModelTrainingEnvironment> {
    return readJson<ModelTrainingEnvironment>(await apiFetch(`${API_BASE}/model/training/environment`));
  },

  async createTraining(form: FormData): Promise<ModelTrainingJob> {
    return readJson<ModelTrainingJob>(await apiFetch(`${API_BASE}/model/training`, { method: 'POST', body: form }));
  },

  async trainingJobs(): Promise<ModelTrainingJob[]> {
    return readJson<ModelTrainingJob[]>(await apiFetch(`${API_BASE}/model/training`));
  },

  async trainingJob(jobId: string): Promise<ModelTrainingJob> {
    return readJson<ModelTrainingJob>(await apiFetch(`${API_BASE}/model/training/${jobId}`));
  },

  async cancelTraining(jobId: string): Promise<void> {
    await readJson(await apiFetch(`${API_BASE}/model/training/${jobId}/cancel`, { method: 'POST' }));
  },

  async findPage(params: {
    query?: any[];
    page_data?: { page: number; page_size: number };
    sort_data?: { field: string; order: 'asc' | 'desc' };
  }): Promise<{ entries: Model[]; page_data: { page: number; page_size: number; total: number } }> {
    const res = await apiFetch(`${API_BASE}/model/page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find models');
    }
    // API returns object directly, not wrapped in {data: ...}
    return json.data || json;
  },
};

export const modelKeyApi = {
	async findAll(): Promise<ModelKey[]> {
		return readJson<ModelKey[]>(await apiFetch(`${API_BASE}/model-key/all`));
	},
	async create(data: { name: string; provider: string; apiKey: string; baseUrl?: string }): Promise<ModelKey> {
		return readJson<ModelKey>(await apiFetch(`${API_BASE}/model-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }));
	},
	async update(ulid: string, data: { name?: string; provider?: string; apiKey?: string; baseUrl?: string; enabled?: boolean }): Promise<void> {
		await readJson(await apiFetch(`${API_BASE}/model-key/${ulid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }));
	},
	async delete(ulid: string): Promise<void> {
		await readJson(await apiFetch(`${API_BASE}/model-key/${ulid}`, { method: 'DELETE' }));
	},
};

export interface SiteCredential {
  ulid: string;
  created_at: number;
  updated_at: number;
  name: string;
  domain: string;
  login_url: string;
  username_masked: string;
  enabled: boolean;
}

export interface BrowserLoginResult {
  session_id: string;
  url: string;
  domain: string;
  status: 'verification_required';
  message: string;
}

export const siteCredentialApi = {
  async findAll(domain?: string): Promise<SiteCredential[]> {
    const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return readJson<SiteCredential[]>(await apiFetch(`${API_BASE}/site-credential/all${query}`));
  },
  async create(data: { name: string; login_url: string; username: string; password: string }): Promise<SiteCredential> {
    return readJson<SiteCredential>(await apiFetch(`${API_BASE}/site-credential`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }));
  },
  async update(ulid: string, data: { name?: string; login_url?: string; username?: string; password?: string; enabled?: boolean }): Promise<SiteCredential> {
    return readJson<SiteCredential>(await apiFetch(`${API_BASE}/site-credential/${ulid}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }));
  },
  async delete(ulid: string): Promise<void> {
    await readJson(await apiFetch(`${API_BASE}/site-credential/${ulid}`, { method: 'DELETE' }));
  },
  async login(ulid: string, sessionId?: string): Promise<BrowserLoginResult> {
    return readJson<BrowserLoginResult>(await apiFetch(`${API_BASE}/site-credential/${ulid}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId || '' }),
    }));
  },
};

export interface ScheduledTaskDTO {
  ulid: string; agent_id: string; session_id: string; name: string;
  task_type: 'ticket' | 'product' | 'appointment' | 'monitor';
  cron: string; timezone: string; prompt: string; criteria_json: string;
  action_mode: 'confirm_before_commit'; status: 'active' | 'paused';
  last_run_at: number; last_status: string; last_result: string; last_error: string; execution_count: number;
}

export const scheduledTaskApi = {
  async findAll(): Promise<ScheduledTaskDTO[]> { return readJson<ScheduledTaskDTO[]>(await apiFetch(`${API_BASE}/scheduled-task/all`)); },
  async setStatus(ulid: string, status: 'active' | 'paused'): Promise<void> { await readJson(await apiFetch(`${API_BASE}/scheduled-task/${ulid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })); },
  async delete(ulid: string): Promise<void> { await readJson(await apiFetch(`${API_BASE}/scheduled-task/${ulid}`, { method: 'DELETE' })); },
  async approvals(): Promise<ChatApproval[]> { return readJson<ChatApproval[]>(await apiFetch(`${API_BASE}/scheduled-task/approvals`)); },
  async decideApproval(ulid: string, approved: boolean, reason = ''): Promise<{ interactive_completion_required: boolean }> { return readJson(await apiFetch(`${API_BASE}/scheduled-task/approvals/${ulid}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved, reason }) })); },
};

export interface KnowledgeBase {
  ulid: string;
  created_at: number;
  updated_at: number;
  created_by: string;
  updated_by: string;
  name: string;
  description: string;
  retrievalUrl: string;
  token: string;
  enabled: boolean;
}

export interface RecallResult {
  title: string;
  content: string;
  score: number;
}

export const knowledgeBaseApi = {
  async create(data: {
    name: string;
    description?: string;
    retrievalUrl: string;
    token?: string;
    enabled?: boolean;
  }): Promise<{ ulid: string }> {
    const res = await apiFetch(`${API_BASE}/knowledge_base`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to create knowledge base');
    }
    return json.data;
  },

  async update(ulid: string, data: {
    name?: string;
    description?: string;
    retrievalUrl?: string;
    token?: string;
    enabled?: boolean;
  }): Promise<void> {
    const res = await apiFetch(`${API_BASE}/knowledge_base/${ulid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || 'Failed to update knowledge base');
    }
  },

  async delete(ulid: string): Promise<void> {
    const res = await apiFetch(`${API_BASE}/knowledge_base/${ulid}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || 'Failed to delete knowledge base');
    }
  },

  async findById(ulid: string): Promise<KnowledgeBase> {
    const res = await apiFetch(`${API_BASE}/knowledge_base/${ulid}`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find knowledge base');
    }
    return json.data || json;
  },

  async findAll(): Promise<KnowledgeBase[]> {
    const res = await apiFetch(`${API_BASE}/knowledge_base/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find knowledge bases');
    }
    return Array.isArray(json) ? json : (json.data || []);
  },

  async recallTest(ulid: string, query: string, topK: number = 5): Promise<RecallResult[]> {
    const res = await apiFetch(`${API_BASE}/knowledge_base/${ulid}/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to recall');
    }
    return json.data || json;
  },
};

// Command API - 魔法盒命令执行
export interface CommandResult {
  success: boolean;
  action: string;
  result?: any;
  agent_id?: string;
  navigate_to?: string;
  message?: string;
  prefilled?: Record<string, any>;
  show_guidance?: boolean;
}

export const commandApi = {
  async execute(command: string, options: { agentId?: string; sessionId?: string } = {}): Promise<CommandResult> {
    const res = await apiFetch(`${API_BASE}/command/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, agent_id: options.agentId, session_id: options.sessionId }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to execute command');
    }
    return json.data || json;
  },
};

export interface WorkspaceInfo {
  id: string;
  name: string;
  root: string;
}

export interface WorkspaceTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: WorkspaceTreeNode[];
}

export interface WorkspaceSearchHit {
  path: string;
  line: number;
  preview: string;
}

export interface WorkspaceContextFile {
  path: string;
  content: string;
  size: number;
  score: number;
  start_line?: number;
  line_count?: number;
}

export interface WorkspaceEditChange {
  path: string;
  find?: string;
  replace: string;
  occurrence?: number;
  start_line?: number;
  end_line?: number;
}

function extractTextFromRunResult(data: any): string {
  if (typeof data === 'string') return data;
  if (typeof data?.content === 'string') return data.content;
  if (typeof data?.output === 'string') return data.output;
  if (typeof data?.result === 'string') return data.result;
  if (typeof data?.message === 'string') return data.message;
  return JSON.stringify(data, null, 2);
}

export const workspaceApi = {
  async selectFolder(): Promise<{ path: string }> {
    const res = await apiFetch(`${API_BASE}/workspace/select-folder`);
    return readJson(res);
  },

  async import(path: string): Promise<WorkspaceInfo> {
    const res = await apiFetch(`${API_BASE}/workspace/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    return readJson(res);
  },

  async tree(id: string, path: string = ''): Promise<{
    root: WorkspaceInfo;
    tree: WorkspaceTreeNode;
    truncated: boolean;
  }> {
    const qs = new URLSearchParams();
    if (path) qs.set('path', path);
    const res = await apiFetch(`${API_BASE}/workspace/${id}/tree${qs.toString() ? `?${qs}` : ''}`);
    return readJson(res);
  },

  async readFile(id: string, path: string): Promise<{ path: string; content: string; size: number; line_count: number }> {
    const qs = new URLSearchParams({ path });
    const res = await apiFetch(`${API_BASE}/workspace/${id}/file?${qs}`);
    return readJson(res);
  },

  async search(id: string, query: string): Promise<{ hits: WorkspaceSearchHit[] }> {
    const res = await apiFetch(`${API_BASE}/workspace/${id}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    return readJson(res);
  },

  async context(id: string, query: string, limit = 6): Promise<{ files: WorkspaceContextFile[] }> {
    const res = await apiFetch(`${API_BASE}/workspace/${id}/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });
    return readJson(res);
  },

  async buildPatch(id: string, changes: WorkspaceEditChange[]): Promise<{ patch: string }> {
    const res = await apiFetch(`${API_BASE}/workspace/${id}/build-patch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes }),
    });
    return readJson(res);
  },

  async applyPatch(id: string, patch: string, dryRun = false): Promise<{ applied: boolean }> {
    const res = await apiFetch(`${API_BASE}/workspace/${id}/apply-patch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch, dry_run: dryRun }),
    });
    return readJson(res);
  },

  async generatePatch(prompt: string, agentId?: string, signal?: AbortSignal): Promise<string> {
    const res = await apiFetch(`${RUNTIME_API_BASE}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        request_id: makeId(),
        context: { channel: 'workspace', agent_id: agentId || undefined },
        options: { stream: false },
      }),
      signal,
    });
    return extractTextFromRunResult(await readJson(res));
  },
};

export interface Skill {
  ulid: string;
  created_at: number;
  updated_at: number;
  created_by: string;
  updated_by: string;
  name: string;
  description: string;
  skill_type: 'mcp' | 'a2a' | 'skill';
  version: string;
  path: string;
  enabled: boolean;
  config: string;
  is_system: boolean;
  risk_level?: 'low' | 'medium' | 'high';
}

export interface CheckSkillNameResult {
  exists: boolean;
  message: string;
}

export const skillApi = {
  async create(data: {
    name: string;
    description?: string;
    skillType: 'mcp' | 'a2a' | 'skill';
    version?: string;
    path: string;
    enabled?: boolean;
    config?: string;
  }): Promise<{ ulid: string }> {
    const res = await apiFetch(`${API_BASE}/skill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to create skill');
    }
    return json.data;
  },

  async update(ulid: string, data: {
    name?: string;
    description?: string;
    skillType?: 'mcp' | 'a2a' | 'skill';
    version?: string;
    path?: string;
    enabled?: boolean;
    config?: string;
  }): Promise<void> {
    const res = await apiFetch(`${API_BASE}/skill/${ulid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || 'Failed to update skill');
    }
  },

  async delete(ulid: string): Promise<void> {
    const res = await apiFetch(`${API_BASE}/skill/${ulid}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || 'Failed to delete skill');
    }
  },

  async findById(ulid: string): Promise<Skill> {
    const res = await apiFetch(`${API_BASE}/skill/${ulid}`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find skill');
    }
    return json.data || json;
  },

  async findAll(params?: { skill_type?: string; name?: string }): Promise<Skill[]> {
    const res = await apiFetch(`${API_BASE}/skill/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find skills');
    }
    return Array.isArray(json) ? json : (json.data || []);
  },

  async findPage(params: {
    query?: any[];
    page_data?: { page: number; page_size: number };
    sort_data?: { field: string; order: 'asc' | 'desc' };
  }): Promise<{ entries: Skill[]; page_data: { page: number; page_size: number; total: number } }> {
    const res = await apiFetch(`${API_BASE}/skill/page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find skills');
    }
    return json.data || json;
  },

  async checkName(name: string): Promise<CheckSkillNameResult> {
    const res = await apiFetch(`${API_BASE}/skill/check-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to check skill name');
    }
    return json.data || json;
  },

  async upload(file: File): Promise<Skill> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiFetch(`${API_BASE}/skill/upload`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) {
      const errMsg = json.cause ? `${json.message}\n${json.cause}` : (json.message || 'Failed to upload skill');
      throw new Error(errMsg);
    }
    return json.data || json;
  },
};

export const agentApi = {
  async findAll(): Promise<Agent[]> {
    const res = await apiFetch(`${API_BASE}/agent/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find agents');
    }
    return json.data || json;
  },

  async findById(ulid: string): Promise<Agent> {
    const res = await apiFetch(`${API_BASE}/agent/${ulid}`, {
      method: 'GET',
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find agent');
    }
    return json.data || json;
  },

  async create(agent: Partial<Agent>): Promise<{ ulid: string }> {
    const res = await apiFetch(`${API_BASE}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to create agent');
    }
    return json.data || json;
  },

  async update(ulid: string, agent: Partial<Agent>): Promise<void> {
    const res = await apiFetch(`${API_BASE}/agent/${ulid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    });
    if (res.status === 204) {
      return; // No Content
    }
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to update agent');
    }
  },

  async delete(ulid: string): Promise<void> {
    const res = await apiFetch(`${API_BASE}/agent/${ulid}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || 'Failed to delete agent');
    }
  },

  async updateEnabled(ulid: string, enabled: boolean): Promise<void> {
    const res = await apiFetch(`${API_BASE}/agent/${ulid}/enabled`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ulid, enabled }),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || 'Failed to update agent enabled');
    }
  },

  async upload(config: {
    name: string;
    description: string;
    icon: string;
    model: string;
    embedding_model?: string;
    image_model?: string;
    video_model?: string;
    config: string;
    config_json?: string;
    enabled: boolean;
  }): Promise<{ ulid: string }> {
    const res = await apiFetch(`${API_BASE}/agent/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const json = await res.json();
    if (!res.ok) {
      const errMsg = json.cause ? `${json.message}\n${json.cause}` : (json.message || 'Failed to upload agent');
      throw new Error(errMsg);
    }
    return json.data || json;
  },
};

export interface Channel {
  ulid: string;
  created_at: number;
  updated_at: number;
  created_by: string;
  updated_by: string;
  name: string;
  code: string;
  description: string;
  icon: string;
  enabled: boolean;
  sort: number;
}

export const channelApi = {
  async findAll(): Promise<Channel[]> {
    const res = await apiFetch(`${API_BASE}/channel/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Failed to find channels');
    }
    return Array.isArray(json) ? json : (json.data || []);
  },
};

// ====== Chat APIs ======

export interface ChatSession {
  ulid: string;
  user_id: string;
  agent_id: string;
  title: string;
  channel: string;
  model: string;
  status: string;
  created_at: number;
  updated_at: number;
  created_by: string;
  updated_by: string;
}

export interface ChatMessage {
  ulid: string;
  session_id: string;
  role: string;
  content: string;
  model: string;
  tokens: number;
  latency_ms: number;
  trace: string;
  status: string;
  error_msg: string;
  metadata: string;
  created_at: number;
  updated_at: number;
}

export interface ChatApproval {
  ulid: string;
  message_id: string;
  session_id: string;
  tool_name: string;
  tool_type: string;
  risk_level: string;
  parameters: string;
  status: string;
  interrupt_id: string;
  approved_by: string;
  approved_at: number;
  reason: string;
  created_at: number;
  updated_at: number;
}

export type RunHistoryMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type RunAgentParams = {
  agent_id: string;
  user_id: string;
  session_id?: string;
  input: string;
  files?: any[];
  history?: RunHistoryMessage[];
	context?: Record<string, unknown>;
	is_test?: boolean;
	capabilities?: RuntimeCapabilityConfig[];
	request_id?: string;
  signal?: AbortSignal;
};

type ResumeAgentParams =
  | {
      checkpoint_id: string;
      approvals: Array<{
        interrupt_id: string;
        approved: boolean;
        disapprove_reason?: string;
      }>;
      request_id?: string;
    }
  | {
      interrupt_id: string;
      approved: boolean;
      approved_by?: string;
      reason?: string;
      checkpoint_id?: string;
      request_id?: string;
    };

const SESSION_KEY = 'agent-runtime-client.chat.sessions';
const MESSAGE_KEY = 'agent-runtime-client.chat.messages';
const APPROVAL_KEY = 'agent-runtime-client.chat.approvals';

function normalizeRuntimeConfig(data: RunAgentParams) {
  const context = {
    session_id: data.session_id || '',
    user_id: data.user_id,
    agent_id: data.agent_id,
    is_test: Boolean(data.is_test),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local',
		locale: i18n.resolvedLanguage || i18n.language || 'en',
		...(data.context || {}),
  };

  return {
    prompt: data.input,
		request_id: data.request_id || makeId(),
    context,
    messages: (data.history || [])
      .filter(m => m && typeof m.content === 'string' && m.content.trim() !== '')
      .map(m => ({ role: m.role, content: m.content })),
    files: (data.files || []).map(file => ({
      name: file.name,
      size: file.size || 0,
      type: file.type || '',
      virtual_path: file.virtual_path || file.url || file.name,
    })),
		capabilities: data.capabilities || [],
    options: {
      stream: true,
    },
  };
}

async function buildRunRequest(data: RunAgentParams) {
  return normalizeRuntimeConfig(data);
}

function getLocalSessions() {
  return localStore.get<ChatSession[]>(SESSION_KEY, []);
}

function setLocalSessions(sessions: ChatSession[]) {
  localStore.set(SESSION_KEY, sessions);
}

function getLocalMessages() {
  return localStore.get<ChatMessage[]>(MESSAGE_KEY, []);
}

function setLocalMessages(messages: ChatMessage[]) {
  localStore.set(MESSAGE_KEY, messages);
}

function getLocalApprovals() {
  return localStore.get<ChatApproval[]>(APPROVAL_KEY, []);
}

function setLocalApprovals(approvals: ChatApproval[]) {
  localStore.set(APPROVAL_KEY, approvals);
}

export const chatApi = {
  // Chat Session APIs
  async createSession(data: {
    user_id: string;
    agent_id: string;
    title?: string;
    channel?: string;
    model?: string;
    status?: string;
  }): Promise<{ ulid: string }> {
    const ulid = makeId();
    const now = Date.now();
    const session: ChatSession = {
      ulid,
      user_id: data.user_id,
      agent_id: data.agent_id,
      title: data.title || '新会话',
      channel: data.channel || 'web',
      model: data.model || '',
      status: data.status || 'active',
      created_at: now,
      updated_at: now,
      created_by: data.user_id,
      updated_by: data.user_id,
    };
    setLocalSessions([session, ...getLocalSessions()]);
    return { ulid };
  },

  async getSession(ulid: string): Promise<ChatSession> {
    const session = getLocalSessions().find(item => item.ulid === ulid);
    if (!session) throw new Error('Session not found');
    return session;
  },

  async updateSession(data: {
    ulid: string;
    title?: string;
    status?: string;
  }): Promise<void> {
    setLocalSessions(getLocalSessions().map(item =>
      item.ulid === data.ulid
        ? { ...item, ...data, updated_at: Date.now() }
        : item
    ));
  },

  async deleteSession(ulid: string): Promise<void> {
    setLocalSessions(getLocalSessions().filter(item => item.ulid !== ulid));
    setLocalMessages(getLocalMessages().filter(item => item.session_id !== ulid));
  },

  async getSessionsByUserId(userId: string, status?: string): Promise<ChatSession[]> {
    return getLocalSessions()
      .filter(item => item.user_id === userId && (!status || item.status === status))
      .sort((a, b) => b.updated_at - a.updated_at);
  },

  // Chat Message APIs
  async createMessage(data: {
    session_id: string;
    role: string;
    content: string;
    model?: string;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    latency_ms?: number;
    trace?: string;
    status?: string;
    error_msg?: string;
    metadata?: string;
    files?: string; // JSON array of file info
  }): Promise<{ ulid: string }> {
    const ulid = makeId();
    const now = Date.now();
    const metadata = data.metadata || data.files || '';
    const msg: ChatMessage = {
      ulid,
      session_id: data.session_id,
      role: data.role,
      content: data.content,
      model: data.model || '',
      tokens: data.total_tokens || 0,
      latency_ms: data.latency_ms || 0,
      trace: data.trace || '',
      status: data.status || 'completed',
      error_msg: data.error_msg || '',
      metadata,
      created_at: now,
      updated_at: now,
    };
    setLocalMessages([...getLocalMessages(), msg]);
    setLocalSessions(getLocalSessions().map(item =>
      item.ulid === data.session_id
        ? { ...item, updated_at: now }
        : item
    ));
    return { ulid };
  },

  async updateMessage(data: {
    ulid: string;
    content?: string;
    tokens?: number;
    status?: string;
    error_msg?: string;
  }): Promise<void> {
    setLocalMessages(getLocalMessages().map(item =>
      item.ulid === data.ulid
        ? {
            ...item,
            content: data.content ?? item.content,
            tokens: data.tokens ?? item.tokens,
            status: data.status ?? item.status,
            error_msg: data.error_msg ?? item.error_msg,
            updated_at: Date.now(),
          }
        : item
    ));
  },

  async getMessage(ulid: string): Promise<ChatMessage> {
    const message = getLocalMessages().find(item => item.ulid === ulid);
    if (!message) throw new Error('Message not found');
    return message;
  },

  async getMessagesBySessionId(sessionId: string): Promise<ChatMessage[]> {
    return getLocalMessages()
      .filter(item => item.session_id === sessionId)
      .sort((a, b) => a.created_at - b.created_at);
  },

  // Chat Approval APIs
  async createApproval(data: {
    message_id: string;
    session_id: string;
    tool_name: string;
    tool_type?: string;
    risk_level?: string;
    parameters?: string;
    status?: string;
    interrupt_id?: string;
  }): Promise<{ ulid: string }> {
    const ulid = makeId();
    const now = Date.now();
    setLocalApprovals([
      ...getLocalApprovals(),
      {
        ulid,
        message_id: data.message_id,
        session_id: data.session_id,
        tool_name: data.tool_name,
        tool_type: data.tool_type || '',
        risk_level: data.risk_level || 'medium',
        parameters: data.parameters || '',
        status: data.status || 'pending',
        interrupt_id: data.interrupt_id || '',
        approved_by: '',
        approved_at: 0,
        reason: '',
        created_at: now,
        updated_at: now,
      },
    ]);
    return { ulid };
  },

  async approveApproval(ulid: string, approvedBy: string, reason?: string): Promise<void> {
	if (!ulid.startsWith('local-')) { await scheduledTaskApi.decideApproval(ulid, true, reason); return; }
    setLocalApprovals(getLocalApprovals().map(item =>
      item.ulid === ulid
        ? { ...item, status: 'approved', approved_by: approvedBy, approved_at: Date.now(), reason: reason || '' }
        : item
    ));
  },

  async rejectApproval(ulid: string, approvedBy: string, reason?: string): Promise<void> {
	if (!ulid.startsWith('local-')) { await scheduledTaskApi.decideApproval(ulid, false, reason); return; }
    setLocalApprovals(getLocalApprovals().map(item =>
      item.ulid === ulid
        ? { ...item, status: 'rejected', approved_by: approvedBy, approved_at: Date.now(), reason: reason || '' }
        : item
    ));
  },

  async getApproval(ulid: string): Promise<ChatApproval> {
    const approval = getLocalApprovals().find(item => item.ulid === ulid);
    if (!approval) throw new Error('Approval not found');
    return approval;
  },

  async getApprovalByMessageId(messageId: string): Promise<ChatApproval> {
    const approval = getLocalApprovals().find(item => item.message_id === messageId);
    if (!approval) throw new Error('Approval not found');
    return approval;
  },

  async getPendingApprovals(): Promise<ChatApproval[]> {
	const local = getLocalApprovals().filter(item => item.status === 'pending');
	try {
		const remote = (await scheduledTaskApi.approvals()).filter(item => item.status === 'pending');
		return [...remote, ...local.filter(item => !remote.some(remoteItem => remoteItem.ulid === item.ulid))];
	} catch { return local; }
  },

  async getApprovalsByUserId(userId: string): Promise<ChatApproval[]> {
    return getLocalApprovals().filter(item => !userId || item.approved_by === userId || item.status === 'pending');
  },

  // Runner API - for agent execution
  async runAgent(data: RunAgentParams): Promise<any> {
    const body = await buildRunRequest(data);
    const res = await apiFetch(`${RUNTIME_API_BASE}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, options: { ...(body.options || {}), stream: false } }),
      signal: data.signal,
    });
    return readJson(res);
  },

  // Runner API - streaming version that returns raw Response for SSE
  async runAgentStream(data: RunAgentParams): Promise<Response> {
    const body = await buildRunRequest(data);
    const res = await apiFetch(`${RUNTIME_API_BASE}/run/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: data.signal,
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || `Failed to run agent: ${res.status}`);
    }
    return res;
  },

  // Resume agent execution after approval
  async resumeAgent(data: ResumeAgentParams): Promise<any> {
    const checkpointId = 'checkpoint_id' in data ? data.checkpoint_id : '';
    const approvals = 'approvals' in data
      ? data.approvals
      : [{
          interrupt_id: data.interrupt_id,
          approved: data.approved,
          disapprove_reason: data.approved ? undefined : data.reason,
        }];
    const res = await apiFetch(`${RUNTIME_API_BASE}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkpoint_id: checkpointId,
        approvals,
        request_id: 'request_id' in data ? data.request_id : makeId(),
      }),
    });
    return readJson(res);
  },

  // Stop agent execution
  async stopAgent(checkpoint_id: string, session_id?: string): Promise<{ stopped: boolean }> {
    const res = await apiFetch(`${RUNTIME_API_BASE}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpoint_id, session_id }),
    });
    return readJson(res);
  },

  // Upload files for agent execution
  async uploadFiles(sessionId: string, files: File[]): Promise<{
    files: Array<{
      name: string;
      size: number;
      type: string;
      virtual_path: string;
    }>;
    count: number;
  }> {
    return {
      count: files.length,
      files: files.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        virtual_path: `local://${sessionId}/${file.name}`,
      })),
    };
  },

  // Job execution APIs
  async getJobExecutions(agentId: string, limit: number = 50): Promise<any> {
    const res = await apiFetch(`${API_BASE}/job/execution/byAgentId?agent_id=${agentId}&limit=${limit}`);
    return readJson(res);
  },

  async getJobExecutionDetail(ulid: string): Promise<any> {
    const res = await apiFetch(`${API_BASE}/job/execution/${ulid}`);
    return readJson(res);
  },
};

// ====== Dashboard APIs ======

export interface DashboardOverview {
  active_agents: number;
  periodic_agents: number;
  tasks_completed: number;
  total_tokens: number;
  active_knowledge_sources: number;
}

export interface TokenUsageItem {
  agent_id: string;
  agent_name: string;
  total_tokens: number;
}

export interface ChannelActivityItem {
  channel_id: string;
  channel_name: string;
  status: 'active' | 'inactive';
  message_count: number;
}

export const dashboardApi = {
  // Dashboard 统计概览
  async getOverview(): Promise<DashboardOverview | null> {
    try {
      const res = await apiFetch(`${API_BASE}/dashboard/overview`);
      return await readJson(res);
    } catch (e) {
      console.error('getOverview failed:', e);
      return null;
    }
  },

  // Token 使用排行
  async getTokenUsageRanking(limit: number = 10): Promise<TokenUsageItem[]> {
    try {
      const res = await apiFetch(`${API_BASE}/dashboard/token-ranking?limit=${limit}`);
      const data = await readJson<any>(res);
      // Handle both array and object response
      if (Array.isArray(data)) return data;
      if (data.rankings && Array.isArray(data.rankings)) return data.rankings;
      return [];
    } catch (e) {
      console.error('getTokenUsageRanking failed:', e);
      return [];
    }
  },

  // 渠道活动统计
  async getChannelActivity(): Promise<ChannelActivityItem[]> {
    try {
      const res = await apiFetch(`${API_BASE}/dashboard/channel-activity`);
      const data = await readJson<any>(res);
      // Handle both array and object response
      if (Array.isArray(data)) return data;
      if (data.channels && Array.isArray(data.channels)) return data.channels;
      return [];
    } catch (e) {
      console.error('getChannelActivity failed:', e);
      return [];
    }
  },

  // 最近会话
  async getRecentSessions(limit: number = 10): Promise<ChatSession[]> {
    try {
      const res = await apiFetch(`${API_BASE}/dashboard/recent-sessions?limit=${limit}`);
      const data = await readJson<any>(res);
      if (Array.isArray(data)) return data;
      if (data.sessions && Array.isArray(data.sessions)) return data.sessions;
      return [];
    } catch (e) {
      console.error('getRecentSessions failed:', e);
      return [];
    }
  },
};
