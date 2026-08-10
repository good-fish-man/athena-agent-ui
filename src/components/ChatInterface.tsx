import React from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  MoreHorizontal,
  Plus,
  History,
  Trash2,
  ChevronDown,
  MessageSquare,
  Search,
  Zap,
  FileText,
  FileSearch,
  FolderSearch,
  BarChart3,
  MapPin,
  Sun,
  Code as CodeIcon,
  Languages,
  Check,
  ArrowUp,
  ChevronRight,
  PenTool,
  Podcast,
  CircleDot,
  Music,
  CheckSquare,
  PieChart,
  Eye,
  Settings,
  Play,
  Volume2,
  Box,
  Terminal,
  Brain,
  Wrench,
  Video,
  ExternalLink,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  UserCheck,
  XCircle,
  Clock,
  Presentation,
  Download,
  UserRound,
  Loader2,
  KeyRound
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { Message, FileInfo, Agent, Conversation, PendingApproval, ChatSession, type BrowserSuggestedAction, type ControlObservation, type ResearchSourcePage } from '../types';
import { agentApi, chatApi, controlApi, REPORT_API_BASE, siteCredentialApi, type RunHistoryMessage, type SiteCredential } from '../lib/api';
import { useTranslation } from 'react-i18next';
import { authStore } from '../lib/auth';
import { useVoiceConversation } from '../hooks/useVoiceConversation';
import VoiceCallStage from './VoiceCallStage';
import { AVATAR_PRESETS } from '../hooks/useVoiceConversation';
import { resolveAvatarSource } from './VoiceAvatar';
import { useCustomAvatars } from '../hooks/useCustomAvatars';
import { toast } from 'sonner';
import {
  parseBrowserAuthenticationMessage,
  parseClarificationMessage,
  type BrowserAuthenticationMessage,
  type ClarificationMessage
} from '../lib/structuredMessage';
import { currentLocationForMessage } from '../lib/geolocation';
import { desktopPermissions } from '../lib/desktopPermissions';
import { formatAssistantOutput } from '../lib/outputFormatting';
import ResearchSourcesPanel from './ResearchSourcesPanel';
import BrowserExecutionPanel, { hasBrowserExecution } from './BrowserExecutionPanel';

// 辅助函数：检测并提取 Markdown 中的 HTML 代码块
function extractHtmlFromMarkdown(content: string): { html: string | null; markdown: string; reportUrl: string | null; pptUrl: string | null } {
  // 匹配 ```html ... ``` 代码块
  const htmlBlockRegex = /```html\s*([\s\S]*?)```/gi;
  const matches = [...content.matchAll(htmlBlockRegex)];

  // 检测报告 URL: /uploads/{sessionID}/reports/*.html 格式
  const reportUrlRegex = /\/uploads\/[^\/]+\/reports\/[^\s]+\.html/gi;
  const reportUrlMatch = content.match(reportUrlRegex);
  const reportUrl = reportUrlMatch ? reportUrlMatch[0] : null;

  // 检测 PPT URL: /uploads/{sessionID}/reports/*.pptx 格式
  const pptUrlRegex = /\/uploads\/[^\/]+\/reports\/[^\s]+\.pptx/gi;
  const pptUrlMatch = content.match(pptUrlRegex);
  const pptUrl = pptUrlMatch ? pptUrlMatch[0] : null;

  if (matches.length === 0 && !reportUrl && !pptUrl) {
    return { html: null, markdown: content, reportUrl: null, pptUrl: null };
  }

  // 提取所有 HTML 代码块并合并
  const htmlParts = matches.map(m => m[1].trim()).filter(h => h.length > 0);
  const fullHtml = htmlParts.join('\n');

  // 从 Markdown 中移除 HTML 代码块，保留其他内容
  let markdown = content.replace(htmlBlockRegex, '').trim();
  // 移除报告 URL 行
  if (reportUrl) {
    markdown = markdown.replace(/\S+\/uploads\/[^\/]+\/reports\/[^\s]+\.html\n?/gi, '').trim();
  }
  // 移除 PPT URL 行
  if (pptUrl) {
    markdown = markdown.replace(/\S+\/uploads\/[^\/]+\/reports\/[^\s]+\.pptx\n?/gi, '').trim();
  }

  return { html: fullHtml, markdown, reportUrl, pptUrl };
}

