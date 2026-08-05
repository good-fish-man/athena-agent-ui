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

function voiceQualityScore(voice: SpeechSynthesisVoice, language: string) {
  const name = voice.name.toLowerCase();
  let score = voice.lang.toLowerCase().startsWith(language.split('-')[0].toLowerCase()) ? 100 : 0;
  if (/natural|neural|premium|enhanced|高质量/.test(name)) score += 30;
  if (/xiaoxiao|xiaoyi|yunxi|tingting|meijia|sinji|siri|google/.test(name)) score += 10;
  if (voice.localService) score += 2;
  return score;
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
  const [conversationMode, setConversationMode] = React.useState(() => localStorage.getItem('chat.voice.conversationMode') === 'true');
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
  const submittedRef = React.useRef(false);
  const recognitionErrorRef = React.useRef('');
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
    if (!synthesisSupported) return;
    const loadVoices = () => {
      const available = [...window.speechSynthesis.getVoices()];
      const locale = language || navigator.language || 'zh-CN';
      available.sort((a, b) => voiceQualityScore(b, locale) - voiceQualityScore(a, locale) || a.name.localeCompare(b.name));
      setVoices(available);
      setSelectedVoiceURI(current => {
		const currentVoice = available.find(voice => voice.voiceURI === current);
		if (currentVoice && currentVoice.lang.toLowerCase().startsWith(locale.split('-')[0].toLowerCase())) return current;
        return available[0]?.voiceURI || '';
      });
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [language, synthesisSupported]);

  React.useEffect(() => {
    localStorage.setItem('chat.voice.voiceURI', selectedVoiceURI);
  }, [selectedVoiceURI]);

  React.useEffect(() => {
    localStorage.setItem('chat.voice.rate', String(speechRate));
  }, [speechRate]);

  React.useEffect(() => {
    localStorage.setItem('chat.voice.pitch', String(speechPitch));
  }, [speechPitch]);

  React.useEffect(() => {
    localStorage.setItem('chat.voice.silenceTimeoutMs', String(silenceTimeoutMs));
  }, [silenceTimeoutMs]);

  const stopListening = React.useCallback(() => {
    intentionalStopRef.current = true;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
    restartTimerRef.current = null;
    silenceTimerRef.current = null;
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const stopSpeaking = React.useCallback(() => {
    if (synthesisSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingText('');
  }, [synthesisSupported]);

  const startListening = React.useCallback(() => {
    const Recognition = recognitionConstructor();
    if (!Recognition || isListening) return;
    stopSpeaking();
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
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
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
      recognitionErrorRef.current = event.error || 'unknown';
      if (event.error === 'aborted' || event.error === 'no-speech') return;
		if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
			intentionalStopRef.current = true;
		}
		const permissionDenied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      const message = permissionDenied
		? microphonePermissionError(language)
		: localizedVoiceError(language, `Speech recognition failed: ${event.error || 'unknown error'}`, `语音识别失败：${event.error || '未知错误'}`);
      setVoiceError(message);
    };
    recognition.onend = () => {
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
      const restartableError = !recognitionErrorRef.current || recognitionErrorRef.current === 'no-speech';
      if (!finalText && conversationModeRef.current && !intentionalStopRef.current && restartableError) {
        restartTimerRef.current = window.setTimeout(() => startListeningRef.current(), 350);
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
		setVoiceError(localizedVoiceError(language, 'Unable to start speech recognition. Please try again.', '无法启动语音识别，请稍后重试。'));
    }
  }, [isListening, language, silenceTimeoutMs, stopSpeaking]);

  startListeningRef.current = startListening;

  const speak = React.useCallback((text: string, resumeConversation = false) => {
    if (!synthesisSupported) {
		setVoiceError(localizedVoiceError(language, 'Speech playback is unavailable in this browser.', '当前浏览器不支持语音朗读。'));
      return;
    }
    const chunks = speechChunks(text);
    if (chunks.length === 0) return;
    stopListening();
    window.speechSynthesis.cancel();
    setVoiceError('');
    setIsSpeaking(true);
    setSpeakingText(speechText(text));

    const locale = language || navigator.language || 'zh-CN';
    const selectedVoice = voices.find(voice => voice.voiceURI === selectedVoiceURI)
      || voices.find(voice => voice.lang.toLowerCase() === locale.toLowerCase())
      || voices.find(voice => voice.lang.toLowerCase().startsWith(locale.split('-')[0].toLowerCase()));
    let index = 0;
    const playNext = () => {
      if (index >= chunks.length) {
        setIsSpeaking(false);
        setSpeakingText('');
        if (resumeConversation && conversationModeRef.current) {
          // Leave enough time for the speaker tail to decay before reopening the mic.
          window.setTimeout(() => startListeningRef.current(), 700);
        }
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      index += 1;
      utterance.lang = locale;
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.onend = playNext;
      utterance.onerror = () => {
        setIsSpeaking(false);
        setSpeakingText('');
		setVoiceError(localizedVoiceError(language, 'Speech playback failed.', '语音朗读失败。'));
      };
      window.speechSynthesis.speak(utterance);
    };
    playNext();
  }, [language, selectedVoiceURI, speechPitch, speechRate, stopListening, synthesisSupported, voices]);

	const stopAll = React.useCallback(() => {
		stopListening();
		stopSpeaking();
		recognitionErrorRef.current = '';
		finalTranscriptRef.current = '';
		currentTranscriptRef.current = '';
		setVoiceError('');
	}, [stopListening, stopSpeaking]);

  React.useEffect(() => () => {
    intentionalStopRef.current = true;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
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
    setSelectedVoiceURI,
    setSpeechRate,
    setSpeechPitch,
    setSilenceTimeoutMs,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
		stopAll,
  };
}
