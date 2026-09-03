import type { ExperienceRecord } from '../types';

export const MAX_LEARNING_EVIDENCE = 20;
const MIN_LEARNING_EVIDENCE = 4;
const MIN_MATCHING_SUCCESSES = 2;

export type LearningEvidenceGateReason =
  | 'READY'
  | 'NO_PATTERN'
  | 'NEEDS_SUCCESSES'
  | 'NEEDS_FAILURE'
  | 'NEEDS_EVIDENCE'
  | 'NEEDS_CONTEXT';

export interface LearningEvidenceGate {
  ready: boolean;
  reason: LearningEvidenceGateReason;
  pattern: string;
  selectedCount: number;
  matchingCount: number;
  successCount: number;
  failureCount: number;
  experienceIDs: string[];
}

interface PatternGroup {
  pattern: string;
  successes: ExperienceRecord[];
  failures: ExperienceRecord[];
}

export function learningActionPattern(item: ExperienceRecord): string {
  return (item.action_refs || []).map(action => {
    const operation = action.operation?.trim() || 'invoke';
    return `${action.capability}.${operation}`;
  }).join('|');
}

export function analyzeLearningEvidence(items: ExperienceRecord[]): LearningEvidenceGate {
  const groups = new Map<string, PatternGroup>();
  for (const item of items) {
    const pattern = learningActionPattern(item);
    if (!pattern) continue;
    const group = groups.get(pattern) || { pattern, successes: [], failures: [] };
    if (item.outcome === 'SUCCEEDED') group.successes.push(item);
    if (item.outcome === 'FAILED') group.failures.push(item);
    groups.set(pattern, group);
  }

  const ordered = [...groups.values()].sort((left, right) =>
    right.successes.length - left.successes.length || left.pattern.localeCompare(right.pattern));
  const top = ordered[0];
  if (!top) return gateResult(items.length, 'NO_PATTERN');
  if (top.successes.length < MIN_MATCHING_SUCCESSES) {
    return gateResult(items.length, 'NEEDS_SUCCESSES', top, top.successes.slice(0, MAX_LEARNING_EVIDENCE));
  }

  let matchingFailure: PatternGroup | undefined;
  let minimumEvidence: { group: PatternGroup; evidence: ExperienceRecord[] } | undefined;
  for (const group of ordered) {
    if (group.successes.length < MIN_MATCHING_SUCCESSES) break;
    if (group.failures.length === 0) continue;
    matchingFailure ||= group;
    if (group.successes.length + group.failures.length < MIN_LEARNING_EVIDENCE) continue;
    const evidence = boundedEvidence(group);
    minimumEvidence ||= { group, evidence };
    const contextualEvidence = boundedContextEvidence(group);
    if (contextualEvidence.length >= MIN_LEARNING_EVIDENCE && hasIndependentContexts(contextualEvidence)) {
      return gateResult(items.length, 'READY', group, contextualEvidence);
    }
  }

  if (!matchingFailure) {
    return gateResult(items.length, 'NEEDS_FAILURE', top, top.successes.slice(0, MAX_LEARNING_EVIDENCE));
  }
  if (!minimumEvidence) {
    return gateResult(items.length, 'NEEDS_EVIDENCE', matchingFailure, boundedEvidence(matchingFailure));
  }
  return gateResult(items.length, 'NEEDS_CONTEXT', minimumEvidence.group, minimumEvidence.evidence);
}

function boundedEvidence(group: PatternGroup): ExperienceRecord[] {
  const successLimit = Math.min(group.successes.length, MAX_LEARNING_EVIDENCE - 1);
  const selected = group.successes.slice(0, successLimit);
  return selected.concat(group.failures.slice(0, MAX_LEARNING_EVIDENCE - selected.length));
}

function boundedContextEvidence(group: PatternGroup): ExperienceRecord[] {
  return boundedEvidence({
    pattern: group.pattern,
    successes: group.successes.filter(hasUsableContext),
    failures: group.failures.filter(hasUsableContext),
  });
}

function hasUsableContext(item: ExperienceRecord): boolean {
  return Boolean(
    item.experience_id.trim()
    && item.task_id.trim()
    && item.environment_fingerprint?.trim()
    && evidenceSiteScope(item) !== 'unknown',
  );
}

function gateResult(selectedCount: number, reason: LearningEvidenceGateReason, group?: PatternGroup, evidence: ExperienceRecord[] = []): LearningEvidenceGate {
  const successCount = evidence.filter(item => item.outcome === 'SUCCEEDED').length;
  const failureCount = evidence.filter(item => item.outcome === 'FAILED').length;
  return {
    ready: reason === 'READY',
    reason,
    pattern: group?.pattern || '',
    selectedCount,
    matchingCount: successCount + failureCount,
    successCount,
    failureCount,
    experienceIDs: evidence.map(item => item.experience_id),
  };
}

function hasIndependentContexts(items: ExperienceRecord[]): boolean {
  const experienceIDs = new Set<string>();
  const taskIDs = new Set<string>();
  const contexts = new Set<string>();
  for (const item of items) {
    if (!item.experience_id.trim() || !item.task_id.trim() || experienceIDs.has(item.experience_id) || taskIDs.has(item.task_id)) return false;
    experienceIDs.add(item.experience_id);
    taskIDs.add(item.task_id);
    const environment = item.environment_fingerprint?.trim() || '';
    const site = evidenceSiteScope(item);
    if (!environment || site === 'unknown') return false;
    contexts.add(`${environment}\u0000${site}`);
  }
  return contexts.size >= 2;
}

function evidenceSiteScope(item: ExperienceRecord): string {
  const site = findSiteScope(item.intent);
  if (site) return site;
  return (item.action_refs || []).some(action => action.capability.trim().toLowerCase().startsWith('browser.'))
    ? 'unknown'
    : 'not-applicable';
}

function findSiteScope(value: unknown): string {
  if (Array.isArray(value)) {
    for (const child of value) {
      const site = findSiteScope(child);
      if (site) return site;
    }
    return '';
  }
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  for (const key of ['site_scope', 'site', 'domain', 'hostname', 'host', 'origin', 'url']) {
    if (key in record) {
      const site = normalizeSiteScope(record[key]);
      if (site) return site;
    }
  }
  for (const key of Object.keys(record).sort()) {
    const site = findSiteScope(record[key]);
    if (site) return site;
  }
  return '';
}

function normalizeSiteScope(value: unknown): string {
  let normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === '<nil>') return '';
  try {
    const parsed = new URL(normalized);
    if (parsed.hostname) return parsed.hostname.replace(/^www\./, '');
  } catch {
    // Plain hostnames are handled below.
  }
  normalized = normalized.replace(/^www\./, '');
  return /[ /?#]/.test(normalized) ? '' : normalized;
}
