import { Activity, CheckCircle2, CircleDashed, Clock3, Compass, Eye, Radio, Route, Search, ShieldAlert, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ControlObservation } from '../types';
import { cn } from '../lib/utils';

type RecordValue = Record<string, any>;

function record(value: unknown): RecordValue | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;
}

function percentage(value: unknown): string {
  const score = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(score) ? `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%` : '-';
}

function effectValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '-';
    }
  }
  return String(value);
}

function evidenceRefs(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
}

function statusTone(status: string): string {
  switch (status.toLowerCase()) {
    case 'verified':
    case 'completed':
    case 'execute':
    case 'active':
    case 'satisfied':
    case 'succeeded':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'failed':
    case 'error':
    case 'blocked':
    case 'unsatisfied':
    case 'conflicting':
      return 'bg-red-50 text-red-700 ring-red-100';
    case 'reobserve':
    case 'ask_user':
    case 'waiting_user':
    case 'unknown':
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-100';
  }
}

export function hasBrowserExecution(observation?: ControlObservation): boolean {
  const state = record(observation?.state);
  return Boolean(state && (state.browser_task || state.automation_state || state.capability_handoff || state.effect_trace));
}

export default function BrowserExecutionPanel({ observation }: { observation: ControlObservation }) {
  const { t } = useTranslation();
  const state = record(observation.state) || {};
  const plan = record(state.browser_task);
  const planning = record(plan?.planning);
  const resolution = record(plan?.resolution);
  const selected = record(resolution?.selected);
  const budget = record(plan?.execution_budget);
  const automation = record(state.automation_state);
  const handoff = record(state.capability_handoff);
  const effectTrace = record(state.effect_trace);
  const outcome = record(effectTrace?.outcome);
  const targetSpec = record(outcome?.target_spec);
  const selector = record(targetSpec?.selector);
  const targetResolution = record(effectTrace?.target_resolution);
  const policy = record(effectTrace?.policy_decision);
  const run = record(effectTrace?.plan_run);
  const effectSummary = record(effectTrace?.verification_summary);
  const effectResults = Array.isArray(effectSummary?.results) ? effectSummary.results.filter(record).slice(0, 8) as RecordValue[] : [];
  const interactions = Array.isArray(plan?.interactions) ? plan.interactions.filter(record).slice(0, 12) as RecordValue[] : [];
  const monitorModes = Array.isArray(automation?.monitor_modes) ? automation.monitor_modes.filter((item): item is string => typeof item === 'string') : [];
  const recentEvents = Array.isArray(automation?.recent_events) ? automation.recent_events.filter(record).slice(0, 5) as RecordValue[] : [];

  if (!plan && !automation && !handoff && !effectTrace) return null;

  return (
    <div className="space-y-3 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/80 via-white to-emerald-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
          <Compass size={13} className="text-sky-600" />
          {t('chat.browserExecution')}
        </div>
        <span className={cn('rounded-full px-2 py-1 text-[9px] font-bold ring-1', statusTone(String(observation.status || 'running')))}>
          {observation.status || t('chat.running')}
        </span>
      </div>

      {planning && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Metric icon={<Route size={12} />} label={t('chat.browserStrategy')} value={String(planning.strategy || plan?.intent || '-')} />
          <Metric icon={<Eye size={12} />} label={t('chat.browserResolution')} value={resolution ? `${resolution.decision || '-'} · ${percentage(resolution.confidence)}` : t('chat.browserNotResolved')} />
          <Metric icon={<Clock3 size={12} />} label={t('chat.browserBudget')} value={budget ? `${budget.used_actions || 0} / ${budget.max_actions || planning.max_actions || '-'}` : `0 / ${planning.max_actions || '-'}`} />
        </div>
      )}

      {outcome && (
        <div className="rounded-lg border border-sky-100 bg-white/90 px-3 py-2.5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-sky-700"><Target size={12} /> {t('chat.browserOutcome')}</div>
              <div className="mt-1 text-[11px] font-semibold leading-5 text-slate-700">{String(outcome.goal || plan?.goal || '-')}</div>
              {selector && <div className="mt-1 font-mono text-[9px] text-slate-400">{String(selector.type || 'target')}{selector.ordinal ? ` #${selector.ordinal}` : ''}{selector.kind ? ` · ${selector.kind}` : ''}</div>}
              {targetResolution?.selected_entity_ref && (
                <div className="mt-1 truncate text-[9px] text-sky-700" title={String(targetResolution.source_snapshot_ref || '')}>
                  {t('chat.browserGroundedTarget')}: <span className="font-mono">{String(targetResolution.selected_entity_ref)}</span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              {policy?.decision && <span className={cn('rounded-full px-2 py-1 text-[8px] font-bold ring-1', statusTone(String(policy.decision)))}>{String(policy.decision)}</span>}
              {run?.status && <span className={cn('rounded-full px-2 py-1 text-[8px] font-bold ring-1', statusTone(String(run.status)))}>{String(run.status)}</span>}
            </div>
          </div>
        </div>
      )}

      {effectSummary && (
        <div className="rounded-lg border border-slate-100 bg-white/85 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500"><Activity size={12} /> {t('chat.browserEffectVerification')}</span>
            <span className={cn('rounded-full px-2 py-1 text-[8px] font-bold ring-1', statusTone(String(effectSummary.status || 'unknown')))}>{String(effectSummary.status || 'unknown')}</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 text-center">
            <EffectCount label={t('chat.browserSatisfied')} value={effectSummary.satisfied} tone="text-emerald-700" />
            <EffectCount label={t('chat.browserUnsatisfied')} value={effectSummary.unsatisfied} tone="text-red-600" />
            <EffectCount label={t('chat.browserUnknown')} value={effectSummary.unknown} tone="text-amber-600" />
            <EffectCount label={t('chat.browserConflicting')} value={effectSummary.conflicting} tone="text-red-700" />
          </div>
          {effectResults.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {effectResults.map((result, index) => {
                const evidence = evidenceRefs(result.evidence_refs);
                const status = String(result.status || 'unknown');
                return (
                  <div key={`${result.effect_clause_id || 'effect'}-${index}`} className="rounded-md bg-slate-50/90 px-2 py-1.5 text-[9px] ring-1 ring-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'satisfied' ? 'bg-emerald-500' : status === 'unknown' ? 'bg-amber-400' : 'bg-red-500')} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-600">{String(result.effect_clause_id || result.reason || 'effect')}</span>
                      <span className="font-mono text-slate-400">{percentage(result.confidence)}</span>
                    </div>
                    <div className="mt-1 truncate text-slate-500" title={String(result.reason || '')}>{String(result.reason || '')}</div>
                    <div className="mt-1 truncate font-mono text-[8px] text-slate-400" title={`${effectValue(result.expected_value)} -> ${effectValue(result.observed_value)}`}>
                      {t('chat.browserExpected')} {effectValue(result.expected_value)} → {t('chat.browserObserved')} {effectValue(result.observed_value)}
                    </div>
                    {evidence.length > 0 && <div className="mt-1 truncate text-[8px] text-sky-600" title={evidence.join(' · ')}>{t('chat.browserEvidence')}: {evidence.join(' · ')}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {resolution && (
        <div className="rounded-lg border border-white bg-white/80 px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('chat.browserSelectedTarget')}</div>
              <div className="mt-1 truncate text-[11px] font-semibold text-slate-700">{selected?.label || resolution.reason || t('chat.browserNotResolved')}</div>
            </div>
            <span className={cn('shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ring-1', statusTone(String(resolution.decision || '')))}>
              {percentage(resolution.confidence)}
            </span>
          </div>
          {resolution.reason && <div className="mt-1 text-[9px] text-slate-400">{String(resolution.reason)}</div>}
        </div>
      )}

      {handoff && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-[10px] text-amber-800">
          <Search size={13} className="mt-0.5 shrink-0" />
          <div><strong>{t('chat.browserCapabilityHandoff')}</strong><div className="mt-0.5 break-words opacity-80">{String(handoff.query || handoff.reason || '')}</div></div>
        </div>
      )}

      {interactions.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('chat.browserInteractions')}</div>
          {interactions.map((interaction, index) => {
            const status = String(interaction.status || 'pending');
            return (
              <div key={`${interaction.action || 'action'}-${index}`} className="flex items-center gap-2 rounded-lg bg-white/75 px-2.5 py-2 text-[10px] ring-1 ring-slate-100">
                {status === 'verified' ? <CheckCircle2 size={13} className="shrink-0 text-emerald-600" /> : status === 'failed' || status === 'blocked' ? <ShieldAlert size={13} className="shrink-0 text-red-500" /> : <CircleDashed size={13} className="shrink-0 text-amber-500" />}
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">{String(interaction.action || 'action')}</span>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[8px] font-bold ring-1', statusTone(status))}>{status}</span>
                {typeof interaction.duration_ms === 'number' && <span className="shrink-0 tabular-nums text-slate-400">{interaction.duration_ms} ms</span>}
              </div>
            );
          })}
        </div>
      )}

      {automation && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span className="flex items-center gap-1.5 font-bold text-emerald-800"><Radio size={12} /> {t('chat.browserAutomation')}</span>
            <span className="text-emerald-700">{automation.mode || 'idle'} · {automation.active_count || 0} {t('chat.browserActiveRules')}</span>
          </div>
          {monitorModes.length > 0 && <div className="mt-1 text-[9px] text-emerald-700/70">{monitorModes.join(' · ')}</div>}
          {recentEvents.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{recentEvents.map((event, index) => <span key={`${event.event_id || event.type}-${index}`} className="rounded-full bg-white px-2 py-1 text-[8px] font-semibold text-slate-500 ring-1 ring-emerald-100">{String(event.type || 'event')} · {String(event.status || 'observed')}</span>)}</div>}
        </div>
      )}
    </div>
  );
}

function EffectCount({ label, value, tone }: { label: string; value: unknown; tone: string }) {
  return <div className="rounded-md bg-slate-50 px-1 py-1.5"><div className={cn('text-[11px] font-bold tabular-nums', tone)}>{Number(value) || 0}</div><div className="mt-0.5 text-[7px] font-bold uppercase tracking-wide text-slate-400">{label}</div></div>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white bg-white/80 px-2.5 py-2 shadow-sm">
      <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">{icon}{label}</div>
      <div className="mt-1 truncate text-[10px] font-semibold text-slate-700" title={value}>{value}</div>
    </div>
  );
}
