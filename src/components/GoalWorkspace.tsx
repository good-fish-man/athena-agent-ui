import React from 'react';
import { Activity, ChevronDown, ChevronRight, CirclePause, CirclePlay, Clock3, GitBranch, Plus, RefreshCw, ShieldCheck, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { agentApi, goalApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { Agent, GoalCheckpoint, GoalState, PersistentGoal } from '../types';

const terminal = new Set(['COMPLETED', 'CANCELLED']);

export function GoalWorkspace() {
  const { t } = useTranslation();
  const [goals, setGoals] = React.useState<GoalState[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [expanded, setExpanded] = React.useState('');
  const [history, setHistory] = React.useState<Record<string, GoalCheckpoint[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState({ agentId: '', objective: '', success: '', deadline: '' });

  const load = React.useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [items, availableAgents] = await Promise.all([goalApi.list(30), agentApi.findAll()]);
      const details = await Promise.all(items.map(item => goalApi.find(item.goal_id)));
      setGoals(details);
      setAgents(availableAgents);
      setForm(current => ({ ...current, agentId: current.agentId || availableAgents[0]?.ulid || availableAgents[0]?.id || '' }));
    } catch (error) {
      if (!quiet) toast.error(t('goals.loadFailed'), { description: error instanceof Error ? error.message : String(error) });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const create = async () => {
    if (!form.agentId || !form.objective.trim() || !form.success.trim()) return;
    setBusy('create');
    try {
      await goalApi.createResearch({ agent_id: form.agentId, objective: form.objective.trim(), success: form.success.trim(), deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined });
      setShowCreate(false);
      setForm(current => ({ ...current, objective: '', success: '', deadline: '' }));
      toast.success(t('goals.created'));
      await load(true);
    } catch (error) {
      toast.error(t('goals.createFailed'), { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy('');
    }
  };

  const transition = async (goal: PersistentGoal, action: 'pause' | 'resume') => {
    setBusy(goal.goal_id);
    try {
      if (action === 'pause') await goalApi.pause(goal);
      else await goalApi.resume(goal);
      toast.success(action === 'pause' ? t('goals.paused') : t('goals.resumed'));
      await load(true);
    } catch (error) {
      toast.error(t('goals.actionFailed'), { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy('');
    }
  };

  const toggleDetails = async (state: GoalState) => {
    if (expanded === state.goal.goal_id) {
      setExpanded('');
      return;
    }
    setExpanded(state.goal.goal_id);
    if (!history[state.goal.goal_id]) {
      const checkpoints = await goalApi.checkpoints(state.goal.goal_id).catch(() => []);
      setHistory(current => ({ ...current, [state.goal.goal_id]: checkpoints }));
    }
  };

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Target size={17} className="text-brand-600" /><h2 className="font-bold text-slate-900">{t('goals.title')}</h2></div>
          <p className="mt-1 text-xs text-slate-500">{t('goals.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50" aria-label={t('inbox.refresh')}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          <button type="button" onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white"><Plus size={15} />{t('goals.new')}</button>
        </div>
      </div>

      {loading && goals.length === 0 ? <div className="theme-card rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">{t('goals.loading')}</div> : goals.length === 0 ? (
        <div className="theme-card rounded-2xl border border-dashed border-slate-300 p-8 text-center"><Target className="mx-auto text-slate-300" size={30} /><p className="mt-3 text-sm font-bold text-slate-700">{t('goals.empty')}</p><p className="mt-1 text-xs text-slate-500">{t('goals.emptyHint')}</p></div>
      ) : <div className="space-y-3">{goals.map(state => {
        const goal = state.goal;
        const open = expanded === goal.goal_id;
        const completed = state.tasks.filter(task => task.status === 'COMPLETED').length;
        return <article key={goal.goal_id} className="theme-card overflow-hidden rounded-2xl border border-slate-200">
          <div className="p-4"><div className="flex items-start gap-3">
            <button type="button" onClick={() => void toggleDetails(state)} className="mt-0.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100">{open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900">{goal.objective}</h3><span className={cn('rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider', statusTone(goal.status))}>{t(`goals.status.${goal.status}`)}</span></div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-medium text-slate-500"><span className="flex items-center gap-1"><GitBranch size={11} />{completed}/{state.tasks.length} {t('goals.tasks')}</span><span className="flex items-center gap-1"><Activity size={11} />{goal.usage.tokens.toLocaleString()} {t('goals.tokens')}</span>{goal.deadline && <span className="flex items-center gap-1"><Clock3 size={11} />{new Date(goal.deadline).toLocaleString()}</span>}</div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${percent(goal.usage.tokens, goal.budget.max_tokens)}%` }} /></div>
            </div>
            {!terminal.has(goal.status) && <button type="button" disabled={busy === goal.goal_id} onClick={() => void transition(goal, goal.status === 'PAUSED' || goal.status === 'WAITING_USER' || goal.status === 'FAILED' ? 'resume' : 'pause')} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40">{goal.status === 'PAUSED' || goal.status === 'WAITING_USER' || goal.status === 'FAILED' ? <CirclePlay size={16} /> : <CirclePause size={16} />}</button>}
          </div></div>
          {open && <div className="border-t border-slate-100 bg-slate-50/70 p-4">
            <div className="grid gap-2 md:grid-cols-2">{state.tasks.map(task => <div key={task.task_id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black tracking-widest text-slate-400">{task.specialist}</span><span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', statusTone(task.status))}>{t(`goals.taskStatus.${task.status}`)}</span></div><p className="mt-2 text-xs font-semibold leading-5 text-slate-700">{task.objective}</p><p className="mt-2 text-[10px] text-slate-400">{t('goals.attempt')} {task.attempt}{task.device_id ? ` · ${task.device_id}` : ''}</p></div>)}</div>
            <div className="mt-4"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700"><ShieldCheck size={14} className="text-emerald-600" />{t('goals.checkpoints')}</div><div className="space-y-1.5">{(history[goal.goal_id] || []).slice(0, 5).map(item => <div key={item.checkpoint_id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-[10px] text-slate-500"><span className="truncate">#{item.sequence} · {item.reason}</span><span className="shrink-0 font-mono">r{item.goal_revision}</span></div>)}</div></div>
          </div>}
        </article>;
      })}</div>}

      {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={event => { if (event.currentTarget === event.target) setShowCreate(false); }}>
        <div className="theme-card w-full max-w-xl rounded-3xl border border-slate-200 p-6 shadow-2xl">
          <div className="flex items-start justify-between"><div><h3 className="text-lg font-black text-slate-900">{t('goals.createTitle')}</h3><p className="mt-1 text-xs text-slate-500">{t('goals.createHint')}</p></div><button type="button" onClick={() => setShowCreate(false)} className="text-slate-400">×</button></div>
          <div className="mt-5 space-y-4">
            <label className="block text-xs font-bold text-slate-600">{t('goals.agent')}<select value={form.agentId} onChange={event => setForm(current => ({ ...current, agentId: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{agents.map(agent => <option key={agent.ulid || agent.id} value={agent.ulid || agent.id}>{agent.name}</option>)}</select></label>
            <label className="block text-xs font-bold text-slate-600">{t('goals.objective')}<textarea value={form.objective} onChange={event => setForm(current => ({ ...current, objective: event.target.value }))} rows={3} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" placeholder={t('goals.objectivePlaceholder')} /></label>
            <label className="block text-xs font-bold text-slate-600">{t('goals.success')}<input value={form.success} onChange={event => setForm(current => ({ ...current, success: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" placeholder={t('goals.successPlaceholder')} /></label>
            <label className="block text-xs font-bold text-slate-600">{t('goals.deadline')}<input type="datetime-local" value={form.deadline} onChange={event => setForm(current => ({ ...current, deadline: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" /></label>
          </div>
          <button type="button" onClick={() => void create()} disabled={busy === 'create' || !form.agentId || !form.objective.trim() || !form.success.trim()} className="mt-6 w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy === 'create' ? t('goals.creating') : t('goals.create')}</button>
        </div>
      </div>}
    </section>
  );
}

function percent(value: number, limit: number) {
  if (!limit) return 0;
  return Math.max(0, Math.min(100, Math.round((value / limit) * 100)));
}

function statusTone(status: string) {
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'RUNNING' || status === 'READY') return 'bg-sky-50 text-sky-700';
  if (status.includes('WAITING') || status === 'PAUSED') return 'bg-amber-50 text-amber-700';
  if (status === 'FAILED' || status === 'CANCELLED') return 'bg-red-50 text-red-700';
  return 'bg-slate-100 text-slate-600';
}
