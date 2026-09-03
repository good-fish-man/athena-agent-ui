import React from 'react';
import {
  CheckCircle2,
  DatabaseBackup,
  HardDrive,
  HeartPulse,
  ListChecks,
  Loader2,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Timer,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { operationsApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { BackupManifest, GAReadinessReport, GAReadinessStatus, GoldenJourney, GoldenJourneyResult, OperationsHealthStatus, OperationsSnapshot } from '../types';

const healthTone: Record<OperationsHealthStatus, string> = {
  HEALTHY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  DEGRADED: 'border-amber-200 bg-amber-50 text-amber-700',
  UNHEALTHY: 'border-red-200 bg-red-50 text-red-700',
};

const readinessTone: Record<GAReadinessStatus, string> = {
  PASS: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  FAIL: 'border-red-200 bg-red-50 text-red-700',
  BLOCKED: 'border-red-200 bg-red-50 text-red-700',
  EXTERNAL_REQUIRED: 'border-amber-200 bg-amber-50 text-amber-700',
  NOT_RUN: 'border-slate-200 bg-slate-50 text-slate-500',
};

export function OperationsRecoveryPanel() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = React.useState<OperationsSnapshot | null>(null);
  const [backups, setBackups] = React.useState<BackupManifest[]>([]);
  const [readiness, setReadiness] = React.useState<GAReadinessReport | null>(null);
  const [journeys, setJourneys] = React.useState<GoldenJourney[]>([]);
  const [journeyResults, setJourneyResults] = React.useState<GoldenJourneyResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [backupConfigured, setBackupConfigured] = React.useState(false);
  const [restoreTarget, setRestoreTarget] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextSnapshot, backupInventory, nextReadiness, nextJourneys] = await Promise.all([
        operationsApi.snapshot(),
        operationsApi.backups().catch(() => ({ items: [], configured: false })),
        operationsApi.readiness(),
        operationsApi.goldenJourneys(),
      ]);
      setSnapshot(nextSnapshot);
      setBackups(backupInventory.items);
      setBackupConfigured(backupInventory.configured);
      setReadiness(nextReadiness);
      setJourneys(nextJourneys.items || []);
      setJourneyResults(nextJourneys.last_results || nextReadiness.journeys || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('operations.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => { void load(); }, [load]);

  const createBackup = async () => {
    setBusy('create');
    try {
      const backup = await operationsApi.createBackup();
      setBackups(current => [backup, ...current.filter(item => item.backup_id !== backup.backup_id)]);
      toast.success(t('operations.backupCreated'));
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : t('operations.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const runGoldenJourneys = async () => {
    setBusy('journeys');
    try {
      const results = await operationsApi.runGoldenJourneys();
      setJourneyResults(results);
      const nextReadiness = await operationsApi.readiness();
      setReadiness(nextReadiness);
      toast.success(t('operations.goldenCompleted'));
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : t('operations.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const verify = async (backup: BackupManifest) => {
    setBusy(`verify:${backup.backup_id}`);
    try {
      const verified = await operationsApi.verifyBackup(backup.backup_id);
      setBackups(current => current.map(item => item.backup_id === backup.backup_id ? verified : item));
      toast.success(t('operations.backupVerified'));
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : t('operations.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const restore = async (backup: BackupManifest, validateOnly: boolean) => {
    const expected = `RESTORE ${backup.backup_id}`;
    if (!validateOnly && confirmation !== expected) return;
    if (!validateOnly && !window.confirm(t('operations.restoreWarning'))) return;
    setBusy(`${validateOnly ? 'validate' : 'restore'}:${backup.backup_id}`);
    try {
      await operationsApi.restoreBackup(backup, validateOnly, confirmation);
      toast.success(t(validateOnly ? 'operations.restoreValidated' : 'operations.restoreCompleted'));
      if (!validateOnly) {
        setConfirmation('');
        setRestoreTarget('');
      }
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : t('operations.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  return <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex flex-col justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white md:flex-row md:items-center">
      <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300"><ShieldCheck size={15} /> Athena Operations</div><h3 className="mt-2 text-lg font-black">{t('operations.title')}</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{t('operations.subtitle')}</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{t('experience.refresh')}</button><button type="button" onClick={() => void createBackup()} disabled={busy !== '' || !snapshot?.recovery_managed || !backupConfigured} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40">{busy === 'create' ? <Loader2 size={14} className="animate-spin" /> : <DatabaseBackup size={14} />}{t('operations.createBackup')}</button></div>
    </div>

    {error ? <div className="m-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700"><ShieldAlert size={17} className="shrink-0" /><div><strong>{t('operations.unavailable')}</strong><p className="mt-1 break-all text-red-600">{error}</p></div></div> : loading && !snapshot ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-emerald-600" /></div> : snapshot && <div className="p-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Summary icon={HeartPulse} label={t('operations.clientHealth')} value={snapshot.health.status} tone={healthTone[snapshot.health.status]} />
        <Summary icon={Server} label={t('operations.runtimeHealth')} value={snapshot.runtime_health?.status || '—'} tone={snapshot.runtime_health ? healthTone[snapshot.runtime_health.status] : undefined} />
        <Summary icon={Smartphone} label={t('operations.devices')} value={`${snapshot.online_devices} / ${snapshot.total_devices}`} />
        <Summary icon={Timer} label={t('operations.p95')} value={snapshot.slo ? `${snapshot.slo.p95_latency_ms} ms` : '—'} />
        <Summary icon={CheckCircle2} label={t('operations.availability')} value={snapshot.slo ? `${(snapshot.slo.availability * 100).toFixed(3)}%` : '—'} />
      </div>

      {snapshot.delegation_slo && <div className={cn('mt-5 rounded-2xl border p-4', snapshot.delegation_slo.duplicate_confirmed_side_effects === 0 && snapshot.delegation_slo.availability >= 0.999 && snapshot.delegation_slo.cancel_propagation_p95_ms <= 5000 ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70')}>
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center"><div><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-700" /><h4 className="text-xs font-black uppercase tracking-wider text-slate-700">{t('operations.delegationRecovery')}</h4></div><p className="mt-1 text-[10px] text-slate-500">{t('operations.delegationRecoveryHint')}</p></div><span className="font-mono text-[9px] text-slate-400">24h · {new Date(snapshot.delegation_slo.generated_at).toLocaleString()}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6"><SmallMetric label={t('operations.delegationRuns')} value={snapshot.delegation_slo.total_runs} /><SmallMetric label={t('operations.delegationAvailability')} value={`${(snapshot.delegation_slo.availability * 100).toFixed(3)}%`} /><SmallMetric label={t('operations.cancelP95')} value={`${snapshot.delegation_slo.cancel_propagation_p95_ms} ms`} /><SmallMetric label={t('operations.recoveredAttempts')} value={snapshot.delegation_slo.recovered_attempts} /><SmallMetric label={t('operations.fencedLateResults')} value={snapshot.delegation_slo.fenced_late_results} /><SmallMetric label={t('operations.confirmedDuplicates')} value={snapshot.delegation_slo.duplicate_confirmed_side_effects} /></div>
      </div>}

      {readiness && <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-center">
          <div><div className="flex items-center gap-2"><ListChecks size={16} className="text-sky-600" /><h4 className="text-xs font-black uppercase tracking-wider text-slate-700">{t('operations.gaReadiness')}</h4><span className={cn('rounded-full border px-2 py-1 text-[9px] font-black', readinessTone[readiness.status])}>{readiness.status}</span></div><p className="mt-1 text-[10px] text-slate-400">{t('operations.gaReadinessHint', { version: readiness.release_version })}</p></div>
          <button type="button" onClick={() => void runGoldenJourneys()} disabled={busy !== ''} className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40">{busy === 'journeys' ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}{t('operations.runGolden')}</button>
        </div>
        <div className="grid gap-4 p-4 xl:grid-cols-[1fr_1.2fr]">
          <div><h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('operations.releaseGates')}</h5><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-1">{readiness.checks.map(check => <div key={check.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate font-mono text-[10px] text-slate-700">{check.id}</strong><p className="mt-1 text-[10px] leading-4 text-slate-500">{check.message}</p></div><span className={cn('shrink-0 rounded-full border px-2 py-1 text-[8px] font-black', readinessTone[check.status])}>{check.status}</span></div>{check.evidence?.map(item => <p key={`${item.kind}:${item.reference}`} className="mt-2 truncate font-mono text-[8px] text-sky-600">{item.kind}: {item.reference}</p>)}</div>)}</div></div>
          <div><div className="flex items-center justify-between"><h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('operations.goldenJourneys')}</h5><span className="text-[9px] text-slate-400">{t('operations.preflightOnly')}</span></div><div className="mt-2 max-h-[390px] space-y-2 overflow-y-auto pr-1">{journeys.map(journey => {
            const result = journeyResults.find(item => item.journey_id === journey.id);
            const status: GAReadinessStatus = result?.status || 'NOT_RUN';
            return <div key={journey.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><strong className="text-xs text-slate-800">{journey.title}</strong><p className="mt-1 text-[10px] leading-4 text-slate-400">{journey.description}</p></div><div className="flex shrink-0 flex-col items-end gap-1">{result && <span className="font-mono text-[7px] font-black tracking-wider text-slate-400">{result.verification_level}</span>}<span className={cn('rounded-full border px-2 py-1 text-[8px] font-black', readinessTone[status])}>{status}</span></div></div><div className="mt-2 flex flex-wrap gap-1">{journey.steps.map(step => <span key={step.id} title={`${step.capability} · ${step.expected_evidence.join(', ')}`} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[8px] text-slate-500">{step.capability}</span>)}</div>{result?.steps[0]?.message && <p className="mt-2 text-[9px] text-slate-500">{result.steps[0].message}</p>}{result && <p className="mt-1 truncate font-mono text-[8px] text-slate-300">{result.run_id}</p>}</div>;
          })}</div></div>
        </div>
      </div>}

      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2"><HeartPulse size={16} className="text-emerald-600" /><h4 className="text-xs font-black uppercase tracking-wider text-slate-700">{t('operations.healthChecks')}</h4></div>
          <div className="mt-3 space-y-2">{snapshot.health.checks.map(check => <div key={check.name} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><strong className="text-xs text-slate-800">{check.name}</strong><span className={cn('rounded-full border px-2 py-1 text-[9px] font-black', healthTone[check.status])}>{check.status}</span></div><p className="mt-1 text-[10px] text-slate-400">{check.latency_ms} ms{check.message ? ` · ${check.message}` : ''}</p></div>)}</div>
          {snapshot.slo && <div className="mt-3 grid grid-cols-2 gap-2"><SmallMetric label={t('operations.requests')} value={snapshot.slo.requests} /><SmallMetric label={t('operations.errors')} value={snapshot.slo.errors} /><SmallMetric label={t('operations.rejected')} value={snapshot.slo.rejected_requests} /><SmallMetric label={t('operations.timeouts')} value={snapshot.slo.timed_out_requests} /><SmallMetric label={t('operations.dropped')} value={snapshot.slo.dropped_events} /><SmallMetric label={t('operations.duplicates')} value={snapshot.slo.duplicate_irreversible_effects} /></div>}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><div><h4 className="text-xs font-black uppercase tracking-wider text-slate-700">{t('operations.recoveryPoints')}</h4><p className="mt-1 text-[10px] text-slate-400">{t('operations.recoveryHint')}</p></div><HardDrive size={18} className="text-slate-400" /></div>
          <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">{!backupConfigured ? <div className="flex items-start gap-2 bg-amber-50 p-4 text-[10px] leading-5 text-amber-800"><ShieldAlert size={15} className="mt-0.5 shrink-0" /><p>{t('operations.backupUnavailable')}</p></div> : backups.length === 0 ? <p className="p-5 text-xs text-slate-400">{t('operations.noBackups')}</p> : backups.map(backup => {
            const exact = `RESTORE ${backup.backup_id}`;
            const expanded = restoreTarget === backup.backup_id;
            return <article key={backup.backup_id} className="p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-xs text-slate-800">{backup.backup_id}</strong><span className={cn('rounded-full border px-2 py-1 text-[9px] font-black', backup.status === 'VERIFIED' ? healthTone.HEALTHY : 'border-sky-200 bg-sky-50 text-sky-700')}>{backup.status}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">AES-GCM</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">{backup.integrity.algorithm}</span></div><p className="mt-1 text-[10px] text-slate-400">PostgreSQL {backup.database_version} · {formatBytes(backup.artifacts.reduce((total, item) => total + item.size_bytes, 0))} · {new Date(backup.created_at).toLocaleString()}</p><p className="mt-1 truncate font-mono text-[9px] text-slate-400">sha256:{backup.manifest_sha256}</p><p className="mt-1 truncate font-mono text-[9px] text-emerald-700">hmac-key:{backup.integrity.key_id}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => void verify(backup)} disabled={busy !== ''} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[10px] font-bold text-emerald-700 disabled:opacity-40">{busy === `verify:${backup.backup_id}` ? t('operations.verifying') : t('operations.verify')}</button><button type="button" onClick={() => { setRestoreTarget(expanded ? '' : backup.backup_id); setConfirmation(''); }} className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-[10px] font-bold text-red-600"><RotateCcw size={11} />{t('operations.restore')}</button></div></div>
              {expanded && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-bold text-red-800">{t('operations.restoreTitle')}</p><p className="mt-1 text-[10px] leading-5 text-red-600">{t('operations.restoreHint')}</p><button type="button" onClick={() => void restore(backup, true)} disabled={busy !== ''} className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-[10px] font-bold text-red-700 disabled:opacity-40">{busy === `validate:${backup.backup_id}` ? t('operations.validating') : t('operations.validateRestore')}</button><label className="mt-3 block"><span className="font-mono text-[10px] text-red-700">{exact}</span><input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder={exact} className="mt-1.5 w-full rounded-lg border border-red-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-red-400" /></label><button type="button" onClick={() => void restore(backup, false)} disabled={busy !== '' || confirmation !== exact} className="mt-3 w-full rounded-lg bg-red-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-30">{busy === `restore:${backup.backup_id}` ? t('operations.restoring') : t('operations.confirmRestore')}</button></div>}
            </article>;
          })}</div>
        </div>
      </div>
    </div>}
  </section>;
}

function Summary({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-slate-400"><Icon size={13} />{label}</div><span className={cn('mt-2 inline-flex rounded-full border border-transparent px-2 py-1 font-mono text-xs font-black text-slate-800', tone)}>{value}</span></div>;
}

function SmallMetric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-2"><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-mono text-xs font-black text-slate-700">{value}</p></div>;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
