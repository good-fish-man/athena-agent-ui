import React from 'react';
import { AlertCircle, Clock3, Download, Film, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { mediaApi, modelApi, type MediaGenerationJob, type Model } from '../lib/api';
import { cn } from '../lib/utils';

type MediaType = 'image' | 'video';

function capabilities(model: Model | undefined) {
  return (model?.capabilities || '').toLowerCase().split(',').map(item => item.trim()).filter(Boolean);
}

function supportsSource(model: Model | undefined, type: MediaType) {
  const values = capabilities(model);
  return values.includes(`image-to-${type}`) || (type === 'image' && values.includes('image-edit'));
}

function isPending(job: MediaGenerationJob) {
  return job.status === 'queued' || job.status === 'running';
}

export function MediaStudio() {
  const { t, i18n } = useTranslation();
  const [type, setType] = React.useState<MediaType>('image');
  const [models, setModels] = React.useState<Model[]>([]);
  const [modelId, setModelId] = React.useState('');
  const [prompt, setPrompt] = React.useState('');
  const [negativePrompt, setNegativePrompt] = React.useState('');
  const [sourceUrl, setSourceUrl] = React.useState('');
  const [size, setSize] = React.useState('1024x1024');
  const [duration, setDuration] = React.useState(4);
  const [submitting, setSubmitting] = React.useState(false);
  const [jobs, setJobs] = React.useState<MediaGenerationJob[]>([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [historyLoading, setHistoryLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    modelApi.findAll().then(allModels => {
      if (cancelled) return;
      const items = allModels.filter(model => {
        const values = capabilities(model);
        return model.modelType === type || values.includes(`text-to-${type}`) || values.includes(`${type}-output`);
      });
      setModels(items);
      setModelId(current => items.some(model => model.ulid === current) ? current : (items[0]?.ulid || ''));
    }).catch(error => toast.error(error instanceof Error ? error.message : t('media.loadFailed')));
    return () => { cancelled = true; };
  }, [type, t]);

  React.useEffect(() => {
    let cancelled = false;
    const refresh = async (showLoading: boolean) => {
      if (showLoading) setHistoryLoading(true);
      try {
        const values = await mediaApi.jobs(type);
        if (cancelled) return;
        setJobs(values);
        setSelectedId(current => values.some(job => job.ulid === current) ? current : (values[0]?.ulid || ''));
      } catch (error) {
        if (!cancelled && showLoading) toast.error(error instanceof Error ? error.message : t('media.historyFailed'));
      } finally {
        if (!cancelled && showLoading) setHistoryLoading(false);
      }
    };
    void refresh(true);
    const timer = window.setInterval(() => void refresh(false), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [type, t]);

  React.useEffect(() => {
    setSourceUrl('');
    setSize(type === 'video' ? '576x320' : '1024x1024');
  }, [type]);

  const selectedModel = models.find(model => model.ulid === modelId);
  const selectedJob = jobs.find(job => job.ulid === selectedId);
  const sourceSupported = supportsSource(selectedModel, type);

  const generate = async () => {
    if (!modelId || !prompt.trim()) return;
    setSubmitting(true);
    try {
      const job = await mediaApi.createJob({
        modelId,
        mediaType: type,
        operation: 'generate',
        prompt: prompt.trim(),
        negativePrompt: type === 'image' ? negativePrompt.trim() : undefined,
        sourceUrl: sourceSupported ? sourceUrl.trim() : undefined,
        size,
        quality: type === 'image' ? 'standard' : undefined,
        durationSeconds: type === 'video' ? duration : undefined,
      });
      setJobs(current => [job, ...current.filter(item => item.ulid !== job.ulid)]);
      setSelectedId(job.ulid);
      setPrompt('');
      toast.success(t('media.queued'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('media.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const removeJob = async (job: MediaGenerationJob) => {
    if (isPending(job)) return;
    try {
      await mediaApi.deleteJob(job.ulid);
      setJobs(current => current.filter(item => item.ulid !== job.ulid));
      if (selectedId === job.ulid) setSelectedId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('media.deleteFailed'));
    }
  };

  const dateFormatter = new Intl.DateTimeFormat(i18n.language.startsWith('zh') ? 'zh-CN' : 'en', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="min-h-full p-4 sm:p-7 lg:p-9">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-700"><Sparkles size={14} /> Athena Create</div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t('media.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">{t('media.subtitle')}</p>
          </div>
          <div className="flex rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {(['image', 'video'] as MediaType[]).map(item => (
              <button key={item} onClick={() => setType(item)} className={cn('flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all', type === item ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}>
                {item === 'image' ? <ImageIcon size={17} /> : <Film size={17} />}{t(`media.${item}`)}
              </button>
            ))}
          </div>
        </header>

        <div className="grid min-h-[650px] gap-5 xl:grid-cols-[minmax(300px,0.72fr)_minmax(430px,1.2fr)_minmax(280px,0.7fr)]">
          <section className="theme-card rounded-[28px] border border-slate-200/80 p-6 shadow-sm">
            <div className="space-y-5">
              <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{t('media.model')}</span>
                <select value={modelId} onChange={event => setModelId(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-400">
                  {models.length === 0 && <option value="">{t('media.noModels')}</option>}
                  {models.map(model => <option key={model.ulid} value={model.ulid}>{model.provider} / {model.name}</option>)}
                </select>
              </label>
              <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{t('media.prompt')}</span>
                <textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={7} placeholder={t('media.promptPlaceholder')} className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-brand-400" />
              </label>
              {type === 'image' && <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{t('media.negativePrompt')}</span><input value={negativePrompt} onChange={event => setNegativePrompt(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-400" /></label>}
              {sourceSupported && <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{t('media.sourceUrl')}</span><input type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://..." className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-400" /></label>}
              <div className="grid grid-cols-2 gap-4">
                <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{t('media.size')}</span>
                  <select value={size} onChange={event => setSize(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-brand-400">
                    {(type === 'image' ? ['1024x1024', '1536x1024', '1024x1536'] : ['576x320', '720x480', '1280x720', '720x1280']).map(value => <option key={value}>{value}</option>)}
                  </select>
                </label>
                {type === 'video' && <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{t('media.duration')}</span><select value={duration} onChange={event => setDuration(Number(event.target.value))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-brand-400">{[4, 6].map(value => <option key={value} value={value}>{value}s</option>)}</select></label>}
              </div>
              <button disabled={submitting || !modelId || !prompt.trim()} onClick={generate} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45">
                {submitting ? <Loader2 className="animate-spin" size={19} /> : <WandSparkles size={19} />}{submitting ? t('media.submitting') : t('media.generate')}
              </button>
            </div>
          </section>

          <section className="relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_35%),linear-gradient(145deg,#0f172a,#1e293b)] p-6 shadow-xl">
            {!selectedJob && <div className="max-w-sm text-center text-slate-300"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/10 bg-white/5"><WandSparkles size={34} /></div><p className="text-lg font-bold text-white">{t('media.previewTitle')}</p><p className="mt-2 text-sm leading-6 text-slate-400">{t('media.previewHint')}</p></div>}
            {selectedJob && isPending(selectedJob) && <div className="w-full max-w-md text-center text-white"><Loader2 className="mx-auto mb-5 animate-spin text-brand-300" size={52} /><p className="text-xl font-black">{t(`media.status.${selectedJob.status}`)}</p><p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{selectedJob.prompt}</p><div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${Math.max(8, selectedJob.progress)}%` }} /></div><p className="mt-2 text-xs text-slate-500">{t('media.safeToLeave')}</p></div>}
            {selectedJob?.status === 'failed' && <div className="max-w-lg text-center"><AlertCircle className="mx-auto mb-4 text-rose-400" size={48} /><p className="font-black text-white">{t('media.status.failed')}</p><p className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-left text-sm leading-6 text-rose-200/80">{selectedJob.errorMessage}</p></div>}
            {selectedJob?.status === 'completed' && selectedJob.mediaType === 'image' && <img src={selectedJob.mediaUrl} alt={selectedJob.prompt} className="max-h-[720px] max-w-full rounded-2xl object-contain shadow-2xl" />}
            {selectedJob?.status === 'completed' && selectedJob.mediaType === 'video' && <video src={selectedJob.mediaUrl} controls className="max-h-[720px] max-w-full rounded-2xl shadow-2xl" />}
            {selectedJob?.status === 'completed' && <a href={selectedJob.mediaUrl} download className="absolute bottom-5 right-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-xl hover:bg-slate-100"><Download size={17} />{t('media.download')}</a>}
          </section>

          <section className="theme-card flex min-h-[420px] flex-col overflow-hidden rounded-[28px] border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-black text-slate-900">{t('media.history')}</h2><p className="text-xs text-slate-400">{t('media.historyHint')}</p></div><RefreshCw size={17} className={cn('text-slate-400', historyLoading && 'animate-spin')} /></div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {historyLoading && jobs.length === 0 && <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>}
              {!historyLoading && jobs.length === 0 && <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-slate-400"><Clock3 className="mb-3" />{t('media.noHistory')}</div>}
              {jobs.map(job => (
                <button key={job.ulid} onClick={() => setSelectedId(job.ulid)} className={cn('group relative w-full rounded-2xl border p-3 text-left transition', selectedId === job.ulid ? 'border-brand-300 bg-brand-50' : 'border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white')}>
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-200 text-slate-500">
                      {job.status === 'completed' && job.mediaType === 'image' ? <img src={job.mediaUrl} alt="" className="h-full w-full object-cover" /> : job.mediaType === 'video' ? <Film size={20} /> : <ImageIcon size={20} />}
                    </div>
                    <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-bold leading-5 text-slate-800">{job.prompt}</p><div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400"><span className={cn(isPending(job) && 'text-amber-600', job.status === 'completed' && 'text-emerald-600', job.status === 'failed' && 'text-rose-600')}>{t(`media.status.${job.status}`)}</span><span>·</span><span>{dateFormatter.format(job.createdAt)}</span></div></div>
                    {!isPending(job) && <span onClick={event => { event.stopPropagation(); void removeJob(job); }} className="absolute right-2 top-2 hidden rounded-lg bg-white p-1.5 text-slate-400 shadow-sm hover:text-rose-500 group-hover:block"><Trash2 size={13} /></span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