function ClarificationCard({ data, onAnswer }: { data: ClarificationMessage; onAnswer?: (answer: string) => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = React.useState<Record<number, string[]>>({});

  const answerLine = (index: number, answers: string[]) => {
    const question = data.questions[index];
    return `${question.header || question.question}：${answers.join('、')}`;
  };

  const choose = (questionIndex: number, label: string) => {
    const question = data.questions[questionIndex];
    if (data.questions.length === 1 && !question.multi_select) {
      onAnswer?.(answerLine(questionIndex, [label]));
      return;
    }
    setSelected(current => {
      const values = current[questionIndex] || [];
      return {
        ...current,
        [questionIndex]: question.multi_select
          ? values.includes(label) ? values.filter(item => item !== label) : [...values, label]
          : [label],
      };
    });
  };

  const complete = data.questions.every((_, index) => (selected[index] || []).length > 0);
  const submit = () => onAnswer?.(data.questions.map((_, index) => answerLine(index, selected[index])).join('\n'));

  return (
    <div className="not-prose space-y-4">
      {data.intro && <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{data.intro}</p>}
      {data.questions.map((question, questionIndex) => (
        <div key={`${question.header || 'question'}-${questionIndex}`} className="space-y-3">
          {question.header && <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{question.header}</span>}
          <p className="text-sm font-semibold leading-6 text-slate-900">{question.question}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map(option => {
              const active = (selected[questionIndex] || []).includes(option.label);
              return (
                <button
                  type="button"
                  key={option.label}
                  onClick={() => choose(questionIndex, option.label)}
                  disabled={!onAnswer}
                  className={cn(
                    "group w-full rounded-xl border px-3 py-2.5 text-left transition-all",
                    active ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50",
                    !onAnswer && "cursor-default opacity-70"
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-xs font-bold text-slate-800">{option.label}</span>
                      {option.description && <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{option.description}</span>}
                    </span>
                    {active ? <Check size={14} className="shrink-0 text-emerald-600" /> : <ChevronRight size={14} className="shrink-0 text-slate-300 group-hover:text-slate-600" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {(data.questions.length > 1 || data.questions.some(question => question.multi_select)) && (
        <button
          type="button"
          disabled={!complete || !onAnswer}
          onClick={submit}
          className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          {t('common.confirm', { defaultValue: 'Confirm choices' })}
        </button>
      )}
    </div>
  );
}

function BrowserAuthenticationCard({ data, onAnswer }: { data: BrowserAuthenticationMessage; onAnswer?: (answer: string) => void }) {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = React.useState<'completed' | 'cancelled' | null>(null);
	const [accounts, setAccounts] = React.useState<SiteCredential[]>([]);
	const [accountsLoading, setAccountsLoading] = React.useState(true);
	const [loginID, setLoginID] = React.useState('');
	const [loginStarted, setLoginStarted] = React.useState(false);

	React.useEffect(() => {
		let active = true;
		setAccountsLoading(true);
		siteCredentialApi.findAll(data.domain)
			.then(items => { if (active) setAccounts(items.filter(item => item.enabled)); })
			.catch(() => { if (active) setAccounts([]); })
			.finally(() => { if (active) setAccountsLoading(false); });
		return () => { active = false; };
	}, [data.domain]);

	const useAccount = async (account: SiteCredential) => {
		setLoginID(account.ulid);
		try {
			await siteCredentialApi.login(account.ulid, data.session_id);
			setLoginStarted(true);
			toast.info(t('chat.browserAuthVerify'));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t('chat.browserAuthLoginFailed'));
		} finally {
			setLoginID('');
		}
	};

	  const complete = () => {
	    setSubmitted('completed');
	    onAnswer?.(`I completed the browser authentication for ${data.domain}.`);
	  };

	  const cancel = () => {
	    setSubmitted('cancelled');
	    onAnswer?.(`I cancelled the browser authentication for ${data.domain}.`);
	  };

  return (
    <div className="not-prose overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70">
      <div className="flex items-start gap-3 border-b border-amber-200/70 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <ShieldAlert size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{t('chat.browserAuthTitle')}</p>
          <p className="mt-1 truncate text-xs font-semibold text-amber-800">{data.domain}</p>
        </div>
        <ExternalLink size={16} className="mt-1 shrink-0 text-amber-600" />
      </div>
      <div className="space-y-3 px-4 py-4">
        <p className="text-xs leading-5 text-slate-700">{data.reason || t('chat.browserAuthReason')}</p>
        <div className="rounded-xl bg-white/80 px-3 py-2.5 text-[11px] leading-5 text-slate-600">
          {t('chat.browserAuthInstructions')}
        </div>
        <div className="flex items-start gap-2 text-[11px] leading-4 text-slate-500">
          <ShieldAlert size={13} className="mt-0.5 shrink-0" />
          <span>{t('chat.browserAuthSecurity')}</span>
        </div>
		<div className="rounded-xl border border-amber-200/70 bg-white/80 p-3">
			<p className="mb-2 flex items-center gap-2 text-[11px] font-bold text-slate-700"><KeyRound size={13} />{t('chat.browserAuthAccounts')}</p>
			{accountsLoading ? <Loader2 size={16} className="animate-spin text-amber-600" /> : accounts.length === 0 ? (
				<p className="text-[11px] text-slate-400">{t('chat.browserAuthNoAccounts')}</p>
			) : (
				<div className="space-y-2">
					{accounts.map(account => (
						<button key={account.ulid} type="button" disabled={Boolean(loginID) || submitted !== null} onClick={() => void useAccount(account)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-left hover:border-amber-300 disabled:opacity-50">
							<span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800">{account.name}</span><span className="block truncate font-mono text-[10px] text-slate-400">{account.username_masked}</span></span>
							<span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-amber-700">{loginID === account.ulid && <Loader2 size={12} className="animate-spin" />}{loginID === account.ulid ? t('chat.browserAuthLoggingIn') : t('chat.browserAuthUseAccount')}</span>
						</button>
					))}
				</div>
			)}
		</div>
		{loginStarted && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold leading-5 text-emerald-700">{t('chat.browserAuthVerify')}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={complete}
            disabled={!onAnswer || submitted !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <UserCheck size={15} />
            {submitted === 'completed' ? t('chat.browserAuthSubmitted') : t('chat.browserAuthComplete')}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={!onAnswer || submitted !== null}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <XCircle size={15} />
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatToolPayload(value: unknown): string {
  if (value === undefined || value === null || value === '') return '(无输出)';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatObservationResult(data: any): string {
  if (!data) return '(无输出)';
  const lines: string[] = [];
  if (data.status) lines.push(`Status: ${data.status}`);
  if (data.error) lines.push(`Error: ${data.error}`);
  if (data.session_id) lines.push(`Session: ${data.session_id}`);
  if (data.state) {
    const state = data.state;
    const summary = {
      ...(state.url ? { url: state.url } : {}),
      ...(state.title ? { title: state.title } : {}),
      ...(state.playback ? { playback: state.playback } : {}),
      ...(state.browser_task ? { browser_task: state.browser_task } : {}),
      ...(state.challenge ? { challenge: state.challenge } : {}),
      ...(state.verification ? { verification: state.verification } : {}),
    };
    if (Object.keys(summary).length > 0) lines.push(`State:\n${formatToolPayload(summary)}`);
  }
  return lines.join('\n\n') || formatToolPayload(data);
}

type ResearchSnapshot = {
  queryTexts: string[];
  pages: ResearchSourcePage[];
  confidence: number;
  queryCount: number;
  sourceCount: number;
};

function boundedScore(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function normalizeResearchQueryTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().slice(0, 240))
    .filter(Boolean))]
    .slice(0, 10);
}

function normalizeResearchPages(value: unknown): ResearchSourcePage[] {
  if (!Array.isArray(value)) return [];
  const pages: ResearchSourcePage[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const source = item as Record<string, unknown>;
    const rawUrl = typeof source.url === 'string' ? source.url.trim() : '';
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      continue;
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || seen.has(parsed.href)) continue;
    seen.add(parsed.href);
    const title = typeof source.title === 'string' && source.title.trim() ? source.title.trim().slice(0, 240) : parsed.hostname;
    const valueSignals = Array.isArray(source.value_signals)
      ? source.value_signals.filter((signal): signal is string => typeof signal === 'string').map(signal => signal.trim()).filter(Boolean).slice(0, 6)
      : Array.isArray(source.valueSignals)
        ? source.valueSignals.filter((signal): signal is string => typeof signal === 'string').map(signal => signal.trim()).filter(Boolean).slice(0, 6)
        : [];
    pages.push({
      id: typeof source.id === 'string' ? source.id : `source-${pages.length + 1}`,
      rank: typeof source.rank === 'number' && source.rank > 0 ? Math.floor(source.rank) : pages.length + 1,
      title,
      url: parsed.href,
      domain: parsed.hostname,
      provider: typeof source.provider === 'string' ? source.provider.slice(0, 80) : undefined,
      kind: typeof source.kind === 'string' ? source.kind.slice(0, 40) : undefined,
      snippet: typeof source.snippet === 'string' ? source.snippet.trim().slice(0, 283) : undefined,
      valueSignals,
      authority: boundedScore(source.authority),
      relevance: boundedScore(source.relevance),
      freshness: boundedScore(source.freshness),
      evidenceScore: boundedScore(source.evidence_score ?? source.evidenceScore),
      fetched: source.fetched === true,
      publishedAt: typeof source.published_at === 'string'
        ? source.published_at.slice(0, 40)
        : typeof source.publishedAt === 'string' ? source.publishedAt.slice(0, 40) : undefined,
    });
    if (pages.length >= 8) break;
  }
  return pages;
}

function researchSnapshotFromToolCalls(toolCalls: Message['toolCalls']): ResearchSnapshot | undefined {
  const call = [...(toolCalls || [])].reverse().find(item => item.name === 'research.execute' && item.researchPages?.length);
  if (!call?.researchPages?.length) return undefined;
  return {
    queryTexts: normalizeResearchQueryTexts(call.researchQueryTexts),
    pages: normalizeResearchPages(call.researchPages),
    confidence: boundedScore(call.researchConfidence),
    queryCount: typeof call.searchQueries === 'number' ? call.searchQueries : 0,
    sourceCount: typeof call.researchSources === 'number' ? call.researchSources : call.researchPages.length,
  };
}

function researchToolCallFromSnapshot(value: unknown): NonNullable<Message['toolCalls']>[number] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const snapshot = value as Record<string, unknown>;
  const pages = normalizeResearchPages(snapshot.pages);
  if (pages.length === 0) return undefined;
  return {
    name: 'research.execute',
    args: {},
    result: 'Research evidence is ready',
    progress: 100,
    progressStage: 'complete',
    progressMessage: 'Research evidence is ready',
    searchQueries: typeof snapshot.queryCount === 'number' ? snapshot.queryCount : 0,
    researchSources: typeof snapshot.sourceCount === 'number' ? snapshot.sourceCount : pages.length,
    researchConfidence: boundedScore(snapshot.confidence),
    researchQueryTexts: normalizeResearchQueryTexts(snapshot.queryTexts),
    researchPages: pages,
    status: 'completed',
  };
}

type BrowserExecutionSnapshot = {
  actionId?: string;
  name: string;
  args: Record<string, unknown>;
  status?: 'pending' | 'running' | 'completed' | 'error';
  observation: ControlObservation;
  suggestedActions?: BrowserSuggestedAction[];
};

function browserRecord(value: unknown): Record<string, any> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : undefined;
}

function browserText(value: unknown, limit = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const result = value.trim();
  return result ? result.slice(0, limit) : undefined;
}

function browserURL(value: unknown): string | undefined {
  const raw = browserText(value, 2048);
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/(?:^|_)(?:access_?token|refresh_?token|id_?token|token|code|api_?key|key|password|passwd|secret|authorization|auth|session|signature|sig)(?:$|_)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString().slice(0, 2048);
  } catch {
    return undefined;
  }
}

function browserNumber(value: unknown): number | undefined {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function browserBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function compactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function browserSafeArguments(value: unknown): Record<string, unknown> {
  const source = browserRecord(value) || {};
  return compactRecord({
    goal: browserText(source.goal, 240),
    target: browserText(source.target, 240),
    query: browserText(source.query, 240),
    url: browserURL(source.url),
    action: browserText(source.action, 80),
    ordinal: browserNumber(source.ordinal),
    automation_id: browserText(source.automation_id, 120),
    ref: /^@e\d+$/.test(browserText(source.ref, 40) || '') ? browserText(source.ref, 40) : undefined,
    target_ref: /^@e\d+$/.test(browserText(source.target_ref, 40) || '') ? browserText(source.target_ref, 40) : undefined,
    target_url: browserURL(source.target_url),
    expected_page_url: browserURL(source.expected_page_url),
    target_label: browserText(source.target_label, 240),
    destination_label: browserText(source.destination_label, 240),
    snapshot: browserBoolean(source.snapshot),
    verify_playback: browserBoolean(source.verify_playback),
  });
}

function browserSafeCandidate(value: unknown): Record<string, unknown> | undefined {
  const source = browserRecord(value);
  if (!source) return undefined;
  const evidence = browserRecord(source.evidence);
  const box = browserRecord(source.bounding_box);
  return compactRecord({
    id: browserText(source.id, 160),
    label: browserText(source.label, 240),
    url: browserURL(source.url),
    ref: browserText(source.ref, 160),
    role: browserText(source.role, 80),
    kind: browserText(source.kind, 80),
    position: browserNumber(source.position),
    order: browserNumber(source.order),
    playable: browserBoolean(source.playable),
    source: browserText(source.source, 80),
    confidence: browserNumber(source.confidence),
    evidence: evidence ? compactRecord({
      semantic: browserNumber(evidence.semantic),
      kind: browserNumber(evidence.kind),
      ordinal: browserNumber(evidence.ordinal),
      source: browserNumber(evidence.source),
      page: browserNumber(evidence.page),
      visual: browserNumber(evidence.visual),
      spatial: browserNumber(evidence.spatial),
    }) : undefined,
    bounding_box: box ? compactRecord({
      x: browserNumber(box.x),
      y: browserNumber(box.y),
      width: browserNumber(box.width),
      height: browserNumber(box.height),
    }) : undefined,
  });
}

function browserSafeResolution(value: unknown): Record<string, unknown> | undefined {
  const source = browserRecord(value);
  if (!source) return undefined;
  const spatial = browserRecord(source.spatial_relation);
  return compactRecord({
    schema: browserText(source.schema, 120),
    decision: browserText(source.decision, 40),
    risk: browserText(source.risk, 40),
    threshold: browserNumber(source.threshold),
    observe_threshold: browserNumber(source.observe_threshold),
    confidence: browserNumber(source.confidence),
    reason: browserText(source.reason, 320),
    requested_ordinal: browserNumber(source.requested_ordinal),
    requires_visual: browserBoolean(source.requires_visual),
    requires_spatial: browserBoolean(source.requires_spatial),
    fallback_used: browserBoolean(source.fallback_used),
    spatial_relation: spatial ? compactRecord({
      direction: browserText(spatial.direction, 40),
      anchor_label: browserText(spatial.anchor_label, 160),
      anchor_role: browserText(spatial.anchor_role, 80),
      resolved: browserBoolean(spatial.resolved),
    }) : undefined,
    selected: browserSafeCandidate(source.selected),
    candidates: Array.isArray(source.candidates)
      ? source.candidates.map(browserSafeCandidate).filter(Boolean).slice(0, 8)
      : undefined,
  });
}

function browserSafeInteractions(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    const source = browserRecord(item) || {};
    const policy = browserRecord(source.policy);
    const verification = browserRecord(source.verification);
    return compactRecord({
      schema: browserText(source.schema, 120),
      action: browserText(source.action, 80),
      status: browserText(source.status, 40),
      reason: browserText(source.reason, 320),
      attempts: browserNumber(source.attempts),
      reobserved: browserBoolean(source.reobserved),
      recovered: browserBoolean(source.recovered),
      started_at: browserText(source.started_at, 64),
      completed_at: browserText(source.completed_at, 64),
      duration_ms: browserNumber(source.duration_ms),
      policy: policy ? compactRecord({
        risk: browserText(policy.risk, 40),
        decision: browserText(policy.decision, 40),
        reason: browserText(policy.reason, 240),
      }) : undefined,
      verification: verification ? compactRecord({
        schema: browserText(verification.schema, 120),
        action: browserText(verification.action, 80),
        status: browserText(verification.status, 40),
        reason: browserText(verification.reason, 240),
        confidence: browserNumber(verification.confidence),
      }) : undefined,
    });
  }).slice(0, 12);
}

function browserSafeTask(value: unknown): Record<string, unknown> | undefined {
  const source = browserRecord(value);
  if (!source) return undefined;
  const planning = browserRecord(source.planning);
  const budget = browserRecord(source.execution_budget);
  return compactRecord({
    goal: browserText(source.goal, 240),
    target: browserText(source.target, 240),
    query: browserText(source.query, 240),
    selected_label: browserText(source.selected_label, 240),
    intent: browserText(source.intent, 100),
    resolved_url: browserURL(source.resolved_url),
    selected_url: browserURL(source.selected_url),
    candidate_source: browserText(source.candidate_source, 80),
    planning: planning ? compactRecord({
      schema: browserText(planning.schema, 120),
      strategy: browserText(planning.strategy, 100),
      reason: browserText(planning.reason, 320),
      max_actions: browserNumber(planning.max_actions),
    }) : undefined,
    resolution: browserSafeResolution(source.resolution),
    execution_budget: budget ? compactRecord({
      max_actions: browserNumber(budget.max_actions),
      used_actions: browserNumber(budget.used_actions),
      remaining_actions: browserNumber(budget.remaining_actions),
    }) : undefined,
    interactions: browserSafeInteractions(source.interactions),
    steps: Array.isArray(source.steps)
      ? source.steps.map(item => browserText(item, 120)).filter((item): item is string => Boolean(item)).slice(0, 16)
      : undefined,
    completed: browserBoolean(source.completed),
    message: browserText(source.message, 500),
  });
}

function browserSafeAutomation(value: unknown): Record<string, unknown> | undefined {
  const source = browserRecord(value);
  if (!source) return undefined;
  const rules = Array.isArray(source.rules) ? source.rules : [];
  const events = Array.isArray(source.recent_events) ? source.recent_events : [];
  return compactRecord({
    schema: browserText(source.schema, 120),
    mode: browserText(source.mode, 40),
    active_count: browserNumber(source.active_count),
    rule_count: browserNumber(source.rule_count),
    monitor_modes: Array.isArray(source.monitor_modes)
      ? source.monitor_modes.map(item => browserText(item, 80)).filter((item): item is string => Boolean(item)).slice(0, 6)
      : undefined,
    rules: rules.map(item => {
      const rule = browserRecord(item) || {};
      return compactRecord({
        id: browserText(rule.id, 120),
        name: browserText(rule.name, 160),
        enabled: browserBoolean(rule.enabled),
        status: browserText(rule.status, 40),
        monitor_mode: browserText(rule.monitor_mode, 80),
        last_error: browserText(rule.last_error, 320),
        monitor_error: browserText(rule.monitor_error, 320),
      });
    }).slice(0, 8),
    recent_events: events.map(item => {
      const event = browserRecord(item) || {};
      return compactRecord({
        event_id: browserText(event.event_id, 120),
        type: browserText(event.type, 80),
        status: browserText(event.status, 40),
        lifecycle: browserText(event.lifecycle, 40),
        observed_at: browserText(event.observed_at, 64),
        error: browserText(event.error, 320),
      });
    }).slice(0, 8),
  });
}

function browserSafeObservation(value: unknown): ControlObservation | undefined {
  const source = browserRecord(value);
  const state = browserRecord(source?.state);
  if (!source || !state || (!state.browser_task && !state.automation_state && !state.capability_handoff)) return undefined;
  const handoff = browserRecord(state.capability_handoff);
  const playback = browserRecord(state.playback);
  const safeState = compactRecord({
    url: browserURL(state.url),
    title: browserText(state.title, 500),
    playback: playback ? compactRecord({
      verified: browserBoolean(playback.verified),
      playing: browserBoolean(playback.playing),
      title: browserText(playback.title, 240),
    }) : undefined,
    browser_task: browserSafeTask(state.browser_task),
    automation_state: browserSafeAutomation(state.automation_state),
    capability_handoff: handoff ? compactRecord({
      schema: browserText(handoff.schema, 120),
      from: browserText(handoff.from, 100),
      to: browserText(handoff.to, 100),
      reason: browserText(handoff.reason, 240),
      query: browserText(handoff.query, 240),
      session_id: browserText(handoff.session_id, 160),
      continuation_required: browserBoolean(handoff.continuation_required),
    }) : undefined,
    continuation_required: browserBoolean(state.continuation_required),
  });
  return {
    protocol: browserText(source.protocol, 120) || 'athena.action-observation.v3',
    type: browserText(source.type, 40) || 'OBSERVATION',
    task_id: browserText(source.task_id, 160) || '',
    action_id: browserText(source.action_id, 160) || '',
    session_id: browserText(source.session_id, 160),
    sequence: browserNumber(source.sequence) || 0,
    status: browserText(source.status, 40) || 'SUCCEEDED',
    observed_at: browserText(source.observed_at, 64),
    error: browserText(source.error, 1000),
    state: safeState,
  };
}

function browserSafeSuggestedActions(value: unknown): BrowserSuggestedAction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const source = browserRecord(item);
    if (!source) return [];
    const id = browserText(source.id, 160);
    const label = browserText(source.label, 240);
    const capability = browserText(source.capability, 120);
    if (!id || !label || !capability) return [];
    return [{
      schema: 'athena.browser.suggestion.v1',
      id,
      label,
      description: browserText(source.description, 320),
      capability,
      kind: browserText(source.kind, 80) || 'navigate',
      arguments: browserSafeArguments(source.arguments),
      risk: browserText(source.risk, 40) || 'LOW',
    } as BrowserSuggestedAction];
  }).slice(0, 4);
}

function browserSnapshotsFromToolCalls(toolCalls: Message['toolCalls']): BrowserExecutionSnapshot[] {
  return (toolCalls || []).flatMap(call => {
    const observation = browserSafeObservation(call.observation);
    if (!observation) return [];
    const suggestedActions = browserSafeSuggestedActions(call.suggestedActions);
    return [{
      actionId: browserText(call.actionId, 160),
      name: browserText(call.name, 120) || 'browser.task',
      args: browserSafeArguments(call.args),
      status: call.status,
      observation,
      suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
    }];
  }).slice(-8);
}

function browserToolCallsFromSnapshot(value: unknown): NonNullable<Message['toolCalls']> {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const source = browserRecord(item);
    const observation = browserSafeObservation(source?.observation);
    if (!source || !observation) return [];
    const suggestedActions = browserSafeSuggestedActions(source.suggestedActions);
    const status = source.status === 'error' || source.status === 'running' || source.status === 'pending'
      ? source.status
      : 'completed';
    return [{
      actionId: browserText(source.actionId, 160),
      name: browserText(source.name, 120) || 'browser.task',
      args: browserSafeArguments(source.args),
      result: formatObservationResult(observation),
      observation,
      suggestedActions,
      suggestionStatus: suggestedActions.length > 0 ? 'idle' as const : undefined,
      status,
    }];
  }).slice(-8);
}

function browserSuggestionsFromObservation(data: any): BrowserSuggestedAction[] {
  const suggestions = data?.state?.suggested_actions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions.filter((item): item is BrowserSuggestedAction => (
    item?.schema === 'athena.browser.suggestion.v1'
    && typeof item.id === 'string'
    && typeof item.label === 'string'
    && typeof item.capability === 'string'
    && item.arguments !== null
    && typeof item.arguments === 'object'
  )).slice(0, 4);
}

function browserObservationSummary(data: any, translate: (key: any) => string): string {
  if (data?.status !== 'SUCCEEDED') {
    const detail = typeof data?.error === 'string' ? data.error.trim() : '';
    return detail
      ? `${translate('chat.browserActionFailed')}\n\n${detail}`
      : translate('chat.browserActionFailed');
  }
  const state = data?.state || {};
  const summary = state?.playback?.verified === true
    ? translate('chat.browserPlaybackVerified')
    : translate('chat.browserActionSucceeded');
  const pageUrl = typeof state.url === 'string' ? state.url.trim() : '';
  const pageTitle = typeof state.title === 'string' && state.title.trim()
    ? state.title.trim()
    : pageUrl;
  if (!pageUrl || !pageTitle) return summary;
  return `${summary}\n\n${translate('chat.browserCurrentPage')}: [${pageTitle}](${pageUrl})`;
}

function toolCallsWithObservation(toolCalls: Message['toolCalls'], data: any): Message['toolCalls'] {
  const calls = toolCalls || [];
  const targetIndex = data.action_id ? calls.findIndex(call => call.actionId === data.action_id) : -1;
  const updateIndex = targetIndex >= 0 ? targetIndex : calls.length - 1;
  const suggestedActions = browserSuggestionsFromObservation(data);
  const update = (call: NonNullable<Message['toolCalls']>[number]) => ({
    ...call,
    result: formatObservationResult(data),
    observation: data,
    suggestedActions,
    suggestionStatus: suggestedActions.length > 0 ? 'idle' as const : call.suggestionStatus,
    status: data.status === 'SUCCEEDED' ? 'completed' as const : 'error' as const,
  });
  if (updateIndex >= 0) {
    return calls.map((call, index) => index === updateIndex ? update(call) : call);
  }
  return [update({
    actionId: data.action_id,
    name: data.capability || 'device.observation',
    args: {},
  })];
}

function formatProgressResult(data: any): string {
  if (!data) return 'Working...';
  const lines: string[] = [];
  if (data.message) lines.push(String(data.message));
  if (data.stage) lines.push(`Stage: ${data.stage}`);
  if (typeof data.bytes === 'number' && data.bytes > 0) {
    const total = typeof data.total === 'number' && data.total > 0 ? ` / ${formatBytes(data.total)}` : '';
    lines.push(`Downloaded: ${formatBytes(data.bytes)}${total}`);
  }
  if (data.state?.path) lines.push(`Path: ${data.state.path}`);
	if (typeof data.state?.queries === 'number') lines.push(`Queries: ${data.state.queries}`);
	if (typeof data.state?.sources === 'number') lines.push(`Sources: ${data.state.sources}`);
	if (typeof data.state?.confidence === 'number' && data.state.confidence > 0) {
		lines.push(`Confidence: ${Math.round(data.state.confidence * 100)}%`);
	}
  return lines.join('\n') || formatToolPayload(data);
}

function toolCallsWithProgress(toolCalls: Message['toolCalls'], data: any): Message['toolCalls'] {
  const calls = toolCalls || [];
  const completed = progressCompleted(data);
  const targetIndex = data.action_id ? calls.findIndex(call => call.actionId === data.action_id) : -1;
  const updateIndex = targetIndex >= 0 ? targetIndex : lastRunningToolCallIndex(calls);
  const pages = normalizeResearchPages(data.state?.valuable_pages);
  const queryTexts = normalizeResearchQueryTexts(data.state?.query_texts);
  const update = (call: NonNullable<Message['toolCalls']>[number]) => ({
    ...call,
    result: formatProgressResult(data),
    progress: typeof data.progress === 'number' ? data.progress : call.progress,
    progressStage: data.stage || call.progressStage,
    progressMessage: data.message || call.progressMessage,
    bytes: typeof data.bytes === 'number' ? data.bytes : call.bytes,
    total: typeof data.total === 'number' ? data.total : call.total,
    searchQueries: typeof data.state?.queries === 'number' ? data.state.queries : call.searchQueries,
    researchSources: typeof data.state?.sources === 'number' ? data.state.sources : call.researchSources,
    researchConfidence: typeof data.state?.confidence === 'number' ? data.state.confidence : call.researchConfidence,
    researchQueryTexts: queryTexts.length > 0 ? queryTexts : call.researchQueryTexts,
    researchPages: pages.length > 0 ? pages : call.researchPages,
    status: completed ? 'completed' as const : 'running' as const,
  });
  if (updateIndex >= 0) {
    return calls.map((call, index) => index === updateIndex ? update(call) : call);
  }
  return [
    ...calls,
    update({
      actionId: data.action_id,
      name: data.capability || 'device.progress',
      args: {},
    }),
  ];
}

function progressCompleted(data: any): boolean {
	return data?.state?.completed === true || data?.stage === 'complete' || data?.progress >= 100;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function lastRunningToolCallIndex(toolCalls: Message['toolCalls']): number {
  if (!toolCalls) return -1;
  for (let index = toolCalls.length - 1; index >= 0; index -= 1) {
    if (toolCalls[index].status === 'running') return index;
  }
  return -1;
}

function isToolResultError(result: unknown, status?: string): boolean {
  if (status === 'error') return true;
  return typeof result === 'string' && result.startsWith('错误:');
}

// 渲染消息内容组件
function MessageContent({ content, htmlContent, reportUrl, pptUrl, onClarificationAnswer }: { content: string; htmlContent?: string; reportUrl?: string; pptUrl?: string; onClarificationAnswer?: (answer: string) => void }) {
  const { t } = useTranslation();
  const [iframeKey, setIframeKey] = React.useState(0);
  content = formatAssistantOutput(stripImagePlanningMarkup(stripInternalControlTags(sanitizeImageToolResult(content))));
	const browserAuthentication = parseBrowserAuthenticationMessage(content);
  const clarification = parseClarificationMessage(content);

	if (browserAuthentication) {
		return (
			<div className="space-y-3">
				{browserAuthentication.prefix && <ReactMarkdown>{browserAuthentication.prefix}</ReactMarkdown>}
				<BrowserAuthenticationCard data={browserAuthentication.data} onAnswer={onClarificationAnswer} />
			</div>
		);
	}

  if (clarification) {
    return (
      <div className="space-y-3">
        {clarification.prefix && <ReactMarkdown>{clarification.prefix}</ReactMarkdown>}
        <ClarificationCard data={clarification.data} onAnswer={onClarificationAnswer} />
      </div>
    );
  }

  // 构建报告的完整访问 URL
  // url 格式: /uploads/{sessionID}/reports/{filename}
  // 需要转换成: /api/xiaoqinglong/agent-frame/v1/runner/reports/{sessionID}/{filename}
  const getReportFullUrl = (url: string) => {
    if (!url) return '';
    // 提取 /uploads/{sessionID}/reports/{filename} 中的 sessionID 和 filename
    const match = url.match(/\/uploads\/([^\/]+)\/reports\/([^/]+\.html)$/);
    if (!match) return '';
    const sessionID = match[1];
    const filename = match[2];
    return `${REPORT_API_BASE}/runner/reports/${sessionID}/${filename}`;
  };

  // 构建 PPT 的完整访问 URL
  const getPptFullUrl = (url: string) => {
    if (!url) return '';
    // 提取 /uploads/{sessionID}/reports/{filename} 中的 sessionID 和 filename
    const match = url.match(/\/uploads\/([^\/]+)\/reports\/([^/]+\.pptx)$/);
    if (!match) return '';
    const sessionID = match[1];
    const filename = match[2];
    return `${REPORT_API_BASE}/runner/reports/${sessionID}/${filename}`;
  };

  // 如果有 PPT URL，显示下载链接
  if (pptUrl) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Presentation size={12} className="text-purple-500" />
            PPT 演示文稿
          </span>
          <a
            href={getPptFullUrl(pptUrl)}
            download
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            下载 PPT
          </a>
        </div>
      </div>
    );
  }

  // 如果有报告 URL，通过 iframe 加载报告
  if (reportUrl) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <BarChart3 size={12} className="text-green-500" />
            数据分析报告
          </span>
          <a
            href={getReportFullUrl(reportUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            在新窗口打开
          </a>
        </div>
        <iframe
          key={iframeKey}
          src={getReportFullUrl(reportUrl)}
          className="w-full border border-slate-200 rounded-xl"
          style={{ height: '600px' }}
          sandbox="allow-scripts allow-same-origin"
          title="数据分析报告"
        />
      </div>
    );
  }

  // 如果有 HTML 内容，通过 iframe srcDoc 渲染
  if (htmlContent) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <BarChart3 size={12} className="text-green-500" />
            数据分析报告
          </span>
          <button
            onClick={() => setIframeKey(k => k + 1)}
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            刷新图表
          </button>
        </div>
        <iframe
          key={iframeKey}
          srcDoc={htmlContent}
          className="w-full border border-slate-200 rounded-xl"
          style={{ height: '600px' }}
          sandbox="allow-scripts allow-same-origin"
          title="数据分析报告"
        />
      </div>
    );
  }

  // 否则渲染 Markdown
  return (
    <div className="markdown-body prose prose-slate prose-sm max-w-none">
      <ReactMarkdown components={{
        img: ({ src, alt }) => (
          <figure className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img src={src} alt={alt || 'Generated image'} className="h-auto w-full" referrerPolicy="no-referrer" />
            {src && (
              <a href={src} download target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 border-t border-slate-200 px-3 py-2 text-xs font-bold text-brand-600 hover:bg-white">
                <Download size={14} /> {t('chat.downloadImage')}
              </a>
            )}
          </figure>
        ),
      }}>{content}</ReactMarkdown>
    </div>
  );
}

