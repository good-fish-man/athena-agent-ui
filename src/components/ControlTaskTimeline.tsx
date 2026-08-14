import React from 'react';
import { Check, CheckCircle2, ChevronDown, CircleDashed, OctagonX, RefreshCw, ShieldAlert, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { controlApi, type ControlApproval, type ControlTask } from '../lib/api';
import { cn } from '../lib/utils';

const terminalStatuses = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);
const liveStatuses = new Set(['PENDING', 'RUNNING', 'WAITING_APPROVAL', 'WAITING_OBSERVATION', 'WAITING_USER']);

function taskTone(status: string) {
  if (status === 'COMPLETED') return 'text-emerald-700 bg-emerald-50 ring-emerald-100';
  if (status === 'FAILED' || status === 'CANCELLED') return 'text-rose-700 bg-rose-50 ring-rose-100';
  if (status.includes('WAITING')) return 'text-amber-700 bg-amber-50 ring-amber-100';
  return 'text-sky-700 bg-sky-50 ring-sky-100';
}

export default function ControlTaskTimeline({ conversationId }: { conversationId?: string | null }) {
  const { t } = useTranslation();
  const [tasks, setTasks] = React.useState<ControlTask[]>([]);
  const [approvals, setApprovals] = React.useState<ControlApproval[]>([]);
  const [expanded, setExpanded] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [deciding, setDeciding] = React.useState('');
  const [approvalError, setApprovalError] = React.useState('');

  const refresh = React.useEffectEvent(async (quiet = false) => {
    if (!conversationId) {
      setTasks([]);
      setApprovals([]);
      return;
    }
    if (!quiet) setRefreshing(true);
    try {
      const next = await controlApi.tasks(conversationId);
      setTasks(next.slice(0, 5));
      const taskIDs = new Set(next.map(task => task.task_id));
      const pending = await controlApi.approvals().catch(error => {
		console.debug('[control] approval refresh skipped', error);
		return [];
	  });
      setApprovals(pending.filter(approval => taskIDs.has(approval.task_id)));
    } catch (error) {
      console.debug('[control] task timeline refresh skipped', error);
    } finally {
      if (!quiet) setRefreshing(false);
    }
  });

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(true), 15000);
    const onFocus = () => void refresh(true);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [conversationId]);

  const activeTaskKey = tasks
	.filter(task => liveStatuses.has(task.status))
    .map(task => `${task.task_id}:${task.revision}`)
    .join('|');

  React.useEffect(() => {
    const subscriptions = tasks
	  .filter(task => liveStatuses.has(task.status))
      .map(task => controlApi.subscribeTaskEvents(task.task_id, 0, () => void refresh(true)));
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, [activeTaskKey]);

  if (!conversationId || (tasks.length === 0 && approvals.length === 0)) return null;
  const activeCount = tasks.filter(task => liveStatuses.has(task.status)).length;

  const cancel = async (taskId: string) => {
    await controlApi.cancelTask(taskId, 'user cancelled the task from its timeline');
    await refresh(true);
  };

  const decide = async (approvalId: string, approved: boolean) => {
	setDeciding(approvalId);
	setApprovalError('');
	try {
	  await controlApi.decideApproval(approvalId, approved);
	  await refresh(true);
	} catch (error) {
	  setApprovalError(error instanceof Error ? error.message : t('chat.approvalFailed'));
	} finally {
	  setDeciding('');
	}
  };

  return (
    <section className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-sky-100 bg-white/90 shadow-sm">
      <button type="button" onClick={() => setExpanded(value => !value)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sky-50/50">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-600"><CircleDashed size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-slate-800">{t('chat.taskTimeline')}</span>
          <span className="block text-[10px] text-slate-400">{activeCount > 0 ? t('chat.taskTimelineActive', { count: activeCount }) : t('chat.taskTimelineRestored')}</span>
        </span>
        <RefreshCw size={14} className={cn('text-slate-400', refreshing && 'animate-spin')} onClick={event => { event.stopPropagation(); void refresh(); }} />
        <ChevronDown size={15} className={cn('text-slate-400 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-slate-100 p-3">
		  {approvals.map(approval => (
			<article key={approval.approval_id} className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
			  <div className="flex items-start gap-3">
				<span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"><ShieldAlert size={15} /></span>
				<div className="min-w-0 flex-1">
				  <div className="flex flex-wrap items-center gap-2">
					<span className="text-[11px] font-bold text-slate-800">{approval.summary || t('chat.approvalRequired')}</span>
					<span className="rounded-full bg-white px-2 py-0.5 text-[8px] font-bold text-amber-700 ring-1 ring-amber-200">{approval.risk}</span>
				  </div>
				  <p className="mt-1 truncate text-[9px] text-slate-500">{String(approval.scope?.capability || approval.scope?.operation || approval.action_id)}</p>
				</div>
				<div className="flex shrink-0 items-center gap-1">
				  <button type="button" disabled={deciding === approval.approval_id} onClick={() => void decide(approval.approval_id, false)} className="flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[9px] font-bold text-rose-600 ring-1 ring-rose-100 hover:bg-rose-50 disabled:opacity-50"><X size={11} />{t('chat.rejectApproval')}</button>
				  <button type="button" disabled={deciding === approval.approval_id} onClick={() => void decide(approval.approval_id, true)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[9px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><Check size={11} />{t('chat.approveApproval')}</button>
				</div>
			  </div>
			</article>
		  ))}
		  {approvalError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[9px] font-medium text-rose-700">{approvalError}</p>}
          {tasks.map(task => (
            <article key={task.task_id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-slate-400">
				  {task.status === 'COMPLETED' ? <CheckCircle2 size={15} className="text-emerald-500" /> : task.status === 'FAILED' ? <OctagonX size={15} className="text-rose-500" /> : <CircleDashed size={15} className={cn('text-sky-500', liveStatuses.has(task.status) && 'animate-pulse')} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[11px] font-bold text-slate-700">{task.goal || task.steps?.at(-1)?.title || task.steps?.at(-1)?.capability || task.task_id}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[8px] font-bold ring-1', taskTone(task.status))}>{task.status}</span>
                    <span className="text-[8px] tabular-nums text-slate-400">r{task.revision}</span>
                  </div>
                  {task.steps && task.steps.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {task.steps.map(step => <span key={step.step_id} className="rounded-md bg-white px-2 py-1 text-[8px] text-slate-500 ring-1 ring-slate-100">{step.ordinal}. {step.operation || step.capability || t('chat.taskStep')} · {step.status}</span>)}
                    </div>
                  )}
                </div>
                {!terminalStatuses.has(task.status) && <button type="button" onClick={() => void cancel(task.task_id)} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold text-rose-600 hover:bg-rose-50"><Square size={10} />{t('chat.cancelTask')}</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
