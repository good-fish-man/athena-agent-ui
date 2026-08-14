import React from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  Globe2,
  Loader2,
  Network,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { evidenceKnowledgeApi } from '../lib/api';
import type {
  KnowledgeClaim,
  KnowledgeContradiction,
  KnowledgeEvidence,
  KnowledgeRetrievalResponse,
  KnowledgeSnapshot,
  OntologyPack,
} from '../types';

const percent = (value: number) => `${Math.round(value * 100)}%`;
const shortDate = (value?: string) => value ? new Date(value).toLocaleString() : 'N/A';

export function EvidenceKnowledgePanel() {
  const { t } = useTranslation();
  const [claims, setClaims] = React.useState<KnowledgeClaim[]>([]);
  const [evidence, setEvidence] = React.useState<KnowledgeEvidence[]>([]);
  const [contradictions, setContradictions] = React.useState<KnowledgeContradiction[]>([]);
  const [snapshots, setSnapshots] = React.useState<KnowledgeSnapshot[]>([]);
  const [packs, setPacks] = React.useState<OntologyPack[]>([]);
  const [query, setQuery] = React.useState('');
  const [result, setResult] = React.useState<KnowledgeRetrievalResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [retrieving, setRetrieving] = React.useState(false);
  const [resolving, setResolving] = React.useState('');
  const [resolutionNotes, setResolutionNotes] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextClaims, nextEvidence, nextContradictions, nextSnapshots, nextPacks] = await Promise.all([
        evidenceKnowledgeApi.claims(),
        evidenceKnowledgeApi.evidence(),
        evidenceKnowledgeApi.contradictions(),
        evidenceKnowledgeApi.snapshots(),
        evidenceKnowledgeApi.ontologyPacks(),
      ]);
      setClaims(nextClaims);
      setEvidence(nextEvidence);
      setContradictions(nextContradictions);
      setSnapshots(nextSnapshots);
      setPacks(nextPacks);
    } catch (loadError) {
      console.error('Failed to load evidence knowledge:', loadError);
      setError(t('evidenceKnowledge.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const retrieve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim() || retrieving) return;
    setRetrieving(true);
    setError('');
    try {
      const next = await evidenceKnowledgeApi.retrieve(query.trim());
      setResult(next);
      if (next.snapshot) {
        setSnapshots(current => [next.snapshot!, ...current.filter(item => item.snapshot_id !== next.snapshot!.snapshot_id)]);
      }
    } catch (retrieveError) {
      console.error('Failed to retrieve evidence knowledge:', retrieveError);
      setError(t('evidenceKnowledge.retrieveFailed'));
    } finally {
      setRetrieving(false);
    }
  };

  const resolveConflict = async (item: KnowledgeContradiction, decision: 'KEEP_CLAIM' | 'MARK_UNCERTAIN' | 'RETRACT_ALL', winningClaimId?: string) => {
    const note = (resolutionNotes[item.contradiction_id] || '').trim();
    if (!note || resolving) return;
    setResolving(item.contradiction_id);
    setError('');
    try {
      await evidenceKnowledgeApi.resolveContradiction(item.contradiction_id, { decision, winning_claim_id: winningClaimId, note });
      setContradictions(current => current.filter(conflict => conflict.contradiction_id !== item.contradiction_id));
      setResolutionNotes(current => {
        const next = { ...current };
        delete next[item.contradiction_id];
        return next;
      });
      setClaims(await evidenceKnowledgeApi.claims());
    } catch (resolveError) {
      console.error('Failed to resolve knowledge contradiction:', resolveError);
      setError(t('evidenceKnowledge.resolveFailed'));
    } finally {
      setResolving('');
    }
  };

  const stats = [
    { label: t('evidenceKnowledge.claims'), value: claims.length, icon: BookOpenCheck, tone: 'bg-sky-50 text-sky-600' },
    { label: t('evidenceKnowledge.evidence'), value: evidence.length, icon: FileCheck2, tone: 'bg-emerald-50 text-emerald-600' },
    { label: t('evidenceKnowledge.conflicts'), value: contradictions.length, icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600' },
    { label: t('evidenceKnowledge.snapshots'), value: snapshots.length, icon: ShieldCheck, tone: 'bg-slate-100 text-slate-600' },
  ];

  return (
    <section className="mb-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-6 py-6 text-white">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              <Network size={15} /> Athena Knowledge v0.6
            </div>
            <h2 className="text-2xl font-bold">{t('evidenceKnowledge.title')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">{t('evidenceKnowledge.subtitle')}</p>
          </div>
          <form onSubmit={retrieve} className="flex w-full gap-2 xl:max-w-xl">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t('evidenceKnowledge.searchPlaceholder')}
                className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-400"
              />
            </div>
            <button
              type="submit"
              disabled={!query.trim() || retrieving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {retrieving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t('evidenceKnowledge.retrieve')}
            </button>
          </form>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={17} /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={18} /></div>
              <p className="text-2xl font-bold text-slate-900">{loading ? '-' : value}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {result && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-slate-900">{t('evidenceKnowledge.retrieve')}</h3>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span>{t('evidenceKnowledge.budget')}:</span>
                <span>{result.budget.results} {t('evidenceKnowledge.results')}</span>
                <span>{result.budget.tokens} {t('evidenceKnowledge.tokens')}</span>
                <span>{result.budget.time_ms} {t('evidenceKnowledge.time')}</span>
              </div>
            </div>
            {result.hits.length === 0 ? (
              <p className="text-sm text-slate-500">{t('evidenceKnowledge.noResults')}</p>
            ) : (
              <div className="space-y-3">
                {result.hits.map(hit => (
                  <article key={hit.claim.claim_id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{hit.claim.subject} / {hit.claim.predicate}</p>
                        <p className="mt-1 font-semibold text-slate-900">{hit.claim.value}</p>
                      </div>
                      <div className="flex gap-2 text-xs font-bold">
                        <span className={`rounded-full px-2.5 py-1 ${hit.determination === 'FACT' ? 'bg-emerald-100 text-emerald-700' : hit.determination === 'CONFLICTED' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{hit.determination}</span>
                        {hit.stale_evidence && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-700">{t('evidenceKnowledge.staleEvidence')}</span>}
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">{percent(hit.score)}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{t('evidenceKnowledge.matchedBy')}: {hit.matched_by.join(', ')}</span>
                      {hit.claim.valid_until && <span>{t('evidenceKnowledge.validUntil')}: {shortDate(hit.claim.valid_until)}</span>}
                    </div>
                    <div className="mt-3 space-y-2">
                      {hit.evidence.map(item => (
                        <div key={item.evidence_id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {item.uri ? (
                              <a href={item.uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:text-sky-900 hover:underline">
                                <Globe2 size={15} /> {item.title || t('evidenceKnowledge.source')} <ExternalLink size={13} />
                              </a>
                            ) : <span className="font-semibold text-slate-700">{item.title}</span>}
                            <span className="text-xs text-slate-500">{item.trust_profile} · {t('evidenceKnowledge.authority')} {percent(item.authority)} · {t('evidenceKnowledge.freshness')} {percent(item.freshness)}</span>
                          </div>
                          {item.excerpt && <p className="mt-1 line-clamp-2 text-slate-600">{item.excerpt}</p>}
                          {item.stale_at && <p className="mt-1 text-xs text-slate-400">{t('evidenceKnowledge.staleAt')}: {shortDate(item.stale_at)}</p>}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4 xl:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{t('evidenceKnowledge.claims')}</h3>
              <span className="text-xs text-slate-400">{claims.length}</span>
            </div>
            {claims.length === 0 ? <p className="text-sm text-slate-500">{t('evidenceKnowledge.noClaims')}</p> : (
              <div className="divide-y divide-slate-100">
                {claims.slice(0, 6).map(claim => (
                  <div key={claim.claim_id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-400">{claim.subject} / {claim.predicate}</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{claim.value}</p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${claim.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : claim.status === 'CONTRADICTED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{claim.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2"><Network size={17} className="text-brand-500" /><h3 className="font-bold text-slate-900">{t('evidenceKnowledge.ontology')}</h3></div>
            {packs.length === 0 ? <p className="text-sm text-slate-500">{loading ? '...' : t('evidenceKnowledge.corePack')}</p> : packs.map(pack => (
              <div key={pack.pack_id} className="mb-2 rounded-lg bg-slate-50 p-3 last:mb-0">
                <p className="font-semibold text-slate-800">{pack.name}</p>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500"><span>{pack.domain}</span><span>v{pack.current_version || 'draft'}</span></div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 xl:col-span-2">
            <div className="mb-3 flex items-center gap-2"><Globe2 size={17} className="text-sky-600" /><h3 className="font-bold text-slate-900">{t('evidenceKnowledge.evidence')}</h3></div>
            {evidence.length === 0 ? <p className="text-sm text-slate-500">{t('evidenceKnowledge.noEvidence')}</p> : (
              <div className="grid gap-3 md:grid-cols-2">
                {evidence.slice(0, 6).map(item => (
                  <div key={item.evidence_id} className="rounded-lg bg-slate-50 p-3">
                    {item.uri ? <a href={item.uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:underline"><Globe2 size={14} />{item.title}<ExternalLink size={12} /></a> : <p className="text-sm font-semibold text-slate-800">{item.title}</p>}
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.excerpt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2"><AlertTriangle size={17} className="text-amber-600" /><h3 className="font-bold text-slate-900">{t('evidenceKnowledge.conflicts')}</h3></div>
            {contradictions.length === 0 ? <p className="text-sm text-slate-500">{t('evidenceKnowledge.noConflicts')}</p> : contradictions.slice(0, 5).map(item => (
              <div key={item.contradiction_id} className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 last:mb-0">
                <p className="text-sm font-semibold text-amber-900">{item.summary}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-700"><Clock3 size={12} />{shortDate(item.created_at)}</p>
                <div className="mt-3 space-y-2">
                  {item.claim_ids.map(claimId => {
                    const claim = claims.find(value => value.claim_id === claimId);
                    return (
                      <button key={claimId} type="button" disabled={!resolutionNotes[item.contradiction_id]?.trim() || resolving === item.contradiction_id} onClick={() => void resolveConflict(item, 'KEEP_CLAIM', claimId)} className="block w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                        {t('evidenceKnowledge.keepClaim')}: {claim?.value || claimId}
                      </button>
                    );
                  })}
                  <textarea value={resolutionNotes[item.contradiction_id] || ''} onChange={event => setResolutionNotes(current => ({ ...current, [item.contradiction_id]: event.target.value }))} placeholder={t('evidenceKnowledge.resolutionNote')} rows={2} className="w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400" />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={!resolutionNotes[item.contradiction_id]?.trim() || resolving === item.contradiction_id} onClick={() => void resolveConflict(item, 'MARK_UNCERTAIN')} className="rounded-lg border border-amber-300 bg-white px-2 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">{t('evidenceKnowledge.markUncertain')}</button>
                    <button type="button" disabled={!resolutionNotes[item.contradiction_id]?.trim() || resolving === item.contradiction_id} onClick={() => void resolveConflict(item, 'RETRACT_ALL')} className="rounded-lg border border-red-200 bg-white px-2 py-2 text-xs font-bold text-red-700 disabled:opacity-50">{t('evidenceKnowledge.retractAll')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {snapshots.length > 0 && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-600" /><h3 className="font-bold text-slate-900">{t('evidenceKnowledge.recentSnapshots')}</h3></div>
            <div className="grid gap-2 lg:grid-cols-2">
              {snapshots.slice(0, 4).map(snapshot => (
                <div key={snapshot.snapshot_id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-3"><span className="font-mono text-slate-800">{snapshot.checksum.slice(0, 12)}</span><span>{shortDate(snapshot.as_of || snapshot.created_at)}</span></div>
                  <p className="mt-1 truncate">{t('evidenceKnowledge.runManifest')}: {snapshot.run_manifest_id || t('evidenceKnowledge.unbound')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