interface ChatInterfaceProps {
  preselectedAgent?: Agent | null;
  onAgentUsed?: () => void;
  onCreateAgent?: () => void;
  onEditAgent?: (agent: Agent) => void;
}

const LAST_AGENT_KEY_PREFIX = 'athena:chat:lastAgentId:';

function lastAgentStorageKey(userId?: string | null): string {
  return `${LAST_AGENT_KEY_PREFIX}${userId || 'anonymous'}`;
}

function readLastAgentId(userId?: string | null): string | null {
  try {
    return localStorage.getItem(lastAgentStorageKey(userId));
  } catch {
    return null;
  }
}

function writeLastAgentId(userId: string | null | undefined, agentId: string): void {
  try {
    if (agentId) localStorage.setItem(lastAgentStorageKey(userId), agentId);
  } catch {
    // ignore storage failures (private mode / quota)
  }
}

// Max number of prior messages replayed to the runtime as conversation history.
const HISTORY_MAX_MESSAGES = 20;
// How many recent messages to scan when detecting prior image generation.
const IMAGE_LOOKBACK_MESSAGES = 8;
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
const GENERATED_IMAGE_HINT = '/generated/';
const LEGACY_IMAGE_HISTORY_MARKER = '[One or more images were generated successfully for the preceding user request. Their URLs are intentionally omitted. For any requested change or variation, call GenerateImage again with a complete revised prompt.]';
const INTERNAL_CONTROL_TAG_RE = /<\/?system[-_]reminder\b[^>]*>/i;
const INTERNAL_CONTROL_TAG_RE_GLOBAL = /<\/?system[-_]reminder\b[^>]*>/gi;
const IMAGE_PLANNING_TAG_RE = /<\/?(?:image|original_prompt)\b[^>]*>/gi;

function extractImageUrls(content: string): string[] {
  if (!content) return [];
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  MARKDOWN_IMAGE_RE.lastIndex = 0;
  while ((match = MARKDOWN_IMAGE_RE.exec(content)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

function hasInternalControlTag(content: string): boolean {
  return INTERNAL_CONTROL_TAG_RE.test(content || '');
}

function stripInternalControlTags(content: string): string {
  return (content || '').replace(INTERNAL_CONTROL_TAG_RE_GLOBAL, '').trim();
}

function hasImagePlanningMarkup(content: string): boolean {
  const value = content || '';
  return /<image\b[^>]*>/i.test(value) && /<original_prompt\b[^>]*>/i.test(value);
}

function stripImagePlanningMarkup(content: string): string {
  return hasImagePlanningMarkup(content)
    ? (content || '').replace(IMAGE_PLANNING_TAG_RE, '').trim()
    : content;
}

function hasStrippedInternalControlTag(message: Message): boolean {
  if (!message.metadata) return false;
  try {
    return JSON.parse(message.metadata)?.internalControlTagStripped === true;
  } catch {
    return false;
  }
}

function hasInvalidImagePlanningOutput(message: Message): boolean {
  if (hasImagePlanningMarkup(message.content || '')) return true;
  if (!message.metadata) return false;
  try {
    return JSON.parse(message.metadata)?.invalidImagePlanningOutput === true;
  } catch {
    return false;
  }
}

function buildAssistantMetadata(
  imageUrls: string[],
  prompt: string,
  internalControlTagStripped: boolean,
	invalidImagePlanningOutput: boolean,
	research?: ResearchSnapshot,
	browserExecutions?: BrowserExecutionSnapshot[],
): string | undefined {
  const metadata: Record<string, unknown> = {};
  if (imageUrls.length > 0) {
    metadata.imageActions = imageUrls.map(url => ({ prompt, url }));
  }
  if (internalControlTagStripped) {
    metadata.internalControlTagStripped = true;
  }
  if (invalidImagePlanningOutput) {
    metadata.invalidImagePlanningOutput = true;
  }
	if (research?.pages.length) {
		metadata.research = research;
	}
	if (browserExecutions?.length) {
		metadata.browserExecutions = browserExecutions;
	}
  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined;
}

// Converts a single raw GenerateImage tool-result JSON object into its Markdown
// image form. Returns null if the object isn't an image tool result.
function imageJsonToMarkdown(raw: string): string | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && (obj.image_url || obj.markdown)) {
      if (typeof obj.markdown === 'string' && obj.markdown.trim()) return obj.markdown;
      if (typeof obj.image_url === 'string' && obj.image_url.trim()) {
        return `![Generated image](${obj.image_url})`;
      }
    }
  } catch {
    // not valid JSON
  }
  return null;
}

// Defensively rewrites any raw GenerateImage tool-result JSON that leaked into
// assistant content into a clean Markdown image, so the UI never shows raw JSON
// and the model is never re-fed JSON samples via replayed history.
function sanitizeImageToolResult(content: string): string {
  if (!content) return content;
  const trimmed = content.trim();
  const whole = imageJsonToMarkdown(trimmed);
  if (whole !== null) return whole;
  if (!content.includes('"image_url"')) return content;
  return content.replace(/\{[^{}]*"image_url"[^{}]*\}/g, (blob) => {
    const md = imageJsonToMarkdown(blob);
    return md !== null ? md : blob;
  });
}

function imageActions(message: Message): { prompt: string; url: string }[] {
  if (!message.metadata) return [];
  try {
    const meta = JSON.parse(message.metadata);
    if (!Array.isArray(meta.imageActions)) return [];
    return meta.imageActions
      .map((action: unknown) => {
        if (!action || typeof action !== 'object') return null;
        const prompt = 'prompt' in action && typeof action.prompt === 'string' ? action.prompt.trim() : '';
        const url = 'url' in action && typeof action.url === 'string' ? action.url.trim() : '';
        return url ? { prompt, url } : null;
      })
      .filter((action: { prompt: string; url: string } | null): action is { prompt: string; url: string } => action !== null);
  } catch {
    return [];
  }
}

function imageActionUrls(message: Message): string[] {
  return imageActions(message).map(action => action.url);
}

function isGeneratedImageMessage(message: Message): boolean {
  const content = message.content || '';
  return extractImageUrls(content).length > 0
    || content.includes(GENERATED_IMAGE_HINT)
    || imageActionUrls(message).length > 0;
}

function isLegacyImageHistoryMarker(message: Message): boolean {
  return message.role === 'assistant'
    && (message.content || '').includes(LEGACY_IMAGE_HISTORY_MARKER);
}

// Build the conversation history (prior turns) replayed to the runtime, capped
// to the most recent HISTORY_MAX_MESSAGES completed user/assistant messages.
function buildRunHistory(messages: Message[]): RunHistoryMessage[] {
  const history: RunHistoryMessage[] = [];
  let latestUserContent = '';
  let imageContextIndex = 0;
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (m.status === 'streaming' || m.status === 'failed') continue;
    if (m.role === 'assistant' && isGeneratedImageMessage(m)) {
      imageContextIndex += 1;
      const actionPrompt = imageActions(m).map(action => action.prompt).filter(Boolean).pop();
      const sourcePrompt = actionPrompt || latestUserContent;
      history.push({
        role: 'system',
        content: `Image context image-${imageContextIndex} was generated successfully only for this request: ${JSON.stringify(sourcePrompt)}. It is independent from other image contexts. Its URL is omitted.`,
      });
      continue;
    }
    if (m.role === 'assistant' && isLegacyImageHistoryMarker(m)) continue;
    if (m.role === 'assistant' && (hasInternalControlTag(m.content || '') || hasStrippedInternalControlTag(m))) {
      continue;
    }
    if (m.role === 'assistant' && hasInvalidImagePlanningOutput(m)) continue;
    const content = stripImagePlanningMarkup(sanitizeImageToolResult((m.content || '').trim())).trim();
    if (!content) continue;
    history.push({ role: m.role, content });
    if (m.role === 'user') latestUserContent = content;
  }
  return history.slice(-HISTORY_MAX_MESSAGES);
}

