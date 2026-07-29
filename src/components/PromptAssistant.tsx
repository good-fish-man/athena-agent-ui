import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Send, Wand2, Check, Square, RefreshCw, Bot, User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { promptAssistantApi, type PromptAssistantMessage } from '../lib/api';

type ModelOption = { id: string; name: string };

type PromptAssistantProps = {
  open: boolean;
  onClose: () => void;
  models: ModelOption[];
  defaultModelId: string;
  userId: string;
  currentPrompt: string;
  onApply: (prompt: string, mode: 'replace' | 'append') => void;
};

type Turn = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
};

const FINAL_OPEN = '<FINAL_PROMPT>';
const FINAL_CLOSE = '</FINAL_PROMPT>';

function extractFinalPrompt(text: string): string | null {
  const start = text.indexOf(FINAL_OPEN);
  if (start === -1) return null;
  const bodyStart = start + FINAL_OPEN.length;
  const end = text.indexOf(FINAL_CLOSE, bodyStart);
  const body = end === -1 ? text.slice(bodyStart) : text.slice(bodyStart, end);
  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Strip the FINAL_PROMPT markers for display so the raw markup isn't shown to the user.
function displayContent(text: string): string {
  return text.split(FINAL_OPEN).join('').split(FINAL_CLOSE).join('').trim();
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PromptAssistant(props: PromptAssistantProps) {
  const { t } = useTranslation();
  const [modelId, setModelId] = React.useState('');
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState('');
  const [finalPrompt, setFinalPrompt] = React.useState<string | null>(null);
  const [showReplaceChoice, setShowReplaceChoice] = React.useState(false);

  const sessionIdRef = React.useRef<string>(`prompt-assistant-${newId()}`);
  const abortRef = React.useRef<AbortController | null>(null);
  const turnsRef = React.useRef<Turn[]>([]);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const startedRef = React.useRef(false);

  turnsRef.current = turns;

  const hasModels = props.models.length > 0;

  React.useEffect(() => {
    if (!props.open) return;
    setModelId(prev => prev || props.defaultModelId || props.models[0]?.id || '');
  }, [props.open, props.defaultModelId, props.models]);

  const scrollToBottom = React.useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const runTurn = React.useCallback(async (text: string, hidden: boolean) => {
    if (!modelId) {
      setError(t('promptAssistant.noModels'));
      return;
    }
    setError('');
    const priorMessages: PromptAssistantMessage[] = turnsRef.current.map(turn => ({
      role: turn.role,
      content: turn.content,
    }));
    const messages: PromptAssistantMessage[] = [
      { role: 'system', content: t('promptAssistant.metaPrompt') },
      ...priorMessages,
    ];

    const assistantId = newId();
    setTurns(current => [
      ...current,
      { id: newId(), role: 'user', content: text, hidden },
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    scrollToBottom();

    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const updateAssistant = (content: string) => {
      setTurns(current => current.map(turn => (turn.id === assistantId ? { ...turn, content } : turn)));
    };

    let accumulated = '';
    try {
      const res = await promptAssistantApi.stream({
        modelId,
        messages,
        prompt: text,
        userId: props.userId,
        sessionId: sessionIdRef.current,
        signal: controller.signal,
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('no stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            let data: any;
            try {
              data = JSON.parse(trimmed.slice(6).trim());
            } catch {
              continue;
            }
            if (currentEvent === 'delta' && data.text) {
              accumulated += data.text;
              updateAssistant(accumulated);
              scrollToBottom();
            } else if (currentEvent === 'done') {
              accumulated = data.content || accumulated;
              updateAssistant(accumulated);
            } else if (currentEvent === 'error') {
              throw new Error(data.message || data.error || 'stream error');
            }
          }
        }
      }
      const found = extractFinalPrompt(accumulated);
      if (found) setFinalPrompt(found);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User stopped; keep whatever streamed so far.
      } else {
        setError(t('promptAssistant.error'));
        setTurns(current => current.filter(turn => turn.id !== assistantId || turn.content.length > 0));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      scrollToBottom();
    }
  }, [modelId, props.userId, scrollToBottom, t]);

  // Kick off the interview automatically the first time the wizard opens.
  React.useEffect(() => {
    if (props.open && !startedRef.current && hasModels && modelId) {
      startedRef.current = true;
      void runTurn(t('promptAssistant.opening'), true);
    }
  }, [props.open, hasModels, modelId, runTurn, t]);

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    void runTurn(text, false);
  };

  const handleGenerate = () => {
    if (streaming) return;
    void runTurn(t('promptAssistant.generateInstruction'), true);
  };

  const handleReset = () => {
    stop();
    startedRef.current = false;
    sessionIdRef.current = `prompt-assistant-${newId()}`;
    setTurns([]);
    setFinalPrompt(null);
    setError('');
    setInput('');
  };

  const applyWithMode = (mode: 'replace' | 'append') => {
    if (!finalPrompt) return;
    props.onApply(finalPrompt, mode);
    toast.success(t('promptAssistant.applied'));
    setShowReplaceChoice(false);
    props.onClose();
  };

  const handleApply = () => {
    if (!finalPrompt) return;
    if (props.currentPrompt.trim().length > 0) {
      setShowReplaceChoice(true);
    } else {
      applyWithMode('replace');
    }
  };

  const visibleTurns = turns.filter(turn => !turn.hidden);

  return (
    <AnimatePresence>
      {props.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) props.onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{t('promptAssistant.title')}</h3>
                  <p className="text-[11px] text-slate-400">{t('promptAssistant.subtitle')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleReset}
                  title={t('promptAssistant.reset')}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  type="button"
                  onClick={props.onClose}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Model picker */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('promptAssistant.modelLabel')}</span>
              <select
                value={modelId}
                onChange={event => setModelId(event.target.value)}
                disabled={!hasModels}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-60"
              >
                {!hasModels && <option value="">{t('promptAssistant.noModels')}</option>}
                {props.models.map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>

            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {!hasModels && (
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">{t('promptAssistant.noModels')}</div>
              )}
              {visibleTurns.map(turn => (
                <div key={turn.id} className={cn('flex gap-3', turn.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                  <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', turn.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-600')}>
                    {turn.role === 'user' ? <UserIcon size={15} /> : <Bot size={15} />}
                  </div>
                  <div className={cn('max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed', turn.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-800')}>
                    {turn.role === 'assistant' && !turn.content && streaming
                      ? <span className="text-slate-400">{t('promptAssistant.thinking')}</span>
                      : displayContent(turn.content) || (turn.role === 'assistant' ? '…' : turn.content)}
                  </div>
                </div>
              ))}
              {error && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-600">{error}</div>}
            </div>

            {/* Apply bar */}
            {finalPrompt && !showReplaceChoice && (
              <div className="flex items-center justify-between gap-3 border-t border-emerald-100 bg-emerald-50/70 px-5 py-3">
                <span className="truncate text-xs text-emerald-800">{finalPrompt.slice(0, 80)}{finalPrompt.length > 80 ? '…' : ''}</span>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600"
                >
                  <Check size={14} />
                  {t('promptAssistant.apply')}
                </button>
              </div>
            )}

            {/* Replace / append choice */}
            {finalPrompt && showReplaceChoice && (
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">{t('promptAssistant.replaceTitle')}</p>
                <p className="mb-3 text-[11px] text-slate-400">{t('promptAssistant.replaceBody')}</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => applyWithMode('replace')} className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-600">{t('promptAssistant.replace')}</button>
                  <button type="button" onClick={() => applyWithMode('append')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white">{t('promptAssistant.append')}</button>
                  <button type="button" onClick={() => setShowReplaceChoice(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600">{t('promptAssistant.cancel')}</button>
                </div>
              </div>
            )}

            {/* Composer */}
            <div className="border-t border-slate-100 px-5 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={t('promptAssistant.placeholder')}
                  rows={1}
                  disabled={!hasModels}
                  className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 disabled:opacity-60"
                />
                {streaming ? (
                  <button type="button" onClick={stop} title={t('promptAssistant.stop')} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-2xl bg-slate-200 text-slate-600 hover:bg-slate-300">
                    <Square size={16} />
                  </button>
                ) : (
                  <button type="button" onClick={handleSend} disabled={!input.trim() || !hasModels} title={t('promptAssistant.send')} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-2xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40">
                    <Send size={16} />
                  </button>
                )}
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={streaming || !hasModels || visibleTurns.length === 0}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                >
                  <Wand2 size={14} />
                  {t('promptAssistant.generate')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
