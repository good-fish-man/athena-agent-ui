import React from 'react';
import {
  Archive,
  Beaker,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  DatabaseZap,
  Eraser,
  FlaskConical,
  Gauge,
  GraduationCap,
  History,
  Loader2,
  LockKeyhole,
  Play,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { experienceApi } from '../lib/api';
import { cn } from '../lib/utils';
import { LearningStudio } from './LearningStudio';
import { DeploymentCenter } from './DeploymentCenter';
import type {
  EvaluationFixture,
  EvaluationResult,
  EvaluationRun,
  EvaluationSuite,
  ExperienceOutcome,
  ExperiencePreference,
  ExperienceRecord,
  ExperienceSensitivity,
  ExperienceStats,
  ExperienceStatus,
} from '../types';

type WorkspaceTab = 'experience' | 'evaluation' | 'learning' | 'deployment';

const defaultStats: ExperienceStats = {
  total: 0,
  ready: 0,
  skipped: 0,
  deleted: 0,
  redactions: 0,
  evaluation_runs: 0,
  evaluation_pass_rate: 0,
  failure_classes: {},
};

const statusTone: Record<string, string> = {
  READY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  SKIPPED: 'border-amber-200 bg-amber-50 text-amber-700',
  DELETED: 'border-slate-200 bg-slate-100 text-slate-500',
  SUCCEEDED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  FAILED: 'border-red-200 bg-red-50 text-red-700',
  CANCELLED: 'border-amber-200 bg-amber-50 text-amber-700',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  RUNNING: 'border-sky-200 bg-sky-50 text-sky-700',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
};

function Badge({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]', statusTone[value] || 'border-slate-200 bg-slate-50 text-slate-600')}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

function formatDuration(value: number) {
  if (value < 1000) return `${value} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)} s`;
  return `${(value / 60_000).toFixed(1)} min`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatMicroCost(value?: number) {
  if (!value) return '—';
  return `$${(value / 1_000_000).toFixed(4)}`;
}

function ExperienceDetails({ item }: { item: ExperienceRecord }) {
  const { t } = useTranslation();
  const evidence = Array.from(new Set([
    ...(item.verification.evidence_ids || []),
    ...(item.failure_classification?.evidence_ids || []),
    ...(item.observation_refs || []).flatMap(observation => observation.evidence_ids || []),
  ]));

  return (
    <div className="grid gap-4 border-t border-slate-200/80 bg-slate-50/70 px-5 py-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <section>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{t('experience.decisionSummary')}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{item.decision_summary || item.plan_summary || t('experience.noSummary')}</p>
        </section>
        <section>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{t('experience.verification')}</p>
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
            {item.verification.passed ? <CheckCircle2 className="mt-0.5 text-emerald-500" size={16} /> : <XCircle className="mt-0.5 text-red-500" size={16} />}
            <p className="text-xs leading-5 text-slate-600">{item.verification.summary || t('experience.noVerification')}</p>
          </div>
        </section>
        {item.failure_classification && (
          <section className="rounded-xl border border-red-100 bg-red-50/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <TriangleAlert size={15} className="text-red-500" />
              <strong className="text-xs text-red-800">{item.failure_classification.class.replaceAll('_', ' ')}</strong>
              <span className="text-[10px] text-red-500">{Math.round(item.failure_classification.confidence * 100)}%</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-red-700">{item.failure_classification.summary}</p>
          </section>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Metric label={t('experience.tokens')} value={item.cost.total_tokens.toLocaleString()} />
          <Metric label={t('experience.duration')} value={formatDuration(item.duration_ms)} />
          <Metric label={t('experience.actions')} value={String(item.action_refs?.length || 0)} />
          <Metric label={t('experience.approvals')} value={String(item.human_intervention.approval_count)} />
        </div>
        {(item.cost.models?.length || 0) > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t('experience.modelUsage')}</p>
            <div className="mt-2 space-y-2">
              {item.cost.models?.map((usage, index) => (
                <div key={`${usage.model_id || usage.model || 'model'}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate text-xs text-slate-700">{usage.model || usage.model_id || t('experience.unknownModel')}</strong>
                    <span className="text-[10px] text-slate-400">{usage.calls} {t('experience.calls')}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {(usage.prompt_tokens + usage.completion_tokens).toLocaleString()} {t('experience.tokens')}
                    {usage.cost_micros ? ` · ${formatMicroCost(usage.cost_micros)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {(item.cost.capabilities?.length || 0) > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t('experience.capabilityUsage')}</p>
            <div className="mt-2 space-y-2">
              {item.cost.capabilities?.map((usage, index) => (
                <div key={`${usage.capability}-${usage.operation || ''}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate font-mono text-[11px] text-slate-700">{usage.capability}{usage.operation ? ` · ${usage.operation}` : ''}</strong>
                    <span className="text-[10px] text-slate-400">{formatDuration(usage.duration_ms)}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {usage.calls} {t('experience.calls')} · {usage.succeeded} {t('experience.succeeded')} · {usage.failed} {t('experience.failed')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t('experience.evidence')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {evidence.length > 0 ? evidence.slice(0, 12).map(id => (
              <code key={id} className="max-w-full truncate rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600">{id}</code>
            )) : <span className="text-xs text-slate-400">{t('experience.noEvidence')}</span>}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 font-mono text-[10px] leading-5 text-slate-500">
          <p>task: {item.task_id}</p>
          <p>trace: {item.provenance.trace_id || '—'}</p>
          <p>generator: {item.provenance.generated_by}</p>
          <p>delete: {formatDate(item.retention_policy.delete_at)}</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

export function ExperienceLab() {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<WorkspaceTab>('experience');
  const [preference, setPreference] = React.useState<ExperiencePreference | null>(null);
  const [stats, setStats] = React.useState(defaultStats);
  const [items, setItems] = React.useState<ExperienceRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [fixtures, setFixtures] = React.useState<EvaluationFixture[]>([]);
  const [suites, setSuites] = React.useState<EvaluationSuite[]>([]);
  const [runs, setRuns] = React.useState<EvaluationRun[]>([]);
  const [results, setResults] = React.useState<Record<string, EvaluationResult[]>>({});
  const [expanded, setExpanded] = React.useState<string>('');
  const [selectedFixtures, setSelectedFixtures] = React.useState<string[]>([]);
  const [suiteName, setSuiteName] = React.useState('');
  const [query, setQuery] = React.useState('');
  const deferredQuery = React.useDeferredValue(query);
  const [status, setStatus] = React.useState<ExperienceStatus | ''>('');
  const [outcome, setOutcome] = React.useState<ExperienceOutcome | ''>('');
  const [sensitivity, setSensitivity] = React.useState<ExperienceSensitivity | ''>('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [nextPreference, nextStats, list, nextFixtures, nextSuites, nextRuns] = await Promise.all([
        experienceApi.preference(),
        experienceApi.stats(),
        experienceApi.list({ query: deferredQuery.trim(), status, outcome, sensitivity, limit: 50 }),
        experienceApi.fixtures(),
        experienceApi.suites(),
        experienceApi.runs(),
      ]);
      setPreference(nextPreference);
      setStats(nextStats);
      setItems(list.items || []);
      setTotal(list.total || 0);
      setFixtures(nextFixtures);
      setSuites(nextSuites);
      setRuns(nextRuns);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('experience.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [deferredQuery, outcome, sensitivity, status, t]);

  React.useEffect(() => { void load(); }, [load]);

  const savePreference = async () => {
    if (!preference) return;
    setBusy('preference');
    try {
      const saved = await experienceApi.savePreference(preference);
      setPreference(saved);
      toast.success(t('experience.preferenceSaved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('experience.saveFailed'));
    } finally {
      setBusy('');
    }
  };

  const removeExperience = async (item: ExperienceRecord) => {
    if (!window.confirm(t('experience.deleteConfirm'))) return;
    setBusy(item.experience_id);
    try {
      await experienceApi.delete(item.experience_id);
      toast.success(t('experience.deleted'));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('experience.deleteFailed'));
    } finally {
      setBusy('');
    }
  };

  const createFixture = async (item: ExperienceRecord) => {
    setBusy(`fixture:${item.experience_id}`);
    try {
      const name = (item.goal_summary || item.decision_summary || item.task_id).slice(0, 80);
      await experienceApi.createFixture(item.experience_id, { name, environment_version: item.environment_fingerprint || 'snapshot-v1' });
      toast.success(t('experience.fixtureCreated'));
      setTab('evaluation');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('experience.fixtureFailed'));
    } finally {
      setBusy('');
    }
  };

  const createSuite = async () => {
    if (!suiteName.trim() || selectedFixtures.length === 0) return;
    setBusy('suite');
    try {
      await experienceApi.createSuite({ name: suiteName.trim(), fixture_ids: selectedFixtures });
      setSuiteName('');
      setSelectedFixtures([]);
      toast.success(t('experience.suiteCreated'));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('experience.suiteFailed'));
    } finally {
      setBusy('');
    }
  };

  const runSuite = async (suite: EvaluationSuite) => {
    setBusy(`run:${suite.suite_id}`);
    try {
      const response = await experienceApi.runSuite(suite.suite_id, { seed: 42, candidate_id: 'v0.3-candidate', baseline_id: 'v0.2-baseline' });
      setRuns(current => [response.run, ...current.filter(run => run.run_id !== response.run.run_id)]);
      setResults(current => ({ ...current, [response.run.run_id]: response.results }));
      toast.success(t('experience.runCompleted'));
      const nextStats = await experienceApi.stats();
      setStats(nextStats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('experience.runFailed'));
    } finally {
      setBusy('');
    }
  };

  const showResults = async (run: EvaluationRun) => {
    if (results[run.run_id]) {
      setExpanded(expanded === run.run_id ? '' : run.run_id);
      return;
    }
    setBusy(`results:${run.run_id}`);
    try {
      const next = await experienceApi.results(run.run_id);
      setResults(current => ({ ...current, [run.run_id]: next }));
      setExpanded(run.run_id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('experience.resultsFailed'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="theme-canvas min-h-full">
      <header className="experience-hero relative overflow-hidden border-b border-slate-800 px-6 py-7 text-white lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.22),transparent_32%),radial-gradient(circle_at_88%_10%,rgba(14,165,233,0.18),transparent_30%)]" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">
              <BrainCircuit size={14} /> Athena Experience Layer
            </div>
            <h1 className="text-3xl font-black tracking-tight lg:text-4xl">{t('experience.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{t('experience.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur">
            <button type="button" onClick={() => setTab('experience')} className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition', tab === 'experience' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white')}>
              <History size={15} /> {t('experience.library')}
            </button>
            <button type="button" onClick={() => setTab('evaluation')} className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition', tab === 'evaluation' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white')}>
              <FlaskConical size={15} /> {t('experience.evaluation')}
            </button>
            <button type="button" onClick={() => setTab('learning')} className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition', tab === 'learning' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white')}>
              <GraduationCap size={15} /> {t('experience.learningStudio')}
            </button>
            <button type="button" onClick={() => setTab('deployment')} className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition', tab === 'deployment' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white')}>
              <Rocket size={15} /> {t('experience.deploymentCenter')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-5 lg:p-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={DatabaseZap} label={t('experience.total')} value={stats.total} accent="text-sky-600 bg-sky-50" />
          <StatCard icon={CheckCircle2} label={t('experience.ready')} value={stats.ready} accent="text-emerald-600 bg-emerald-50" />
          <StatCard icon={Eraser} label={t('experience.redactions')} value={stats.redactions} accent="text-amber-600 bg-amber-50" />
          <StatCard icon={Beaker} label={t('experience.evalRuns')} value={stats.evaluation_runs} accent="text-indigo-600 bg-indigo-50" />
          <StatCard icon={Gauge} label={t('experience.passRate')} value={`${Math.round(stats.evaluation_pass_rate * 100)}%`} accent="text-violet-600 bg-violet-50" />
        </section>

        {tab === 'experience' ? (
          <>
            {preference && (
              <section className="theme-card grid gap-5 rounded-2xl border border-slate-200 p-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-600" />
                    <h2 className="font-bold text-slate-900">{t('experience.learningControl')}</h2>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{t('experience.learningControlHint')}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('experience.learning')}</span>
                      <button type="button" onClick={() => setPreference(current => current ? { ...current, learning_enabled: !current.learning_enabled } : current)} className={cn('mt-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold', preference.learning_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600')}>
                        {preference.learning_enabled ? t('experience.enabled') : t('experience.disabled')}
                        <span className={cn('h-3 w-3 rounded-full', preference.learning_enabled ? 'bg-emerald-500' : 'bg-slate-400')} />
                      </button>
                    </label>
                    <label className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('experience.retention')}</span>
                      <input type="number" min={1} max={3650} value={preference.retention_days} onChange={event => setPreference(current => current ? { ...current, retention_days: Number(event.target.value) } : current)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand-400" />
                    </label>
                    <label className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('experience.maxSensitivity')}</span>
                      <select value={preference.max_sensitivity} onChange={event => setPreference(current => current ? { ...current, max_sensitivity: event.target.value as ExperienceSensitivity } : current)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand-400">
                        <option value="INTERNAL">INTERNAL</option>
                        <option value="SENSITIVE">SENSITIVE</option>
                        <option value="RESTRICTED">RESTRICTED</option>
                      </select>
                    </label>
                  </div>
                </div>
                <button type="button" onClick={() => void savePreference()} disabled={busy === 'preference'} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">
                  {busy === 'preference' ? <Loader2 size={15} className="animate-spin" /> : <LockKeyhole size={15} />}
                  {t('experience.savePreference')}
                </button>
              </section>
            )}

            <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && void load()} placeholder={t('experience.searchPlaceholder')} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-brand-400 focus:bg-white" />
                </div>
                <div className="grid grid-cols-3 gap-2 xl:flex">
                  <FilterSelect value={status} onChange={value => setStatus(value as ExperienceStatus | '')} label={t('experience.anyStatus')} options={['READY', 'SKIPPED', 'DELETED']} />
                  <FilterSelect value={outcome} onChange={value => setOutcome(value as ExperienceOutcome | '')} label={t('experience.anyOutcome')} options={['SUCCEEDED', 'FAILED', 'CANCELLED']} />
                  <FilterSelect value={sensitivity} onChange={value => setSensitivity(value as ExperienceSensitivity | '')} label={t('experience.anySensitivity')} options={['INTERNAL', 'SENSITIVE', 'RESTRICTED']} />
                </div>
                <button type="button" onClick={() => void load()} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {t('experience.refresh')}
                </button>
              </div>
              <div className="flex items-center justify-between bg-slate-50/70 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <span>{t('experience.records', { count: total })}</span>
                <span className="flex items-center gap-1.5 text-emerald-600"><Archive size={12} /> {t('experience.historicalOnly')}</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="animate-spin" size={24} /></div>
              ) : items.length === 0 ? (
                <Empty icon={BrainCircuit} title={t('experience.empty')} body={t('experience.emptyHint')} />
              ) : (
                <div className="divide-y divide-slate-200">
                  {items.map(item => (
                    <article key={item.experience_id}>
                      <div className="flex items-start gap-3 p-5">
                        <button type="button" onClick={() => setExpanded(expanded === item.experience_id ? '' : item.experience_id)} className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700">
                          {expanded === item.experience_id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><Badge value={item.status} /><Badge value={item.outcome} /><Badge value={item.sensitivity} /></div>
                          <h3 className="mt-3 text-sm font-bold leading-6 text-slate-900">{item.goal_summary || item.decision_summary || t('experience.untitled')}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1"><Clock3 size={11} /> {formatDate(item.created_at)}</span>
                            <span>{formatDuration(item.duration_ms)}</span>
                            <span>{item.cost.total_tokens.toLocaleString()} {t('experience.tokens').toLowerCase()}</span>
                            {item.failure_classification && <span className="font-bold text-red-500">{item.failure_classification.class.replaceAll('_', ' ')}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {item.status === 'READY' && (
                            <button type="button" onClick={() => void createFixture(item)} disabled={busy === `fixture:${item.experience_id}`} title={t('experience.createFixture')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                              {busy === `fixture:${item.experience_id}` ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
                            </button>
                          )}
                          {item.status !== 'DELETED' && (
                            <button type="button" onClick={() => void removeExperience(item)} disabled={busy === item.experience_id} title={t('experience.delete')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                              {busy === item.experience_id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                            </button>
                          )}
                        </div>
                      </div>
                      {expanded === item.experience_id && <ExperienceDetails item={item} />}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : tab === 'evaluation' ? (
          <EvaluationWorkspace
            fixtures={fixtures}
            suites={suites}
            runs={runs}
            results={results}
            selectedFixtures={selectedFixtures}
            setSelectedFixtures={setSelectedFixtures}
            suiteName={suiteName}
            setSuiteName={setSuiteName}
            busy={busy}
            expanded={expanded}
            onCreateSuite={createSuite}
            onRunSuite={runSuite}
            onShowResults={showResults}
          />
        ) : tab === 'learning' ? (
          <LearningStudio experiences={items} />
        ) : (
          <DeploymentCenter />
        )}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string | number; accent: string }) {
  return (
    <div className="theme-card flex items-center gap-3 rounded-2xl border border-slate-200 p-4 shadow-sm">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', accent)}><Icon size={18} /></span>
      <div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-0.5 text-xl font-black text-slate-900">{value}</p></div>
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: string[] }) {
  return (
    <select value={value} onChange={event => onChange(event.target.value)} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-brand-400">
      <option value="">{label}</option>
      {options.map(option => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
    </select>
  );
}

function Empty({ icon: Icon, title, body }: { icon: React.ComponentType<{ size?: number }>; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300"><Icon size={25} /></span>
      <h3 className="mt-4 text-sm font-bold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{body}</p>
    </div>
  );
}

interface EvaluationWorkspaceProps {
  fixtures: EvaluationFixture[];
  suites: EvaluationSuite[];
  runs: EvaluationRun[];
  results: Record<string, EvaluationResult[]>;
  selectedFixtures: string[];
  setSelectedFixtures: React.Dispatch<React.SetStateAction<string[]>>;
  suiteName: string;
  setSuiteName: (value: string) => void;
  busy: string;
  expanded: string;
  onCreateSuite: () => Promise<void>;
  onRunSuite: (suite: EvaluationSuite) => Promise<void>;
  onShowResults: (run: EvaluationRun) => Promise<void>;
}

function EvaluationWorkspace(props: EvaluationWorkspaceProps) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <div className="space-y-6">
        <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center gap-2"><Sparkles size={17} className="text-indigo-600" /><h2 className="font-bold text-slate-900">{t('experience.fixtures')}</h2></div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{t('experience.fixturesHint')}</p>
          </div>
          {props.fixtures.length === 0 ? <Empty icon={Beaker} title={t('experience.noFixtures')} body={t('experience.noFixturesHint')} /> : (
            <div className="max-h-[420px] divide-y divide-slate-200 overflow-y-auto">
              {props.fixtures.map(fixture => {
                const checked = props.selectedFixtures.includes(fixture.fixture_id);
                return (
                  <label key={fixture.fixture_id} className={cn('flex cursor-pointer gap-3 p-4 transition hover:bg-slate-50', checked && 'bg-indigo-50/50')}>
                    <input type="checkbox" checked={checked} onChange={() => props.setSelectedFixtures(current => checked ? current.filter(id => id !== fixture.fixture_id) : [...current, fixture.fixture_id])} className="mt-1 accent-indigo-600" />
                    <span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800">{fixture.name}</span><span className="mt-1 block font-mono text-[9px] text-slate-400">{fixture.simulator} · {fixture.environment_version}</span></span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="space-y-3 border-t border-slate-200 bg-slate-50/70 p-4">
            <input value={props.suiteName} onChange={event => props.setSuiteName(event.target.value)} placeholder={t('experience.suiteName')} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
            <button type="button" onClick={() => void props.onCreateSuite()} disabled={!props.suiteName.trim() || props.selectedFixtures.length === 0 || props.busy === 'suite'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
              {props.busy === 'suite' ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
              {t('experience.createSuite', { count: props.selectedFixtures.length })}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
          <div className="flex gap-3"><ShieldCheck className="shrink-0 text-emerald-600" size={19} /><div><h3 className="text-sm font-bold text-emerald-900">{t('experience.offlineOnly')}</h3><p className="mt-1 text-xs leading-5 text-emerald-700">{t('experience.offlineOnlyHint')}</p></div></div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 p-5"><h2 className="font-bold text-slate-900">{t('experience.suites')}</h2><p className="mt-1 text-xs text-slate-500">{t('experience.suitesHint')}</p></div>
          {props.suites.length === 0 ? <Empty icon={FlaskConical} title={t('experience.noSuites')} body={t('experience.noSuitesHint')} /> : (
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {props.suites.map(suite => (
                <article key={suite.suite_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">{suite.name}</h3><p className="mt-1 text-[10px] text-slate-400">{t('experience.fixtureCount', { count: suite.fixture_ids.length })}</p></div><Badge value="READY" /></div>
                  <button type="button" onClick={() => void props.onRunSuite(suite)} disabled={props.busy === `run:${suite.suite_id}`} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
                    {props.busy === `run:${suite.suite_id}` ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}{t('experience.runSeed')}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 p-5"><h2 className="font-bold text-slate-900">{t('experience.runHistory')}</h2><p className="mt-1 text-xs text-slate-500">{t('experience.runHistoryHint')}</p></div>
          {props.runs.length === 0 ? <Empty icon={Gauge} title={t('experience.noRuns')} body={t('experience.noRunsHint')} /> : (
            <div className="divide-y divide-slate-200">
              {props.runs.map(run => (
                <article key={run.run_id}>
                  <button type="button" onClick={() => void props.onShowResults(run)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{props.busy === `results:${run.run_id}` ? <Loader2 size={16} className="animate-spin" /> : <Beaker size={16} />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-mono text-[10px] font-bold text-slate-700">{run.run_id}</span><span className="mt-1 block text-[10px] text-slate-400">seed {run.seed} · {formatDate(run.started_at)}</span></span>
                    <span className="hidden gap-3 text-right sm:flex"><RunMetric label={t('experience.correctness')} value={run.metrics.correctness} /><RunMetric label={t('experience.safety')} value={run.metrics.safety_score} /></span>
                    <Badge value={run.status} />
                    {props.expanded === run.run_id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  {props.expanded === run.run_id && (
                    <div className="space-y-2 border-t border-slate-200 bg-slate-50 p-4">
                      {(props.results[run.run_id] || []).map(result => (
                        <div key={result.result_id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                          {result.passed ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />}
                          <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-800">{result.summary}</p><p className="mt-1 truncate font-mono text-[9px] text-slate-400">{result.fixture_id}</p></div>
                          <span className="text-xs font-black text-slate-700">{Math.round(result.metrics.correctness * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RunMetric({ label, value }: { label: string; value: number }) {
  return <span><span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</span><span className="text-xs font-black text-slate-800">{Math.round(value * 100)}%</span></span>;
}
