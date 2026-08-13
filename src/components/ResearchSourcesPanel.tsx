import React from 'react';
import { CheckCircle2, ExternalLink, Globe2, ListChecks, Search, Sparkles, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ResearchSourcePage } from '../types';

type Props = {
  pages: ResearchSourcePage[];
  queryTexts?: string[];
  confidence?: number;
  disabled?: boolean;
  onAsk?: (prompt: string, displayText: string) => void;
};

function scorePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function domainMark(domain: string): string {
  const value = domain.replace(/^www\./, '').trim();
  return (value[0] || 'W').toUpperCase();
}

export default function ResearchSourcesPanel({ pages, queryTexts = [], confidence = 0, disabled = false, onAsk }: Props) {
  const { t } = useTranslation();
  if (pages.length === 0) return null;
  const sourceList = pages.slice(0, 8).map((page, index) => `${index + 1}. ${page.title}: ${page.url}`).join('\n');

  return (
    <section className="border-t border-slate-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.78))] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm shadow-brand-200">
            <Globe2 size={15} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-[11px] font-extrabold text-slate-800">{t('chat.researchValuablePages')}</h4>
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-slate-500 ring-1 ring-slate-200">
                {t('chat.researchPageCount', { count: pages.length })}
              </span>
              {confidence > 0 && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                  {t('chat.researchConfidence')} {scorePercent(confidence)}%
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[9px] leading-4 text-slate-400">{t('chat.researchValuablePagesHint')}</p>
          </div>
        </div>
      </div>

      {queryTexts.length > 0 && (
        <div className="mt-3 flex items-start gap-2">
          <Search size={12} className="mt-1 shrink-0 text-slate-400" />
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {queryTexts.slice(0, 8).map(query => (
              <span key={query} className="max-w-full truncate rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-slate-500 ring-1 ring-slate-200" title={query}>
                {query}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 grid auto-cols-[minmax(245px,78%)] grid-flow-col gap-2.5 overflow-x-auto pb-2 sm:auto-cols-[minmax(270px,48%)]">
        {pages.map(page => (
          <article
            key={`${page.id}-${page.url}`}
            className="group flex min-h-44 flex-col rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
          >
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                <Globe2 size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                  <span className="truncate">{page.domain}</span>
                  <span>#{page.rank}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 text-[11px] font-extrabold leading-4 text-slate-800 group-hover:text-brand-700">
                  {page.title}
                </span>
              </span>
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[9px] font-black text-white" title={page.domain}>
                {domainMark(page.domain)}
              </span>
            </div>

            {page.snippet && <p className="mt-2 line-clamp-3 text-[9px] leading-4 text-slate-500">{page.snippet}</p>}

            <code className="mt-2 line-clamp-2 break-all rounded-lg bg-slate-50 px-2 py-1.5 text-[8px] leading-3 text-slate-400">
              {page.url}
            </code>

            <div className="mt-auto pt-2.5">
              <div className="mb-2 flex flex-wrap gap-1">
                {page.valueSignals.slice(0, 4).map(signal => (
                  <span key={signal} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700">
                    {signal === 'opened' && <CheckCircle2 size={8} />}
                    {t(`chat.researchValueSignals.${signal}`, { defaultValue: signal })}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, scorePercent(page.evidenceScore))}%` }} />
                </div>
                <span className="text-[8px] font-bold text-slate-400">{t('chat.researchEvidenceScore')} {scorePercent(page.evidenceScore)}%</span>
              </div>
              <div className="mt-2 flex gap-1.5 border-t border-slate-100 pt-2">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-sky-50 px-2 py-1.5 text-[9px] font-bold text-sky-700 transition-colors hover:bg-sky-100"
                >
                  <Globe2 size={11} /> {t('chat.researchOpenSource')} <ExternalLink size={9} />
                </a>
                {onAsk && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onAsk(
                      t('chat.referencePrompts.read', { title: page.title, url: page.url }),
                      t('chat.referenceActionMessage', { action: t('chat.referenceReadDeeply'), source: page.title }),
                    )}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-[9px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Sparkles size={11} /> {t('chat.researchAnalyzeSource')}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {onAsk && (
        <div className="mt-1 rounded-xl border border-sky-100 bg-white/85 p-2.5">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('chat.referenceContinue')}</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAsk(
                t('chat.referencePrompts.verify', { sources: sourceList }),
                t('chat.referenceActionMessage', { action: t('chat.referenceCrossCheck'), source: t('chat.researchValuablePages') }),
              )}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-slate-700 transition-colors hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Scale size={11} /> {t('chat.referenceCrossCheck')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAsk(
                t('chat.referencePrompts.checklist', { sources: sourceList }),
                t('chat.referenceActionMessage', { action: t('chat.referenceMakeChecklist'), source: t('chat.researchValuablePages') }),
              )}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ListChecks size={11} /> {t('chat.referenceMakeChecklist')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
