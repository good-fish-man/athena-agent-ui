import React from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Download,
  FlaskConical,
  GraduationCap,
  Loader2,
  Play,
  RefreshCw,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { modelApi } from '../lib/api';
import type { ModelTrainingEnvironment, ModelTrainingJob } from '../lib/api';
import type { Model } from '../types';
import { cn } from '../lib/utils';

type TrainingMode = 'fine_tune' | 'distill';

interface ModelTrainingLabProps {
  models: Model[];
  onClose: () => void;
  onModelCreated: () => Promise<void>;
}

const supportedStudentNames = /^(qwen3:(0\.6b|1\.7b|4b|8b)|gemma3:(1b|4b))$/i;

const trainingTemplates: Record<TrainingMode, Array<Record<string, unknown>>> = {
  fine_tune: [
    {
      messages: [
        { role: 'system', content: '你是企业内部知识助手，请根据已确认的业务规则准确回答。' },
        { role: 'user', content: '客户申请退款需要提供哪些信息？' },
        { role: 'assistant', content: '请提供订单号、购买账号、退款原因以及可联系的手机号码。' },
      ],
    },
    {
      messages: [
        { role: 'user', content: '如何重置员工门户密码？' },
        { role: 'assistant', content: '在登录页选择“忘记密码”，完成身份验证后设置新密码；如验证失败，请联系管理员。' },
      ],
    },
  ],
  distill: [
    { prompt: '请解释公司差旅报销的完整流程。' },
    { prompt: '请根据内部规范给出新员工入职第一周的任务清单。' },
  ],
};

