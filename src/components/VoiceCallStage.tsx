import React from 'react';
import { motion, AnimatePresence, useMotionValue } from 'motion/react';
import { Mic, MicOff, PhoneOff, Settings, Maximize2, Minimize2, Volume2, VolumeX, GripVertical, Upload, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import VoiceAvatar, { AVATAR_GESTURES, GESTURE_DURATION_MS, type AvatarState, type AvatarGesture, type AvatarSource } from './VoiceAvatar';
import { type AvatarPreset } from '../hooks/useVoiceConversation';
import { type CustomAvatar } from '../hooks/useCustomAvatars';

type VoiceCallStageProps = {
  source: AvatarSource;
  selectedId: string;
  presets: readonly AvatarPreset[];
  customAvatars: CustomAvatar[];
  onSelectAvatar: (id: string) => void;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  liveTranscript: string;
  speakingText: string;
  voiceError: string;
  agentName?: string;
  onToggleMic: () => void;
  onStopSpeaking: () => void;
  onEndCall: () => void;
  onOpenSettings: () => void;
  onUploadAvatar: () => void;
  onRemoveAvatar: (id: string) => void;
};

const GESTURE_EMOJI: Record<AvatarGesture, string> = {
  wave: '👋',
  nod: '✅',
  shake: '❌',
  thumbsUp: '👍',
  happy: '😄',
  surprise: '😮',
};

const POS_KEY = 'chat.voice.panelPos';

function avatarState(isListening: boolean, isSpeaking: boolean, isThinking: boolean): AvatarState {
  if (isSpeaking) return 'speaking';
  if (isListening) return 'listening';
  if (isThinking) return 'thinking';
  return 'idle';
}

function storedPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed;
    }
  } catch {
    /* ignore */
  }
  return { x: 0, y: 0 };
}

function AvatarSwatch({ id, presets, customAvatars }: { id: string; presets: readonly AvatarPreset[]; customAvatars: CustomAvatar[] }) {
  const custom = customAvatars.find(item => item.id === id);
  if (custom) {
    if (custom.kind === 'video') {
      return <video src={custom.url} muted playsInline className="h-full w-full object-cover" />;
    }
    return <img src={custom.url} alt={custom.name} className="h-full w-full object-cover" />;
  }
  const preset = presets.find(item => item.id === id) || presets[0];
  return <span className="block h-full w-full" style={{ background: `radial-gradient(circle at 50% 38%, ${preset.skin}, ${preset.cloth})` }} />;
}

