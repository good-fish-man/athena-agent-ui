import React from 'react';
import {
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronRight,
  CircleOff,
  ClipboardCheck,
  FlaskConical,
  GitCompareArrows,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Pencil,
  Play,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { experienceApi, learningApi } from '../lib/api';
import { authStore } from '../lib/auth';
import { analyzeLearningEvidence, learningActionPattern, MAX_LEARNING_EVIDENCE } from '../lib/learningEvidence';
import { cn } from '../lib/utils';
import type {
  Demonstration,
  ExperienceRecord,
  LearnedSkill,
  LearningCandidate,
  LearningCandidateEvidence,
  LearningCandidateEvaluation,
  LearningEvolutionStatus,
} from '../types';

type LearningView = 'candidates' | 'demonstrations';

const lifecycleTone: Record<string, string> = {
  REVIEW_REQUIRED: 'border-amber-200 bg-amber-50 text-amber-700',
  APPROVED_FOR_USE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
  RECORDING: 'border-sky-200 bg-sky-50 text-sky-700',
  PAUSED_SENSITIVE: 'border-amber-200 bg-amber-50 text-amber-700',
  PREVIEW: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  CONFIRMED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  DISCARDED: 'border-slate-200 bg-slate-100 text-slate-500',
};

function LifecycleBadge({ value }: { value: string }) {
  return <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]', lifecycleTone[value] || 'border-slate-200 bg-slate-50 text-slate-600')}>{value.replaceAll('_', ' ')}</span>;
}

function percent(value: number) { return `${Math.round(value * 100)}%`; }

