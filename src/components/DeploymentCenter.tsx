import React from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileClock,
  Fingerprint,
  FlaskConical,
  GitBranch,
  Loader2,
  Pause,
  Power,
  RefreshCw,
  Rocket,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { agentApi, deploymentApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { Agent, AgentBuild, CanaryMetric, DeploymentExposure, DeploymentRollback, DeploymentStatus, Promotion, RunManifest, ShadowResult } from '../types';

const statusTone: Record<DeploymentStatus, string> = {
  PROPOSED: 'border-slate-200 bg-slate-50 text-slate-600',
  REVIEWED: 'border-sky-200 bg-sky-50 text-sky-700',
  SHADOW: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  CANARY: 'border-amber-200 bg-amber-50 text-amber-700',
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PAUSED: 'border-orange-200 bg-orange-50 text-orange-700',
  ROLLED_BACK: 'border-red-200 bg-red-50 text-red-700',
  RETIRED: 'border-slate-200 bg-slate-100 text-slate-400',
};

function agentID(agent: Agent) { return agent.ulid || agent.id; }

export function DeploymentCenter() {
  const { t } = useTranslation();
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [builds, setBuilds] = React.useState<AgentBuild[]>([]);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [manifests, setManifests] = React.useState<RunManifest[]>([]);
  const [rollbacks, setRollbacks] = React.useState<DeploymentRollback[]>([]);
  const [exposure, setExposure] = React.useState<DeploymentExposure | null>(null);
  const [shadow, setShadow] = React.useState<Record<string, ShadowResult[]>>({});
  const [metrics, setMetrics] = React.useState<Record<string, CanaryMetric[]>>({});
  const [expanded, setExpanded] = React.useState('');
  const [selectedAgent, setSelectedAgent] = React.useState('');
  const [version, setVersion] = React.useState('0.5.0');
  const [risk, setRisk] = React.useState<AgentBuild['risk_level']>('R1');
  const [busy, setBusy] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [agentItems, buildItems, promotionItems, manifestItems, rollbackItems] = await Promise.all([
        agentApi.findAll(), deploymentApi.builds(), deploymentApi.promotions(), deploymentApi.manifests(), deploymentApi.rollbacks(),
      ]);
      setAgents(agentItems);
      setBuilds(buildItems);
      setPromotions(promotionItems);
      setManifests(manifestItems);
      setRollbacks(rollbackItems);
      if (!selectedAgent && agentItems.length > 0) setSelectedAgent(agentID(agentItems[0]));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('deployment.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, t]);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    if (!selectedAgent) {
      setExposure(null);
      return;
    }
    void deploymentApi.experiment(selectedAgent).then(setExposure).catch(() => setExposure(null));
  }, [selectedAgent, promotions]);

  const createBuild = async () => {
    if (!selectedAgent) return;
    setBusy('build');
    try {
      const build = await deploymentApi.createBuild({ agent_id: selectedAgent, version, risk_level: risk, prompt_template_versions: { system: `agent-${selectedAgent}-current` } });
      setBuilds(current => [build, ...current]);
      toast.success(t('deployment.buildCreated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('deployment.buildFailed'));
    } finally {
      setBusy('');
    }
  };

  const propose = async (build: AgentBuild) => {
    setBusy(`propose:${build.build_id}`);
    try {
      const promotion = await deploymentApi.propose(build.build_id, 10);
      setPromotions(current => [promotion, ...current]);
      toast.success(t('deployment.promotionCreated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('deployment.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const transition = async (promotion: Promotion, status: DeploymentStatus, explicit = false) => {
    setBusy(`promotion:${promotion.promotion_id}`);
    try {
      const updated = await deploymentApi.transition(promotion, status, explicit);
      setPromotions(current => current.map(item => item.promotion_id === updated.promotion_id ? updated : item));
      toast.success(t('deployment.transitioned', { status }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('deployment.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const rollback = async (promotion: Promotion) => {
    if (!window.confirm(t('deployment.rollbackConfirm'))) return;
    setBusy(`promotion:${promotion.promotion_id}`);
    try {
      await deploymentApi.rollback(promotion, 'manual rollback from release center');
      await load();
      toast.success(t('deployment.rolledBack'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('deployment.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const toggleOptOut = async () => {
    if (!selectedAgent || !exposure) return;
    setBusy('experiment');
    try {
      await deploymentApi.setOptOut(selectedAgent, !exposure.opted_out);
      setExposure(await deploymentApi.experiment(selectedAgent));
      toast.success(t(exposure.opted_out ? 'deployment.experimentJoined' : 'deployment.experimentLeft'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('deployment.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const openPromotion = async (promotion: Promotion) => {
    if (expanded === promotion.promotion_id) {
      setExpanded('');
      return;
    }
    setExpanded(promotion.promotion_id);
    try {
      const [shadowItems, metricItems] = await Promise.all([deploymentApi.shadow(promotion.promotion_id), deploymentApi.metrics(promotion.promotion_id)]);
      setShadow(current => ({ ...current, [promotion.promotion_id]: shadowItems }));
      setMetrics(current => ({ ...current, [promotion.promotion_id]: metricItems }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('deployment.loadFailed'));
    }
  };

  const filteredBuilds = selectedAgent ? builds.filter(item => item.agent_id === selectedAgent) : builds;
  const filteredPromotions = selectedAgent ? promotions.filter(item => item.agent_id === selectedAgent) : promotions;

  return <div className="space-y-6">
    <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-col justify-between gap-4 bg-slate-950 px-5 py-5 text-white md:flex-row md:items-center">
        <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-sky-300"><Rocket size={15} /> Athena Release Control</div><h2 className="mt-2 text-xl font-black">{t('deployment.title')}</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{t('deployment.subtitle')}</p></div>
        <button type="button" onClick={() => void load()} className="flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{t('experience.refresh')}</button>
      </div>
      <div className="grid gap-3 border-t border-white/10 bg-slate-900 px-5 py-4 text-[10px] text-slate-300 md:grid-cols-3"><span className="flex items-center gap-2"><Fingerprint size={14} className="text-sky-400" />{t('deployment.immutable')}</span><span className="flex items-center gap-2"><FlaskConical size={14} className="text-indigo-400" />{t('deployment.shadowSafe')}</span><span className="flex items-center gap-2"><RotateCcw size={14} className="text-amber-400" />{t('deployment.pointerRollback')}</span></div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[350px_1fr]">
      <aside className="space-y-5">
        <section className="theme-card rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">{t('deployment.newBuild')}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{t('deployment.newBuildHint')}</p>
          <Field label={t('deployment.agent')}><select value={selectedAgent} onChange={event => setSelectedAgent(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-sky-400"><option value="">{t('deployment.selectAgent')}</option>{agents.map(agent => <option key={agentID(agent)} value={agentID(agent)}>{agent.name || agentID(agent)}</option>)}</select></Field>
          <Field label={t('deployment.version')}><input value={version} onChange={event => setVersion(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-sky-400" /></Field>
          <Field label={t('deployment.risk')}><select value={risk} onChange={event => setRisk(event.target.value as AgentBuild['risk_level'])} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-sky-400"><option>R0</option><option>R1</option><option>R2</option><option>R3</option></select></Field>
          <button type="button" onClick={() => void createBuild()} disabled={!selectedAgent || !version || busy === 'build'} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white disabled:opacity-40">{busy === 'build' ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}{t('deployment.createBuild')}</button>
        </section>
        <section className="theme-card rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">{t('deployment.experiment')}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{t('deployment.experimentHint')}</p></div><Power size={18} className="text-slate-400" /></div>
          {exposure ? <><div className="mt-4 grid grid-cols-2 gap-2"><Metric label={t('deployment.variant')} value={exposure.opted_out ? 'CONTROL' : exposure.variant} /><Metric label={t('deployment.bucket')} value={String(exposure.bucket)} /></div><button type="button" onClick={() => void toggleOptOut()} disabled={busy === 'experiment'} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-40">{busy === 'experiment' && <Loader2 size={13} className="animate-spin" />}{t(exposure.opted_out ? 'deployment.joinExperiment' : 'deployment.leaveExperiment')}</button></> : <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-400">{t('deployment.noExperiment')}</p>}
        </section>
        <section className="theme-card rounded-2xl border border-slate-200 p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">{t('deployment.builds')}</h3><strong className="text-sm text-sky-600">{filteredBuilds.length}</strong></div><div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">{filteredBuilds.map(build => <div key={build.build_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate font-mono text-xs text-slate-800">{build.version}</strong><span className="text-[9px] text-slate-400">{build.build_id}</span></div><span className="rounded bg-white px-2 py-1 text-[9px] font-black text-slate-600">{build.risk_level}</span></div><p className="mt-2 truncate font-mono text-[9px] text-slate-400">sha256:{build.checksum.slice(0, 16)}…</p><button type="button" onClick={() => void propose(build)} disabled={busy === `propose:${build.build_id}`} className="mt-3 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-[10px] font-bold text-sky-700 disabled:opacity-40">{t('deployment.propose')}</button></div>)}{filteredBuilds.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">{t('deployment.noBuilds')}</p>}</div></section>
      </aside>

      <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200 p-5"><h3 className="font-bold text-slate-900">{t('deployment.promotionPipeline')}</h3><p className="mt-1 text-xs text-slate-500">{t('deployment.pipelineHint')}</p></div>
        {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-sky-600" /></div> : filteredPromotions.length === 0 ? <div className="flex min-h-64 items-center justify-center text-xs text-slate-400">{t('deployment.noPromotions')}</div> : <div className="divide-y divide-slate-200">{filteredPromotions.map(promotion => {
          const isExpanded = expanded === promotion.promotion_id;
          const shadowItems = shadow[promotion.promotion_id] || [];
          const metricItems = metrics[promotion.promotion_id] || [];
          const running = busy === `promotion:${promotion.promotion_id}`;
          return <article key={promotion.promotion_id}>
            <button type="button" onClick={() => void openPromotion(promotion)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50"><span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400">{isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="font-mono text-xs text-slate-900">{promotion.build_id}</strong><Status value={promotion.status} /><span className="rounded bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">{promotion.risk_level}</span></span><span className="mt-1 block text-[10px] text-slate-400">{promotion.promotion_id} · {promotion.canary_percent}% canary</span></span><span className="text-right text-[10px] text-slate-400">rev {promotion.revision}</span></button>
            {isExpanded && <div className="border-t border-slate-200 bg-slate-50/70 p-5">
              <div className="grid gap-3 sm:grid-cols-3"><Metric label={t('deployment.shadowRuns')} value={String(shadowItems.length)} good={shadowItems.some(item => item.passed)} /><Metric label={t('deployment.canarySamples')} value={String(metricItems[0]?.sample_count || 0)} good={Boolean(metricItems[0] && !metricItems[0].stop_triggered)} /><Metric label={t('deployment.previousBuild')} value={promotion.previous_build_id?.slice(0, 12) || '—'} /></div>
              <div className="mt-4 flex flex-wrap gap-2">{promotion.status === 'PROPOSED' && <Action icon={ShieldCheck} label={t('deployment.review')} onClick={() => void transition(promotion, 'REVIEWED')} disabled={running} />}{promotion.status === 'REVIEWED' && <Action icon={FlaskConical} label={t('deployment.startShadow')} onClick={() => void transition(promotion, 'SHADOW')} disabled={running} />}{promotion.status === 'SHADOW' && (promotion.risk_level === 'R0' || promotion.risk_level === 'R1' ? <Action icon={Activity} label={t('deployment.startCanary')} onClick={() => void transition(promotion, 'CANARY')} disabled={running || !shadowItems.some(item => item.passed)} /> : <Action icon={ShieldCheck} label={t('deployment.explicitActivate')} onClick={() => void transition(promotion, 'ACTIVE', true)} disabled={running || !shadowItems.some(item => item.passed)} />)}{promotion.status === 'CANARY' && <><Action icon={CheckCircle2} label={t('deployment.activate')} onClick={() => void transition(promotion, 'ACTIVE')} disabled={running || !metricItems.some(item => item.sample_count >= promotion.thresholds.minimum_samples && !item.stop_triggered)} /><Action icon={Pause} label={t('deployment.pause')} onClick={() => void transition(promotion, 'PAUSED')} disabled={running} /></>}{promotion.status === 'ACTIVE' && <Action icon={Pause} label={t('deployment.pause')} onClick={() => void transition(promotion, 'PAUSED')} disabled={running} />}{['ACTIVE', 'CANARY', 'PAUSED'].includes(promotion.status) && promotion.previous_build_id && <Action icon={RotateCcw} label={t('deployment.rollback')} onClick={() => void rollback(promotion)} disabled={running} danger />}{running && <Loader2 size={15} className="animate-spin text-sky-600" />}</div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2"><EvidenceList title={t('deployment.shadowEvidence')} empty={t('deployment.waitingShadow')} items={shadowItems.map(item => ({ id: item.shadow_id, title: item.passed ? t('deployment.passed') : t('deployment.failed'), detail: `${item.task_id} · ${item.latency_ms}ms · ${item.no_external_side_effects ? t('deployment.noSideEffects') : ''}` }))} /><EvidenceList title={t('deployment.canaryHealth')} empty={t('deployment.waitingMetrics')} items={metricItems.map(item => ({ id: item.metric_id, title: `${Math.round(item.success_rate * 100)}% · ${item.sample_count} samples`, detail: item.stop_triggered ? item.stop_reason || t('deployment.stopped') : `${item.p95_latency_ms}ms p95` }))} /></div>
            </div>}
          </article>;
        })}</div>}
      </section>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <section className="theme-card rounded-2xl border border-slate-200 p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-900">{t('deployment.runManifests')}</h3><p className="mt-1 text-xs text-slate-500">{t('deployment.runManifestHint')}</p></div><FileClock size={18} className="text-slate-400" /></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-[9px] uppercase tracking-wider text-slate-400"><tr><th className="pb-2">Task</th><th className="pb-2">Build</th><th className="pb-2">Model config</th><th className="pb-2">Device</th><th className="pb-2">World</th><th className="pb-2">Time</th></tr></thead><tbody className="divide-y divide-slate-100">{manifests.filter(item => !selectedAgent || item.agent_id === selectedAgent).slice(0, 20).map(item => <tr key={item.manifest_id}><td className="py-3 font-mono text-[10px] text-slate-700">{item.task_id}</td><td className="py-3 font-mono text-[10px] text-sky-700">{item.agent_build_id}</td><td className="max-w-48 truncate py-3 font-mono text-[9px] text-slate-400">{item.model_config_version}</td><td className="py-3 text-slate-500">{item.device_id || '—'}</td><td className="py-3 text-slate-500">{item.world_revision}</td><td className="py-3 text-slate-400">{new Date(item.created_at).toLocaleString()}</td></tr>)}</tbody></table></div></section>
      <section className="theme-card rounded-2xl border border-slate-200 p-5 shadow-sm"><div className="flex items-center gap-2"><RotateCcw size={17} className="text-amber-600" /><h3 className="font-bold text-slate-900">{t('deployment.rollbackHistory')}</h3></div><p className="mt-1 text-xs text-slate-500">{t('deployment.rollbackHistoryHint')}</p><div className="mt-4 space-y-2">{rollbacks.filter(item => !selectedAgent || item.agent_id === selectedAgent).slice(0, 10).map(item => <div key={item.rollback_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="font-mono text-[9px] text-slate-400">{item.from_build_id.slice(0, 12)} → {item.to_build_id.slice(0, 12)}</p><p className="mt-1 text-xs font-bold text-slate-700">{item.reason}</p><p className="mt-1 text-[9px] text-slate-400">{new Date(item.created_at).toLocaleString()}</p></div>)}{rollbacks.filter(item => !selectedAgent || item.agent_id === selectedAgent).length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">{t('deployment.noRollbacks')}</p>}</div></section>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-3 block"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span><span className="mt-1.5 block">{children}</span></label>; }
function Status({ value }: { value: DeploymentStatus }) { return <span className={cn('rounded-full border px-2.5 py-1 text-[9px] font-black tracking-wider', statusTone[value])}>{value.replaceAll('_', ' ')}</span>; }
function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) { return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={cn('mt-1 truncate font-mono text-sm font-black', good ? 'text-emerald-600' : 'text-slate-800')}>{value}</p></div>; }
function Action({ icon: Icon, label, onClick, disabled, danger }: { icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className={cn('flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-[10px] font-bold disabled:opacity-40', danger ? 'border-red-200 text-red-600' : 'border-slate-200 text-slate-700')}><Icon size={12} />{label}</button>; }
function EvidenceList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; detail: string }> }) { return <div className="rounded-xl border border-slate-200 bg-white p-3"><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</h4><div className="mt-2 space-y-2">{items.length === 0 ? <p className="text-[10px] text-slate-400">{empty}</p> : items.slice(0, 5).map(item => <div key={item.id} className="rounded-lg bg-slate-50 p-2"><strong className="text-[10px] text-slate-700">{item.title}</strong><p className="mt-1 text-[9px] text-slate-400">{item.detail}</p></div>)}</div></div>; }