// Returns true when a recent assistant turn generated an image, so the chat
// model can be reminded that continuing/editing the drawing is possible.
function hasRecentGeneratedImage(messages: Message[]): boolean {
  const recent = messages.slice(-IMAGE_LOOKBACK_MESSAGES);
  for (const m of recent) {
    if (m.role !== 'assistant') continue;
    if (isGeneratedImageMessage(m)) return true;
  }
  return false;
}

export function ChatInterface({ preselectedAgent, onAgentUsed, onCreateAgent, onEditAgent }: ChatInterfaceProps) {
	const currentUserId = authStore.userID();
  const { t, i18n } = useTranslation();
	const [voiceLanguage, setVoiceLanguage] = React.useState(() => localStorage.getItem('chat.voice.language') || 'en-US');
	const autoBoundDeviceRef = React.useRef<string>('');
  const [messages, setMessages] = React.useState<Message[]>([]);
	const messagesRef = React.useRef<Message[]>([]);
	const browserSuggestionLocksRef = React.useRef<Set<string>>(new Set());
	React.useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);
  const [input, setInput] = React.useState('');
  const [liveTranscript, setLiveTranscript] = React.useState('');
  const inputRef = React.useRef('');
  const voiceSendRef = React.useRef<(text: string) => void>(() => {});
  const voice = useVoiceConversation({
		language: voiceLanguage,
    onTranscript: text => {
      inputRef.current = text;
      setInput(text);
      setLiveTranscript(text);
    },
    onFinalTranscript: text => {
      setLiveTranscript(text);
      voiceSendRef.current(text);
    },
  });
	React.useEffect(() => {
		localStorage.setItem('chat.voice.language', voiceLanguage);
	}, [voiceLanguage]);
	React.useEffect(() => {
		if (!currentUserId) return;
		let active = true;
		const bindLatestUnownedDevice = async () => {
			try {
				const devices = await controlApi.devices();
				if (!active) return;
				const device = devices.find(item => item.online && !item.user_id);
				if (!device || autoBoundDeviceRef.current === device.id) return;
				await controlApi.bindDevice(device.id);
				autoBoundDeviceRef.current = device.id;
				if (active) toast.success(t('chat.desktopDeviceBound'));
			} catch (error) {
				console.debug('[control] auto-bind desktop device skipped', error);
			}
		};
		void bindLatestUnownedDevice();
		window.addEventListener('focus', bindLatestUnownedDevice);
		return () => {
			active = false;
			window.removeEventListener('focus', bindLatestUnownedDevice);
		};
	}, [currentUserId, t]);
  const customAvatars = useCustomAvatars();
  const avatarUploadRef = React.useRef<HTMLInputElement | null>(null);
  const avatarSource = React.useMemo(
    () => resolveAvatarSource(voice.avatarId, customAvatars.avatars),
    [voice.avatarId, customAvatars.avatars],
  );
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const created = await customAvatars.addAvatar(file);
    if (created) {
      voice.setAvatarId(created.id);
    } else if (customAvatars.error) {
      const messages: Record<string, string> = {
        unsupportedType: t('voiceCall.uploadUnsupported'),
        tooLarge: t('voiceCall.uploadTooLarge'),
        storageFailed: t('voiceCall.uploadFailed'),
      };
      toast.error(messages[customAvatars.error] || t('voiceCall.uploadFailed'));
    }
  };
  const [files, setFiles] = React.useState<FileInfo[]>([]);
	const localRootStorageKey = `athena.chat.local-file-roots.${currentUserId || 'anonymous'}`;
	const [localFileRoots, setLocalFileRoots] = React.useState<string[]>(() => {
		try {
			const value = JSON.parse(localStorage.getItem(localRootStorageKey) || '[]');
			return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
		} catch {
			return [];
		}
	});
	React.useEffect(() => {
		localStorage.setItem(localRootStorageKey, JSON.stringify(localFileRoots));
	}, [localFileRoots, localRootStorageKey]);
		const [desktopBridgeAvailable, setDesktopBridgeAvailable] = React.useState(false);
		React.useEffect(() => {
			let active = true;
			void desktopPermissions.available().then(available => {
				if (active) setDesktopBridgeAvailable(available);
			});
		return () => { active = false; };
	}, []);
	const authorizeLocalFolder = async () => {
		if (!desktopBridgeAvailable) {
			toast.error(t('chat.localFolderRemoteUnavailable'));
			return;
		}
		try {
			const path = await desktopPermissions.selectFolder();
			if (!path) return;
			setLocalFileRoots(current => current.includes(path) ? current : [...current, path]);
			toast.success(t('chat.localFolderAuthorized'));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t('chat.localFolderFailed'));
		}
	};
  const filesRef = React.useRef<FileInfo[]>([]); // 用于跟踪当前文件，异步更新
  const pendingFilesRef = React.useRef<File[]>([]); // 保存待上传的原始 File 对象
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = React.useState<Agent | null>(null);
  const [isOpeningAgentEditor, setIsOpeningAgentEditor] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [currentSession, setCurrentSession] = React.useState<ChatSession | null>(null);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = React.useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isTraceOpen, setIsTraceOpen] = React.useState(false);
  const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null);
  const [showThinking, setShowThinking] = React.useState<Record<string, boolean>>({});
  const [collapsedTools, setCollapsedTools] = React.useState<Record<string, boolean>>({});
  const [pendingApprovals, setPendingApprovals] = React.useState<PendingApproval[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const checkpointIdRef = React.useRef<string | null>(null);
  const userInitiatedStopRef = React.useRef(false);

  // Load agents from backend
  React.useEffect(() => {
    const loadAgents = async () => {
      try {
        const backendAgents = await agentApi.findAll();
        // 系统 Agent 排在前面，用户 Agent 排在后面
        const sortedAgents = backendAgents.filter(agent => agent.enabled !== false).sort((a, b) => {
          if (a.is_system === b.is_system) return 0;
          return a.is_system ? -1 : 1;
        });
        setAgents(sortedAgents);
        setActiveAgent(current => {
          if (current && sortedAgents.some(agent => (agent.ulid || agent.id) === (current.ulid || current.id))) {
            return current;
          }
          const lastAgentId = readLastAgentId(currentUserId);
          const lastAgent = lastAgentId
            ? sortedAgents.find(agent => (agent.ulid || agent.id) === lastAgentId)
            : undefined;
          return lastAgent || sortedAgents[0] || null;
        });
      } catch (err) {
        console.error('Failed to load agents:', err);
        setAgents([]);
        setActiveAgent(null);
      }
    };
    loadAgents();
  }, []);

  // Load user sessions
  React.useEffect(() => {
    const loadSessions = async () => {
      try {
		const sessions = await chatApi.getSessionsByUserId(currentUserId);
        const convs: Conversation[] = sessions.map(s => ({
          id: s.ulid,
          title: s.title || '新会话',
          lastMessage: '',
          timestamp: new Date(s.updated_at || s.created_at),
          agentId: s.agent_id
        }));
        setConversations(convs);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    };
    loadSessions();
  }, []);

  // Handle preselected agent from AgentManager
  React.useEffect(() => {
    if (preselectedAgent && preselectedAgent.enabled !== false) {
      setActiveAgent(preselectedAgent);
      setMessages([]);
      setActiveConversationId(null);
      setCurrentSession(null);
      if (onAgentUsed) {
        onAgentUsed();
      }
    }
  }, [preselectedAgent, onAgentUsed]);

  // Remember the last agent the user used, per user
  React.useEffect(() => {
    const id = activeAgent?.ulid || activeAgent?.id;
    if (id) writeLastAgentId(currentUserId, id);
  }, [activeAgent, currentUserId]);

  // Load session messages
  const loadSessionMessages = async (sessionId: string) => {
    try {
      const msgs = await chatApi.getMessagesBySessionId(sessionId);
      const mapped: Message[] = msgs.map(m => {
        // Reconstruct htmlContent and reportUrl from content (same as streaming done message)
        const { html, markdown, reportUrl, pptUrl } = extractHtmlFromMarkdown(m.content);
        // Parse files from metadata if present
        let files: FileInfo[] | undefined;
		let toolCalls: Message['toolCalls'];
        if (m.metadata) {
          try {
            const meta = JSON.parse(m.metadata);
            if (meta.files && Array.isArray(meta.files)) {
              files = meta.files;
            }
			const restoredToolCalls: NonNullable<Message['toolCalls']> = [];
			const researchCall = researchToolCallFromSnapshot(meta.research);
			if (researchCall) restoredToolCalls.push(researchCall);
			restoredToolCalls.push(...browserToolCallsFromSnapshot(meta.browserExecutions));
			if (restoredToolCalls.length > 0) toolCalls = restoredToolCalls;
          } catch (e) {
            // Ignore parse errors
          }
        }
        return {
          id: m.ulid,
          role: m.role as 'user' | 'assistant',
          content: html ? markdown : m.content,
          htmlContent: html || undefined,
          reportUrl: reportUrl || undefined,
          pptUrl: pptUrl || undefined,
          files,
		  toolCalls,
          timestamp: new Date(m.created_at),
          status: m.status as 'pending_approval' | 'completed' | 'failed' | undefined,
          metadata: m.metadata || undefined,
          thinking: m.trace ? JSON.parse(m.trace)?.thinking : undefined,
          trace: m.trace ? JSON.parse(m.trace)?.trace : undefined
        };
      });
      setMessages(mapped);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  // Handle approval
  const handleApproval = async (approvalId: string, action: 'approved' | 'rejected', reason?: string) => {
    try {
      if (action === 'approved') {
		await chatApi.approveApproval(approvalId, currentUserId, reason);
      } else {
		await chatApi.rejectApproval(approvalId, currentUserId, reason);
      }
      // Remove from pending list
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
    } catch (err) {
      console.error('Failed to handle approval:', err);
    }
  };

  const getAgentIcon = (iconName: string, size: number = 16) => {
    switch (iconName) {
      case 'Zap': return <Zap size={size} />;
      case 'ImageIcon': return <ImageIcon size={size} />;
      case 'PenTool': return <PenTool size={size} />;
      case 'Languages': return <Languages size={size} />;
      case 'Code': return <CodeIcon size={size} />;
      case 'Search': return <Search size={size} />;
      case 'Podcast': return <Podcast size={size} />;
      case 'CircleDot': return <CircleDot size={size} />;
      case 'Music': return <Music size={size} />;
      case 'CheckSquare': return <CheckSquare size={size} />;
      case 'PieChart': return <PieChart size={size} />;
      default: return <MessageSquare size={size} />;
    }
  };

  const activeAgentId = activeAgent?.ulid || activeAgent?.id || '';
  const activeAgentConversations = conversations.filter(conversation => conversation.agentId === activeAgentId);

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    console.log('[onDrop] called, acceptedFiles:', acceptedFiles.length);
    // 只保存文件信息到 state，不上传
    const newFiles = acceptedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file)
    }));
    filesRef.current = [...filesRef.current, ...newFiles];
    pendingFilesRef.current = [...pendingFilesRef.current, ...acceptedFiles];
    console.log('[onDrop] after - filesRef.current.length:', filesRef.current.length, 'pendingFilesRef.current.length:', pendingFilesRef.current.length);
    setFiles(filesRef.current);
  }, []);

  // 删除文件的处理函数，同时更新 filesRef 和 state
  const removeFile = (index: number) => {
    const removedFile = filesRef.current[index];
    // 如果有 blob URL，释放它
    if (removedFile?.url && removedFile.url.startsWith('blob:')) {
      URL.revokeObjectURL(removedFile.url);
    }
    filesRef.current = filesRef.current.filter((_, idx) => idx !== index);
    pendingFilesRef.current = pendingFilesRef.current.filter((_, idx) => idx !== index);
    setFiles(filesRef.current);
    console.log('[removeFile] after - filesRef.current.length:', filesRef.current.length);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true
  } as any);

  const handleSend = async (voiceText?: string, options: { hidden?: boolean; sessionId?: string } = {}) => {
	const hidden = options.hidden === true;
    const currentFiles = hidden ? [] : filesRef.current;
    const messageText = typeof voiceText === 'string' ? voiceText.trim() : inputRef.current.trim();
    console.log('[handleSend] called, currentFiles:', currentFiles, 'input:', messageText);
    if ((!messageText && currentFiles.length === 0) || (!hidden && isLoading) || !activeAgent) return;
	if (!hidden) {
		if (voice.isListening) voice.stopListening();
		if (voice.isSpeaking) voice.stopSpeaking();
	}

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      files: [...currentFiles]
    };

	if (!hidden) {
		setMessages(prev => [...prev, userMessage]);
		setInput('');
		inputRef.current = '';
		setFiles([]);
		filesRef.current = [];
	}
    setIsLoading(true);
    checkpointIdRef.current = null;
    userInitiatedStopRef.current = false;
    abortControllerRef.current = new AbortController();
	let activeAssistantMessageId: string | null = null;

    try {
      // Get session ID - create session if needed
      let sessionId = options.sessionId || currentSession?.ulid || activeConversationId;
      console.log('[handleSend] sessionId:', sessionId, 'currentFiles:', currentFiles.length);
      // Use first 50 chars of input as session title
      const sessionTitle = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
      if (!sessionId) {
        const result = await chatApi.createSession({
		  user_id: currentUserId,
          agent_id: activeAgent.ulid || activeAgent.id,
          title: sessionTitle,
          channel: 'web',
          model: activeAgent.model,
          status: 'active'
        });
        sessionId = result.ulid;
        setCurrentSession({
          ulid: result.ulid,
		  user_id: currentUserId,
          agent_id: activeAgent.ulid || activeAgent.id,
          title: sessionTitle,
          channel: 'web',
          model: activeAgent.model || '',
          status: 'active',
          created_at: Date.now(),
          updated_at: Date.now(),
		  created_by: currentUserId,
		  updated_by: currentUserId
        });
        setActiveConversationId(result.ulid);
        // Add to conversations list for sidebar display
        const newConv: Conversation = {
          id: result.ulid,
          title: sessionTitle,
          timestamp: new Date(),
          agentId: activeAgent.ulid || activeAgent.id
        };
        setConversations(prev => [newConv, ...prev]);
      }

      // 如果有待上传的文件，先上传
      let filesToSend = currentFiles;
      console.log('[handleSend] pendingFilesRef.current.length:', pendingFilesRef.current.length);
      if (!hidden && pendingFilesRef.current.length > 0) {
        console.log('[handleSend] Uploading pending files first, count:', pendingFilesRef.current.length);
        try {
          const result = await chatApi.uploadFiles(sessionId, pendingFilesRef.current);
          console.log('[handleSend] Pending files uploaded:', result);
          // 更新 files 中的 virtual_path
          const updatedFiles = currentFiles.map((f, idx) => {
            if (!f.virtual_path && result.files[idx]) {
              return { ...f, virtual_path: result.files[idx]?.virtual_path || '' };
            }
            return f;
          });
          console.log('[handleSend] updatedFiles:', updatedFiles);
          filesToSend = updatedFiles;
          filesRef.current = updatedFiles;
          setFiles(updatedFiles);
          pendingFilesRef.current = [];
        } catch (err) {
          console.error('Failed to upload pending files:', err);
          // 上传失败，只发送有 virtual_path 的文件
          filesToSend = currentFiles.filter(f => f.virtual_path);
        }
      } else {
        console.log('[handleSend] No pending files to upload, using currentFiles:', currentFiles);
      }

      // Save user message to database (with files if present)
      let userMessageUlid: string | null = null;
		if (!hidden) {
			try {
				const filesJson = filesToSend.length > 0 ? JSON.stringify(filesToSend) : undefined;
				const userMsgResult = await chatApi.createMessage({
					session_id: sessionId,
					role: 'user',
					content: messageText,
					status: 'completed',
					files: filesJson
				});
				userMessageUlid = userMsgResult.ulid;
			} catch (err) {
				console.error('Failed to save user message:', err);
			}
			}

	      // 调用 runner API
      console.log('[handleSend] Calling runner with filesToSend:', filesToSend);
      // 组装最近会话历史（不含本轮输入，本轮走 prompt 字段），让聊天模型跨轮次
      // 知道上下文——包括之前是否已用图像模型生成过图片。
      const runHistory = buildRunHistory(messagesRef.current);
      if (hasRecentGeneratedImage(messagesRef.current)) {
        runHistory.unshift({ role: 'system', content: t('multimodal.imageContinuityHint') });
      }
		const currentLocation = hidden ? null : await currentLocationForMessage(messageText);
		const runtimeContext: Record<string, unknown> = {};
			if (currentLocation) runtimeContext.current_location = currentLocation;
			if (desktopBridgeAvailable) runtimeContext.desktop_bridge = true;
			if (desktopBridgeAvailable) runtimeContext.browser_controller = true;
      const runResponse = await chatApi.runAgentStream({
        agent_id: activeAgent.ulid || activeAgent.id,
		user_id: currentUserId,
        session_id: sessionId || undefined,
        input: messageText,
        files: filesToSend.length > 0 ? filesToSend : undefined,
        history: runHistory.length > 0 ? runHistory : undefined,
		context: Object.keys(runtimeContext).length > 0 ? runtimeContext : undefined,
        is_test: false,
        signal: abortControllerRef.current.signal
      });

      // 检查是否流式响应
      const contentType = runResponse.headers.get('content-type') || '';
      const isStreaming = contentType.includes('text/event-stream');

      if (isStreaming) {
        // 流式响应处理
        const reader = runResponse.body?.getReader();
        if (!reader) {
          throw new Error('No reader available');
        }

        const assistantMsgId = (Date.now() + 1).toString();
		activeAssistantMessageId = assistantMsgId;
        let accumulatedContent = '';
        let finalAssistantContent = '';
		let streamCompleted = false;
		let streamErrorMessage = '';
        let internalControlTagStripped = false;
        let invalidImagePlanningOutput = false;
        let streamTokenUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } = {};
        let toolCalls: Message['toolCalls'] = [];
        let pendingToolCall: { name: string; args: any } | null = null;
        let recallInfo: Message['recallInfo'] = { status: 'running' };

        // 先创建一条空消息用于流式更新
        const assistantMessage: Message = {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          status: 'streaming',
          toolCalls: [],
          recallInfo: { status: 'running' }
        };
        setMessages(prev => [...prev, assistantMessage]);

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEventType = '';

        // 更新消息内容和方法调用的辅助函数
        const updateMessage = (updates: Partial<Message>) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, ...updates }
              : m
          ));
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              if (trimmedLine.startsWith('event: ')) {
                currentEventType = trimmedLine.slice(7).trim();
              } else if (trimmedLine.startsWith('data: ')) {
                // Standard SSE format with "data: " prefix
                const dataStr = trimmedLine.slice(6).trim();
                try {
                  const data = JSON.parse(dataStr);

                  // 处理 meta 事件 - 捕获 checkpoint_id
                  if (currentEventType === 'meta' && data.checkpoint_id) {
                    checkpointIdRef.current = data.checkpoint_id;
                    console.log('[SSE] checkpoint_id:', checkpointIdRef.current);
                  }

				  if (currentEventType === 'delta' && data.text) {
                    accumulatedContent += data.text;
                    updateMessage({ content: accumulatedContent });
				  }

				  if (currentEventType === 'action') {
					toolCalls = [...toolCalls, { actionId: data.action_id, name: data.capability || 'device.action', args: data.arguments || {}, result: 'Waiting for device observation...', status: 'running' }];
					updateMessage({
					  ...(data.arguments?.user_takeover && data.arguments?.message ? { content: String(data.arguments.message) } : {}),
					  toolCalls: [...toolCalls], status: data.policy?.decision === 'ASK_USER' ? 'pending_approval' : 'streaming',
					});
				  }

				  if (currentEventType === 'progress') {
					toolCalls = toolCallsWithProgress(toolCalls, data);
					updateMessage({ toolCalls: [...toolCalls] });
				  }

				  if (currentEventType === 'observation') {
					toolCalls = toolCallsWithObservation(toolCalls, data);
					updateMessage({ toolCalls: [...toolCalls] });
				  }

                  // 处理 recall_complete 事件 - 显示知识召回完成
                  if (currentEventType === 'recall_complete') {
                    recallInfo = { status: 'completed', count: data.count, message: data.message };
                    updateMessage({ recallInfo });
                  }

                  // 处理 tool_call 事件 - 显示正在调用的工具
                  if (currentEventType === 'tool_call') {
                    const toolName = data.tool || data.name || 'unknown';
                    pendingToolCall = { name: toolName, args: data.input || data.arguments || {} };
                    toolCalls = [...toolCalls, { name: toolName, args: data.input || data.arguments || {}, result: '执行中...', status: 'running' }];
                    updateMessage({ toolCalls: [...toolCalls] });
                  }

                  // 处理 tool 事件 - 显示工具执行结果（可能没有前置 tool_call）
                  if (currentEventType === 'tool_result' || currentEventType === 'tool') {
                    const toolName = data.tool || pendingToolCall?.name || 'unknown';
                    // 优先使用 data.arguments，其次使用 pendingToolCall?.args
                    const toolArgs = data.input || data.arguments || pendingToolCall?.args || {};
                    if (pendingToolCall && toolCalls.length > 0) {
                      // 更新最后一个 toolCall 的结果
                      toolCalls = toolCalls.map((tc, idx) =>
                        idx === toolCalls.length - 1
                          ? { ...tc, result: formatToolPayload(data.output !== undefined ? data.output : data.error), status: data.success === false ? 'error' : 'completed' }
                          : tc
                      );
                    } else {
                      // 没有 pendingToolCall，说明是独立的 tool 事件，直接添加
                      toolCalls = [...toolCalls, { name: toolName, args: toolArgs, result: formatToolPayload(data.output !== undefined ? data.output : data.error), status: data.success === false ? 'error' : 'completed' }];
                    }
                    pendingToolCall = null;
                    updateMessage({ toolCalls: [...toolCalls] });
                  }

                  if (currentEventType === 'interrupted') {
                    checkpointIdRef.current = data.checkpoint_id || checkpointIdRef.current;
                    const approvals = data.pending_approvals || [];
                    for (const approval of approvals) {
                      setPendingApprovals(prev => [...prev, {
                        id: approval.interrupt_id,
                        sessionId: data.checkpoint_id || sessionId,
                        messageId: userMessageUlid || '',
                        toolName: approval.tool_name,
                        toolType: approval.tool_type || '',
                        riskLevel: approval.risk_level || 'high',
                        parameters: approval.arguments_json ? JSON.parse(approval.arguments_json) : {},
                        status: 'pending',
                        timestamp: new Date()
                      }]);
                    }
                    updateMessage({ status: 'pending_approval' });
                  }

                  if (currentEventType === 'done') {
					streamCompleted = true;
                    streamTokenUsage = {
                      prompt_tokens: data.prompt_tokens,
                      completion_tokens: data.completion_tokens,
                      total_tokens: data.total_tokens
                    };
                    const rawFinalContent = data.content || accumulatedContent;
                    internalControlTagStripped ||= hasInternalControlTag(rawFinalContent);
                    invalidImagePlanningOutput ||= hasImagePlanningMarkup(rawFinalContent);
                    const finalContent = stripImagePlanningMarkup(stripInternalControlTags(rawFinalContent));
                    finalAssistantContent = finalContent;
                    const { html, markdown, reportUrl, pptUrl } = extractHtmlFromMarkdown(finalContent);
					const waiting = data.finish_reason === 'waiting_approval' || data.finish_reason === 'waiting_user';
					updateMessage({
					  ...(!waiting || finalContent ? { content: markdown || finalContent } : {}),
					  htmlContent: html || undefined, reportUrl: reportUrl || undefined, pptUrl: pptUrl || undefined,
					  status: data.finish_reason === 'waiting_approval' ? 'pending_approval' : 'completed', toolCalls: [...toolCalls]
					});
                  }

                  if (currentEventType === 'error') {
                    console.error('Stream error:', data.message || data.error);
					if (!streamErrorMessage) streamErrorMessage = data.message || data.error || 'Unknown error';
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              } else if (trimmedLine.startsWith('{')) {
                // Runner sends JSON directly after event line without "data: " prefix
                try {
                  const data = JSON.parse(trimmedLine);

                  // 处理 meta 事件 - 捕获 checkpoint_id
                  if (currentEventType === 'meta' && data.checkpoint_id) {
                    checkpointIdRef.current = data.checkpoint_id;
                    console.log('[SSE] checkpoint_id:', checkpointIdRef.current);
                  }

				  if (currentEventType === 'delta' && data.text) {
                    accumulatedContent += data.text;
                    updateMessage({ content: accumulatedContent });
				  }

				  if (currentEventType === 'action') {
					toolCalls = [...toolCalls, { actionId: data.action_id, name: data.capability || 'device.action', args: data.arguments || {}, result: 'Waiting for device observation...', status: 'running' }];
					updateMessage({
					  ...(data.arguments?.user_takeover && data.arguments?.message ? { content: String(data.arguments.message) } : {}),
					  toolCalls: [...toolCalls], status: data.policy?.decision === 'ASK_USER' ? 'pending_approval' : 'streaming',
					});
				  }

				  if (currentEventType === 'progress') {
					toolCalls = toolCallsWithProgress(toolCalls, data);
					updateMessage({ toolCalls: [...toolCalls] });
				  }

				  if (currentEventType === 'observation') {
					toolCalls = toolCallsWithObservation(toolCalls, data);
					updateMessage({ toolCalls: [...toolCalls] });
				  }

                  // 处理 recall_complete 事件
                  if (currentEventType === 'recall_complete') {
                    recallInfo = { status: 'completed', count: data.count, message: data.message };
                    updateMessage({ recallInfo });
                  }

                  // 处理 tool_call 事件
                  if (currentEventType === 'tool_call') {
                    pendingToolCall = { name: data.tool || data.name, args: data.input || data.arguments || {} };
                    toolCalls = [...toolCalls, { name: data.tool || data.name, args: data.input || data.arguments || {}, result: '执行中...', status: 'running' }];
                    updateMessage({ toolCalls: [...toolCalls] });
                  }

                  // 处理 tool 事件（可能没有前置 tool_call）
                  if (currentEventType === 'tool_result' || currentEventType === 'tool') {
                    const toolName = data.tool || pendingToolCall?.name || 'unknown';
                    const toolArgs = data.input || data.arguments || pendingToolCall?.args || {};
                    if (pendingToolCall && toolCalls.length > 0) {
                      toolCalls = toolCalls.map((tc, idx) =>
                        idx === toolCalls.length - 1
                          ? { ...tc, result: formatToolPayload(data.output !== undefined ? data.output : data.error), status: data.success === false ? 'error' : 'completed' }
                          : tc
                      );
                    } else {
                      toolCalls = [...toolCalls, { name: toolName, args: toolArgs, result: formatToolPayload(data.output !== undefined ? data.output : data.error), status: data.success === false ? 'error' : 'completed' }];
                    }
                    pendingToolCall = null;
                    updateMessage({ toolCalls: [...toolCalls] });
                  }

                  if (currentEventType === 'interrupted') {
                    checkpointIdRef.current = data.checkpoint_id || checkpointIdRef.current;
                    const approvals = data.pending_approvals || [];
                    for (const approval of approvals) {
                      setPendingApprovals(prev => [...prev, {
                        id: approval.interrupt_id,
                        sessionId: data.checkpoint_id || sessionId,
                        messageId: userMessageUlid || '',
                        toolName: approval.tool_name,
                        toolType: approval.tool_type || '',
                        riskLevel: approval.risk_level || 'high',
                        parameters: approval.arguments_json ? JSON.parse(approval.arguments_json) : {},
                        status: 'pending',
                        timestamp: new Date()
                      }]);
                    }
                    updateMessage({ status: 'pending_approval' });
                  }

                  if (currentEventType === 'done') {
					streamCompleted = true;
                    streamTokenUsage = {
                      prompt_tokens: data.prompt_tokens,
                      completion_tokens: data.completion_tokens,
                      total_tokens: data.total_tokens
                    };
                    const rawFinalContent = data.content || accumulatedContent;
                    internalControlTagStripped ||= hasInternalControlTag(rawFinalContent);
                    invalidImagePlanningOutput ||= hasImagePlanningMarkup(rawFinalContent);
                    const finalContent = stripImagePlanningMarkup(stripInternalControlTags(rawFinalContent));
                    finalAssistantContent = finalContent;
                    const { html, markdown, reportUrl, pptUrl } = extractHtmlFromMarkdown(finalContent);
					const waiting = data.finish_reason === 'waiting_approval' || data.finish_reason === 'waiting_user';
					updateMessage({
					  ...(!waiting || finalContent ? { content: markdown || finalContent } : {}),
					  htmlContent: html || undefined, reportUrl: reportUrl || undefined, pptUrl: pptUrl || undefined,
					  status: data.finish_reason === 'waiting_approval' ? 'pending_approval' : 'completed', toolCalls: [...toolCalls]
					});
                  }

                  if (currentEventType === 'error') {
                    console.error('Stream error:', data.message || data.error);
					if (!streamErrorMessage) streamErrorMessage = data.message || data.error || 'Unknown error';
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
		if (!streamCompleted && streamErrorMessage) {
			const failure = userInitiatedStopRef.current
				? t('chat.generationStopped')
				: `${t('chat.executionError')}: ${streamErrorMessage}`;
			accumulatedContent = accumulatedContent.trim()
				? `${accumulatedContent.trim()}\n\n${failure}`
				: failure;
			updateMessage({ content: accumulatedContent, status: 'failed' });
		}

		// 保存消息到数据库
		const rawCompletedContent = finalAssistantContent || accumulatedContent;
        internalControlTagStripped ||= hasInternalControlTag(rawCompletedContent);
        invalidImagePlanningOutput ||= hasImagePlanningMarkup(rawCompletedContent);
        const completedContent = stripImagePlanningMarkup(stripInternalControlTags(rawCompletedContent));
        // 记录本轮生成的图片（prompt 取本轮用户输入，url 取内容中的图片地址），
        // 便于刷新/切会话后仍能识别"上次画过图"。
        const generatedImageUrls = extractImageUrls(completedContent);
        const assistantMetadata = buildAssistantMetadata(
          generatedImageUrls,
          messageText,
          internalControlTagStripped,
          invalidImagePlanningOutput,
		  researchSnapshotFromToolCalls(toolCalls),
		  browserSnapshotsFromToolCalls(toolCalls),
        );
        updateMessage({ content: completedContent, metadata: assistantMetadata });
        try {
          await chatApi.createMessage({
            session_id: sessionId,
            role: 'assistant',
            content: completedContent,
            model: activeAgent.model || '',
            input_tokens: streamTokenUsage.prompt_tokens || 0,
            output_tokens: streamTokenUsage.completion_tokens || 0,
            total_tokens: streamTokenUsage.total_tokens || 0,
            status: 'completed',
            metadata: assistantMetadata
          });
        } catch (err) {
          console.error('Failed to save assistant message:', err);
        }

        setIsLoading(false);
        if ((voice.autoSpeak || voice.conversationMode) && completedContent.trim()) {
          voice.speak(completedContent, voice.conversationMode);
        }
        return
      }

      // 非流式响应处理
      const data = await runResponse.json();

      // Check if response indicates pending approval
      if (data.pending_approvals && data.pending_approvals.length > 0) {
        // Handle pending approvals from the response
        for (const approval of data.pending_approvals) {
          const pendingApproval: PendingApproval = {
            id: approval.interrupt_id,
            sessionId: data.checkpoint_id || sessionId,
            messageId: userMessageUlid || '',
            toolName: approval.tool_name,
            toolType: approval.tool_type || '',
            riskLevel: approval.risk_level || 'high',
            parameters: approval.arguments ? JSON.parse(approval.arguments) : {},
            status: 'pending',
            timestamp: new Date()
          };
          setPendingApprovals(prev => [...prev, pendingApproval]);
        }
      }

	  const rawAssistantMessage = data.content || data.output || "I'm sorry, I couldn't generate a response.";
      const nonStreamInternalTagStripped = hasInternalControlTag(rawAssistantMessage);
      const nonStreamInvalidImagePlanningOutput = hasImagePlanningMarkup(rawAssistantMessage);
      const assistantMessageRaw = stripImagePlanningMarkup(stripInternalControlTags(rawAssistantMessage));
      const { html, markdown, reportUrl, pptUrl } = extractHtmlFromMarkdown(assistantMessageRaw);
      const nonStreamImageUrls = extractImageUrls(assistantMessageRaw);
      const nonStreamMetadata = buildAssistantMetadata(
        nonStreamImageUrls,
        messageText,
        nonStreamInternalTagStripped,
        nonStreamInvalidImagePlanningOutput,
      );
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: markdown || assistantMessageRaw,
        htmlContent: html || undefined,
        reportUrl: reportUrl || undefined,
        pptUrl: pptUrl || undefined,
        timestamp: new Date(),
        thinking: data.thinking,
        trace: data.trace,
        status: data.status,
        metadata: nonStreamMetadata
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message to database
      try {
        await chatApi.createMessage({
          session_id: sessionId,
          role: 'assistant',
          content: assistantMessageRaw,
          model: data.metadata?.model || activeAgent.model || '',
          total_tokens: data.metadata?.tokens_used || 0,
          latency_ms: data.metadata?.latency_ms || 0,
          status: data.pending_approvals?.length > 0 ? 'pending_approval' : 'completed',
          trace: data.trace ? JSON.stringify({ thinking: data.thinking, trace: data.trace }) : undefined,
          metadata: nonStreamMetadata
        });
      } catch (err) {
        console.error('Failed to save assistant message:', err);
      }
      if (voice.autoSpeak || voice.conversationMode) {
        voice.speak(assistantMessageRaw, voice.conversationMode);
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || userInitiatedStopRef.current) {
        console.log("Generation stopped by user");
        return;
      }
      console.error("Runner Error:", error);
	  const detail = String(error?.message || error || t('chat.unknownError')).split('\n')[0].slice(0, 500);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
		content: `${t('chat.executionError')}: ${detail}`,
        timestamp: new Date()
      };
	  setMessages(prev => activeAssistantMessageId
		? prev.map(message => message.id === activeAssistantMessageId ? { ...message, content: errorMessage.content, status: 'failed' } : message)
		: [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  voiceSendRef.current = text => {
    void handleSend(text);
  };

  const stopGeneration = () => {
    console.log('[Stop] stopGeneration called, checkpointId:', checkpointIdRef.current, 'sessionId:', activeConversationId);
    userInitiatedStopRef.current = true;
    // 直接发送 stop 请求到后端（使用 session_id 来停止）
    void chatApi.stopAgent(checkpointIdRef.current || '', activeConversationId || '').then(() => {
      console.log('[Stop] Backend stop API success');
    }).catch(err => {
      console.error('[Stop] Backend stop API failed:', err);
    });
    // abort 前端的 fetch 请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setActiveConversationId(null);
    setCurrentSession(null);
  };

  const handleSelectAgent = (agent: Agent) => {
    const nextAgentId = agent.ulid || agent.id;
    if (nextAgentId === activeAgentId) {
      setIsAgentMenuOpen(false);
      return;
    }
    if (isLoading) {
      toast.error('请先停止当前回复，再切换 Agent');
      return;
    }
    voice.stopListening();
    voice.stopSpeaking();
    setActiveAgent(agent);
    setSearchQuery('');
    setIsAgentMenuOpen(false);
    startNewConversation();
  };

  const handleEditActiveAgent = async () => {
    if (!activeAgent || !onEditAgent || isOpeningAgentEditor) return;
    const agentId = activeAgent.ulid || activeAgent.id;
    if (!agentId) {
      toast.error(t('chat.editAgentLoadFailed'));
      return;
    }
    setIsOpeningAgentEditor(true);
    try {
      onEditAgent(await agentApi.findById(agentId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('chat.editAgentLoadFailed'));
    } finally {
      setIsOpeningAgentEditor(false);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await chatApi.deleteSession(id);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      startNewConversation();
    }
  };

  // Handle conversation selection
  const handleSelectConversation = async (conv: Conversation) => {
    try {
      const session = await chatApi.getSession(conv.id);
      const sessionAgent = agents.find(agent => (agent.ulid || agent.id) === session.agent_id);
      if (sessionAgent) setActiveAgent(sessionAgent);
      setCurrentSession(session);
      setActiveConversationId(conv.id);
      await loadSessionMessages(conv.id);
    } catch (err) {
      console.error('Failed to load session:', err);
      toast.error('无法加载该会话');
    }
  };

  const executeBrowserSuggestion = async (
    messageId: string,
    toolIndex: number,
    action: BrowserSuggestedAction,
    sessionId: string,
  ) => {
	if (!sessionId) {
	  toast.error(t('chat.browserActionSessionMissing'));
	  return;
	}
	if (browserSuggestionLocksRef.current.has(sessionId)) {
	  return;
	}
	browserSuggestionLocksRef.current.add(sessionId);
	setMessages(previous => previous.map(message => ({
	  ...message,
	  toolCalls: message.toolCalls?.map((tool, index) => {
		if (message.id === messageId && index === toolIndex) {
		  return {
			...tool,
			selectedSuggestionId: action.id,
			suggestionStatus: 'running',
			suggestionError: undefined,
		  };
		}
		return tool.observation?.session_id === sessionId
		  ? { ...tool, suggestedActions: [] }
		  : tool;
	  }),
	})));
	try {
	  const observation = await controlApi.executeSuggestedAction(action, sessionId);
	  const succeeded = observation.status === 'SUCCEEDED';
	  const suggestedActions = succeeded ? browserSuggestionsFromObservation(observation) : [];
	  const updatedContent = browserObservationSummary(observation, t);
	  setMessages(previous => previous.map(message => ({
		...message,
		...(message.id === messageId ? { content: updatedContent } : {}),
		toolCalls: message.toolCalls?.map((tool, index) => {
		  if (message.id === messageId && index === toolIndex) {
			return {
			  ...tool,
			  result: formatObservationResult(observation),
			  observation,
			  suggestedActions,
			  selectedSuggestionId: action.id,
			  suggestionStatus: succeeded ? 'completed' : 'error',
			  suggestionError: succeeded ? undefined : (observation.error || t('chat.browserActionFailed')),
			  status: succeeded ? 'completed' : 'error',
			};
		  }
		  return tool.observation?.session_id === sessionId
			? { ...tool, suggestedActions: [] }
			: tool;
		}),
	  })));
      if (!succeeded) {
        toast.error(observation.error || t('chat.browserActionFailed'));
      } else if (observation.state?.playback?.verified === true) {
        toast.success(t('chat.browserPlaybackVerified'));
      } else {
        toast.success(t('chat.browserActionSucceeded'));
      }
	} catch (error) {
      const message = error instanceof Error ? error.message : t('chat.browserActionFailed');
      setMessages(previous => previous.map(item => item.id !== messageId ? item : {
        ...item,
        toolCalls: item.toolCalls?.map((tool, index) => index !== toolIndex ? tool : {
          ...tool,
          selectedSuggestionId: action.id,
          suggestionStatus: 'error',
          suggestionError: message,
        }),
      }));
	  toast.error(message);
	} finally {
	  browserSuggestionLocksRef.current.delete(sessionId);
	}
  };

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="theme-canvas flex h-full overflow-hidden" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* History Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className={cn(
          "border-r border-slate-100 flex flex-col bg-slate-50/50 overflow-hidden shrink-0",
          !isSidebarOpen && "border-none"
        )}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between min-w-[280px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-slate-200 rounded-md transition-colors text-slate-500"
              title="收起侧边栏"
            >
              <PanelLeftClose size={18} />
            </button>
            <div>
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <History size={18} className="text-slate-400" />
                {t('chat.history')}
              </h2>
              <p className="mt-0.5 max-w-[160px] truncate pl-6 text-[10px] text-slate-400">
                {activeAgent ? `${activeAgent.name} · ${activeAgentConversations.length} 个会话` : '请先选择 Agent'}
              </p>
            </div>
          </div>
          <button
            onClick={startNewConversation}
            disabled={!activeAgent}
            className="p-1.5 hover:bg-slate-200 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            title="新建当前 Agent 的会话"
          >
            <Plus size={18} className="text-slate-600" />
          </button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('agents.search')}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-w-[280px]">
          {(() => {
            const filteredConvs = activeAgentConversations.filter(c =>
              c.title.toLowerCase().includes(searchQuery.toLowerCase())
            );
            if (filteredConvs.length === 0) {
              return (
                <div className="p-4 text-center">
                  <p className="text-xs text-slate-400">{searchQuery ? t('chat.noConversations') : t('chat.noConversations')}</p>
                </div>
              );
            }
            return filteredConvs.map(conv => (
              <div key={conv.id} className="group relative">
                <button
                  onClick={() => handleSelectConversation(conv)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-all flex flex-col gap-1",
                    activeConversationId === conv.id ? "bg-white shadow-sm border border-slate-200" : "hover:bg-white/50"
                  )}
                >
                  <p className="text-sm font-medium text-slate-700 truncate pr-6">{conv.title}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {conv.timestamp.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 rounded-md transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ));
          })()}
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="theme-header h-14 border-b border-slate-100 flex items-center justify-between px-4 lg:px-6 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3 min-w-0">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                title="展开侧边栏"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setIsAgentMenuOpen(current => !current)}
                className="flex max-w-[260px] items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-[11px] font-bold text-white shadow-sm shadow-brand-500/20">
                  {activeAgent ? getAgentIcon(activeAgent.icon || '', 15) : 'A'}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-bold text-slate-900 lg:text-sm">{activeAgent?.name || t('chat.selectAgent')}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("h-1.5 w-1.5 rounded-full", activeAgent ? "bg-emerald-500" : "bg-slate-300")} />
                    <span className="truncate text-[9px] font-medium text-slate-400">
                      {activeConversationId ? t('chat.historicalConversation') : t('chat.newConversation')}
                    </span>
                  </div>
                </div>
                <ChevronDown size={14} className={cn("shrink-0 text-slate-400 transition-transform", isAgentMenuOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isAgentMenuOpen && (
                  <>
                    <button type="button" aria-label="关闭 Agent 菜单" className="fixed inset-0 z-20 cursor-default" onClick={() => setIsAgentMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      className="absolute left-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                    >
                      <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('chat.switchAgent')}</p>
                      <div className="max-h-72 space-y-1 overflow-y-auto">
                        {agents.map(agent => {
                          const selected = (agent.ulid || agent.id) === activeAgentId;
                          const conversationCount = conversations.filter(item => item.agentId === (agent.ulid || agent.id)).length;
                          return (
                            <button
                              type="button"
                              key={agent.ulid || agent.id}
                              onClick={() => handleSelectAgent(agent)}
                              className={cn(
                                "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                                selected ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                              )}
                            >
                              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", selected ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500")}>
                                {getAgentIcon(agent.icon || '', 14)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-bold">{agent.name}</span>
                                <span className="block text-[10px] text-slate-400">{t('chat.conversationCount', { count: conversationCount })}</span>
                              </span>
                              {selected && <Check size={14} className="shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAgentMenuOpen(false);
                          onCreateAgent?.();
                        }}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <Plus size={13} />
                        {t('chat.createAgent')}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingApprovals.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold">
                <ShieldAlert size={14} />
                <span>{pendingApprovals.length}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleEditActiveAgent()}
              disabled={!activeAgent || !onEditAgent || isLoading || isOpeningAgentEditor}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              title={t('chat.editAgent')}
            >
              {isOpeningAgentEditor ? <Loader2 size={15} className="animate-spin" /> : <Settings size={15} />}
              <span className="hidden sm:inline">{isOpeningAgentEditor ? t('chat.editAgentLoading') : t('chat.editAgent')}</span>
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
              <MoreHorizontal size={20} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4 scrollbar-hide bg-slate-50/30"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 mb-4">
                <MessageSquare size={32} />
              </div>
              {agents.length === 0 ? (
                <>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">先创建一个 Agent</h2>
                  <p className="text-sm text-slate-500 mb-5">
                    聊天页只会使用你已经创建并启用的 Agent。创建后回到这里，就可以直接选择并开始对话。
                  </p>
                  <button
                    onClick={onCreateAgent}
                    className="px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20"
                  >
                    去创建 Agent
                  </button>
                </>
              ) : activeAgent ? (
                <>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{t('chat.startNew')}</h2>
                  <p className="text-sm text-slate-500">
                    Ask {activeAgent.name} anything. You can upload documents, images, or just start typing.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">请选择一个 Agent</h2>
                  <p className="text-sm text-slate-500">
                    从下方 Agent 列表选择一个已创建的 Agent，然后开始聊天。
                  </p>
                </>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={cn(
                "flex gap-4 max-w-4xl",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold",
                msg.role === 'user' ? "bg-slate-900 text-white" : "bg-brand-500 text-white"
              )}>
                {msg.role === 'user' ? 'U' : 'A'}
              </div>
              <div className={cn(
                "flex flex-col gap-3",
                msg.role === 'user' ? "items-end" : "items-start w-full"
              )}>
                {/* Thinking Process */}
                {msg.thinking && (
                  <div className="w-full max-w-2xl">
                    <button
                      onClick={() => setShowThinking(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                      className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-brand-500 transition-colors mb-2"
                    >
                      <Brain size={12} />
                      {showThinking[msg.id] ? "隐藏思考过程" : "查看思考过程"}
                      {showThinking[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <AnimatePresence>
                      {showThinking[msg.id] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 italic leading-relaxed mb-3">
                            {msg.thinking}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Tool Calls */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="w-full max-w-2xl space-y-2 mb-2">
                    {msg.toolCalls.map((tool, idx) => {
                      const toolKey = `${msg.id}-${idx}`;
                      const isCollapsed = collapsedTools[toolKey];
					  const isRunning = tool.status === 'running' || tool.result === '执行中...' || tool.suggestionStatus === 'running';
					  const isError = isToolResultError(tool.result, tool.status) || tool.suggestionStatus === 'error';
					  const isResearch = tool.name === 'research.execute';
					  const isBrowserExecution = hasBrowserExecution(tool.observation);
					  const progressStageLabel = isResearch && tool.progressStage
						? t(`chat.researchStages.${tool.progressStage}`, { defaultValue: tool.progressStage })
						: tool.progressStage || 'progress';
					  const progressMessage = isResearch && tool.progressStage
						? t(`chat.researchMessages.${tool.progressStage}`, { defaultValue: tool.progressMessage || '' })
						: tool.progressMessage || '';
                      return (
                        <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                          <div
                            className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-100/50 cursor-pointer hover:bg-slate-100/70 transition-colors"
                            onClick={() => {
                              setCollapsedTools(prev => ({
                                ...prev,
                                [toolKey]: !prev[toolKey]
                              }));
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <ChevronRight size={12} className={cn("text-slate-400 transition-transform", !isCollapsed && "rotate-90")} />
							  {isResearch ? <Search size={12} className="text-brand-500" /> : <Wrench size={12} className="text-brand-500" />}
							  <span className="text-[10px] font-bold text-slate-600">
								{isResearch ? t('chat.researchProgress') : tool.name}
                              </span>
                            </div>
                            {isRunning ? (
                              <div className="flex items-center gap-1 text-amber-500">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
								<span className="text-[10px]">{t('chat.running')}</span>
                              </div>
                            ) : isError ? (
                              <XCircle size={12} className="text-red-500" />
                            ) : (
                              <Check size={12} className="text-green-500" />
                            )}
                          </div>
                          {!isCollapsed && (
                            <div className="p-3 space-y-2">
							  {!isResearch && !isBrowserExecution && (
								<div className="space-y-1">
								  <div className="flex items-center gap-1 text-[9px] text-slate-400 uppercase font-medium">
									<Terminal size={10} /> {t('chat.input')}
								  </div>
								  <code className="block text-[10px] text-slate-600 bg-white px-2 py-1.5 rounded border border-slate-100 font-mono">
									{JSON.stringify(tool.args, null, 2)}
								  </code>
								</div>
							  )}
                              {typeof tool.progress === 'number' && (
                                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                  <div className="flex items-center justify-between text-[9px] font-bold uppercase text-slate-400">
									<span>{progressStageLabel}</span>
                                    <span>{Math.max(0, Math.min(100, tool.progress))}%</span>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                                    <div
                                      className={cn(
                                        'h-full rounded-full transition-all duration-500',
                                        isError ? 'bg-red-400' : isRunning ? 'bg-amber-400' : 'bg-green-500'
                                      )}
                                      style={{ width: `${Math.max(3, Math.min(100, tool.progress))}%` }}
                                    />
                                  </div>
								  {(progressMessage || tool.bytes) && (
									<div className="text-[10px] text-slate-500">
									  {progressMessage}
									  {tool.bytes ? `${progressMessage ? ' · ' : ''}${formatBytes(tool.bytes)}${tool.total ? ` / ${formatBytes(tool.total)}` : ''}` : ''}
									</div>
								  )}
								  {isResearch && (
									<div className="flex flex-wrap gap-1.5 text-[9px] font-semibold text-slate-500">
									  {typeof tool.searchQueries === 'number' && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-100">{t('chat.researchQueries')}: {tool.searchQueries}</span>}
									  {typeof tool.researchSources === 'number' && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-100">{t('chat.researchSources')}: {tool.researchSources}</span>}
									  {typeof tool.researchConfidence === 'number' && tool.researchConfidence > 0 && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-100">{t('chat.researchConfidence')}: {Math.round(tool.researchConfidence * 100)}%</span>}
									</div>
								  )}
								</div>
							  )}
							  {isBrowserExecution && tool.observation && (
								<BrowserExecutionPanel observation={tool.observation} />
							  )}
							  {tool.result && !isResearch && (!isBrowserExecution || isError) && (
                                <div className="space-y-1 pt-2 border-t border-slate-100">
                                  <div className="flex items-center gap-1 text-[9px] text-slate-400 uppercase font-medium">
                                    {isRunning ? (
                                      <Clock size={10} className="text-amber-500" />
                                    ) : isError ? (
                                      <XCircle size={10} className="text-red-500" />
                                    ) : (
                                      <CheckSquare size={10} className="text-green-500" />
                                    )}
                                    {t('chat.output')}
                                  </div>
                                  <code className="block text-[10px] text-slate-600 bg-white px-2 py-1.5 rounded border border-slate-100 font-mono max-h-32 overflow-auto">
                                    {formatToolPayload(tool.result)}
                                  </code>
                                </div>
                              )}
                            </div>
                          )}
						  {isResearch && tool.researchPages && tool.researchPages.length > 0 && (
							<ResearchSourcesPanel
							  pages={tool.researchPages}
							  queryTexts={tool.researchQueryTexts}
							  confidence={tool.researchConfidence}
							/>
						  )}
						  {tool.suggestedActions && tool.suggestedActions.length > 0 && (
							<div className="border-t border-slate-100 bg-white px-3 py-3">
							  <div className="mb-2 flex items-center justify-between gap-2">
								<div>
								  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('chat.browserSuggestedActions')}</div>
								  <div className="mt-0.5 text-[10px] text-slate-400">{t('chat.browserSuggestedActionsHint')}</div>
								</div>
								{tool.observation?.state?.playback?.verified === true && (
								  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">
									<Check size={10} /> {t('chat.browserPlaybackVerified')}
								  </span>
								)}
							  </div>
							  <div className="grid gap-2 sm:grid-cols-2">
								{tool.suggestedActions.map(action => {
								  const selected = tool.selectedSuggestionId === action.id;
								  const running = selected && tool.suggestionStatus === 'running';
								  const interactionLocked = isLoading || tool.suggestionStatus === 'running';
								  return (
									<button
									  key={action.id}
									  type="button"
									  disabled={interactionLocked}
									  onClick={() => void executeBrowserSuggestion(msg.id, idx, action, tool.observation?.session_id || '')}
									  className={cn(
										'group flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all disabled:cursor-wait disabled:opacity-60',
										selected && tool.suggestionStatus === 'completed'
										  ? 'border-emerald-200 bg-emerald-50/70'
										  : selected && tool.suggestionStatus === 'error'
											? 'border-red-200 bg-red-50/70'
											: 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/50',
									  )}
									>
									  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm ring-1 ring-slate-100">
										{running ? <Loader2 size={15} className="animate-spin" /> : action.kind === 'media' ? <Play size={15} /> : <ChevronRight size={15} />}
									  </span>
									  <span className="min-w-0 flex-1">
										<span className="block truncate text-[11px] font-bold text-slate-700">{action.label}</span>
										{action.description && <span className="mt-0.5 block line-clamp-2 text-[9px] leading-3 text-slate-400">{action.description}</span>}
									  </span>
									</button>
								  );
								})}
							  </div>
							  {tool.suggestionError && <div className="mt-2 text-[10px] font-medium text-red-600">{tool.suggestionError}</div>}
							</div>
						  )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className={cn(
                  "p-3 lg:p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                  msg.role === 'user'
                    ? "bg-slate-900 text-white rounded-tr-none w-full max-w-2xl"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-none w-fit w-full max-w-2xl"
                )}>
                  {msg.role === 'assistant' ? (
                    msg.status === 'streaming' ? (
                      <div className="text-slate-800 whitespace-pre-wrap">{stripImagePlanningMarkup(stripInternalControlTags(msg.content)) || t('chat.solving')}</div>
                    ) : (
                      <MessageContent
                        content={msg.content}
                        htmlContent={msg.htmlContent}
                        reportUrl={msg.reportUrl}
                        pptUrl={msg.pptUrl}
                        onClarificationAnswer={answer => void handleSend(answer)}
                      />
                    )
                  ) : (
                    msg.content
                  )}

                  {/* Media Content */}
                  <div className="space-y-3 mt-3">
                    {msg.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-100">
                        <img src={msg.imageUrl} alt="Generated content" className="w-full h-auto" referrerPolicy="no-referrer" />
                      </div>
                    )}

                    {msg.videoUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-100 bg-black aspect-video">
                        <video src={msg.videoUrl} controls className="w-full h-full" />
                      </div>
                    )}

                    {msg.audioUrl && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white">
                          <Volume2 size={16} />
                        </div>
                        <audio src={msg.audioUrl} controls className="h-8 flex-1" />
                      </div>
                    )}
                  </div>

                  {/* a2ui Dashboard Demo */}
                  {msg.a2ui?.type === 'dashboard' && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                          <BarChart3 size={14} className="text-brand-500" />
                          {msg.a2ui.data.title}
                        </h4>
                        <div className="flex items-center gap-2">
                          {msg.trace && (
                            <button
                              onClick={() => {
                                setSelectedMessageId(msg.id);
                                setIsTraceOpen(true);
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-slate-400 transition-colors"
                              title="查看执行追踪"
                            >
                              <Search size={12} />
                            </button>
                          )}
                          <ExternalLink size={12} className="text-slate-400" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {msg.a2ui.data.metrics.map((m: any, i: number) => (
                          <div key={i} className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                            <p className="text-[8px] text-slate-400 uppercase font-bold mb-1">{m.label}</p>
                            <p className="text-sm font-bold text-slate-900">{m.value}</p>
                            <p className={cn(
                              "text-[8px] font-bold mt-1",
                              m.trend.startsWith('+') ? "text-green-500" : "text-red-500"
                            )}>{m.trend}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.files && msg.files.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.files.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-white/10 rounded-lg border border-white/10">
                          <Paperclip size={12} />
                          <span className="text-[10px] truncate max-w-[100px]">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Trace Trigger for non-a2ui messages */}
                  {msg.role === 'assistant' && msg.trace && !msg.a2ui && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => {
                          setSelectedMessageId(msg.id);
                          setIsTraceOpen(true);
                        }}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-brand-500 hover:text-brand-600 uppercase tracking-wider"
                      >
                        <Search size={12} />
                        查看执行追踪
                      </button>
                    </div>
                  )}
                </div>
                {isLoading && msg.id === messages[messages.length - 1]?.id && msg.role === 'user' && (
                  <div className="flex gap-1 mt-1">
                    <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {msg.role === 'assistant' && msg.status !== 'streaming' && msg.content && (
                    <button
                      type="button"
                      onClick={() => voice.isSpeaking ? voice.stopSpeaking() : voice.speak(msg.content)}
                      className={cn(
                        "p-1 rounded-md transition-colors",
                        voice.isSpeaking ? "text-emerald-600 bg-emerald-50" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      )}
					  title={voice.isSpeaking ? t('voiceCall.stopReading') : t('voiceCall.readReply')}
                    >
                      <Volume2 size={12} />
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Pending Approvals Cards */}
          {pendingApprovals.length > 0 && (
            <div className="space-y-4 mt-4">
              {pendingApprovals.map(approval => (
                <div
                  key={approval.id}
                  className="bg-white rounded-2xl border border-amber-200 p-6 shadow-lg shadow-amber-100/50"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold">
                        <ShieldAlert size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">待审批请求</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                          <Clock size={10} />
                          {approval.timestamp.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                      待审批
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-900 mb-2">
                      <ShieldAlert size={16} className="text-amber-500" />
                      <span className="text-sm font-bold">工具: {approval.toolName}</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      风险等级: <span className={approval.riskLevel === 'high' ? 'text-red-500 font-bold' : 'text-amber-500 font-bold'}>{approval.riskLevel.toUpperCase()}</span>
                    </p>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">参数</p>
                      <div className="bg-white rounded-lg border border-slate-200 p-3 font-mono text-xs text-slate-700">
                        <pre>{JSON.stringify(approval.parameters, null, 2)}</pre>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => handleApproval(approval.id, 'rejected')}
                      className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                    >
                      <XCircle size={16} />
                      拒绝
                    </button>
                    <button
                      onClick={() => handleApproval(approval.id, 'approved')}
                      className="flex items-center gap-2 px-6 py-2 bg-brand-500 text-white rounded-lg text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20"
                    >
                      <UserCheck size={16} />
                      批准
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 lg:p-6 bg-white border-t border-slate-100">
          <input
            ref={avatarUploadRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          {voice.avatarEnabled && (voice.conversationMode || voice.isListening || voice.isSpeaking) && (
            <VoiceCallStage
              source={avatarSource}
              selectedId={voice.avatarId}
              presets={AVATAR_PRESETS}
              customAvatars={customAvatars.avatars}
              onSelectAvatar={voice.setAvatarId}
              isListening={voice.isListening}
              isSpeaking={voice.isSpeaking}
              isThinking={isLoading}
              liveTranscript={liveTranscript}
              speakingText={voice.speakingText}
              voiceError={voice.voiceError}
              agentName={activeAgent?.name}
              onToggleMic={() => (voice.isListening ? voice.stopListening() : voice.startListening())}
              onStopSpeaking={voice.stopSpeaking}
              onEndCall={() => {
                voice.setConversationMode(false);
				voice.stopAll();
              }}
              onOpenSettings={() => setIsVoiceSettingsOpen(true)}
              onUploadAvatar={() => avatarUploadRef.current?.click()}
              onRemoveAvatar={(id) => {
                void customAvatars.removeAvatar(id);
                if (voice.avatarId === id) voice.setAvatarId(AVATAR_PRESETS[0].id);
              }}
            />
          )}
          {(voice.isListening || voice.isSpeaking || voice.voiceError) && (
            <div className={cn(
              "max-w-4xl mx-auto mb-3 px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2",
              voice.voiceError ? "bg-red-50 text-red-600" : voice.isListening ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
            )}>
              {voice.isListening ? <Mic size={14} className="animate-pulse" /> : <Volume2 size={14} />}
			  <span>{voice.voiceError || (voice.isListening ? t('voiceCall.listeningBanner') : t('voiceCall.speakingBanner'))}</span>
              <button
                type="button"
				onClick={() => {
					voice.setConversationMode(false);
					voice.stopAll();
				}}
                className="ml-auto font-bold hover:opacity-70"
              >
				{t('voiceCall.stop')}
              </button>
            </div>
          )}
          <AnimatePresence>
            {(files.length > 0 || localFileRoots.length > 0) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 flex flex-wrap gap-2"
              >
                {files.map((file, i) => (
                  <div key={i} className="group relative flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <Paperclip size={14} className="text-slate-400" />
                    <span className="text-xs text-slate-600 truncate max-w-[150px]">{file.name}</span>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
				{localFileRoots.map(root => (
				  <div key={root} className="group relative flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
					<FolderSearch size={14} className="text-emerald-600" />
					<span className="text-xs text-emerald-800 truncate max-w-[240px]" title={root}>{root}</span>
					<button
					  type="button"
					  onClick={() => setLocalFileRoots(current => current.filter(item => item !== root))}
					  className="p-1 hover:bg-emerald-100 rounded-full text-emerald-500 hover:text-red-500 transition-colors"
					  title={t('chat.localFolderRemove')}
					>
					  <XCircle size={12} />
					</button>
				  </div>
				))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative group w-full max-w-4xl mx-auto">
            <div className="relative bg-white border border-slate-200 rounded-[24px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all">
              <AnimatePresence>
                {isVoiceSettingsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    className="absolute bottom-full left-0 mb-3 z-40 w-[min(360px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
						<h3 className="text-sm font-bold text-slate-900">{t('voiceCall.voiceStyle')}</h3>
						<p className="text-[11px] text-slate-400 mt-0.5">{t('voiceCall.voiceStyleHint')}</p>
                      </div>
                      <button type="button" onClick={() => setIsVoiceSettingsOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                        <XCircle size={16} />
                      </button>
                    </div>

                    <div className="space-y-4">
					  <label className="block space-y-1.5">
						<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('voiceCall.languageLabel')}</span>
						<select
						  value={voiceLanguage}
						  onChange={event => setVoiceLanguage(event.target.value)}
						  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-emerald-400"
						>
						  <option value="en-US">English (United States)</option>
						  <option value="en-GB">English (United Kingdom)</option>
						  <option value="zh-CN">中文（普通话）</option>
						  <option value="zh-TW">中文（台灣）</option>
						  <option value="ja-JP">日本語</option>
						</select>
					  </label>
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('voiceCall.avatarLabel')}</span>
                        <div className="grid grid-cols-4 gap-2">
                          {AVATAR_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => voice.setAvatarId(preset.id)}
                              title={t(`voiceCall.avatars.${preset.id}`)}
                              className={cn(
                                "flex flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors",
                                voice.avatarId === preset.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                              )}
                            >
                              <span
                                className="h-9 w-9 rounded-full border border-white shadow-inner"
                                style={{ background: `radial-gradient(circle at 50% 34%, ${preset.skin} 0 42%, ${preset.hair} 43% 62%, ${preset.cloth} 63%)` }}
                              />
                              <span className="text-[9px] font-semibold text-slate-500 truncate w-full text-center">{t(`voiceCall.avatars.${preset.id}`)}</span>
                            </button>
                          ))}
                        </div>

                        {customAvatars.avatars.length > 0 && (
                          <div className="grid grid-cols-4 gap-2 pt-1">
                            {customAvatars.avatars.map(item => (
                              <div
                                key={item.id}
                                className={cn(
                                  "group relative flex flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors cursor-pointer",
                                  voice.avatarId === item.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                                )}
                                onClick={() => voice.setAvatarId(item.id)}
                              >
                                <span className="h-9 w-9 rounded-full border border-white shadow-inner overflow-hidden">
                                  {item.kind === 'video'
                                    ? <video src={item.url} muted playsInline className="h-full w-full object-cover" />
                                    : <img src={item.url} alt={item.name} className="h-full w-full object-cover" />}
                                </span>
                                <span className="text-[9px] font-semibold text-slate-500 truncate w-full text-center">{item.name}</span>
                                <button
                                  type="button"
                                  onClick={event => { event.stopPropagation(); void customAvatars.removeAvatar(item.id); if (voice.avatarId === item.id) voice.setAvatarId(AVATAR_PRESETS[0].id); }}
                                  title={t('common.confirmDelete')}
                                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 shadow hover:text-red-500"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => avatarUploadRef.current?.click()}
                          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-[11px] font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                        >
                          <ImageIcon size={13} />
                          {t('voiceCall.uploadReal')}
                        </button>
                      </div>

                      <label className="block space-y-1.5">
						<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('voiceCall.voiceLabel')}</span>
                        <select
                          value={voice.selectedVoiceURI}
                          onChange={event => voice.setSelectedVoiceURI(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-emerald-400"
                        >
						  {voice.voices.length === 0 && <option value="">{t('voiceCall.systemDefaultVoice')}</option>}
                          {voice.voices.map(item => {
                            const highQuality = /natural|neural|premium|enhanced|高质量/i.test(item.name);
                            return (
                              <option key={item.voiceURI} value={item.voiceURI}>
                                {highQuality ? '★ ' : ''}{item.name} · {item.lang}
                              </option>
                            );
                          })}
                        </select>
                      </label>

                      <label className="block space-y-1.5">
                        <span className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
						  <span>{t('voiceCall.speed')}</span><span>{voice.speechRate.toFixed(2)}x</span>
                        </span>
                        <input
                          type="range"
                          min="0.7"
                          max="1.3"
                          step="0.05"
                          value={voice.speechRate}
                          onChange={event => voice.setSpeechRate(Number(event.target.value))}
                          className="w-full accent-emerald-500"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
						  <span>{t('voiceCall.pitch')}</span><span>{voice.speechPitch.toFixed(2)}</span>
                        </span>
                        <input
                          type="range"
                          min="0.75"
                          max="1.25"
                          step="0.05"
                          value={voice.speechPitch}
                          onChange={event => voice.setSpeechPitch(Number(event.target.value))}
                          className="w-full accent-emerald-500"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
						  <span>{t('voiceCall.silenceDelay')}</span><span>{t('voiceCall.seconds', { value: (voice.silenceTimeoutMs / 1000).toFixed(1) })}</span>
                        </span>
                        <input
                          type="range"
                          min="700"
                          max="3000"
                          step="100"
                          value={voice.silenceTimeoutMs}
                          onChange={event => voice.setSilenceTimeoutMs(Number(event.target.value))}
                          className="w-full accent-emerald-500"
                        />
                        <span className="block text-[10px] leading-relaxed text-slate-400">
						  {t('voiceCall.silenceHint')}
                        </span>
                      </label>

                      <button
                        type="button"
						onClick={() => voice.isSpeaking ? voice.stopSpeaking() : voice.speak(t('voiceCall.previewText'))}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
                      >
                        <Volume2 size={14} />
						{voice.isSpeaking ? t('voiceCall.stopPreview') : t('voiceCall.preview')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <textarea
                value={input}
                onChange={(e) => {
                  inputRef.current = e.target.value;
                  setInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={!activeAgent || agents.length === 0}
                placeholder={agents.length === 0 ? '请先创建 Agent' : activeAgent ? t('chat.placeholder') : '请选择一个 Agent'}
                className="w-full bg-transparent border-none focus:ring-0 outline-none focus:outline-none text-base p-4 pb-1 resize-none min-h-[50px] max-h-32 scrollbar-hide"
              />

              <div className="flex items-center justify-between px-4 pb-4">
                <div className="flex items-center gap-1 flex-1 mr-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!voice.supported) {
						toast.error(t('voiceCall.unsupportedRecognition'));
                        return;
                      }
                      if (voice.isListening) voice.stopListening();
                      else voice.startListening();
                    }}
                    disabled={!activeAgent || agents.length === 0 || isLoading}
                    className={cn(
                      "relative p-1.5 rounded-full transition-all shrink-0",
                      voice.isListening
                        ? "bg-rose-500 text-white shadow-md shadow-rose-200"
                        : activeAgent && agents.length > 0 && !isLoading
                          ? "hover:bg-slate-50 text-slate-600"
                          : "text-slate-300 cursor-not-allowed"
                    )}
					title={voice.isListening ? t('voiceCall.inputStop') : t('voiceCall.inputStart')}
                  >
                    {voice.isListening && <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-30" />}
                    <Mic size={16} className="relative" />
                  </button>

                  <button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={!activeAgent || agents.length === 0}
                    className={cn(
                      "p-1.5 rounded-full transition-colors shrink-0",
                      activeAgent && agents.length > 0 ? "hover:bg-slate-50 text-slate-600" : "text-slate-300 cursor-not-allowed"
                    )}
                  >
                    <Paperclip size={16} />
                  </button>

				  <button
					type="button"
					onClick={() => void authorizeLocalFolder()}
					disabled={!activeAgent || agents.length === 0 || !desktopBridgeAvailable}
					className={cn(
					  "p-1.5 rounded-full transition-colors shrink-0",
					  localFileRoots.length > 0 ? "bg-emerald-50 text-emerald-600" : activeAgent && agents.length > 0 && desktopBridgeAvailable ? "hover:bg-slate-50 text-slate-600" : "text-slate-300 cursor-not-allowed"
					)}
					title={desktopBridgeAvailable ? t('chat.localFolderAuthorize') : t('chat.localFolderRemoteUnavailable')}
				  >
					<FolderSearch size={16} />
				  </button>

                  <div className="h-4 w-px bg-slate-100 shrink-0" />

                  <button
                    type="button"
                    onClick={() => {
                      if (!voice.synthesisSupported) {
						toast.error(t('voiceCall.unsupportedSynthesis'));
                        return;
                      }
                      if (voice.isSpeaking) voice.stopSpeaking();
                      voice.setAutoSpeak(!voice.autoSpeak);
                    }}
                    className={cn(
                      "p-1.5 rounded-full transition-colors shrink-0",
                      voice.autoSpeak ? "bg-emerald-50 text-emerald-600" : "text-slate-500 hover:bg-slate-50"
                    )}
					title={voice.autoSpeak ? t('voiceCall.autoReadOff') : t('voiceCall.autoReadOn')}
                  >
                    <Volume2 size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!voice.synthesisSupported) {
						toast.error(t('voiceCall.unsupportedSynthesis'));
                        return;
                      }
                      setIsVoiceSettingsOpen(current => !current);
                    }}
                    className={cn(
                      "p-1.5 rounded-full transition-colors shrink-0",
                      isVoiceSettingsOpen ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
                    )}
					title={t('voiceCall.chooseStyle')}
                  >
                    <Settings size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !voice.conversationMode;
                      voice.setConversationMode(next);
                      if (!next) {
                        voice.stopListening();
                        voice.stopSpeaking();
                      } else {
                        voice.stopSpeaking();
                        window.setTimeout(() => voice.startListening(), 0);
                      }
                    }}
                    disabled={!voice.supported || !voice.synthesisSupported || !activeAgent}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors",
                      voice.conversationMode
                        ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                        : "text-slate-500 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed"
                    )}
					title={t('voiceCall.continuousHint')}
                  >
                    <Podcast size={12} />
					<span className="hidden sm:inline">{t('voiceCall.continuous')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => voice.setAvatarEnabled(!voice.avatarEnabled)}
                    disabled={!voice.synthesisSupported}
                    title={voice.avatarEnabled ? t('voiceCall.avatarOff') : t('voiceCall.avatarOn')}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors",
                      voice.avatarEnabled
                        ? "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200"
                        : "text-slate-500 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed"
                    )}
                  >
                    <UserRound size={12} />
                    <span className="hidden sm:inline">{t('voiceCall.simulatePerson')}</span>
                  </button>
                </div>

                <button
                  onClick={() => isLoading ? stopGeneration() : void handleSend()}
                  disabled={!isLoading && (!activeAgent || agents.length === 0 || (!input.trim() && files.length === 0))}
                  aria-disabled={!activeAgent || agents.length === 0}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0",
                    isLoading
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95"
                      : activeAgent && agents.length > 0 && (input.trim() || files.length > 0)
                        ? "bg-brand-600 text-white shadow-lg shadow-brand-500/20 hover:scale-105 active:scale-95"
                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <div className="w-3 h-3 bg-white rounded-sm" />
                  ) : (
                    <ArrowUp size={18} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <input
            id="file-upload"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                onDrop(Array.from(e.target.files));
              }
            }}
          />
        </div>

        {isDragActive && (
          <div className="absolute inset-0 bg-brand-500/10 backdrop-blur-sm border-2 border-dashed border-brand-500 z-50 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-brand-500 text-white flex items-center justify-center mb-4 animate-bounce">
              <Plus size={40} />
            </div>
            <h2 className="text-2xl font-bold text-brand-600">{t('chat.dropFiles')}</h2>
            <p className="text-brand-500/70">{t('chat.dropSubtitle')}</p>
          </div>
        )}
      </div>

      {/* Trace Sidebar */}
      <AnimatePresence>
        {isTraceOpen && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="w-[400px] border-l border-slate-200 bg-white flex flex-col shrink-0 z-30 shadow-2xl"
          >
            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Search size={18} className="text-brand-500" />
                <h3 className="font-bold text-slate-900">执行追踪 (Tracing)</h3>
              </div>
              <button
                onClick={() => setIsTraceOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400"
              >
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {messages.find(m => m.id === selectedMessageId)?.trace?.map((step, idx) => (
                <div key={step.id} className="relative pl-8">
                  {/* Timeline Line */}
                  {idx !== (messages.find(m => m.id === selectedMessageId)?.trace?.length || 0) - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-slate-100" />
                  )}

                  {/* Step Icon */}
                  <div className={cn(
                    "absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center z-10",
                    step.status === 'success' ? "bg-green-500 text-white" : "bg-brand-500 text-white"
                  )}>
                    {step.type === 'thought' && <Brain size={12} />}
                    {step.type === 'tool' && <Wrench size={12} />}
                    {step.type === 'skill' && <Zap size={12} />}
                    {step.type === 'observation' && <Eye size={12} />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {step.label}
                      </span>
                      {step.duration && (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {step.duration}
                        </span>
                      )}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed">
                      {step.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