export default function VoiceCallStage(props: VoiceCallStageProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const [gesture, setGesture] = React.useState<AvatarGesture | null>(null);
  const [gestureNonce, setGestureNonce] = React.useState(0);
  const gestureTimerRef = React.useRef<number | null>(null);
  const state = avatarState(props.isListening, props.isSpeaking, props.isThinking);

  const initialPos = React.useRef(storedPos());
  const x = useMotionValue(initialPos.current.x);
  const y = useMotionValue(initialPos.current.y);

  React.useEffect(() => () => {
    if (gestureTimerRef.current !== null) window.clearTimeout(gestureTimerRef.current);
  }, []);

  const triggerGesture = React.useCallback((name: AvatarGesture) => {
    setGesture(name);
    setGestureNonce(nonce => nonce + 1);
    if (gestureTimerRef.current !== null) window.clearTimeout(gestureTimerRef.current);
    gestureTimerRef.current = window.setTimeout(() => setGesture(null), GESTURE_DURATION_MS);
  }, []);

  const persistPos = React.useCallback(() => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ x: x.get(), y: y.get() }));
    } catch {
      /* ignore */
    }
  }, [x, y]);

  const statusText = props.voiceError
    ? props.voiceError
    : state === 'speaking'
      ? t('voiceCall.statusSpeaking')
      : state === 'listening'
        ? t('voiceCall.statusListening')
        : state === 'thinking'
          ? t('voiceCall.statusThinking')
          : t('voiceCall.statusIdle');

  const subtitle = props.isSpeaking ? props.speakingText : props.liveTranscript;
  const subtitleWho = props.isSpeaking ? (props.agentName || t('voiceCall.assistant')) : t('voiceCall.you');

  const switchOptions = React.useMemo(
    () => [...props.presets.map(p => p.id as string), ...props.customAvatars.map(c => c.id)],
    [props.presets, props.customAvatars],
  );

  const controls = (
    <>
      <button
        type="button"
        onClick={props.onToggleMic}
        title={props.isListening ? t('voiceCall.micStop') : t('voiceCall.micStart')}
        className={cn('flex items-center justify-center rounded-full transition-colors', props.isListening ? 'bg-rose-500 text-white' : 'bg-white/90 text-slate-700 hover:bg-white')}
      >
        {props.isListening ? <Mic size={18} /> : <MicOff size={18} />}
      </button>
      <button
        type="button"
        onClick={props.onStopSpeaking}
        title={props.isSpeaking ? t('voiceCall.mute') : t('voiceCall.muted')}
        className={cn('flex items-center justify-center rounded-full transition-colors', props.isSpeaking ? 'bg-emerald-500 text-white' : 'bg-white/90 text-slate-500 hover:bg-white')}
      >
        {props.isSpeaking ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      <button
        type="button"
        onClick={props.onEndCall}
        title={t('voiceCall.endCall')}
        className="flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
      >
        <PhoneOff size={18} />
      </button>
    </>
  );

  const emoteRow = (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {AVATAR_GESTURES.map(name => (
        <button
          key={name}
          type="button"
          onClick={() => triggerGesture(name)}
          title={t(`voiceCall.gestures.${name}`)}
          className="h-9 w-9 rounded-full bg-white/10 text-lg leading-none grid place-items-center hover:bg-white/25 transition-colors"
        >
          <span aria-hidden>{GESTURE_EMOJI[name]}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* Mini floating panel (draggable) */}
      <AnimatePresence>
        {!expanded && (
          <motion.div
            drag
            dragMomentum={false}
            dragConstraints={{ left: -window.innerWidth + 220, right: 40, top: -window.innerHeight + 220, bottom: 40 }}
            style={{ x, y }}
            onDragEnd={persistPos}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 right-5 z-40 w-[188px] rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur"
          >
            <div className="flex items-center justify-between px-2 pt-2">
              <span className="text-slate-300 cursor-grab active:cursor-grabbing" title={t('voiceCall.drag')}>
                <GripVertical size={14} />
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={props.onUploadAvatar}
                  title={t('voiceCall.uploadReal')}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                >
                  <Upload size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  title={t('voiceCall.expand')}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>
            <div className="h-[140px] w-full pointer-events-none">
              <VoiceAvatar source={props.source} state={state} variant="mini" gesture={gesture} gestureNonce={gestureNonce} />
            </div>
            <div className="px-3 pb-3">
              <div className={cn('text-[11px] font-bold text-center', props.voiceError ? 'text-red-500' : state === 'listening' ? 'text-rose-500' : state === 'speaking' ? 'text-emerald-600' : 'text-slate-500')}>
                {statusText}
              </div>
              <div className="mt-2 flex items-center justify-center gap-2 [&>button]:h-8 [&>button]:w-8">{controls}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen call overlay */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden"
            style={{ background: 'radial-gradient(circle at 30% 20%, #1e293b, #0f172a 60%, #020617)' }}
          >
            <div className="w-full flex items-center justify-between px-6 pt-6">
              <div className="text-white/80">
                <div className="text-sm font-bold">{props.agentName || t('voiceCall.assistant')}</div>
                <div className="text-[11px] text-white/50">{statusText}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setExpanded(false); props.onOpenSettings(); }} title={t('voiceCall.settings')} className="p-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20">
                  <Settings size={18} />
                </button>
                <button type="button" onClick={() => setExpanded(false)} title={t('voiceCall.collapse')} className="p-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20">
                  <Minimize2 size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 w-full flex items-center justify-center">
              <div className="h-[42vh] w-[42vh] max-h-[400px] max-w-[400px]">
                <VoiceAvatar source={props.source} state={state} variant="full" gesture={gesture} gestureNonce={gestureNonce} />
              </div>
            </div>

            <div className="w-full max-w-2xl px-6 min-h-[56px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                {subtitle ? (
                  <motion.div key={subtitleWho + subtitle.slice(0, 12)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="text-center">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">{subtitleWho}</div>
                    <div className="mt-1 text-lg leading-relaxed text-white/90">{subtitle}</div>
                  </motion.div>
                ) : (
                  <div className="text-sm text-white/40">{t('voiceCall.subtitleHint')}</div>
                )}
              </AnimatePresence>
            </div>

            {/* Emote buttons */}
            <div className="pb-2">{emoteRow}</div>

            {/* Avatar quick switch */}
            <div className="flex items-center gap-2 pb-3 px-4 max-w-full overflow-x-auto">
              {switchOptions.map(id => {
                const isCustom = id.startsWith('custom:');
                return (
                  <div key={id} className="group relative shrink-0">
                    <button
                      type="button"
                      onClick={() => props.onSelectAvatar(id)}
                      className={cn('h-9 w-9 rounded-full border-2 overflow-hidden transition-transform', props.selectedId === id ? 'border-white scale-110' : 'border-white/20 hover:border-white/60')}
                    >
                      <AvatarSwatch id={id} presets={props.presets} customAvatars={props.customAvatars} />
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => props.onRemoveAvatar(id)}
                        title={t('common.confirmDelete')}
                        className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-white text-slate-500 shadow hover:text-red-500"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={props.onUploadAvatar}
                title={t('voiceCall.uploadReal')}
                className="h-9 w-9 shrink-0 rounded-full border-2 border-dashed border-white/30 text-white/70 grid place-items-center hover:border-white/70 hover:text-white transition-colors"
              >
                <Upload size={15} />
              </button>
            </div>

            <div className="w-full flex items-center justify-center gap-5 pb-10 [&>button]:h-14 [&>button]:w-14 [&>button]:shadow-xl">{controls}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
