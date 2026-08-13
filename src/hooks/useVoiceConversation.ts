import React from 'react';
import { assistantSpeechText } from '../lib/structuredMessage';

type VoiceConversationOptions = {
  onTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  language?: string;
};

type RecognitionConstructor = new () => any;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const voiceWindow = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition || null;
}

function speechText(value: string) {
  return assistantSpeechText(value)
    .replace(/```[\s\S]*?```/g, ' 代码内容已省略。 ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '链接')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function speechChunks(value: string) {
  const text = speechText(value);
  if (!text) return [];
  const sentences = text.match(/[^。！？.!?；;]+[。！？.!?；;]?/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > 180) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function storedNumber(key: string, fallback: number) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function localizedVoiceError(language: string | undefined, english: string, chinese: string) {
	return (language || '').toLowerCase().startsWith('zh') ? chinese : english;
}

function microphonePermissionError(language?: string) {
  const isDesktop = typeof window !== 'undefined' && window.location.hostname === 'wails.localhost';
  const isChinese = (language || navigator.language || '').toLowerCase().startsWith('zh');
  if (isDesktop) {
		const navigatorWithPlatform = navigator as Navigator & { userAgentData?: { platform?: string } };
		const platform = `${navigatorWithPlatform.userAgentData?.platform || ''} ${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase();
		if (platform.includes('win')) {
			return isChinese
				? '麦克风权限被拒绝，请在 Windows 设置 > 隐私和安全性 > 麦克风中开启“麦克风访问”和“允许桌面应用访问麦克风”，然后重新打开 Athena。'
				: 'Microphone access was denied. In Windows Settings > Privacy & security > Microphone, enable both microphone access and desktop app access, then reopen Athena.';
		}
		if (platform.includes('linux')) {
			return isChinese
				? '麦克风权限被拒绝，请在系统隐私或声音设置中允许 Athena 使用麦克风，然后重新打开应用。'
				: 'Microphone access was denied. Allow Athena in your system privacy or sound settings, then reopen the app.';
		}
    return isChinese
      ? '麦克风权限被拒绝，请在系统设置 > 隐私与安全性 > 麦克风中允许 Athena，然后重新打开应用。'
      : 'Microphone access was denied. Allow Athena in System Settings > Privacy & Security > Microphone, then reopen the app.';
  }
  return isChinese
    ? '麦克风权限被拒绝，请在浏览器设置中允许访问。'
    : 'Microphone access was denied. Allow it in your browser settings.';
}

const FATAL_RECOGNITION_ERRORS = new Set([
  'audio-capture',
  'language-not-supported',
  'not-allowed',
  'service-not-allowed',
]);

function isFatalRecognitionError(error: string) {
  return FATAL_RECOGNITION_ERRORS.has(error);
}

function voiceQualityScore(voice: SpeechSynthesisVoice, language: string) {
  const name = voice.name.toLowerCase();
  let score = voice.lang.toLowerCase().startsWith(language.split('-')[0].toLowerCase()) ? 100 : 0;
  if (/natural|neural|premium|enhanced|高质量/.test(name)) score += 30;
  if (/xiaoxiao|xiaoyi|yunxi|tingting|meijia|sinji|siri|google/.test(name)) score += 10;
  if (voice.localService) score += 2;
  return score;
}

function normalizedLocale(value: string) {
  return value.trim().replace('_', '-').toLowerCase();
}

function voiceForSelection(
  available: SpeechSynthesisVoice[],
  selectedVoiceURI: string,
  language: string,
) {
  const locale = normalizedLocale(language);
  const languageBase = locale.split('-')[0];
  return available.find(voice => voice.voiceURI === selectedVoiceURI)
    || available.find(voice => normalizedLocale(voice.lang) === locale)
    || available.find(voice => normalizedLocale(voice.lang).split('-')[0] === languageBase)
    || available[0];
}

export const AVATAR_PRESETS = [
  { id: 'mira', gender: 'female', skin: '#f2c6a0', skinShadow: '#e0a97f', hair: '#3f2a20', hairLight: '#5c3d2e', cloth: '#0f766e', clothDark: '#0b5851', blush: '#f4a6a0' },
  { id: 'leo', gender: 'male', skin: '#e9b489', skinShadow: '#d29a6c', hair: '#211814', hairLight: '#3a2a20', cloth: '#1e3a8a', clothDark: '#172c69', blush: '#e79b93' },
  { id: 'yuki', gender: 'female', skin: '#f7d7bd', skinShadow: '#eab892', hair: '#6d4c9f', hairLight: '#8a68bd', cloth: '#be185d', clothDark: '#921247', blush: '#f6a8b6' },
  { id: 'kai', gender: 'male', skin: '#c68642', skinShadow: '#a86d30', hair: '#0e0b0a', hairLight: '#2a211d', cloth: '#0e7490', clothDark: '#0a5a72', blush: '#c9765f' },
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];
export type AvatarId = AvatarPreset['id'];
// The selected avatar can be a built-in preset id or a custom upload id (custom:<uuid>).
export type SelectedAvatarId = string;

const DEFAULT_AVATAR_ID: AvatarId = AVATAR_PRESETS[0].id;

function storedAvatarId(): SelectedAvatarId {
  const value = localStorage.getItem('chat.voice.avatarId');
  return value && value.trim() ? value : DEFAULT_AVATAR_ID;
}

export function useVoiceConversation({ onTranscript, onFinalTranscript, language }: VoiceConversationOptions) {
  const [isListening, setIsListening] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [speakingText, setSpeakingText] = React.useState('');
  const [voiceError, setVoiceError] = React.useState('');
  const [autoSpeak, setAutoSpeak] = React.useState(() => localStorage.getItem('chat.voice.autoSpeak') === 'true');
  const [conversationMode, setConversationModeState] = React.useState(() => localStorage.getItem('chat.voice.conversationMode') === 'true');
  const [avatarEnabled, setAvatarEnabled] = React.useState(() => localStorage.getItem('chat.voice.avatarEnabled') !== 'false');
  const [avatarId, setAvatarId] = React.useState<SelectedAvatarId>(storedAvatarId);
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = React.useState(() => localStorage.getItem('chat.voice.voiceURI') || '');
  const [speechRate, setSpeechRate] = React.useState(() => storedNumber('chat.voice.rate', 0.95));
  const [speechPitch, setSpeechPitch] = React.useState(() => storedNumber('chat.voice.pitch', 1));
  const [silenceTimeoutMs, setSilenceTimeoutMs] = React.useState(() => storedNumber('chat.voice.silenceTimeoutMs', 1600));
  const recognitionRef = React.useRef<any>(null);
  const restartTimerRef = React.useRef<number | null>(null);
  const silenceTimerRef = React.useRef<number | null>(null);
  const intentionalStopRef = React.useRef(false);
  const manualPauseRef = React.useRef(false);
  const submittedRef = React.useRef(false);
  const recognitionErrorRef = React.useRef('');
  const restartAttemptRef = React.useRef(0);
  const speechRunRef = React.useRef(0);
  const voicesRef = React.useRef<SpeechSynthesisVoice[]>([]);
  const selectedVoiceURIRef = React.useRef(selectedVoiceURI);
  const languageRef = React.useRef(language || (typeof navigator !== 'undefined' ? navigator.language : 'zh-CN'));
  const speechRateRef = React.useRef(speechRate);
  const speechPitchRef = React.useRef(speechPitch);
  const activeSpeechRef = React.useRef<{ remainingText: string; resumeConversation: boolean } | null>(null);
  const speakRef = React.useRef<(text: string, resumeConversation?: boolean) => void>(() => {});
  const finalTranscriptRef = React.useRef('');
  const currentTranscriptRef = React.useRef('');
  const conversationModeRef = React.useRef(conversationMode);
  const onTranscriptRef = React.useRef(onTranscript);
  const onFinalTranscriptRef = React.useRef(onFinalTranscript);
  const startListeningRef = React.useRef<() => void>(() => {});
  const supported = Boolean(recognitionConstructor());
  const synthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  React.useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript, onTranscript]);

  React.useEffect(() => {
    conversationModeRef.current = conversationMode;
    localStorage.setItem('chat.voice.conversationMode', String(conversationMode));
  }, [conversationMode]);

  React.useEffect(() => {
    localStorage.setItem('chat.voice.autoSpeak', String(autoSpeak));
  }, [autoSpeak]);

  React.useEffect(() => {
    localStorage.setItem('chat.voice.avatarEnabled', String(avatarEnabled));
  }, [avatarEnabled]);

  React.useEffect(() => {
    localStorage.setItem('chat.voice.avatarId', avatarId);
  }, [avatarId]);

  React.useEffect(() => {
    languageRef.current = language || navigator.language || 'zh-CN';
  }, [language]);

  React.useEffect(() => {
    if (!synthesisSupported) return;
    const loadVoices = () => {
      const available = [...window.speechSynthesis.getVoices()];
      const locale = language || navigator.language || 'zh-CN';
      available.sort((a, b) => voiceQualityScore(b, locale) - voiceQualityScore(a, locale) || a.name.localeCompare(b.name));
      voicesRef.current = available;
      setVoices(available);
      setSelectedVoiceURI(current => {
		const normalizedTarget = normalizedLocale(locale);
		const currentVoice = available.find(voice => voice.voiceURI === current);
		if (currentVoice && normalizedLocale(currentVoice.lang) === normalizedTarget) {
		  selectedVoiceURIRef.current = current;
		  return current;
		}
		const nextVoice = voiceForSelection(available, '', locale);
		const nextVoiceURI = nextVoice?.voiceURI || '';
		selectedVoiceURIRef.current = nextVoiceURI;
		return nextVoiceURI;
      });
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [language, synthesisSupported]);

  React.useEffect(() => {
    selectedVoiceURIRef.current = selectedVoiceURI;
    localStorage.setItem('chat.voice.voiceURI', selectedVoiceURI);
  }, [selectedVoiceURI]);

  React.useEffect(() => {
    speechRateRef.current = speechRate;
    localStorage.setItem('chat.voice.rate', String(speechRate));
  }, [speechRate]);

  React.useEffect(() => {
    speechPitchRef.current = speechPitch;
    localStorage.setItem('chat.voice.pitch', String(speechPitch));
  }, [speechPitch]);

  React.useEffect(() => {
    localStorage.setItem('chat.voice.silenceTimeoutMs', String(silenceTimeoutMs));
  }, [silenceTimeoutMs]);

  const scheduleListeningRestart = React.useCallback((delayMs = 350) => {
    if (!conversationModeRef.current || manualPauseRef.current) return;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      if (!conversationModeRef.current || manualPauseRef.current || recognitionRef.current) return;
      startListeningRef.current();
    }, delayMs);
  }, []);

  const setConversationMode = React.useCallback((enabled: boolean) => {
    conversationModeRef.current = enabled;
    manualPauseRef.current = false;
    restartAttemptRef.current = 0;
    if (!enabled && restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    setConversationModeState(enabled);
  }, []);

  const stopListening = React.useCallback((pauseConversation = false) => {
    intentionalStopRef.current = true;
    if (pauseConversation) manualPauseRef.current = true;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
    restartTimerRef.current = null;
    silenceTimerRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort?.();
    setIsListening(false);
  }, []);

  const pauseListening = React.useCallback(() => {
    stopListening(true);
  }, [stopListening]);

  const stopSpeaking = React.useCallback((resumeConversation = false) => {
    speechRunRef.current += 1;
    if (synthesisSupported) window.speechSynthesis.cancel();
    activeSpeechRef.current = null;
    setIsSpeaking(false);
    setSpeakingText('');
    if (resumeConversation) scheduleListeningRestart(300);
  }, [scheduleListeningRestart, synthesisSupported]);

  const startListening = React.useCallback(() => {
    const Recognition = recognitionConstructor();
    if (!Recognition || recognitionRef.current) return;
    stopSpeaking();
    manualPauseRef.current = false;
    intentionalStopRef.current = false;
    recognitionErrorRef.current = '';
    setVoiceError('');
    finalTranscriptRef.current = '';
    currentTranscriptRef.current = '';
    submittedRef.current = false;
    if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;

    const recognition = new Recognition();
    recognition.lang = language || navigator.language || 'zh-CN';
    recognition.continuous = conversationModeRef.current;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    const submitTranscript = () => {
      const finalText = currentTranscriptRef.current.trim();
      if (!finalText || submittedRef.current || intentionalStopRef.current) return;
      submittedRef.current = true;
      intentionalStopRef.current = true;
      if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      recognition.stop?.();
      onFinalTranscriptRef.current(finalText);
    };
    const scheduleTranscript = () => {
      if (!conversationModeRef.current || !currentTranscriptRef.current.trim()) return;
      if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(submitTranscript, silenceTimeoutMs);
    };
    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return;
      setVoiceError('');
      setIsListening(true);
    };
    recognition.onresult = (event: any) => {
      if (recognitionRef.current !== recognition) return;
      restartAttemptRef.current = 0;
      recognitionErrorRef.current = '';
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) finalTranscriptRef.current += transcript;
        else interim += transcript;
      }
      const transcript = `${finalTranscriptRef.current}${interim}`.trim();
      currentTranscriptRef.current = transcript;
      onTranscriptRef.current(transcript);
      scheduleTranscript();
    };
    recognition.onerror = (event: any) => {
      if (recognitionRef.current !== recognition) return;
      const errorCode = event.error || 'unknown';
      recognitionErrorRef.current = errorCode;
      if (errorCode === 'aborted' || errorCode === 'no-speech') return;
      if (isFatalRecognitionError(errorCode)) intentionalStopRef.current = true;
      const permissionDenied = errorCode === 'not-allowed' || errorCode === 'service-not-allowed';
      const message = permissionDenied
        ? microphonePermissionError(language)
        : localizedVoiceError(language, `Speech recognition failed: ${errorCode}`, `语音识别失败：${errorCode}`);
      setVoiceError(message);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setIsListening(false);
      if (submittedRef.current || intentionalStopRef.current) {
        return;
      }
      const finalText = currentTranscriptRef.current.trim();
      if (finalText && conversationModeRef.current) {
        scheduleTranscript();
        return;
      }
      const errorCode = recognitionErrorRef.current;
      const restartableError = !isFatalRecognitionError(errorCode);
      if (!finalText && conversationModeRef.current && !manualPauseRef.current && !intentionalStopRef.current && restartableError) {
        const transientFailure = Boolean(errorCode && errorCode !== 'no-speech');
        if (transientFailure) restartAttemptRef.current = Math.min(restartAttemptRef.current + 1, 5);
        else restartAttemptRef.current = 0;
        const delay = transientFailure
          ? Math.min(500 * (2 ** Math.max(0, restartAttemptRef.current - 1)), 4000)
          : 350;
        scheduleListeningRestart(delay);
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceError(localizedVoiceError(language, 'Unable to start speech recognition. Retrying shortly.', '无法启动语音识别，正在稍后重试。'));
      if (conversationModeRef.current && !manualPauseRef.current) {
        restartAttemptRef.current = Math.min(restartAttemptRef.current + 1, 5);
        scheduleListeningRestart(Math.min(500 * (2 ** Math.max(0, restartAttemptRef.current - 1)), 4000));
      }
    }
  }, [language, scheduleListeningRestart, silenceTimeoutMs, stopSpeaking]);

  startListeningRef.current = startListening;

  const speak = React.useCallback((text: string, resumeConversation = false) => {
    if (!synthesisSupported) {
		setVoiceError(localizedVoiceError(language, 'Speech playback is unavailable in this browser.', '当前浏览器不支持语音朗读。'));
      return;
    }
    const chunks = speechChunks(text);
    if (chunks.length === 0) return;
    stopListening();
    const speechRun = speechRunRef.current + 1;
    speechRunRef.current = speechRun;
    window.speechSynthesis.cancel();
    setVoiceError('');
    setIsSpeaking(true);
    setSpeakingText(speechText(text));
	activeSpeechRef.current = { remainingText: chunks.join(' '), resumeConversation };

    let index = 0;
    const playNext = () => {
      if (speechRunRef.current !== speechRun) return;
      if (index >= chunks.length) {
        activeSpeechRef.current = null;
        setIsSpeaking(false);
        setSpeakingText('');
        if (resumeConversation && conversationModeRef.current) {
          // Leave enough time for the speaker tail to decay before reopening the mic.
          scheduleListeningRestart(700);
        }
        return;
      }
	  activeSpeechRef.current = {
		remainingText: chunks.slice(index).join(' '),
		resumeConversation,
	  };
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      index += 1;
	  // Resolve a fresh system voice for every chunk. WebKit can replace voice
	  // objects after `voiceschanged`, and stale objects may silently fall back.
	  const currentVoices = [...window.speechSynthesis.getVoices()];
	  if (currentVoices.length > 0) voicesRef.current = currentVoices;
	  const locale = languageRef.current || navigator.language || 'zh-CN';
	  const selectedVoice = voiceForSelection(voicesRef.current, selectedVoiceURIRef.current, locale);
	  utterance.rate = speechRateRef.current;
	  utterance.pitch = speechPitchRef.current;
      if (selectedVoice) utterance.voice = selectedVoice;
	  utterance.lang = selectedVoice?.lang || locale;
      utterance.onend = playNext;
      utterance.onerror = () => {
        if (speechRunRef.current !== speechRun) return;
		activeSpeechRef.current = null;
        setIsSpeaking(false);
        setSpeakingText('');
		setVoiceError(localizedVoiceError(language, 'Speech playback failed.', '语音朗读失败。'));
        if (resumeConversation) scheduleListeningRestart(700);
      };
      window.speechSynthesis.speak(utterance);
    };
    playNext();
  }, [language, scheduleListeningRestart, stopListening, synthesisSupported]);

  speakRef.current = speak;

  const selectVoice = React.useCallback((voiceURI: string) => {
	selectedVoiceURIRef.current = voiceURI;
	setSelectedVoiceURI(voiceURI);
	localStorage.setItem('chat.voice.voiceURI', voiceURI);
	const activeSpeech = activeSpeechRef.current;
	if (!activeSpeech || !synthesisSupported) return;
	// A running SpeechSynthesisUtterance cannot change voices in place. Cancel
	// the active run and rebuild it with the new voice immediately.
	speechRunRef.current += 1;
	window.speechSynthesis.cancel();
	window.setTimeout(() => speakRef.current(activeSpeech.remainingText, activeSpeech.resumeConversation), 0);
  }, [synthesisSupported]);

  const resumeListening = React.useCallback((delayMs = 500) => {
    scheduleListeningRestart(delayMs);
  }, [scheduleListeningRestart]);

	const stopAll = React.useCallback(() => {
		stopListening();
		stopSpeaking();
		manualPauseRef.current = false;
		restartAttemptRef.current = 0;
		recognitionErrorRef.current = '';
		finalTranscriptRef.current = '';
		currentTranscriptRef.current = '';
		setVoiceError('');
	}, [stopListening, stopSpeaking]);

  React.useEffect(() => () => {
    intentionalStopRef.current = true;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
    speechRunRef.current += 1;
    recognitionRef.current?.abort?.();
    if (synthesisSupported) window.speechSynthesis.cancel();
  }, [synthesisSupported]);

  return {
    supported,
    synthesisSupported,
    isListening,
    isSpeaking,
    speakingText,
    voiceError,
    autoSpeak,
    conversationMode,
    avatarEnabled,
    avatarId,
    voices,
    selectedVoiceURI,
    speechRate,
    speechPitch,
    silenceTimeoutMs,
    setAutoSpeak,
    setConversationMode,
    setAvatarEnabled,
    setAvatarId,
    setSelectedVoiceURI: selectVoice,
    setSpeechRate,
    setSpeechPitch,
    setSilenceTimeoutMs,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    speak,
    stopSpeaking,
		stopAll,
  };
}
