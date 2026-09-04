import React from 'react';
import {
  AlertTriangle, Check, DatabaseZap, Eye, FlaskConical, GitBranch, Network,
  Pencil, PencilRuler, PlugZap, Plus, RefreshCw, Search, ShieldCheck, Trash2, Undo2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { evidenceKnowledgeApi, worldModelApi } from '../lib/api';
import { authStore } from '../lib/auth';
import type {
  KnowledgeEvidence, OntologyCandidate, OntologyContext, OntologyDefinition,
  OntologyPack, OntologyValidationRule, WorldConflict, WorldProvider,
  WorldProviderKind, WorldProviderRequest, WorldSnapshot,
} from '../types';

type Tab = 'explorer' | 'providers' | 'conflicts' | 'studio' | 'review';
type Translate = (key: string, options?: Record<string, unknown>) => string;

const providerQueries: Record<WorldProviderKind, string> = {
  ATHENA_HTTP: '',
  SPARQL: 'SELECT ("entity" AS ?kind) (STR(?entity) AS ?id) (REPLACE(STR(?class), "^.*[/#]", "") AS ?type) (STR(COALESCE(?label, ?entity)) AS ?canonical_name) WHERE { ?entity a ?class . OPTIONAL { ?entity <http://www.w3.org/2000/01/rdf-schema#label> ?label } } LIMIT {{limit}}',
  NEO4J: "MATCH (n) RETURN {athena_kind: 'entity', id: n.athena_id, type: head(labels(n)), canonical_name: coalesce(n.name, n.athena_id)} AS athena LIMIT $limit",
  TYPEDB: 'match $entity isa $entity-type; fetch { "athena_kind": "entity", "id": $entity, "type": $entity-type };',
};

const blankDefinition: OntologyDefinition = { entities: [{ id: 'Thing' }], relations: [] };
const blankRules: OntologyValidationRule[] = [{ subject_type: 'Thing', predicate: 'describes', value_type: 'Thing', required: false }];

export function WorldModelCenter() {
  const { t } = useTranslation();
  const isAdmin = (authStore.user()?.admin_level || 0) > 0;
  const [tab, setTab] = React.useState<Tab>('explorer');
  const [snapshot, setSnapshot] = React.useState<WorldSnapshot | null>(null);
  const [providerSnapshot, setProviderSnapshot] = React.useState<WorldSnapshot | null>(null);
  const [conflicts, setConflicts] = React.useState<WorldConflict[]>([]);
  const [candidates, setCandidates] = React.useState<OntologyCandidate[]>([]);
  const [providers, setProviders] = React.useState<WorldProvider[]>([]);
  const [packs, setPacks] = React.useState<OntologyPack[]>([]);
  const [evidence, setEvidence] = React.useState<KnowledgeEvidence[]>([]);
  const [ontology, setOntology] = React.useState<OntologyContext | null>(null);
  const [taskId, setTaskId] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [world, pendingConflicts] = await Promise.all([
        worldModelApi.query({ task_id: taskId.trim(), text: query.trim(), limit: 200 }),
        worldModelApi.conflicts('OPEN'),
      ]);
      setSnapshot(world);
      setConflicts(pendingConflicts);
      if (!isAdmin) return;
      const [ontologyPacks, ontologyCandidates, providerItems, activeOntology, evidenceItems] = await Promise.all([
        evidenceKnowledgeApi.ontologyPacks(), evidenceKnowledgeApi.ontologyCandidates(100),
        worldModelApi.providers(), worldModelApi.ontologyContext(), evidenceKnowledgeApi.evidence(100),
      ]);
      setPacks(ontologyPacks);
      setCandidates(ontologyCandidates);
      setProviders(providerItems);
      setOntology(activeOntology);
      setEvidence(evidenceItems);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('world.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, query, taskId, t]);

  React.useEffect(() => { void load(); }, []);

  const resolveConflict = async (item: WorldConflict) => {
    const note = notes[item.conflict_id]?.trim();
    if (!note) return;
    try {
      await worldModelApi.resolveConflict(item, note);
      setConflicts(values => values.filter(value => value.conflict_id !== item.conflict_id));
      toast.success(t('world.conflictResolved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('world.resolveFailed'));
    }
  };

  const review = async (item: OntologyCandidate, approved: boolean) => {
    const note = notes[item.candidate_id]?.trim();
    if (!note) return;
    try {
      const updated = await evidenceKnowledgeApi.reviewOntologyCandidate(item, approved, note);
      setCandidates(values => values.map(value => value.candidate_id === updated.candidate_id ? updated : value));
      toast.success(t(approved ? 'world.approved' : 'world.rejected'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('world.reviewFailed'));
    }
  };

  const tabs: Array<{id:Tab; label:string; icon:typeof Network; count?:number}> = [
    { id: 'explorer', label: t('world.explorer'), icon: Network },
    { id: 'conflicts', label: t('world.conflictInbox'), icon: AlertTriangle, count: conflicts.length },
  ];
  if (isAdmin) tabs.push(
    { id: 'providers', label: t('world.providers'), icon: PlugZap, count: providers.length },
    { id: 'studio', label: t('world.ontologyStudio'), icon: PencilRuler },
    { id: 'review', label: t('world.ontologyReview'), icon: ShieldCheck, count: candidates.filter(value => value.status === 'REVIEW_REQUIRED').length },
  );

  return <div className="min-h-full bg-slate-50">
    <header className="border-b border-slate-800 bg-slate-950 px-5 py-6 text-white sm:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-emerald-400"><DatabaseZap size={16}/>{t('world.eyebrow')}</div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t('world.title')}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">{t('world.subtitle')}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-semibold hover:bg-slate-900 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>{t('world.refresh')}</button>
      </div>
    </header>
    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-8">
      <nav className="flex overflow-x-auto border-b border-slate-200" aria-label={t('world.title')}>
        {tabs.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === item.id ? 'border-emerald-500 text-slate-950' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><Icon size={16}/>{item.label}{item.count !== undefined && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">{item.count}</span>}</button>; })}
      </nav>
      {tab === 'explorer' && (
        <Explorer snapshot={snapshot} taskId={taskId} query={query} setTaskId={setTaskId} setQuery={setQuery} load={load} t={t}/>
      )}
      {tab === 'providers' && (
        <ProviderRegistry providers={providers} ontology={ontology} snapshot={providerSnapshot} setProviders={setProviders} setSnapshot={setProviderSnapshot} t={t}/>
      )}
      {tab === 'conflicts' && (
        <ConflictInbox conflicts={conflicts} notes={notes} setNotes={setNotes} resolve={resolveConflict} t={t}/>
      )}
      {tab === 'studio' && (
        <OntologyStudio packs={packs} ontology={ontology} evidence={evidence} onCreated={() => void load()} t={t}/>
      )}
      {tab === 'review' && (
        <OntologyReview candidates={candidates} notes={notes} setNotes={setNotes} review={review} t={t}/>
      )}
    </div>
  </div>;
}

function Explorer({snapshot,taskId,query,setTaskId,setQuery,load,t}:{snapshot:WorldSnapshot|null;taskId:string;query:string;setTaskId:(v:string)=>void;setQuery:(v:string)=>void;load:()=>Promise<void>;t:Translate}) {
  return <section className="py-5">
    <form onSubmit={event => { event.preventDefault(); void load(); }} className="grid gap-3 border-b border-slate-200 pb-5 md:grid-cols-[minmax(220px,0.7fr)_minmax(280px,1fr)_auto]">
      <Field label={t('world.taskId')}><input value={taskId} onChange={event => setTaskId(event.target.value)} placeholder={t('world.allTasks')} className={inputClass}/></Field>
      <Field label={t('world.search')}><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('world.searchPlaceholder')} className={`${inputClass} pl-9`}/></div></Field>
      <button type="submit" className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white"><Search size={16}/>{t('world.query')}</button>
    </form>
    {snapshot && (
      <SnapshotView snapshot={snapshot} t={t}/>
    )}
  </section>;
}

function ProviderRegistry({providers,ontology,snapshot,setProviders,setSnapshot,t}:{providers:WorldProvider[];ontology:OntologyContext|null;snapshot:WorldSnapshot|null;setProviders:React.Dispatch<React.SetStateAction<WorldProvider[]>>;setSnapshot:(value:WorldSnapshot|null)=>void;t:Translate}) {
  const [form, setForm] = React.useState<WorldProviderRequest>(() => blankProvider(ontology));
  const [editing, setEditing] = React.useState<WorldProvider | null>(null);
  const [previewText, setPreviewText] = React.useState('');
  React.useEffect(() => { if (ontology && !editing) setForm(value => ({...value, ontology_pack: ontology.pack_id, ontology_version: ontology.version})); }, [editing, ontology]);
  const update = <K extends keyof WorldProviderRequest>(key: K, value: WorldProviderRequest[K]) => setForm(current => ({...current, [key]: value}));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const value = editing
        ? await worldModelApi.updateProvider(editing, form)
        : await worldModelApi.createProvider(form);
      setProviders(items => editing
        ? items.map(item => item.provider_id === value.provider_id ? value : item)
        : [...items, value]);
      setEditing(null);
      setForm(blankProvider(ontology));
      toast.success(t(editing ? 'world.providerUpdated' : 'world.providerCreated'));
    } catch (error) { toast.error(error instanceof Error ? error.message : t('world.providerFailed')); }
  };
  const edit = (provider: WorldProvider) => {
    setEditing(provider);
    setForm(requestFromProvider(provider));
  };
  const cancelEdit = () => {
    setEditing(null);
    setForm(blankProvider(ontology));
  };
  const test = async (provider: WorldProvider) => {
    try {
      const value = await worldModelApi.testProvider(provider.provider_id);
      setProviders(items => items.map(item => item.provider_id === value.provider_id ? value : item));
      toast.success(value.health_status === 'AVAILABLE' ? t('world.providerAvailable') : value.health_message || t('world.providerFailed'));
    } catch (error) { toast.error(error instanceof Error ? error.message : t('world.providerFailed')); }
  };
  const preview = async (provider: WorldProvider) => {
    try { const value = await worldModelApi.queryProvider(provider.provider_id, previewText.trim()); setSnapshot(value.snapshot); toast.success(t('world.previewLoaded')); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('world.providerFailed')); }
  };
  const toggle = async (provider: WorldProvider) => {
    try {
      const value = await worldModelApi.updateProvider(provider, {...requestFromProvider(provider), enabled: !provider.enabled});
      setProviders(items => items.map(item => item.provider_id === value.provider_id ? value : item));
    } catch (error) { toast.error(error instanceof Error ? error.message : t('world.providerFailed')); }
  };
  const remove = async (provider: WorldProvider) => {
    if (!window.confirm(t('world.deleteProviderConfirm'))) return;
    try {
      await worldModelApi.deleteProvider(provider.provider_id);
      setProviders(items => items.filter(item => item.provider_id !== provider.provider_id));
      if (editing?.provider_id === provider.provider_id) cancelEdit();
      if (snapshot?.entities.some(item => item.scope === `provider:${provider.provider_id}`)) setSnapshot(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : t('world.providerFailed')); }
  };

  return <section className="py-5">
    <div className="grid gap-8 xl:grid-cols-[minmax(360px,0.75fr)_minmax(560px,1.25fr)]">
      <form onSubmit={save} className="space-y-3 border-b border-slate-200 pb-6 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-8">
        <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold text-slate-900">{editing ? <Pencil size={17}/> : <Plus size={17}/>} {t(editing ? 'world.editProvider' : 'world.addProvider')}</h2>{editing && <button type="button" onClick={cancelEdit} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-600"><Undo2 size={14}/>{t('world.cancel')}</button>}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('world.providerName')}><input required value={form.name} onChange={event => update('name', event.target.value)} className={inputClass}/></Field>
          <Field label={t('world.providerKind')}><select value={form.kind} onChange={event => { const kind = event.target.value as WorldProviderKind; setForm(value => ({...value, kind, query_template: providerQueries[kind]})); }} className={inputClass}>{(['ATHENA_HTTP','SPARQL','NEO4J','TYPEDB'] as WorldProviderKind[]).map(value => <option key={value}>{value}</option>)}</select></Field>
        </div>
        <Field label={t('world.endpoint')}><input required type="url" value={form.endpoint} onChange={event => update('endpoint', event.target.value)} placeholder="https://graph.example.com" className={inputClass}/></Field>
        {(form.kind === 'NEO4J' || form.kind === 'TYPEDB') && <Field label={t('world.database')}><input required value={form.database || ''} onChange={event => update('database', event.target.value)} className={inputClass}/></Field>}
        {form.kind !== 'ATHENA_HTTP' && <Field label={t('world.readOnlyQuery')}><textarea required rows={5} value={form.query_template || ''} onChange={event => update('query_template', event.target.value)} className={textareaClass}/></Field>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('world.authMode')}><select value={form.auth_mode} onChange={event => update('auth_mode', event.target.value as WorldProviderRequest['auth_mode'])} className={inputClass}><option>NONE</option><option>BEARER</option><option>BASIC</option></select></Field>
          {form.auth_mode !== 'NONE' && <Field label={t('world.credentialEnv')}><input required value={form.credential_env || ''} onChange={event => update('credential_env', event.target.value.toUpperCase())} placeholder="ATHENA_WORLD_PROVIDER_TOKEN" pattern="ATHENA_WORLD_PROVIDER_[A-Z0-9_]+" className={inputClass}/></Field>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('world.confidence')}><input type="number" min="0.01" max="1" step="0.01" value={form.default_confidence} onChange={event => update('default_confidence', Number(event.target.value))} className={inputClass}/></Field>
          <Field label={t('world.ttl')}><input type="number" min="1" value={form.ttl_seconds} onChange={event => update('ttl_seconds', Number(event.target.value))} className={inputClass}/></Field>
          <Field label={t('world.timeout')}><input type="number" min="250" max="30000" value={form.timeout_ms} onChange={event => update('timeout_ms', Number(event.target.value))} className={inputClass}/></Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.allow_private_network} onChange={event => update('allow_private_network', event.target.checked)}/>{t('world.allowPrivate')}</label>
        <button type="submit" disabled={!ontology} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40"><PlugZap size={16}/>{t(editing ? 'world.saveProvider' : 'world.connectProvider')}</button>
      </form>
      <div>
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><h2 className="font-bold text-slate-900">{t('world.providerRegistry')}</h2><div className="relative sm:w-72"><Search size={14} className="absolute left-3 top-3 text-slate-400"/><input value={previewText} onChange={event => setPreviewText(event.target.value)} aria-label={t('world.providerQuery')} placeholder={t('world.providerQuery')} className={`${inputClass} pl-8`}/></div></div>
        {providers.length === 0 ? <Empty icon={PlugZap} text={t('world.noProviders')}/> : <div className="divide-y divide-slate-200 border-y border-slate-200">{providers.map(provider => <div key={provider.provider_id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b>{provider.name}</b><span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-bold">{provider.kind}</span><Health status={provider.health_status}/>{!provider.enabled && <span className="text-xs text-slate-400">{t('world.disabled')}</span>}</div><div className="mt-1 truncate text-xs text-slate-500">{provider.endpoint} · {provider.ontology_pack}@{provider.ontology_version}</div>{provider.health_message && <div className="mt-1 text-xs text-slate-500">{provider.health_message}</div>}</div><div className="flex flex-wrap gap-2"><IconButton title={t('world.edit')} onClick={() => edit(provider)} icon={Pencil}/><IconButton title={t('world.test')} onClick={() => void test(provider)} icon={FlaskConical}/><IconButton title={t('world.preview')} onClick={() => void preview(provider)} icon={Eye}/><button type="button" onClick={() => void toggle(provider)} className={`h-9 rounded-lg px-3 text-xs font-bold ${provider.enabled ? 'border border-slate-300 text-slate-700' : 'bg-emerald-600 text-white'}`}>{provider.enabled ? t('world.disable') : t('world.enable')}</button><IconButton title={t('world.delete')} onClick={() => void remove(provider)} icon={Trash2} danger/></div></div>)}</div>}
      </div>
    </div>
    {snapshot && <div className="mt-8 border-t border-slate-200 pt-5"><h2 className="font-bold">{t('world.providerPreview')}</h2><SnapshotView snapshot={snapshot} t={t}/></div>}
  </section>;
}

function ConflictInbox({conflicts,notes,setNotes,resolve,t}:{conflicts:WorldConflict[];notes:Record<string,string>;setNotes:React.Dispatch<React.SetStateAction<Record<string,string>>>;resolve:(value:WorldConflict)=>Promise<void>;t:Translate}) {
  return <section className="divide-y divide-slate-200">{conflicts.length === 0 ? <Empty icon={Check} text={t('world.noConflicts')}/> : conflicts.map(item => <article key={item.conflict_id} className="grid gap-4 py-5 lg:grid-cols-[1fr_minmax(300px,0.7fr)]"><div><div className="flex items-center gap-2"><AlertTriangle size={17} className="text-amber-600"/><h2 className="font-bold text-slate-900">{item.subject}</h2><span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{item.kind}</span></div><p className="mt-2 text-sm text-slate-600">{t('world.matches')}: {(item.candidate_ids || []).join(', ') || '-'}</p><p className="mt-1 text-xs text-slate-400">{item.task_id} · {formatDate(item.created_at)}</p></div><div className="flex gap-2"><input value={notes[item.conflict_id] || ''} onChange={event => setNotes(value => ({...value, [item.conflict_id]: event.target.value}))} placeholder={t('world.resolution')} className={inputClass}/><button type="button" disabled={!notes[item.conflict_id]?.trim()} onClick={() => void resolve(item)} className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40">{t('world.resolve')}</button></div></article>)}</section>;
}

function OntologyStudio({packs,ontology,evidence,onCreated,t}:{packs:OntologyPack[];ontology:OntologyContext|null;evidence:KnowledgeEvidence[];onCreated:()=>void;t:Translate}) {
  const [packName, setPackName] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const [packID, setPackID] = React.useState(ontology?.pack_id || '');
  const [version, setVersion] = React.useState('1.1.0');
  const [selectedEvidence, setSelectedEvidence] = React.useState<string[]>([]);
  const [definition, setDefinition] = React.useState(JSON.stringify(ontology?.definition || blankDefinition, null, 2));
  const [rules, setRules] = React.useState(JSON.stringify(ontology?.validation_rules || blankRules, null, 2));
  React.useEffect(() => { if (ontology && !packID) { setPackID(ontology.pack_id); setDefinition(JSON.stringify(ontology.definition, null, 2)); setRules(JSON.stringify(ontology.validation_rules, null, 2)); } }, [ontology, packID]);
  const selectedPack = packs.find(value => value.pack_id === packID);
  const createPack = async (event: React.FormEvent) => {
    event.preventDefault();
    try { await evidenceKnowledgeApi.createOntologyPack({name: packName, domain}); setPackName(''); setDomain(''); toast.success(t('world.packCreated')); onCreated(); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('world.ontologyPlanFailed')); }
  };
  const propose = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const parsedDefinition = JSON.parse(definition) as OntologyDefinition;
      const parsedRules = JSON.parse(rules) as OntologyValidationRule[];
      await evidenceKnowledgeApi.createOntologyCandidate({pack_id: packID, base_version: selectedPack?.current_version || '0.0.0', version, compatible_with: selectedPack?.current_version ? [selectedPack.current_version] : [], definition: parsedDefinition, validation_rules: parsedRules, evidence_refs: selectedEvidence});
      toast.success(t('world.candidateCreated'));
      onCreated();
    } catch (error) { toast.error(error instanceof Error ? error.message : t('world.ontologyPlanFailed')); }
  };
  return <section className="grid gap-8 py-5 xl:grid-cols-[minmax(280px,0.55fr)_minmax(600px,1.45fr)]">
    <form onSubmit={createPack} className="space-y-3 border-b border-slate-200 pb-6 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-8">
      <h2 className="font-bold">{t('world.createPack')}</h2>
      <Field label={t('world.packName')}><input required value={packName} onChange={event => setPackName(event.target.value)} className={inputClass}/></Field>
      <Field label={t('world.domain')}><input required value={domain} onChange={event => setDomain(event.target.value)} className={inputClass}/></Field>
      <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold"><Plus size={16}/>{t('world.createPack')}</button>
      <div className="pt-4 text-xs text-slate-500">{packs.map(pack => <div key={pack.pack_id} className="border-t border-slate-100 py-2"><b>{pack.name}</b><br/>{pack.domain} · {pack.current_version || '0.0.0'}</div>)}</div>
    </form>
    <form onSubmit={propose} className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-bold">{t('world.planCandidate')}</h2>{ontology && <code className="text-xs text-slate-500">{ontology.pack_id}@{ontology.version}</code>}</div>
      <div className="grid gap-3 sm:grid-cols-2"><Field label={t('world.pack')}><select required value={packID} onChange={event => setPackID(event.target.value)} className={inputClass}><option value="">-</option>{packs.map(pack => <option key={pack.pack_id} value={pack.pack_id}>{pack.name} · {pack.current_version || '0.0.0'}</option>)}</select></Field><Field label={t('world.newVersion')}><input required value={version} onChange={event => setVersion(event.target.value)} pattern="[0-9]+\.[0-9]+\.[0-9]+" className={inputClass}/></Field></div>
      <Field label={t('world.definitionJson')}><textarea required rows={11} value={definition} onChange={event => setDefinition(event.target.value)} className={`${textareaClass} font-mono text-xs`}/></Field>
      <Field label={t('world.rulesJson')}><textarea required rows={6} value={rules} onChange={event => setRules(event.target.value)} className={`${textareaClass} font-mono text-xs`}/></Field>
      <Field label={t('world.evidenceSelection')}><div className="max-h-40 overflow-y-auto border-y border-slate-200">{evidence.map(item => <label key={item.evidence_id} className="flex items-start gap-2 border-b border-slate-100 py-2 text-xs"><input type="checkbox" checked={selectedEvidence.includes(item.evidence_id)} onChange={event => setSelectedEvidence(values => event.target.checked ? [...values, item.evidence_id] : values.filter(id => id !== item.evidence_id))}/><span><b>{item.title}</b><br/><code>{item.evidence_id}</code></span></label>)}</div></Field>
      <button disabled={!packID || selectedEvidence.length === 0} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40"><GitBranch size={16}/>{t('world.submitReview')}</button>
    </form>
  </section>;
}

function OntologyReview({candidates,notes,setNotes,review,t}:{candidates:OntologyCandidate[];notes:Record<string,string>;setNotes:React.Dispatch<React.SetStateAction<Record<string,string>>>;review:(value:OntologyCandidate,approved:boolean)=>Promise<void>;t:Translate}) {
  return <section className="divide-y divide-slate-200">{candidates.length === 0 ? <Empty icon={GitBranch} text={t('world.noCandidates')}/> : candidates.map(item => <article key={item.candidate_id} className="py-5"><div className="flex flex-col justify-between gap-4 lg:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-900">{item.pack_id} · {item.base_version || '0.0.0'} → {item.proposed.version}</h2><span className={`rounded px-2 py-1 text-xs font-bold ${item.status === 'REVIEW_REQUIRED' ? 'bg-sky-100 text-sky-800' : item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{item.status}</span></div><p className="mt-2 text-sm text-slate-600">{t('world.proposedBy')}: <code>{item.created_by}</code> · {item.proposed.definition.entities.length} {t('world.entities').toLowerCase()} · {item.proposed.definition.relations.length} {t('world.relations').toLowerCase()}</p><p className="mt-1 text-xs text-slate-400">{t('world.offlineEvaluation')}: {item.evaluation.passed ? 'PASS' : 'FAIL'} · {item.evidence_refs.length} {t('world.evidence')}</p></div>{item.status === 'REVIEW_REQUIRED' && <div className="flex min-w-0 gap-2 lg:w-[480px]"><input value={notes[item.candidate_id] || ''} onChange={event => setNotes(value => ({...value, [item.candidate_id]: event.target.value}))} placeholder={t('world.reviewNote')} className={inputClass}/><IconButton title={t('world.reject')} disabled={!notes[item.candidate_id]?.trim()} onClick={() => void review(item, false)} icon={X} danger/><IconButton title={t('world.approve')} disabled={!notes[item.candidate_id]?.trim() || !item.evaluation.passed} onClick={() => void review(item, true)} icon={Check} primary/></div>}</div></article>)}</section>;
}

function SnapshotView({snapshot,t}:{snapshot:WorldSnapshot;t:Translate}) { return <div className="py-4"><div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500"><span>{t('world.revision')} <b className="text-slate-800">{snapshot.revision}</b></span><span>{t('world.ontology')} <b className="text-slate-800">{snapshot.ontology_pack}@{snapshot.ontology_version}</b></span><span>{t('world.snapshot')} <code>{snapshot.snapshot_id}</code></span></div><WorldTable title={t('world.entities')} columns={[t('world.id'),t('world.type'),t('world.name'),t('world.confidence'),t('world.expires')]} rows={snapshot.entities.map(value => [value.entity_id,value.type,value.canonical_name || '-',`${Math.round(value.confidence*100)}%`,formatDate(value.expires_at)])}/><WorldTable title={t('world.relations')} columns={[t('world.id'),t('world.predicate'),t('world.source'),t('world.target'),t('world.confidence')]} rows={snapshot.relations.map(value => [value.relation_id,value.predicate,value.source_id,value.target_id,`${Math.round(value.confidence*100)}%`])}/><WorldTable title={t('world.facts')} columns={[t('world.id'),t('world.subject'),t('world.predicate'),t('world.value'),t('world.confidence')]} rows={snapshot.facts.map(value => [value.fact_id,value.subject_id,value.predicate,String(value.value),`${Math.round(value.confidence*100)}%`])}/></div>; }
function WorldTable({title,columns,rows}:{title:string;columns:string[];rows:string[][]}) { return <section className="mb-6"><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900">{title}</h2><span className="text-xs text-slate-400">{rows.length}</span></div><div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr>{columns.map(value => <th key={value} className="px-3 py-2 font-bold">{value}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">-</td></tr> : rows.map((row,index) => <tr key={`${row[0]}-${index}`} className="hover:bg-slate-50">{row.map((value,column) => <td key={column} className="max-w-[320px] truncate px-3 py-2 text-slate-700" title={value}>{value}</td>)}</tr>)}</tbody></table></div></section>; }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>{children}</label>; }
function Empty({icon:Icon,text}:{icon:typeof Check;text:string}) { return <div className="flex min-h-64 flex-col items-center justify-center text-slate-400"><Icon size={28}/><p className="mt-3 text-sm font-semibold">{text}</p></div>; }
function IconButton({title,onClick,icon:Icon,disabled,danger,primary}:{title:string;onClick:()=>void;icon:typeof Check;disabled?:boolean;danger?:boolean;primary?:boolean}) { return <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:opacity-40 ${primary ? 'bg-emerald-600 text-white' : danger ? 'border border-red-300 text-red-700' : 'border border-slate-300 text-slate-700'}`}><Icon size={16}/></button>; }
function Health({status}:{status:WorldProvider['health_status']}) { return <span className={`h-2.5 w-2.5 rounded-full ${status === 'AVAILABLE' ? 'bg-emerald-500' : status === 'FAILED' ? 'bg-red-500' : 'bg-slate-300'}`} title={status}/>; }
function formatDate(value:string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(); }
function blankProvider(ontology:OntologyContext|null):WorldProviderRequest { return {name:'',kind:'ATHENA_HTTP',endpoint:'',database:'',query_template:'',auth_mode:'NONE',credential_env:'',allow_private_network:false,ontology_pack:ontology?.pack_id || '',ontology_version:ontology?.version || '',default_confidence:.75,ttl_seconds:3600,timeout_ms:5000,enabled:true}; }
function requestFromProvider(value:WorldProvider):WorldProviderRequest { return {name:value.name,kind:value.kind,endpoint:value.endpoint,database:value.database,query_template:value.query_template,auth_mode:value.auth_mode,credential_env:value.credential_env,allow_private_network:value.allow_private_network,ontology_pack:value.ontology_pack,ontology_version:value.ontology_version,default_confidence:value.default_confidence,ttl_seconds:value.ttl_seconds,timeout_ms:value.timeout_ms,enabled:value.enabled}; }

const inputClass = 'h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500';
const textareaClass = 'w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-emerald-500';