export function ModelTrainingLab({ models, onClose, onModelCreated }: ModelTrainingLabProps) {
  const { t } = useTranslation();
  const [mode, setMode] = React.useState<TrainingMode>('fine_tune');
  const [environment, setEnvironment] = React.useState<ModelTrainingEnvironment | null>(null);
  const [jobs, setJobs] = React.useState<ModelTrainingJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [dataset, setDataset] = React.useState<File | null>(null);
  const [form, setForm] = React.useState({
    name: '', studentModelId: '', teacherModelId: '', outputName: '',
    iterations: 600, batchSize: 1, learningRate: 0.00001, loraRank: 8, maxSamples: 500,
  });

  const trainableModels = models.filter(model => model.type === 'llm' && model.provider.toLowerCase() === 'ollama' && supportedStudentNames.test(model.name));
  const teacherModels = models.filter(model => model.type === 'llm' && model.id !== form.studentModelId);
  const hasActiveJobs = jobs.some(job => job.status === 'queued' || job.status === 'running');

  const load = React.useEffectEvent(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const [nextEnvironment, nextJobs] = await Promise.all([modelApi.trainingEnvironment(), modelApi.trainingJobs()]);
      setEnvironment(nextEnvironment);
      setJobs(nextJobs);
      if (nextJobs.some(job => job.status === 'completed' && !jobs.some(current => current.ulid === job.ulid && current.status === 'completed'))) {
        await onModelCreated();
      }
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : t('models.training.loadFailed'));
    } finally {
      if (!quiet) setLoading(false);
    }
  });

  React.useEffect(() => { void load(); }, []);
  React.useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => void load(true), 2000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dataset) {
      toast.error(t('models.training.datasetRequired'));
      return;
    }
    if (mode === 'distill' && !form.teacherModelId) {
      toast.error(t('models.training.teacherRequired'));
      return;
    }
    const body = new FormData();
    body.set('mode', mode);
    body.set('name', form.name);
    body.set('studentModelId', form.studentModelId);
    body.set('teacherModelId', mode === 'distill' ? form.teacherModelId : '');
    body.set('outputName', form.outputName);
    body.set('iterations', String(form.iterations));
    body.set('batchSize', String(form.batchSize));
    body.set('learningRate', String(form.learningRate));
    body.set('loraRank', String(form.loraRank));
    body.set('maxSamples', String(form.maxSamples));
    body.set('acknowledgeDistillation', mode === 'distill' ? 'true' : 'false');
    body.set('dataset', dataset);
    try {
      setSubmitting(true);
      const job = await modelApi.createTraining(body);
      setJobs(current => [job, ...current]);
      toast.success(t('models.training.queued'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('models.training.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (jobId: string) => {
    try {
      await modelApi.cancelTraining(jobId);
      await load(true);
      toast.success(t('models.training.canceled'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('models.training.cancelFailed'));
    }
  };

  const downloadTemplate = (templateMode: TrainingMode) => {
    const content = trainingTemplates[templateMode].map(row => JSON.stringify(row)).join('\n') + '\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'application/x-ndjson;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = templateMode === 'fine_tune' ? 'athena-fine-tune-template.jsonl' : 'athena-distillation-template.jsonl';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(t('models.training.templateDownloaded'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex h-[94vh] w-full max-w-6xl min-h-0 flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/20"><FlaskConical size={22} /></span>
            <div>
              <h2 className="text-xl font-black text-slate-900">{t('models.training.title')}</h2>
              <p className="text-xs text-slate-500">{t('models.training.subtitle')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={20} /></button>
        </header>

        <div className="model-modal-scroll min-h-0 flex-1 overflow-auto overscroll-contain">
          <div className="grid min-w-[60rem] grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] gap-6 p-6">
            <form onSubmit={submit} className="space-y-5">
              <div className={cn('rounded-2xl border p-4', environment?.supported ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50')}>
                <div className="flex items-start gap-3">
                  {loading ? <Loader2 className="mt-0.5 animate-spin text-brand-500" size={18} /> : environment?.supported ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={18} /> : <AlertTriangle className="mt-0.5 text-amber-600" size={18} />}
                  <div>
                    <p className="text-sm font-bold text-slate-800">{environment ? `${environment.os} / ${environment.arch} · ${environment.backend || t('models.training.unavailable')}` : t('models.training.detecting')}</p>
                    <p className="mt-1 text-xs text-slate-600">{environment?.message}</p>
                    {environment?.supported && !environment.dependenciesReady && <p className="mt-1 text-xs font-semibold text-amber-700">{t('models.training.dependenciesNotice')}</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setMode('fine_tune')} className={cn('rounded-2xl border p-4 text-left transition-all', mode === 'fine_tune' ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-500/10' : 'border-slate-200 hover:border-slate-300')}>
                  <BrainCircuit className={mode === 'fine_tune' ? 'text-brand-600' : 'text-slate-400'} size={21} />
                  <span className="mt-3 block text-sm font-black text-slate-900">{t('models.training.fineTune')}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{t('models.training.fineTuneHelp')}</span>
                </button>
                <button type="button" onClick={() => setMode('distill')} className={cn('rounded-2xl border p-4 text-left transition-all', mode === 'distill' ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-500/10' : 'border-slate-200 hover:border-slate-300')}>
                  <GraduationCap className={mode === 'distill' ? 'text-amber-600' : 'text-slate-400'} size={22} />
                  <span className="mt-3 block text-sm font-black text-slate-900">{t('models.training.distill')}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{t('models.training.distillHelp')}</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3">
                <div>
                  <p className="text-xs font-black text-sky-900">{t('models.training.downloadTemplate')}</p>
                  <p className="mt-0.5 text-[11px] text-sky-700/80">{t('models.training.templateHelp')}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => downloadTemplate('fine_tune')} className={cn('inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors', mode === 'fine_tune' ? 'border-brand-300 bg-white text-brand-700 shadow-sm' : 'border-sky-200 bg-white/70 text-slate-600 hover:bg-white')}>
                    <Download size={14} />{t('models.training.fineTuneTemplate')}
                  </button>
                  <button type="button" onClick={() => downloadTemplate('distill')} className={cn('inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors', mode === 'distill' ? 'border-amber-300 bg-white text-amber-700 shadow-sm' : 'border-sky-200 bg-white/70 text-slate-600 hover:bg-white')}>
                    <Download size={14} />{t('models.training.distillTemplate')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5 text-xs font-bold text-slate-500">
                  {t('models.training.taskName')}
                  <input required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-brand-400" placeholder={t('models.training.taskNamePlaceholder')} />
                </label>
                <label className="space-y-1.5 text-xs font-bold text-slate-500">
                  {t('models.training.outputName')}
                  <input required value={form.outputName} onChange={event => setForm(current => ({ ...current, outputName: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-brand-400" placeholder="athena-qwen3:finance-v1" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5 text-xs font-bold text-slate-500">
                  {t('models.training.studentModel')}
                  <select required value={form.studentModelId} onChange={event => setForm(current => ({ ...current, studentModelId: event.target.value, teacherModelId: current.teacherModelId === event.target.value ? '' : current.teacherModelId }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-400">
                    <option value="">{t('models.training.chooseStudent')}</option>
                    {trainableModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                  </select>
                </label>
                {mode === 'distill' ? (
                  <label className="space-y-1.5 text-xs font-bold text-slate-500">
                    {t('models.training.teacherModel')}
                    <select required value={form.teacherModelId} onChange={event => setForm(current => ({ ...current, teacherModelId: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-400">
                      <option value="">{t('models.training.chooseTeacher')}</option>
                      {teacherModels.map(model => <option key={model.id} value={model.id}>{model.provider} / {model.name}</option>)}
                    </select>
                  </label>
                ) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-xs leading-5 text-slate-500">{t('models.training.baseModelNotice')}</div>}
              </div>

              {mode === 'distill' && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 shrink-0" size={15} />{t('models.training.costWarning')}</div>}

              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-5 text-center hover:border-brand-300 hover:bg-brand-50/40">
                <input type="file" accept=".jsonl,application/json" className="hidden" onChange={event => setDataset(event.target.files?.[0] || null)} />
                <UploadCloud className="mx-auto text-brand-500" size={24} />
                <span className="mt-2 block text-sm font-bold text-slate-700">{dataset?.name || t('models.training.uploadDataset')}</span>
                <span className="mt-1 block text-[11px] text-slate-400">{mode === 'fine_tune' ? t('models.training.fineTuneFormat') : t('models.training.distillFormat')}</span>
              </label>

              <div className="grid grid-cols-5 gap-3 rounded-2xl border border-slate-200 p-4">
                <NumberField label={t('models.training.iterations')} value={form.iterations} min={10} max={10000} step={10} onChange={value => setForm(current => ({ ...current, iterations: value }))} />
                <NumberField label={t('models.training.batchSize')} value={form.batchSize} min={1} max={16} onChange={value => setForm(current => ({ ...current, batchSize: value }))} />
                <NumberField label={t('models.training.learningRate')} value={form.learningRate} min={0.000001} max={0.1} step={0.000001} onChange={value => setForm(current => ({ ...current, learningRate: value }))} />
                <NumberField label={t('models.training.loraRank')} value={form.loraRank} min={1} max={256} onChange={value => setForm(current => ({ ...current, loraRank: value }))} />
                <NumberField label={t('models.training.maxSamples')} value={form.maxSamples} min={2} max={10000} onChange={value => setForm(current => ({ ...current, maxSamples: value }))} />
              </div>

              <button disabled={submitting || loading || !environment?.supported || !environment.pythonInstalled || trainableModels.length === 0} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-45">
                {submitting ? <Loader2 className="animate-spin" size={17} /> : <Play size={17} />}
                {submitting ? t('models.training.creating') : t('models.training.start')}
              </button>
              {trainableModels.length === 0 && <p className="text-center text-xs font-semibold text-rose-600">{t('models.training.noStudent')}</p>}
            </form>

            <section className="min-w-0 rounded-3xl bg-slate-950 p-5 text-white">
              <div className="mb-4 flex items-center justify-between">
                <div><h3 className="font-black">{t('models.training.history')}</h3><p className="text-[11px] text-slate-400">{t('models.training.historyHelp')}</p></div>
                <button type="button" onClick={() => void load(true)} className="rounded-xl bg-white/10 p-2 text-slate-300 hover:bg-white/15"><RefreshCw size={15} /></button>
              </div>
              <div className="space-y-3">
                {!loading && jobs.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-xs text-slate-500">{t('models.training.empty')}</div>}
                {jobs.map(job => <TrainingJobCard key={job.ulid} job={job} onCancel={cancel} />)}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}<input type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold normal-case text-slate-700 outline-none focus:border-brand-400" /></label>;
}

function TrainingJobCard({ job, onCancel }: { job: ModelTrainingJob; onCancel: (jobId: string) => Promise<void> }) {
  const { t } = useTranslation();
  const active = job.status === 'queued' || job.status === 'running';
  const failed = job.status === 'failed' || job.status === 'canceled';
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{job.name}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{job.studentModelName} → {job.outputName}</p></div>
        <span className={cn('shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide', active ? 'bg-sky-400/15 text-sky-300' : failed ? 'bg-rose-400/15 text-rose-300' : 'bg-emerald-400/15 text-emerald-300')}>{t(`models.training.status.${job.status}`)}</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400"><span>{t(`models.training.stage.${job.stage}`, { defaultValue: job.stage })}</span><span>{job.progress}%</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={cn('h-full rounded-full transition-all', failed ? 'bg-rose-400' : 'bg-brand-400')} style={{ width: `${job.progress}%` }} /></div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500"><span>{job.mode === 'distill' ? `${t('models.training.teacher')}: ${job.teacherModelName}` : `${job.sampleCount} ${t('models.training.samples')}`}</span>{active && <button type="button" onClick={() => void onCancel(job.ulid)} className="flex items-center gap-1 font-bold text-rose-300 hover:text-rose-200"><XCircle size={12} />{t('models.training.cancel')}</button>}</div>
      {job.errorMsg && <p className="mt-2 rounded-lg bg-rose-500/10 px-2 py-1.5 text-[10px] leading-4 text-rose-300">{job.errorMsg}</p>}
    </article>
  );
}
