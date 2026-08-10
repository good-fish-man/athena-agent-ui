import { CheckCircle2, CircleDashed, Clock3, Compass, Eye, Radio, Route, Search, ShieldAlert } from 'lucide-react';
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

function statusTone(status: string): string {
  switch (status.toLowerCase()) {
    case 'verified':
    case 'completed':
    case 'execute':
    case 'active':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'failed':
    case 'error':
    case 'blocked':
      return 'bg-red-50 text-red-700 ring-red-100';
    case 'reobserve':
    case 'ask_user':
    case 'waiting_user':
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-100';
  }
}

export function hasBrowserExecution(observation?: ControlObservation): boolean {
  const state = record(observation?.state);
  return Boolean(state && (state.browser_task || state.automation_state || state.capability_handoff));
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
  const interactions = Array.isArray(plan?.interactions) ? plan.interactions.filter(record).slice(0, 12) as RecordValue[] : [];
  const monitorModes = Array.isArray(automation?.monitor_modes) ? automation.monitor_modes.filter((item): item is string => typeof item === 'string') : [];
  const recentEvents = Array.isArray(automation?.recent_events) ? automation.recent_events.filter(record).slice(0, 5) as RecordValue[] : [];

  if (!plan && !automation && !handoff) return null;

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

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white bg-white/80 px-2.5 py-2 shadow-sm">
      <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">{icon}{label}</div>
      <div className="mt-1 truncate text-[10px] font-semibold text-slate-700" title={value}>{value}</div>
    </div>
  );
}
