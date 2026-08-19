import React from 'react';
import {
  Activity,
  Ban,
  CheckCircle2,
  FlaskConical,
  GitCompareArrows,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  delegationLearningApi,
  type DelegationBenchmarkMetrics,
  type DelegationLearningCandidate,
  type DelegationLearningSnapshot,
  type LearningBenchmarkMode,
} from '../lib/delegationLearningApi';
import { cn } from '../lib/utils';

const modeOrder: LearningBenchmarkMode[] = ['SINGLE_AGENT', 'STATIC_SPECIALIST', 'DYNAMIC_DSO'];

export function DelegationLearningPanel() {
  const { i18n } = useTranslation();
  const zh = i18n.language.toLowerCase().startsWith('zh');
  const [snapshot, setSnapshot] = React.useState<DelegationLearningSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');

  const copy = zh ? {
    eyebrow: '受治理的动态专家学习', title: 'Delegation Learning Lab', subtitle: '候选只能来自历史证据；经过离线回放、人工审核、无副作用 Shadow、低风险 Canary 和三路基准后，才允许进入默认 AgentBuild。',
    enabled: '允许生成学习候选', disabled: '学习已关闭', refresh: '刷新', unavailable: '学习控制面不可用', evolution: '自动候选发现', scans: '最近扫描', created: '已创建候选', candidates: '候选制品', empty: '还没有候选。自动扫描只会创建声明式候选，不会自动启用。',
    experiences: '经验来源', runs: '运行证据', offline: '离线评估', review: '人工审核', shadow: 'Shadow', rollout: '发布状态', approve: '批准候选', reject: '拒绝', runShadow: '运行 Shadow', startCanary: '启动 10% Canary', promote: '晋级', disable: '立即禁用', waiting: '等待', passed: '通过', failed: '失败', noReview: '未审核', benchmark: '三路基准', safety: '安全', quality: '质量', recovery: '恢复率', latency: 'P95 延迟', cost: '平均成本', primary: '主改进指标', noBenchmark: '等待真实 Canary 样本生成基准报告。', fallback: '任何失败都会回退到 rule-policy baseline。', actionFailed: '操作失败', actionDone: '治理状态已更新',
  } : {
    eyebrow: 'Governed dynamic specialist learning', title: 'Delegation Learning Lab', subtitle: 'Evidence-derived candidates must pass offline replay, human review, zero-side-effect shadow, low-risk canary, and a three-way benchmark before entering a default AgentBuild.',
    enabled: 'Allow learning candidates', disabled: 'Learning is disabled', refresh: 'Refresh', unavailable: 'Learning control plane unavailable', evolution: 'Automatic candidate discovery', scans: 'Last scan', created: 'Candidates created', candidates: 'Artifact candidates', empty: 'No candidates yet. Automatic scans create declarative candidates only; they never activate them.',
    experiences: 'Experience evidence', runs: 'Run evidence', offline: 'Offline evaluation', review: 'Human review', shadow: 'Shadow', rollout: 'Rollout', approve: 'Approve candidate', reject: 'Reject', runShadow: 'Run shadow', startCanary: 'Start 10% canary', promote: 'Promote', disable: 'Disable now', waiting: 'Waiting', passed: 'Passed', failed: 'Failed', noReview: 'Not reviewed', benchmark: 'Three-way benchmark', safety: 'Safety', quality: 'Quality', recovery: 'Recovery', latency: 'P95 latency', cost: 'Average cost', primary: 'Primary improvement', noBenchmark: 'Waiting for a benchmark generated from real canary samples.', fallback: 'Every failed gate falls back to the rule-policy baseline.', actionFailed: 'Action failed', actionDone: 'Governance state updated',
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSnapshot(await delegationLearningApi.snapshot());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.unavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.unavailable]);

  React.useEffect(() => { void load(); }, [load]);

  const act = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await action();
      await load();
      toast.success(copy.actionDone);
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : copy.actionFailed);
    } finally {
      setBusy('');
    }
  };

  const toggle = () => {
    if (!snapshot) return;
    void act('preference', () => delegationLearningApi.preference(!snapshot.preference.enabled, snapshot.preference.revision));
  };

  return <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
    <header className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(120deg,#071d19_0%,#0b2e28_58%,#153a34_100%)] px-5 py-6 text-white">
      <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border border-emerald-300/20 bg-emerald-300/5" />
      <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300"><Sparkles size={15} />{copy.eyebrow}</div><h3 className="mt-2 text-xl font-black">{copy.title}</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-emerald-50/65">{copy.subtitle}</p></div>
        <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{copy.refresh}</button><button type="button" onClick={toggle} disabled={!snapshot || busy !== ''} className={cn('rounded-xl px-3 py-2 text-xs font-black disabled:opacity-40', snapshot?.preference.enabled ? 'bg-emerald-300 text-emerald-950' : 'bg-amber-300 text-amber-950')}>{busy === 'preference' ? <Loader2 size={14} className="inline animate-spin" /> : snapshot?.preference.enabled ? copy.enabled : copy.disabled}</button></div>
      </div>
    </header>
    {error ? <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700"><strong>{copy.unavailable}</strong><p className="mt-1 break-all">{error}</p></div> : loading && !snapshot ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-emerald-600" /></div> : snapshot && <div className="p-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat icon={Activity} label={copy.evolution} value={snapshot.evolution.running ? 'RUNNING' : snapshot.evolution.enabled ? 'IDLE' : 'OFF'} />
        <Stat icon={RefreshCw} label={copy.scans} value={snapshot.evolution.last_scan_at ? new Date(snapshot.evolution.last_scan_at).toLocaleString() : '—'} />
        <Stat icon={Sparkles} label={copy.created} value={String(snapshot.evolution.created_candidates || 0)} />
        <Stat icon={ShieldCheck} label={copy.candidates} value={String(snapshot.candidates.length)} />
      </div>
      <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[10px] font-medium text-emerald-800">{copy.fallback}</p>
      <div className="mt-5 space-y-4">{snapshot.candidates.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">{copy.empty}</p> : snapshot.candidates.map(candidate => <CandidateCard key={candidate.candidate_id} candidate={candidate} snapshot={snapshot} busy={busy} copy={copy} onAction={act} />)}</div>
    </div>}
  </section>;
}

function CandidateCard({ candidate, snapshot, busy, copy, onAction }: { candidate: DelegationLearningCandidate; snapshot: DelegationLearningSnapshot; busy: string; copy: Record<string, string>; onAction: (key: string, action: () => Promise<unknown>) => Promise<void> }) {
  const evaluations = snapshot.evaluations.filter(item => item.candidate_ref === candidate.candidate_id);
  const offline = [...evaluations].reverse().find(item => item.stage === 'OFFLINE');
  const shadow = [...evaluations].reverse().find(item => item.stage === 'SHADOW');
  const review = [...snapshot.reviews].reverse().find(item => item.candidate_ref === candidate.candidate_id);
  const rollout = [...snapshot.rollouts].reverse().find(item => item.candidate_ref === candidate.candidate_id);
  const benchmark = [...snapshot.benchmarks].reverse().find(item => item.candidate_ref === candidate.candidate_id);
  const artifact = candidate.policy_artifact || candidate.profile_artifact;
  const label = artifact ? `${artifact.artifact_id}@${artifact.version}` : candidate.candidate_id;
  const pending = (name: string) => busy === `${name}:${candidate.candidate_id}`;
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-900 px-2.5 py-1 text-[9px] font-black tracking-wider text-white">{candidate.kind.replaceAll('_', ' ')}</span><strong className="font-mono text-xs text-slate-800">{label}</strong></div><p className="mt-2 truncate font-mono text-[9px] text-slate-400">sha256:{candidate.definition_hash}</p></div><div className="flex gap-2"><Evidence label={copy.experiences} value={candidate.source_experience_refs.length} /><Evidence label={copy.runs} value={candidate.source_run_refs.length} /></div></div>
    <div className="grid gap-3 p-4 lg:grid-cols-4"><Gate icon={FlaskConical} label={copy.offline} status={offline ? offline.passed ? copy.passed : copy.failed : copy.waiting} good={offline?.passed} /><Gate icon={UserCheck} label={copy.review} status={review?.decision || copy.noReview} good={review?.decision === 'APPROVE'} /><Gate icon={ShieldCheck} label={copy.shadow} status={shadow ? shadow.passed ? copy.passed : copy.failed : copy.waiting} good={shadow?.passed} /><Gate icon={Activity} label={copy.rollout} status={rollout?.status || copy.waiting} good={rollout?.status === 'PROMOTED'} /></div>
    <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
      {offline?.passed && !review && <><Action label={copy.approve} icon={CheckCircle2} busy={pending('approve')} onClick={() => void onAction(`approve:${candidate.candidate_id}`, () => delegationLearningApi.review(candidate.candidate_id, 'APPROVE', ['human_review_approved']))} /><Action label={copy.reject} icon={XCircle} danger busy={pending('reject')} onClick={() => void onAction(`reject:${candidate.candidate_id}`, () => delegationLearningApi.review(candidate.candidate_id, 'REJECT', ['human_review_rejected']))} /></>}
      {review?.decision === 'APPROVE' && !shadow && <Action label={copy.runShadow} icon={FlaskConical} busy={pending('shadow')} onClick={() => void onAction(`shadow:${candidate.candidate_id}`, () => delegationLearningApi.shadow(candidate.candidate_id))} />}
      {shadow?.passed && !rollout && <Action label={copy.startCanary} icon={Activity} busy={pending('canary')} onClick={() => void onAction(`canary:${candidate.candidate_id}`, () => delegationLearningApi.canary(candidate.candidate_id, snapshot.preference.owner_id, 10))} />}
      {rollout?.status === 'CANARY' && benchmark?.safety_passed && <Action label={copy.promote} icon={GitCompareArrows} busy={pending('promote')} onClick={() => void onAction(`promote:${candidate.candidate_id}`, () => delegationLearningApi.promote(rollout.rollout_id))} />}
      {rollout && ['CANARY', 'PROMOTED', 'PAUSED'].includes(rollout.status) && <Action label={copy.disable} icon={Ban} danger busy={pending('disable')} onClick={() => void onAction(`disable:${candidate.candidate_id}`, () => delegationLearningApi.disable(rollout.rollout_id))} />}
    </div>
    <Benchmark report={benchmark} copy={copy} />
  </article>;
}

function Benchmark({ report, copy }: { report?: DelegationLearningSnapshot['benchmarks'][number]; copy: Record<string, string> }) {
  if (!report) return <div className="border-t border-slate-100 px-4 py-4"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><GitCompareArrows size={14} />{copy.benchmark}</div><p className="mt-2 text-[10px] text-slate-400">{copy.noBenchmark}</p></div>;
  const variants = new Map(report.variants.map(item => [item.mode, item.metrics]));
  return <div className="border-t border-slate-100 px-4 py-4"><div className="flex flex-col justify-between gap-2 md:flex-row md:items-center"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500"><GitCompareArrows size={14} />{copy.benchmark}</div><span className={cn('rounded-full px-2 py-1 text-[9px] font-black', report.safety_passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>{copy.safety}: {report.safety_passed ? copy.passed : copy.failed}</span></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="text-[8px] font-black uppercase tracking-wider text-slate-400"><th className="pb-2">Mode</th><th className="pb-2">{copy.quality}</th><th className="pb-2">{copy.safety}</th><th className="pb-2">{copy.recovery}</th><th className="pb-2">{copy.latency}</th><th className="pb-2">{copy.cost}</th></tr></thead><tbody className="divide-y divide-slate-100">{modeOrder.map(mode => <BenchmarkRow key={mode} mode={mode} metrics={variants.get(mode)} />)}</tbody></table></div><p className="mt-2 text-[9px] text-slate-400">{copy.primary}: <span className="font-mono text-slate-600">{report.primary_improvement}</span></p></div>;
}

function BenchmarkRow({ mode, metrics }: { mode: LearningBenchmarkMode; metrics?: DelegationBenchmarkMetrics }) {
  return <tr className={mode === 'DYNAMIC_DSO' ? 'bg-emerald-50/40' : ''}><td className="py-2 font-mono text-[9px] font-black text-slate-700">{mode}</td><td className="py-2 text-[10px] text-slate-600">{metrics ? `${(metrics.quality_score * 100).toFixed(1)}%` : '—'}</td><td className="py-2 text-[10px] text-slate-600">{metrics ? `${(metrics.safety_score * 100).toFixed(1)}%` : '—'}</td><td className="py-2 text-[10px] text-slate-600">{metrics ? `${(metrics.recovery_rate * 100).toFixed(1)}%` : '—'}</td><td className="py-2 text-[10px] text-slate-600">{metrics ? `${metrics.p95_latency_ms} ms` : '—'}</td><td className="py-2 text-[10px] text-slate-600">{metrics ? metrics.average_cost_micros.toLocaleString() : '—'}</td></tr>;
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-slate-400"><Icon size={13} />{label}</div><p className="mt-2 truncate font-mono text-xs font-black text-slate-800">{value}</p></div>; }
function Evidence({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center"><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</p><strong className="font-mono text-xs text-slate-700">{value}</strong></div>; }
function Gate({ icon: Icon, label, status, good }: { icon: React.ComponentType<{ size?: number }>; label: string; status: string; good?: boolean }) { return <div className={cn('rounded-xl border p-3', good ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50')}><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-slate-400"><Icon size={13} />{label}</div><p className={cn('mt-2 text-xs font-black', good ? 'text-emerald-700' : 'text-slate-600')}>{status}</p></div>; }
function Action({ icon: Icon, label, onClick, danger, busy }: { icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void; danger?: boolean; busy?: boolean }) { return <button type="button" onClick={onClick} disabled={busy} className={cn('flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-[10px] font-bold disabled:opacity-40', danger ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-700')}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}{label}</button>; }
