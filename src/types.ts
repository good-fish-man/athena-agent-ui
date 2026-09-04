import type { ModelRuntimeMode } from './lib/runtimeConstants';
import type { Observation as ProtocolObservation } from './generated/athena-protocol-v5';

export type View = 'dashboard' | 'orchestrator' | 'agents' | 'skills' | 'knowledge' | 'models' | 'media' | 'chat' | 'workspace' | 'website-accounts' | 'settings' | 'inbox' | 'experience' | 'world';

export type ExperienceStatus = 'READY' | 'SKIPPED' | 'DELETED';
export type ExperienceOutcome = 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type ExperienceSensitivity = 'INTERNAL' | 'SENSITIVE' | 'RESTRICTED';

export interface ExperienceFailure {
  class: string;
  rule: string;
  summary: string;
  evidence_ids?: string[];
  confidence: number;
}

export interface ExperienceModelUsage {
  model_id?: string;
  model?: string;
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_micros?: number;
}

export interface ExperienceCapabilityUsage {
  capability: string;
  operation?: string;
  calls: number;
  succeeded: number;
  failed: number;
  duration_ms: number;
}

export interface ExperienceRecord {
  schema: 'athena.experience.v1' | string;
  experience_id: string;
  owner_id: string;
  task_id: string;
  status: ExperienceStatus;
  skip_reason?: string;
  goal_summary?: string;
  task_type?: string;
  domain?: string;
  skill_refs?: string[];
  intent?: Record<string, unknown>;
  environment_fingerprint?: string;
  plan_summary?: string;
  decision_summary?: string;
  action_refs?: Array<{
    action_id: string;
    step_id?: string;
    capability: string;
    operation?: string;
    risk?: string;
    outcome?: string;
  }>;
  observation_refs?: Array<{
    observation_id: string;
    action_id: string;
    status: string;
    summary?: string;
    evidence_ids?: string[];
  }>;
  outcome?: ExperienceOutcome;
  verification: { passed: boolean; summary?: string; evidence_ids?: string[] };
  failure_classification?: ExperienceFailure;
  cost: {
    models?: ExperienceModelUsage[];
    capabilities?: ExperienceCapabilityUsage[];
    total_tokens: number;
    total_micros?: number;
  };
  duration_ms: number;
  human_intervention: { required: boolean; approval_count: number; rejected_count: number };
  sensitivity: ExperienceSensitivity;
  retention_policy: { days: number; payload_mode: string; delete_at?: string };
  provenance: {
    trace_id?: string;
    protocol: string;
    event_ids?: string[];
    generated_by: string;
    generated_at: string;
  };
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface ExperiencePreference {
  owner_id: string;
  learning_enabled: boolean;
  retention_days: number;
  max_sensitivity: ExperienceSensitivity;
  updated_at: string;
}

export interface ExperienceStats {
  total: number;
  terminal_tasks: number;
  covered_tasks: number;
  pending_tasks: number;
  coverage_rate: number;
  ready: number;
  skipped: number;
  deleted: number;
  redactions: number;
  evaluation_runs: number;
  evaluation_pass_rate: number;
  failure_classes: Record<string, number>;
}

export interface ExperienceSearchHit {
  experience: ExperienceRecord;
  score: number;
  keyword_score: number;
  similarity_score: number;
  historical_only: true;
}

export interface EvaluationMetrics {
  correctness: number;
  success_rate: number;
  safety_score: number;
  latency_ms: number;
  cost_micros: number;
}

export interface EvaluationFixture {
  schema: string;
  fixture_id: string;
  owner_id: string;
  experience_id: string;
  name: string;
  runtime_kind: string;
  simulator: string;
  environment_version: string;
  snapshot_hash: string;
  protocol: string;
  input: Record<string, unknown>;
  expected: { task_status?: string; observation_status?: string; predicates?: Record<string, unknown> };
  sensitivity: ExperienceSensitivity;
  created_at: string;
}

export interface EvaluationSuite {
  suite_id: string;
  owner_id: string;
  name: string;
  fixture_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface EvaluationRun {
  run_id: string;
  owner_id: string;
  suite_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  seed: number;
  candidate_id?: string;
  baseline_id?: string;
  metrics: EvaluationMetrics;
  baseline_metrics: EvaluationMetrics;
  metric_delta: EvaluationMetrics;
  regression: boolean;
  regression_count: number;
  started_at: string;
  finished_at?: string;
  error?: string;
}

export interface EvaluationResult {
  result_id: string;
  run_id: string;
  fixture_id: string;
  passed: boolean;
  metrics: EvaluationMetrics;
  baseline_metrics: EvaluationMetrics;
  metric_delta: EvaluationMetrics;
  regression: boolean;
  summary: string;
  evidence_ids?: string[];
  created_at: string;
}

export type LearningCandidateKind = 'SKILL' | 'STRATEGY';
export type LearningLifecycle = 'DRAFT' | 'VALIDATING' | 'EVALUATING' | 'REVIEW_REQUIRED' | 'APPROVED_FOR_USE' | 'REJECTED' | 'DEPRECATED' | 'RETIRED';

export interface LearningEvolutionStatus {
  enabled: boolean;
  running: boolean;
  ai_synthesis_enabled: boolean;
  ai_synthesis_model?: string;
  scans: number;
  owners_scanned: number;
  patterns_discovered: number;
  candidates_proposed: number;
  candidates_skipped: number;
  last_scan_at?: string;
  last_completed_at?: string;
  last_error?: string;
}

export interface LearningEvolutionScanResult {
  owners_scanned: number;
  patterns_discovered: number;
  candidates_proposed: number;
  candidates_skipped: number;
  candidate_ids?: string[];
}

export interface DeclarativeSkill {
  id: string;
  version: string;
  description: string;
  preconditions: Array<{ field: string; operator: string; value?: unknown }>;
  required_capabilities: string[];
  task_graph_template: {
    steps: Array<{ id: string; capability: string; operation: string; arguments?: Record<string, unknown>; depends_on?: string[] }>;
  };
  recovery_paths: Array<{ on: string; step_ids: string[]; max_attempts: number }>;
  verification_rules: Array<{ field: string; operator: string; expected?: unknown; evidence_required: boolean }>;
  risk_ceiling: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evaluation_suite: { suite_id: string; minimum_sample: number; minimum_score: number };
  owner_id: string;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  lifecycle_state: LearningLifecycle;
  metadata?: Record<string, string>;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}

export interface DeclarativeStrategy {
  id: string;
  version: string;
  description: string;
  condition: Array<{ field: string; operator: string; value?: unknown }>;
  preferred_skill: string;
  fallback_order?: string[];
  observation_policy: { required_fields?: string[]; require_evidence: boolean };
  retry_budget: { max_attempts: number; max_duration_ms: number };
  verification_policy: Array<{ field: string; operator: string; expected?: unknown; evidence_required: boolean }>;
  risk_ceiling: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  owner_id: string;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  lifecycle_state: LearningLifecycle;
}

export interface LearningCandidate {
  schema: 'athena.learning.v2';
  candidate_id: string;
  owner_id: string;
  kind: LearningCandidateKind;
  status: LearningLifecycle;
  skill?: DeclarativeSkill;
  strategy?: DeclarativeStrategy;
  evidence: {
    experience_ids: string[];
    success_count: number;
    failure_count: number;
    counterexamples: number;
    pattern: string;
    contexts: Array<{
      experience_id: string;
      environment_fingerprint: string;
      site_scope: string;
      outcome: 'SUCCEEDED' | 'FAILED';
      failure_condition?: string;
    }>;
  };
  evaluation: {
    run_id?: string;
    sample_size: number;
    success_rate: number;
    baseline_rate: number;
    delta: number;
    safety_score: number;
    confidence: { lower: number; upper: number; level: number };
    passed: boolean;
  };
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  revision: number;
  trace_id?: string;
  created_at: string;
  updated_at: string;
}

export interface LearningCandidateEvidence {
  evidence_id: string;
  candidate_id: string;
  experience_id: string;
  relation: 'SUPPORTING_SUCCESS' | 'FAILURE_COUNTEREXAMPLE' | string;
  outcome: ExperienceOutcome;
  summary: string;
  trace_id?: string;
  created_at: string;
}

export interface LearningCandidateEvaluation {
  evaluation_id: string;
  candidate_id: string;
  run_id: string;
  summary: LearningCandidate['evaluation'];
  created_at: string;
}

export interface LearnedSkill {
  skill_id: string;
  owner_id: string;
  organization_id?: string;
  latest_version: string;
  status: LearningLifecycle;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  definition: DeclarativeSkill;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface LearnedStrategy {
  strategy_id: string;
  owner_id: string;
  organization_id?: string;
  latest_version: string;
  status: LearningLifecycle;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  definition: DeclarativeStrategy;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface Demonstration {
  schema: 'athena.learning.v2';
  demonstration_id: string;
  owner_id: string;
  task_id: string;
  status: 'RECORDING' | 'PAUSED_SENSITIVE' | 'PREVIEW' | 'CONFIRMED' | 'DISCARDED';
  title: string;
  steps: Array<{ sequence: number; capability: string; operation: string; summary: string; redacted: boolean }>;
  pause_count: number;
  confirmed_by?: string;
  confirmed_at?: string;
  revision: number;
  trace_id?: string;
  created_at: string;
  updated_at: string;
}

export type DeploymentStatus = 'PROPOSED' | 'REVIEWED' | 'SHADOW' | 'CANARY' | 'ACTIVE' | 'PAUSED' | 'ROLLED_BACK' | 'RETIRED';
export type DeploymentRisk = 'R0' | 'R1' | 'R2' | 'R3';

export interface PluginPermissionSet {
  network_domains?: string[];
  filesystem_read?: string[];
  filesystem_write?: string[];
  credential_scopes?: string[];
  device_capabilities?: string[];
  world_read_scopes?: string[];
  world_write_scopes?: string[];
  external_effects: boolean;
}

export interface PluginProviderManifest {
  schema: 'athena.plugin.v1';
  provider_id: string;
  name: string;
  version: string;
  description: string;
  min_runtime_version: string;
	capabilities: Array<{ id: string; description: string; input_schema: Record<string, unknown>; output_schema: Record<string, unknown>; read_only: boolean; risk: DeploymentRisk; observation_contract: string }>;
	permissions: PluginPermissionSet;
	risk_floor: DeploymentRisk;
	resources: { max_execution_ms: number; max_input_bytes: number; max_output_bytes: number; max_concurrency: number; max_memory_mb: number; max_cpu_millis: number };
	health_check: { operation: string; timeout_ms: number; input: Record<string, unknown> };
	runtime: { kind: 'http_json' | 'static_json'; base_url?: string };
	package: { assets: Array<{ path: string; kind: 'schema' | 'knowledge' | 'skill' | 'runtime' | 'test'; sha256: string; size_bytes: number }> };
}

export interface PluginScanReport {
	schema: 'athena.plugin-scan.v1';
	scan_id: string;
	provider_id: string;
	version: string;
	manifest_sha256: string;
	payload_sha256: string;
	scanner_version: string;
	status: 'PASSED' | 'FAILED';
	checks: Array<{ name: string; passed: boolean; message?: string }>;
	findings: Array<{ severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; code: string; message: string; path?: string }>;
	scanned_at: string;
}

export interface PluginProvider {
  provider_id: string;
  version: string;
  name: string;
  description: string;
  status: 'INSTALLED' | 'ACTIVE' | 'DISABLED' | 'REVOKED' | 'QUARANTINED';
  visibility: 'private' | 'public';
	manifest_sha256: string;
	payload_sha256: string;
	scan_status: 'PENDING' | 'PASSED' | 'FAILED';
	scan_report_sha256: string;
	scanned_at: number;
	scan_report: PluginScanReport;
	granted_permissions: PluginPermissionSet;
	granted_resources: PluginProviderManifest['resources'];
  review_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  review_notes?: string;
  approved_by?: string;
  revoked_reason?: string;
  revision: number;
  installed_at: number;
  updated_at: number;
  manifest: PluginProviderManifest;
}

export interface PluginInvocationTrace {
  invocation_id: string;
  provider_id: string;
  provider_version: string;
	capability_id: string;
	owner_id?: string;
	task_id?: string;
	trace_id: string;
	status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'DENIED' | 'UNAVAILABLE';
	manifest_sha256: string;
	permission_snapshot: PluginPermissionSet;
	resource_snapshot: PluginProviderManifest['resources'];
	input_sha256: string;
	output_sha256?: string;
	observation_ref?: string;
	observation_sha256?: string;
  error_code?: string;
  started_at: string;
  duration_ms: number;
}

export type OperationsHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

export interface OperationsHealthCheck {
  name: string;
  status: OperationsHealthStatus;
  latency_ms: number;
  message?: string;
}

export interface OperationsHealthSnapshot {
  schema: 'athena.operations.v1';
  component: string;
  version: string;
  instance_id: string;
  status: OperationsHealthStatus;
  uptime_ms: number;
  inflight: number;
  queue_depth: number;
  checks: OperationsHealthCheck[];
  observed_at: string;
}

export interface OperationsSLOSnapshot {
  schema: 'athena.operations.v1';
  component: string;
  window_start: string;
  window_end: string;
  requests: number;
  errors: number;
  rejected_requests: number;
  timed_out_requests: number;
  availability: number;
  p95_latency_ms: number;
  dropped_events: number;
  duplicate_irreversible_effects: number;
  upgrade_attempts: number;
  upgrade_successes: number;
}

export interface DelegationOperationalSLOSnapshot {
  schema: 'athena.dso.v0alpha';
  window_started_at: string;
  window_ended_at: string;
  total_runs: number;
  terminal_runs: number;
  failed_runs: number;
  recovered_attempts: number;
  fenced_late_results: number;
  duplicate_confirmed_side_effects: number;
  availability: number;
  cancel_propagation_p95_ms: number;
  generated_at: string;
}

export interface OperationsSnapshot {
  schema: 'athena.operations.v1';
  health: OperationsHealthSnapshot;
  runtime_health?: OperationsHealthSnapshot;
  slo?: OperationsSLOSnapshot;
  delegation_slo?: DelegationOperationalSLOSnapshot;
  online_devices: number;
  total_devices: number;
  recovery_managed: boolean;
  observed_at: string;
}

export interface BackupArtifact {
  name: string;
  relative_path: string;
  sha256: string;
  size_bytes: number;
  classification: string;
  encrypted: boolean;
}

export interface BackupManifest {
  schema: 'athena.operations.v1';
  backup_id: string;
  source_version: string;
  protocol_version: string;
  status: 'CREATING' | 'COMPLETE' | 'FAILED' | 'VERIFIED';
  artifacts: BackupArtifact[];
  database_engine: string;
  database_version: string;
  created_at: string;
  completed_at?: string;
  manifest_sha256: string;
  integrity: {
    algorithm: 'HMAC-SHA256';
    key_id: string;
    value: string;
  };
}

export interface BackupInventory {
  items: BackupManifest[];
  configured: boolean;
  reason?: string;
}

export type GAReadinessStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'EXTERNAL_REQUIRED' | 'NOT_RUN';

export interface GAEvidenceRef {
  kind: string;
  reference: string;
  sha256?: string;
}

export interface GAReadinessCheck {
  id: string;
  category: string;
  status: GAReadinessStatus;
  required: boolean;
  message: string;
  evidence?: GAEvidenceRef[];
}

export interface GoldenJourneyStep {
  id: string;
  capability: string;
  expected_evidence: string[];
  requires_approval: boolean;
}

export interface GoldenJourney {
  id: string;
  title: string;
  description: string;
  required: boolean;
  steps: GoldenJourneyStep[];
}

export interface GoldenJourneyStepResult {
  step_id: string;
  status: GAReadinessStatus;
  message: string;
  evidence?: GAEvidenceRef[];
  duration_ms: number;
}

export interface GoldenJourneyResult {
  run_id: string;
  journey_id: string;
  verification_level: 'PREFLIGHT' | 'E2E';
  status: GAReadinessStatus;
  steps: GoldenJourneyStepResult[];
  started_at: string;
  finished_at: string;
}

export interface GAReadinessReport {
  schema: 'athena.ga.v1';
  release_version: string;
  component: string;
  instance_id: string;
  status: GAReadinessStatus;
  checks: GAReadinessCheck[];
  journeys?: GoldenJourneyResult[];
  observed_at: string;
}

export interface AgentBuild {
  schema: 'athena.deployment.v1';
  build_id: string;
  owner_id: string;
  agent_id: string;
  version: string;
  kernel_version: string;
  planner_version: string;
  policy_version: string;
  protocol_version: string;
  skill_versions?: Record<string, string>;
  strategy_versions?: Record<string, string>;
  ontology_version: string;
  prompt_template_versions: Record<string, string>;
  evaluation_suite_version: string;
  artifact_approvals?: ArtifactApprovalReference[];
  risk_level: DeploymentRisk;
  verified: boolean;
  recoverable: boolean;
  trace_id: string;
  checksum: string;
  created_by: string;
  created_at: string;
}

export interface ArtifactApprovalReference {
  kind: 'SKILL' | 'STRATEGY';
  artifact_id: string;
  version: string;
  version_id: string;
  candidate_id: string;
  evaluation_run_id: string;
  reviewed_by: string;
  reviewed_at: string;
  checksum: string;
  verified: boolean;
}

export interface CanaryThresholds {
  minimum_success_rate: number;
  maximum_p95_latency_ms: number;
  maximum_average_cost_micros: number;
  minimum_safety_score: number;
  maximum_intervention_rate: number;
  minimum_samples: number;
}

export interface Promotion {
  schema: 'athena.deployment.v1';
  promotion_id: string;
  owner_id: string;
  agent_id: string;
  build_id: string;
  previous_build_id?: string;
  status: DeploymentStatus;
  risk_level: DeploymentRisk;
  canary_percent: number;
  thresholds: CanaryThresholds;
  verified: boolean;
  recoverable: boolean;
  approved_by?: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface DeploymentExposure {
  exposure_id: string;
  promotion_id: string;
  owner_id: string;
  agent_id: string;
  bucket: number;
  variant: 'CONTROL' | 'CANDIDATE';
  opted_out: boolean;
  created_at: string;
}

export interface ShadowResult {
  schema: 'athena.deployment.v1';
  shadow_id: string;
  promotion_id: string;
  task_id: string;
  trace_id: string;
  input_digest: string;
  evaluator_version: string;
  production_build_id: string;
  candidate_build_id: string;
  production_build_hash: string;
  candidate_build_hash: string;
  production_route_hash: string;
  candidate_route_hash: string;
  production_graph_hash: string;
  candidate_graph_hash: string;
  production_actions_hash: string;
  candidate_actions_hash: string;
  production_cost_micros: number;
  candidate_cost_micros: number;
  production_risk: DeploymentRisk;
  candidate_risk: DeploymentRisk;
  production_planned_actions: number;
  candidate_planned_actions: number;
  production_proof: ShadowSideEffectProof;
  candidate_proof: ShadowSideEffectProof;
  checks: Array<{ id: string; required: boolean; passed: boolean; detail?: string }>;
  latency_ms: number;
  no_external_side_effects: boolean;
  executed_action_count: number;
  passed: boolean;
  summary?: string;
  created_at: string;
}

export interface ShadowSideEffectProof {
  mode: 'PLAN_ONLY';
  world_writes: number;
  network_requests: number;
  device_actions: number;
  credential_reads: number;
  proof_digest: string;
}

export interface CanaryMetric {
  metric_id: string;
  promotion_id: string;
  sample_count: number;
  success_rate: number;
  p95_latency_ms: number;
  average_cost_micros: number;
  safety_score: number;
  intervention_rate: number;
  latest_sample_id: string;
  samples_digest: string;
  stop_triggered: boolean;
  stop_reason?: string;
  created_at: string;
}

export interface CanarySample {
  schema: 'athena.deployment.v1';
  sample_id: string;
  promotion_id: string;
  manifest_id: string;
  exposure_id: string;
  agent_build_id: string;
  task_id: string;
  succeeded: boolean;
  latency_ms: number;
  cost_micros: number;
  safety_score: number;
  intervention: boolean;
  trace_id: string;
  created_at: string;
}

export interface RunManifest {
  manifest_id: string;
  task_id: string;
  agent_id: string;
  agent_build_id: string;
  model_config_version: string;
  capability_instances: string[];
  device_id?: string;
  world_revision: number;
  knowledge_snapshot: string;
  exposure_id?: string;
  created_at: string;
}

export interface DeploymentRollback {
  rollback_id: string;
  promotion_id: string;
  agent_id: string;
  from_build_id: string;
  to_build_id: string;
  reason: string;
  requested_by: string;
  created_at: string;
}

export interface KnowledgeProvenance {
  producer: string;
  method: string;
  trace_id?: string;
  source_task_id?: string;
  captured_at: string;
  content_sha256: string;
}

export interface KnowledgeEvidence {
  schema: 'athena.knowledge.v1';
  evidence_id: string;
  owner_id: string;
  organization_id?: string;
  scope: 'USER' | 'ORGANIZATION' | 'PUBLIC';
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'RESTRICTED';
  source_type: 'OFFICIAL' | 'RESEARCH' | 'PAGE_OBSERVATION' | 'USER_CONFIRMATION';
  title: string;
  uri?: string;
  accessible: boolean;
  excerpt: string;
  authority: number;
  freshness: number;
  published_at?: string;
  observed_at: string;
  stale_at?: string;
  trust_profile: string;
  access_verified_at: string;
  provenance: KnowledgeProvenance;
}

export interface KnowledgeClaim {
  schema: 'athena.knowledge.v1';
  claim_id: string;
  owner_id: string;
  organization_id?: string;
  subject: string;
  predicate: string;
  value: string;
  scope: 'USER' | 'ORGANIZATION' | 'PUBLIC';
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'RESTRICTED';
  evidence_refs: string[];
  confidence: number;
  time_sensitive: boolean;
  valid_from?: string;
  valid_until?: string;
  contradicted_by?: string[];
  relations?: Array<{ predicate: string; target_claim_id: string; weight: number }>;
  status: 'ACTIVE' | 'EXPIRED' | 'CONTRADICTED' | 'RETRACTED';
  provenance: KnowledgeProvenance;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeContradiction {
  contradiction_id: string;
  subject: string;
  predicate: string;
  claim_ids: string[];
  evidence_refs: string[];
  severity: string;
  summary: string;
  resolved: boolean;
  resolution?: {
    decision: 'KEEP_CLAIM' | 'MARK_UNCERTAIN' | 'RETRACT_ALL';
    winning_claim_id?: string;
    note: string;
    resolved_by: string;
    resolved_at: string;
  };
  created_at: string;
}

export interface KnowledgeSnapshot {
  snapshot_id: string;
  query_sha256: string;
  as_of: string;
  claim_ids: string[];
  evidence_ids: string[];
  contradiction_ids?: string[];
  ontology_pack: string;
  ontology_version: string;
  checksum: string;
  run_manifest_id?: string;
  bound_at?: string;
  created_at: string;
}

export interface KnowledgeRetrievalHit {
  claim: KnowledgeClaim;
  evidence: KnowledgeEvidence[];
  score: number;
  evidence_score: number;
  expired: boolean;
  stale_evidence: boolean;
  has_conflict: boolean;
  determination: 'FACT' | 'CONFLICTED' | 'EXPIRED' | 'STALE_EVIDENCE' | 'RETRACTED';
  matched_by: string[];
  relation_path?: string[];
}

export interface KnowledgeRetrievalResponse {
  hits: KnowledgeRetrievalHit[];
  contradictions: KnowledgeContradiction[];
  snapshot?: KnowledgeSnapshot;
  budget: { results: number; tokens: number; time_ms: number };
}

export interface OntologyPack {
  pack_id: string;
  name: string;
  domain: string;
  current_version?: string;
  display?: Record<string, string>;
  created_at: string;
}

export interface OntologyDefinition {
  entities: Array<{ id: string; display?: Record<string, string> }>;
  relations: Array<{ id: string; source_type: string; target_type: string; display?: Record<string, string> }>;
}

export interface OntologyValidationRule { subject_type: string; predicate: string; value_type: string; required: boolean }
export interface OntologyContext { pack_id: string; version: string; checksum: string; definition: OntologyDefinition; validation_rules: OntologyValidationRule[] }

export interface WorldEvidenceRef { evidence_id: string; kind: string; uri?: string; summary?: string }
export interface WorldEntity { entity_id: string; scope: string; type: string; canonical_name?: string; aliases?: string[]; properties?: Record<string, unknown>; evidence?: WorldEvidenceRef[]; confidence: number; observed_at: string; expires_at: string; revision: number }
export interface WorldRelation { relation_id: string; scope: string; source_id: string; target_id: string; predicate: string; properties?: Record<string, unknown>; evidence?: WorldEvidenceRef[]; confidence: number; observed_at: string; expires_at: string; revision: number }
export interface WorldFact { fact_id: string; scope: string; subject_id: string; subject_type: string; predicate: string; value: unknown; value_type: string; properties?: Record<string, unknown>; evidence?: WorldEvidenceRef[]; confidence: number; observed_at: string; expires_at: string; revision: number }
export interface WorldSnapshot { schema: 'athena.world-snapshot.v1'; snapshot_id: string; task_id: string; revision: number; ontology_pack: string; ontology_version: string; ontology_checksum: string; entities: WorldEntity[]; relations: WorldRelation[]; facts: WorldFact[]; captured_at: string; checksum: string }
export interface WorldConflict { conflict_id: string; owner_id: string; task_id: string; observation_id: string; kind: string; subject: string; candidate_ids?: string[]; details?: Record<string, unknown>; status: 'OPEN' | 'RESOLVED' | 'DISMISSED'; resolution?: string; revision: number; created_at: string; updated_at: string }

export type WorldProviderKind = 'ATHENA_HTTP' | 'SPARQL' | 'NEO4J' | 'TYPEDB';
export type WorldProviderAuth = 'NONE' | 'BEARER' | 'BASIC';
export interface WorldProvider {
  provider_id: string; name: string; kind: WorldProviderKind; endpoint: string; database?: string; query_template?: string;
  auth_mode: WorldProviderAuth; credential_env?: string; allow_private_network: boolean; ontology_pack: string; ontology_version: string;
  default_confidence: number; ttl_seconds: number; timeout_ms: number; enabled: boolean; read_only: true; capabilities: string[];
  health_status: 'UNKNOWN' | 'AVAILABLE' | 'FAILED'; health_message?: string; last_checked_at?: string; revision: number; created_at: string; updated_at: string;
}
export type WorldProviderRequest = Omit<WorldProvider, 'provider_id' | 'read_only' | 'capabilities' | 'health_status' | 'health_message' | 'last_checked_at' | 'revision' | 'created_at' | 'updated_at'> & { expected_revision?: number };
export interface WorldProviderQueryResult { provider_id: string; provider_kind: WorldProviderKind; authoritative: false; snapshot: WorldSnapshot; warnings?: string[] }

export interface OntologyCandidate {
  candidate_id: string; pack_id: string; base_version: string; created_by: string; status: string; review_note?: string; revision: number; created_at: string;
  evidence_refs: string[];
  proposed: { version: string; checksum: string; definition: OntologyDefinition; validation_rules: OntologyValidationRule[] };
  evaluation: { passed: boolean; environment: string; evaluator: string; checks: Array<{ name: string; required: boolean; passed: boolean; detail?: string }> };
}

export type GoalStatus = 'DRAFT' | 'PLANNED' | 'RUNNING' | 'WAITING_USER' | 'WAITING_DEVICE' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type GoalTaskStatus = 'PENDING' | 'READY' | 'RUNNING' | 'WAITING_USER' | 'WAITING_DEVICE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface GoalBudget {
  max_concurrent_specialists: number;
  max_depth: number;
  max_tokens: number;
  max_duration_ms: number;
  max_search_queries: number;
  max_pages: number;
  max_actions: number;
}

export interface GoalUsage {
  tokens: number;
  duration_ms: number;
  search_queries: number;
  pages: number;
  actions: number;
}

export interface GoalCriterion {
  criterion_id: string;
  description: string;
  required: boolean;
  verified: boolean;
  evidence_ref?: string;
}

export interface GoalInput {
  input_id: string;
  content: string;
  created_at: string;
}

export interface GoalTrigger {
  type: 'INTERACTIVE' | 'SCHEDULE';
  trigger_id?: string;
  schedule_id?: string;
  scheduled_at?: string;
  max_attempts?: number;
  retry_backoff_ms?: number;
}

export interface PersistentGoal {
  schema: 'athena.orchestration.v2';
  goal_id: string;
  owner_id: string;
  agent_id: string;
  conversation_id?: string;
  objective: string;
  constraints: string[];
  success_criteria: GoalCriterion[];
  inputs?: GoalInput[];
  budget: GoalBudget;
  usage: GoalUsage;
  deadline?: string;
  approval_policy: { require_before_risks: string[]; preauthorization_id?: string; preauthorized_risks?: string[]; expires_at?: string };
  trigger: GoalTrigger;
  active_task_ids?: string[];
  latest_checkpoint_id?: string;
  status: GoalStatus;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface GoalTask {
  task_id: string;
  task_key: string;
  goal_id: string;
  specialist: 'RESEARCH' | 'BROWSER' | 'DESKTOP' | 'FILE' | 'SYNTHESIS';
  objective: string;
  depends_on?: string[];
  required_capabilities?: string[];
  world_slice_refs?: string[];
  requires_device: boolean;
  preferred_device_id?: string;
  device_id?: string;
  execution_id?: string;
  idempotency_scope: string;
  budget: Omit<GoalBudget, 'max_concurrent_specialists' | 'max_depth'>;
  usage: GoalUsage;
  status: GoalTaskStatus;
  attempt: number;
  depth: number;
  next_attempt_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GoalCheckpoint {
  checkpoint_id: string;
  goal_id: string;
  sequence: number;
  goal_revision: number;
  status: GoalStatus;
	usage: GoalUsage;
	confirmed_effect_keys?: string[];
	observation_refs?: string[];
	pending_approval_ids?: string[];
  reason: string;
  previous_checksum?: string;
  checksum: string;
  created_at: string;
}

export interface SpecialistResult {
  run_id: string;
  execution_id: string;
  task_id: string;
  specialist: GoalTask['specialist'];
  status: GoalTaskStatus;
  summary: string;
  evidence_refs?: string[];
  observation_refs?: string[];
  confirmed_effect_keys?: string[];
  usage: GoalUsage;
  provenance: { producer_type: 'RUNTIME_RUN' | 'CONTROL_PLANE'; producer: string; producer_version: string; run_manifest_id?: string; agent_build_id?: string; model_config_version?: string; device_id?: string; trace_id: string; produced_at: string };
  created_at: string;
}

export type ScheduleTriggerStatus = 'QUEUED' | 'RUNNING' | 'WAITING_USER' | 'WAITING_DEVICE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ScheduleTrigger {
  schema: 'athena.orchestration.v2';
  trigger_id: string;
  schedule_id: string;
  owner_id: string;
  goal_id: string;
  task_id: string;
  idempotency_key: string;
  scheduled_at: string;
  started_at?: string;
  finished_at?: string;
  attempt: number;
  max_attempts: number;
  retry_backoff_ms: number;
  status: ScheduleTriggerStatus;
  run_id?: string;
  summary?: string;
  notify: boolean;
  notification_status: 'DISABLED' | 'PENDING' | 'SENT' | 'FAILED';
  notified_at?: string;
  reconciled_at?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface GoalState {
  goal: PersistentGoal;
  tasks: GoalTask[];
  results: SpecialistResult[];
  checkpoint?: GoalCheckpoint;
}

export interface Agent {
  ulid?: string;
  id: string;
  name: string;
  description: string;
  model: string;
  embedding_model?: string;
  image_model?: string;
  video_model?: string;
  icon: string;
  config?: any;
  config_json?: any;
  is_system?: boolean;
  enabled?: boolean;
  skills: string[];
  capabilities: string[];
  knowledgeBases?: string[];
  isBuiltIn?: boolean;
  channels?: string[];
  is_periodic?: boolean;  // snake_case from backend API
  cron_rule?: string;     // snake_case from backend API
  isPeriodic?: boolean;
  cronRule?: string;
  logs?: AgentLog[];
  memoryLimit?: number;
  longTermMemory?: boolean;
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  rerank?: boolean;
  variables?: Variable[];
  retryCount?: number;
  retryInterval?: number;
  timeout?: number;
  endpoint?: string;
  maxIterations?: number;
  stream?: boolean;
  sandbox?: {
    enabled: boolean;
    mode: 'docker' | 'local';
    image?: string;
    workdir?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
  };
  responseSchema?: {
    type: 'text' | 'markdown' | 'a2ui' | 'audio' | 'image' | 'video' | 'mixed';
    version: string;
    strict: boolean;
    schema: any;
  };
  created_at?: number;
  updated_at?: number;
  created_by?: string;
  updated_by?: string;
}

export interface Variable {
  name: string;
  type: string;
  required: boolean;
}

export interface AgentLog {
  id: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'running';
  message: string;
  duration?: string;
}

export interface BrowserSuggestedAction {
  schema: 'athena.browser.suggestion.v1' | string;
  id: string;
  label: string;
  description?: string;
  kind: 'media' | 'navigate' | string;
  capability: string;
  arguments: Record<string, unknown>;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  precondition?: Record<string, unknown>;
  postcondition?: Record<string, unknown>;
}

export interface ControlObservation extends Omit<ProtocolObservation, 'state'> {
  state?: Record<string, any>;
}

export interface ResearchSourcePage {
  id: string;
  rank: number;
  title: string;
  url: string;
  domain: string;
  provider?: string;
  kind?: string;
  snippet?: string;
  valueSignals: string[];
  authority: number;
  relevance: number;
  freshness: number;
  evidenceScore: number;
  fetched: boolean;
  publishedAt?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: 'built-in' | 'custom' | 'mcp' | 'a2a' | 'skill';
  category: 'logic' | 'data' | 'web' | 'media' | 'mcp' | 'a2a';
  enabled: boolean;
  is_system?: boolean;
  content?: string;
  mcpUrl?: string;
  icon?: string;
  endpoint?: string;
  token?: string;
  sandboxEndpoint?: string;
  method?: 'GET' | 'POST';
  timeout?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  sandboxToken?: string;
  instruction?: string;
  scope?: 'client' | 'server' | 'both';
  trigger?: 'auto' | 'manual';
  entryScript?: string;
  filePath?: string;
  headers?: Record<string, string>;
  args?: string[];
  env?: Record<string, string>;
  command?: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  lastUpdated: string;
  retrievalUrl: string;
  token?: string;
  enabled?: boolean;
}

export interface RecallTestRecord {
  id: string;
  kbId: string;
  kbName: string;
  query: string;
  timestamp: string;
  results: {
    title: string;
    score: number;
    content: string;
  }[];
}

export interface SpecialistProgressNode {
  nodeId: string;
  role: string;
  status: string;
  dependsOn: string[];
}

export interface TemporarySpecialistProgress {
  overlayId: string;
  baseProfileRef: string;
  role: string;
  admissionDecisionId: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: FileInfo[];
  thinking?: string;
  trace?: TraceStep[];
  toolCalls?: {
    actionId?: string;
    name: string;
    args: any;
    result?: any;
    progress?: number;
    progressStage?: string;
    progressMessage?: string;
    bytes?: number;
    total?: number;
	searchQueries?: number;
	researchSources?: number;
	researchConfidence?: number;
	researchQueryTexts?: string[];
	researchPages?: ResearchSourcePage[];
    parallelPlanId?: string;
    specialistNodes?: SpecialistProgressNode[];
    configuredParallelism?: number;
    effectiveParallelism?: number;
    temporarySpecialist?: TemporarySpecialistProgress;
    status?: 'pending' | 'running' | 'completed' | 'error';
    observation?: ControlObservation;
    suggestedActions?: BrowserSuggestedAction[];
    selectedSuggestionId?: string;
    suggestionStatus?: 'idle' | 'running' | 'completed' | 'error';
    suggestionError?: string;
  }[];
  recallInfo?: {
    status: 'pending' | 'running' | 'completed';
    count?: number;
    message?: string;
  };
  a2ui?: {
    type: string;
    data: any;
  };
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  htmlContent?: string;  // 提取的HTML内容（如数据分析报告）
  reportUrl?: string;   // HTML报告的URL（如 /uploads/{sessionID}/reports/xxx.html）
  pptUrl?: string;      // PPT文件的URL（如 /uploads/{sessionID}/reports/xxx.pptx）
  status?: 'pending_approval' | 'completed' | 'failed' | 'streaming';
  interruptId?: string;  // 用于审批时调用 resume
  metadata?: string;     // 原始 metadata JSON（如 files、imageActions 等）
}

export interface TraceStep {
  id: string;
  type: 'thought' | 'tool' | 'skill' | 'mcp' | 'a2a' | 'observation' | 'retrieval';
  label: string;
  content: string;
  status: 'success' | 'running' | 'error' | 'pending';
  duration?: string;
  timestamp: Date;
}

export interface ApprovalTask {
  id: string;
  agentId: string;
  agentName: string;
  toolName: string;
  description: string;
  params: any;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected';
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  url?: string;
  virtual_path?: string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  status: 'active' | 'configured' | 'disabled' | 'error';
	enabled: boolean;
	runtimeMode: ModelRuntimeMode;
	ownerId?: string;
  latency?: string;
  contextWindow?: string;
  usage?: number;
	usageRate?: number;
	usageCount?: number;
	successRate?: number;
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
  type: 'llm' | 'embedding' | 'image' | 'video';
  capabilities?: string;
  category?: 'default' | 'rewrite' | 'skill' | 'summarize';
	keyId?: string;
	keyName?: string;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: Date;
  agentId?: string;
  messages?: Message[];
  lastUpdated?: Date;
}

// Chat-related types
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

export interface PendingApproval {
  id: string;
  sessionId: string;
  messageId: string;
  toolName: string;
  toolType: string;
  riskLevel: string;
  parameters: any;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: Date;
}

// Job execution types
export interface JobExecution {
  ulid: string;
  agent_id: string;
  agent_name: string;
  session_id: string;
  status: 'running' | 'success' | 'failed';
  trigger_time: number;
  started_at: number;
  finished_at: number;
  input_summary: string;
  output_summary: string;
  output_full: string;
  error_msg: string;
  tokens_used: number;
  latency_ms: number;
  created_at: number;
  updated_at: number;
}