export function LearningStudio({
  onExperiencesChanged,
}: {
  onExperiencesChanged?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
	const organizationID = authStore.user()?.organization_id?.trim() || '';
  const [view, setView] = React.useState<LearningView>('candidates');
  const [candidates, setCandidates] = React.useState<LearningCandidate[]>([]);
  const [skills, setSkills] = React.useState<LearnedSkill[]>([]);
  const [demonstrations, setDemonstrations] = React.useState<Demonstration[]>([]);
  const [evidencePool, setEvidencePool] = React.useState<ExperienceRecord[]>([]);
  const [evolution, setEvolution] = React.useState<LearningEvolutionStatus | null>(null);
  const [details, setDetails] = React.useState<Record<string, { evidence: LearningCandidateEvidence[]; evaluations: LearningCandidateEvaluation[] }>>({});
  const [expanded, setExpanded] = React.useState('');
  const [selectedExperienceIDs, setSelectedExperienceIDs] = React.useState<string[]>([]);
  const [candidateID, setCandidateID] = React.useState('');
  const [candidateDescription, setCandidateDescription] = React.useState('');
  const [candidateVisibility, setCandidateVisibility] = React.useState<'PRIVATE' | 'TEAM' | 'PUBLIC'>('PRIVATE');
  const [taskID, setTaskID] = React.useState('');
  const [demonstrationTitle, setDemonstrationTitle] = React.useState('');
  const [reviewNotes, setReviewNotes] = React.useState<Record<string, string>>({});
  const [editingCandidate, setEditingCandidate] = React.useState('');
  const [candidateDrafts, setCandidateDrafts] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState('');

  const eligible = React.useMemo(() => evidencePool.filter(item => item.status === 'READY'), [evidencePool]);
  const selectedExperiences = React.useMemo(() => {
    const selected = new Set(selectedExperienceIDs);
    return eligible.filter(item => selected.has(item.experience_id));
  }, [eligible, selectedExperienceIDs]);
  const evidenceGate = React.useMemo(() => analyzeLearningEvidence(selectedExperiences), [selectedExperiences]);
  const suggestedEvidence = React.useMemo(() => analyzeLearningEvidence(eligible), [eligible]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [candidatePage, nextSkills, nextDemonstrations, nextEvolution, evidencePage] = await Promise.all([
        learningApi.candidates(), learningApi.skills(), learningApi.demonstrations(), learningApi.evolutionStatus(),
        experienceApi.list({ status: 'READY', limit: 200 }),
      ]);
      const nextEvidence = evidencePage.items || [];
      setCandidates(candidatePage.items || []);
      setSkills(nextSkills);
      setDemonstrations(nextDemonstrations);
      setEvolution(nextEvolution);
      setEvidencePool(nextEvidence);
      setSelectedExperienceIDs(current => {
        const available = new Set(nextEvidence.map(item => item.experience_id));
        const retained = current.filter(id => available.has(id)).slice(0, MAX_LEARNING_EVIDENCE);
        return retained.length > 0 ? retained : analyzeLearningEvidence(nextEvidence).experienceIDs;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learning.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => { void load(); }, [load]);
	React.useEffect(() => {
		if (!organizationID && candidateVisibility === 'TEAM') setCandidateVisibility('PRIVATE');
	}, [candidateVisibility, organizationID]);

  const scanEvolution = async () => {
    setBusy('evolution:scan');
    try {
      const result = await learningApi.scanEvolution();
      await load();
      toast.success(t('learning.evolutionScanCompleted', { count: result.candidates_proposed }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learning.evolutionScanFailed'));
    } finally {
      setBusy('');
    }
  };

  const generate = async () => {
    if (!evidenceGate.ready) {
      toast.error(t(`learning.evidenceGateReasons.${evidenceGate.reason}`));
      return;
    }
    setBusy('generate');
    try {
      const candidate = await learningApi.generate({
        kind: 'SKILL', id: candidateID.trim() || undefined, description: candidateDescription.trim() || undefined,
        experience_ids: evidenceGate.experienceIDs, visibility: candidateVisibility, minimum_score: 0.75,
      });
      setCandidates(current => [candidate, ...current]);
      setCandidateID('');
      setCandidateDescription('');
      setExpanded(candidate.candidate_id);
      try {
        const value = await learningApi.candidate(candidate.candidate_id);
        setDetails(current => ({ ...current, [candidate.candidate_id]: { evidence: value.evidence, evaluations: value.evaluations } }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('learning.loadFailed'));
      }
      toast.success(t('learning.generated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learning.generateFailed'));
    } finally {
      setBusy('');
    }
  };

  const toggleEvidence = (experienceID: string) => {
    setSelectedExperienceIDs(current => {
      if (current.includes(experienceID)) return current.filter(id => id !== experienceID);
      if (current.length >= MAX_LEARNING_EVIDENCE) return current;
      return [...current, experienceID];
    });
  };

  const openCandidate = async (candidate: LearningCandidate) => {
    if (expanded === candidate.candidate_id) {
      setExpanded('');
      return;
    }
    setExpanded(candidate.candidate_id);
    if (details[candidate.candidate_id]) return;
    setBusy(`detail:${candidate.candidate_id}`);
    try {
      const value = await learningApi.candidate(candidate.candidate_id);
      setDetails(current => ({ ...current, [candidate.candidate_id]: { evidence: value.evidence, evaluations: value.evaluations } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learning.loadFailed'));
    } finally {
      setBusy('');
    }
  };

  const review = async (candidate: LearningCandidate, decision: 'APPROVE' | 'REJECT') => {
    const note = (reviewNotes[candidate.candidate_id] || '').trim();
    if (!note) {
      toast.error(t('learning.reviewNoteRequired'));
      return;
    }
    setBusy(`review:${candidate.candidate_id}`);
    try {
      const reviewed = await learningApi.review(candidate.candidate_id, {
        decision, note, expected_revision: candidate.revision,
      });
      setCandidates(current => current.map(item => item.candidate_id === reviewed.candidate_id ? reviewed : item));
      if (decision === 'APPROVE') setSkills(await learningApi.skills());
      toast.success(decision === 'APPROVE' ? t('learning.approved') : t('learning.rejected'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learning.reviewFailed'));
    } finally {
      setBusy('');
    }
  };

  const beginEdit = (candidate: LearningCandidate) => {
    setEditingCandidate(candidate.candidate_id);
    setCandidateDrafts(current => ({
      ...current,
      [candidate.candidate_id]: JSON.stringify(candidate.skill || candidate.strategy, null, 2),
    }));
  };

  const saveCandidate = async (candidate: LearningCandidate) => {
    setBusy(`edit:${candidate.candidate_id}`);
    try {
      const definition = JSON.parse(candidateDrafts[candidate.candidate_id] || '{}') as NonNullable<LearningCandidate['skill'] | LearningCandidate['strategy']>;
      const updated = await learningApi.update(candidate.candidate_id, {
        ...candidate,
        skill: candidate.kind === 'SKILL' ? definition as LearningCandidate['skill'] : undefined,
        strategy: candidate.kind === 'STRATEGY' ? definition as LearningCandidate['strategy'] : undefined,
      });
      setCandidates(current => current.map(item => item.candidate_id === updated.candidate_id ? updated : item));
      setEditingCandidate('');
      toast.success(t('learning.editSaved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learning.editFailed'));
    } finally {
      setBusy('');
    }
  };

  const reevaluateCandidate = async (candidate: LearningCandidate) => {
    setBusy(`reevaluate:${candidate.candidate_id}`);
    try {
      const updated = await learningApi.reevaluate(candidate.candidate_id, candidate.revision);
      setCandidates(current => current.map(item => item.candidate_id === updated.candidate_id ? updated : item));
      const value = await learningApi.candidate(candidate.candidate_id);
      setDetails(current => ({ ...current, [candidate.candidate_id]: { evidence: value.evidence, evaluations: value.evaluations } }));
      toast.success(t('learning.reevaluated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learning.reevaluateFailed'));
    } finally {
      setBusy('');
    }
  };

  const startDemonstration = async () => {
    if (!taskID.trim() || !demonstrationTitle.trim()) return;
    setBusy('demonstration:start');
    try {
      const value = await learningApi.startDemonstration({ task_id: taskID.trim(), title: demonstrationTitle.trim() });
      setDemonstrations(current => [value, ...current]);
      setTaskID('');
      setDemonstrationTitle('');
      toast.success(t('learning.demonstrationStarted'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learning.demonstrationFailed'));
    } finally {
      setBusy('');
    }
  };

  const transitionDemonstration = async (item: Demonstration, action: 'resume' | 'preview' | 'confirm' | 'discard') => {
    setBusy(`demonstration:${item.demonstration_id}`);
    try {
      const next = action === 'resume' ? await learningApi.resumeDemonstration(item.demonstration_id)
        : action === 'preview' ? await learningApi.previewDemonstration(item.demonstration_id)
          : action === 'confirm' ? await learningApi.confirmDemonstration(item.demonstration_id)
            : await learningApi.discardDemonstration(item.demonstration_id);
      setDemonstrations(current => current.map(value => value.demonstration_id === next.demonstration_id ? next : value));
      if (action === 'confirm') {
        await onExperiencesChanged?.();
        await load();
      }
      toast.success(t(`learning.demonstrationActions.${action}Done`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learning.demonstrationFailed'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300"><GraduationCap size={15} /> Athena Learning Gate</div>
            <h2 className="mt-2 text-xl font-black">{t('learning.title')}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{t('learning.subtitle')}</p>
          </div>
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button type="button" onClick={() => setView('candidates')} className={cn('rounded-lg px-4 py-2 text-xs font-bold', view === 'candidates' ? 'bg-white text-slate-950' : 'text-slate-300')}><ClipboardCheck className="mr-2 inline" size={14} />{t('learning.candidateInbox')}</button>
            <button type="button" onClick={() => setView('demonstrations')} className={cn('rounded-lg px-4 py-2 text-xs font-bold', view === 'demonstrations' ? 'bg-white text-slate-950' : 'text-slate-300')}><GraduationCap className="mr-2 inline" size={14} />{t('learning.demonstrations')}</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-emerald-50 px-5 py-3 text-xs text-emerald-800">
          <span className="flex items-center gap-2"><LockKeyhole size={15} />{t('learning.noAutoActivation')}</span>
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn('flex items-center gap-1.5 font-bold', evolution?.ai_synthesis_enabled ? 'text-indigo-700' : 'text-slate-500')}>
              <Sparkles size={13} />
              {evolution?.ai_synthesis_enabled
                ? t('learning.codexEnabled', { model: evolution.ai_synthesis_model || 'Codex' })
                : t('learning.codexDisabled')}
            </span>
            <button type="button" onClick={() => void scanEvolution()} disabled={!evolution?.enabled || busy === 'evolution:scan'} className="flex items-center gap-1.5 font-bold disabled:opacity-40">
              {busy === 'evolution:scan' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {t('learning.scanEvolution')}
            </button>
            <button type="button" onClick={() => void load()} className="flex items-center gap-1.5 font-bold"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />{t('experience.refresh')}</button>
          </div>
        </div>
      </section>

      {view === 'candidates' ? (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-5">
            <section className="theme-card rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2"><Sparkles size={17} className="text-emerald-600" /><h3 className="font-bold text-slate-900">{t('learning.proposeSkill')}</h3></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{t('learning.proposeHint')}</p>
              <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('learning.skillID')}</label>
              <input value={candidateID} onChange={event => setCandidateID(event.target.value)} placeholder="browser.open.reviewed" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-emerald-400" />
              <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('learning.description')}</label>
              <textarea value={candidateDescription} onChange={event => setCandidateDescription(event.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-emerald-400" />
              <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('learning.visibility')}</label>
              <select value={candidateVisibility} onChange={event => setCandidateVisibility(event.target.value as 'PRIVATE' | 'TEAM' | 'PUBLIC')} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-emerald-400">
                <option value="PRIVATE">{t('learning.visibilityPrivate')}</option>
                <option value="TEAM" disabled={!organizationID}>{t('learning.visibilityTeam')}</option>
                <option value="PUBLIC">{t('learning.visibilityPublic')}</option>
              </select>
				{candidateVisibility === 'TEAM' && organizationID && <p className="mt-1.5 text-[10px] text-slate-500">{t('learning.organizationScope', { id: organizationID })}</p>}
				{!organizationID && <p className="mt-1.5 text-[10px] text-amber-600">{t('learning.organizationRequired')}</p>}
              <div className="mt-4 flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('learning.evidenceSelection')}</span><span className="text-right text-[10px] text-slate-400">{t('learning.evidenceSelected', { count: selectedExperienceIDs.length, max: MAX_LEARNING_EVIDENCE, available: eligible.length })}</span></div>
              <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {eligible.map(item => {
                  const checked = selectedExperienceIDs.includes(item.experience_id);
                  const disabled = !checked && selectedExperienceIDs.length >= MAX_LEARNING_EVIDENCE;
                  return <button key={item.experience_id} type="button" onClick={() => toggleEvidence(item.experience_id)} disabled={disabled} className={cn('flex w-full items-start gap-2 rounded-xl border p-2.5 text-left disabled:cursor-not-allowed disabled:opacity-45', checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50')}>
                    <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300')}>{checked && <Check size={11} />}</span>
                    <span className="min-w-0"><strong className="block truncate text-[11px] text-slate-700">{item.goal_summary || item.task_id}</strong><span className={cn('text-[9px] font-bold', item.outcome === 'SUCCEEDED' ? 'text-emerald-600' : 'text-red-500')}>{item.outcome}</span><span className="ml-2 text-[9px] text-slate-400">{learningActionPattern(item) || t('learning.noActionPattern')}</span></span>
                  </button>;
                })}
                {eligible.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">{t('learning.noEligibleEvidence')}</p>}
              </div>
              <div className={cn('mt-3 rounded-xl border p-3 text-[10px] leading-5', evidenceGate.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800')}>
                <div className="flex items-start gap-2">{evidenceGate.ready ? <Check className="mt-0.5 shrink-0" size={13} /> : <ShieldAlert className="mt-0.5 shrink-0" size={13} />}<div className="min-w-0"><strong>{t(`learning.evidenceGateReasons.${evidenceGate.reason}`)}</strong><p>{t('learning.evidenceCounts', { successes: evidenceGate.successCount, failures: evidenceGate.failureCount, matching: evidenceGate.matchingCount })}</p>{evidenceGate.pattern && <p className="truncate font-mono text-[9px]" title={evidenceGate.pattern}>{t('learning.evidencePattern', { pattern: evidenceGate.pattern })}</p>}</div></div>
                {!evidenceGate.ready && suggestedEvidence.ready && <button type="button" onClick={() => setSelectedExperienceIDs(suggestedEvidence.experienceIDs)} className="mt-2 flex items-center gap-1.5 font-bold text-emerald-700"><Check size={12} />{t('learning.useSuggestedEvidence')}</button>}
              </div>
              <button type="button" onClick={() => void generate()} disabled={busy === 'generate' || !evidenceGate.ready} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                {busy === 'generate' ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}{t('learning.validateAndPropose')}
              </button>
            </section>
            <section className="theme-card rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">{t('learning.approvedSkills')}</h3><span className="text-xs font-black text-emerald-600">{skills.length}</span></div>
              <p className="mt-1 text-[10px] leading-5 text-slate-500">{t('learning.approvedSkillsHint')}</p>
              <div className="mt-3 space-y-2">{skills.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">{t('learning.noApprovedSkills')}</p> : skills.map(skill => <div key={skill.skill_id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><strong className="truncate font-mono text-xs text-slate-800">{skill.skill_id}</strong><span className="text-[9px] text-slate-400">v{skill.latest_version}</span></div><p className="mt-1 text-[10px] text-slate-500">{skill.definition.description}</p></div>)}</div>
            </section>
          </aside>

          <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="font-bold text-slate-900">{t('learning.reviewQueue')}</h3><p className="mt-1 text-xs text-slate-500">{t('learning.reviewQueueHint')}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-700">{candidates.filter(item => item.status === 'REVIEW_REQUIRED').length} {t('learning.pending')}</span></div>
            {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-emerald-600" /></div> : candidates.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><CircleOff size={28} className="text-slate-300" /><h4 className="mt-3 font-bold text-slate-700">{t('learning.empty')}</h4><p className="mt-1 max-w-md text-xs leading-5 text-slate-400">{t('learning.emptyHint')}</p></div> : (
              <div className="divide-y divide-slate-200">{candidates.map(candidate => {
                const artifact = candidate.skill || candidate.strategy;
                const detail = details[candidate.candidate_id];
                const isExpanded = expanded === candidate.candidate_id;
                return <article key={candidate.candidate_id}>
                  <button type="button" onClick={() => void openCandidate(candidate)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50">
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400">{isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="font-mono text-sm text-slate-900">{artifact?.id || candidate.candidate_id}</strong><span className="rounded bg-sky-100 px-2 py-0.5 text-[9px] font-black text-sky-700">{candidate.kind}</span>{candidate.skill?.metadata?.synthesizer === 'codex' && <span className="rounded bg-indigo-100 px-2 py-0.5 text-[9px] font-black text-indigo-700">CODEX</span>}<LifecycleBadge value={candidate.status} /></span><span className="mt-1 block text-xs text-slate-500">{artifact?.description}</span></span>
                    <span className="hidden text-right sm:block"><strong className="block text-sm text-slate-800">{percent(candidate.evaluation.success_rate)}</strong><span className="text-[9px] uppercase tracking-wider text-slate-400">{t('learning.offlineScore')}</span></span>
                  </button>
                  {isExpanded && <div className="border-t border-slate-200 bg-slate-50/70 p-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <ReviewMetric label={t('learning.samples')} value={String(candidate.evaluation.sample_size)} />
                      <ReviewMetric label={t('learning.confidence')} value={`${percent(candidate.evaluation.confidence.lower)}–${percent(candidate.evaluation.confidence.upper)}`} />
                      <ReviewMetric label={t('learning.baselineDelta')} value={`${candidate.evaluation.delta >= 0 ? '+' : ''}${percent(candidate.evaluation.delta)}`} />
                      <ReviewMetric label={t('learning.counterexamples')} value={String(candidate.evidence.counterexamples)} />
                      <ReviewMetric label={t('learning.evidenceContexts')} value={String(new Set(candidate.evidence.contexts.map(item => `${item.environment_fingerprint}|${item.site_scope}`)).size)} />
                      <ReviewMetric label={t('learning.siteScopes')} value={String(new Set(candidate.evidence.contexts.map(item => item.site_scope)).size)} />
                      <ReviewMetric label={t('learning.failureConditions')} value={String(new Set(candidate.evidence.contexts.map(item => item.failure_condition).filter(Boolean)).size)} />
                      <ReviewMetric label={t('learning.riskCeiling')} value={artifact?.risk_ceiling || '—'} />
                      {candidate.reviewed_by && <ReviewMetric label={t('learning.reviewedBy')} value={candidate.reviewed_by} />}
                      {candidate.reviewed_by && candidate.reviewed_at && <ReviewMetric label={t('learning.reviewedAt')} value={new Date(candidate.reviewed_at).toLocaleString()} />}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">{candidate.evidence.contexts.map(context => <span key={context.experience_id} className={cn('rounded-full border px-2.5 py-1 font-mono text-[9px]', context.outcome === 'FAILED' ? 'border-red-200 bg-red-50 text-red-700' : 'border-sky-200 bg-sky-50 text-sky-700')}>{context.environment_fingerprint} · {context.site_scope}{context.failure_condition ? ` · ${context.failure_condition}` : ''}</span>)}</div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500"><GitCompareArrows size={13} />{t('learning.behaviorDiff')}</div><div className="grid grid-cols-2 divide-x divide-slate-200"><div className="p-3"><span className="text-[9px] font-bold text-red-500">− {t('learning.before')}</span><p className="mt-2 text-[10px] leading-5 text-slate-400">{t('learning.noInstalledBehavior')}</p></div><div className="p-3"><span className="text-[9px] font-bold text-emerald-600">+ {t('learning.afterApproval')}</span><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-all font-mono text-[9px] leading-4 text-slate-600">{JSON.stringify(artifact, null, 2)}</pre></div></div></div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('learning.evidenceTrail')}</span>{busy === `detail:${candidate.candidate_id}` && <Loader2 size={13} className="animate-spin" />}</div><div className="mt-2 max-h-52 space-y-2 overflow-y-auto">{(detail?.evidence || []).map(item => <div key={item.evidence_id} className={cn('rounded-lg border p-2.5', item.relation === 'FAILURE_COUNTEREXAMPLE' ? 'border-red-100 bg-red-50' : 'border-emerald-100 bg-emerald-50')}><div className="flex items-center justify-between gap-2"><strong className="text-[10px] text-slate-700">{item.relation.replaceAll('_', ' ')}</strong><span className="font-mono text-[9px] text-slate-400">{item.experience_id}</span></div><p className="mt-1 text-[10px] text-slate-600">{item.summary}</p></div>)}{!detail && <p className="text-xs text-slate-400">{t('learning.loadingEvidence')}</p>}</div></div>
                    </div>
                    {['REVIEW_REQUIRED', 'EVALUATING'].includes(candidate.status) && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-amber-700">{t('learning.reviewNote')}</label>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => beginEdit(candidate)} className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-800"><Pencil size={12} />{t('learning.edit')}</button>
                          <button type="button" onClick={() => void reevaluateCandidate(candidate)} disabled={busy === `reevaluate:${candidate.candidate_id}`} className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-2 text-[10px] font-bold text-sky-700 disabled:opacity-40">{busy === `reevaluate:${candidate.candidate_id}` ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}{t('learning.reevaluate')}</button>
                        </div>
                      </div>
                      {editingCandidate === candidate.candidate_id && <div className="mt-3 rounded-xl border border-slate-300 bg-slate-950 p-3">
                        <p className="mb-2 text-[10px] leading-5 text-slate-300">{t('learning.declarativeOnly')}</p>
                        <textarea value={candidateDrafts[candidate.candidate_id] || ''} onChange={event => setCandidateDrafts(current => ({ ...current, [candidate.candidate_id]: event.target.value }))} rows={14} spellCheck={false} className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-[10px] leading-5 text-emerald-200 outline-none" />
                        <div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => setEditingCandidate('')} className="rounded-lg border border-slate-600 px-3 py-2 text-[10px] font-bold text-slate-300">{t('common.cancel')}</button><button type="button" onClick={() => void saveCandidate(candidate)} disabled={busy === `edit:${candidate.candidate_id}`} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-bold text-slate-950 disabled:opacity-40">{busy === `edit:${candidate.candidate_id}` ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}{t('common.save')}</button></div>
                      </div>}
                      {candidate.status === 'EVALUATING' && <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-semibold text-sky-700">{t('learning.evaluationRequiredAfterEdit')}</p>}
                      {candidate.status === 'REVIEW_REQUIRED' && <>
                        <textarea value={reviewNotes[candidate.candidate_id] || ''} onChange={event => setReviewNotes(current => ({ ...current, [candidate.candidate_id]: event.target.value }))} rows={2} required placeholder={t('learning.reviewNoteRequired')} className="mt-2 w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs outline-none" />
                        <div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => void review(candidate, 'REJECT')} disabled={!reviewNotes[candidate.candidate_id]?.trim() || busy === `review:${candidate.candidate_id}`} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-40"><X size={13} />{t('learning.reject')}</button><button type="button" onClick={() => void review(candidate, 'APPROVE')} disabled={!candidate.evaluation.passed || !reviewNotes[candidate.candidate_id]?.trim() || busy === `review:${candidate.candidate_id}`} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === `review:${candidate.candidate_id}` ? <Loader2 size={13} className="animate-spin" /> : <BookOpenCheck size={13} />}{t('learning.approve')}</button></div>
                      </>}
                    </div>}
                  </div>}
                </article>;
              })}</div>
            )}
          </section>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="theme-card h-fit rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2"><Play size={17} className="text-indigo-600" /><h3 className="font-bold text-slate-900">{t('learning.startDemonstration')}</h3></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{t('learning.demonstrationHint')}</p>
            <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('learning.taskID')}</label><input value={taskID} onChange={event => setTaskID(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs outline-none" />
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('learning.demonstrationTitle')}</label><input value={demonstrationTitle} onChange={event => setDemonstrationTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none" />
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-800"><LockKeyhole className="mr-1.5 inline" size={13} />{t('learning.sensitivePause')}</div>
            <button type="button" onClick={() => void startDemonstration()} disabled={!taskID.trim() || !demonstrationTitle.trim() || busy === 'demonstration:start'} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white disabled:opacity-40">{busy === 'demonstration:start' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}{t('learning.startExplicitly')}</button>
          </section>
          <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm"><div className="border-b border-slate-200 p-5"><h3 className="font-bold text-slate-900">{t('learning.demonstrationHistory')}</h3><p className="mt-1 text-xs text-slate-500">{t('learning.privateByDefault')}</p></div>{demonstrations.length === 0 ? <div className="flex min-h-64 items-center justify-center text-xs text-slate-400">{t('learning.noDemonstrations')}</div> : <div className="divide-y divide-slate-200">{demonstrations.map(item => <article key={item.demonstration_id} className="p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{item.title}</strong><LifecycleBadge value={item.status} /></div><p className="mt-1 font-mono text-[10px] text-slate-400">{item.task_id}</p></div><div className="flex flex-wrap gap-2">{item.status === 'PAUSED_SENSITIVE' && <DemoButton icon={Play} label={t('learning.demonstrationActions.resume')} onClick={() => void transitionDemonstration(item, 'resume')} />}{item.status === 'RECORDING' && <DemoButton icon={Square} label={t('learning.demonstrationActions.preview')} onClick={() => void transitionDemonstration(item, 'preview')} />}{item.status === 'PREVIEW' && <><DemoButton icon={Check} label={t('learning.demonstrationActions.confirm')} onClick={() => void transitionDemonstration(item, 'confirm')} /><DemoButton icon={X} label={t('learning.demonstrationActions.discard')} onClick={() => void transitionDemonstration(item, 'discard')} /></>}{!['CONFIRMED', 'DISCARDED'].includes(item.status) && item.status !== 'PREVIEW' && <DemoButton icon={X} label={t('learning.demonstrationActions.discard')} onClick={() => void transitionDemonstration(item, 'discard')} />}</div></div><div className="mt-4 space-y-2">{item.steps.map(step => <div key={step.sequence} className={cn('flex items-start gap-3 rounded-xl border p-3', step.redacted ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50')}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-black text-slate-500">{step.sequence}</span><div className="min-w-0"><strong className="font-mono text-[10px] text-slate-700">{step.capability} · {step.operation}</strong><p className="mt-1 text-[10px] text-slate-500">{step.summary}</p></div>{step.redacted && <LockKeyhole className="ml-auto shrink-0 text-amber-600" size={14} />}</div>)}</div></article>)}</div>}</section>
        </div>
      )}
    </div>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-800">{value}</p></div>; }

function DemoButton({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"><Icon size={12} />{label}</button>; }
