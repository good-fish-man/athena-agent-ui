import React from 'react';
import { AVATAR_PRESETS, type AvatarId, type AvatarPreset } from '../hooks/useVoiceConversation';
import type { CustomAvatar } from '../hooks/useCustomAvatars';

export type AvatarState = 'idle' | 'listening' | 'speaking' | 'thinking';
export type AvatarGesture = 'wave' | 'nod' | 'shake' | 'thumbsUp' | 'happy' | 'surprise';

export type AvatarSource =
  | { type: 'preset'; presetId: AvatarId }
  | { type: 'image'; url: string }
  | { type: 'video'; url: string };

export function resolveAvatarSource(avatarId: string, customAvatars: CustomAvatar[]): AvatarSource {
  const custom = customAvatars.find(item => item.id === avatarId);
  if (custom) return custom.kind === 'video' ? { type: 'video', url: custom.url } : { type: 'image', url: custom.url };
  const preset = AVATAR_PRESETS.find(item => item.id === avatarId);
  return { type: 'preset', presetId: (preset || AVATAR_PRESETS[0]).id };
}

type VoiceAvatarProps = {
  source: AvatarSource;
  state: AvatarState;
  variant?: 'mini' | 'full';
  gesture?: AvatarGesture | null;
  gestureNonce?: number;
  className?: string;
};

function presetFor(presetId: AvatarId): AvatarPreset {
  return AVATAR_PRESETS.find(preset => preset.id === presetId) || AVATAR_PRESETS[0];
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function ringColor(state: AvatarState) {
  return state === 'listening'
    ? 'rgba(244,63,94,0.55)'
    : state === 'speaking'
      ? 'rgba(16,185,129,0.55)'
      : state === 'thinking'
        ? 'rgba(217,119,6,0.5)'
        : 'rgba(148,163,184,0.4)';
}

const SHARED_KEYFRAMES = `
  @keyframes va-breathe { 0%,100% { transform: translateY(0) } 50% { transform: translateY(1.4%) } }
  @keyframes va-sway { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
  @keyframes va-ring { 0% { transform: scale(0.82); opacity: .7 } 100% { transform: scale(1.25); opacity: 0 } }
  @keyframes va-wave { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-14deg) } }
  @keyframes va-nod { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2%) } }
  @keyframes va-g-nod { 0%,100% { transform: rotate(0deg) translateY(0) } 25% { transform: rotate(0deg) translateY(4px) } 60% { transform: translateY(-2px) } }
  @keyframes va-g-shake { 0%,100% { transform: rotate(0deg) } 20% { transform: rotate(-9deg) } 60% { transform: rotate(9deg) } 80% { transform: rotate(-5deg) } }
  @keyframes va-g-bounce { 0%,100% { transform: translateY(0) scale(1) } 30% { transform: translateY(-9%) scale(1.03) } 60% { transform: translateY(0) scale(0.99) } }
  @keyframes va-g-wave { 0%,100% { transform: rotate(0deg) } 25% { transform: rotate(-22deg) } 50% { transform: rotate(6deg) } 75% { transform: rotate(-18deg) } }
  @keyframes va-pop { 0% { transform: scale(0) translateY(6px); opacity: 0 } 40% { transform: scale(1.15) translateY(0); opacity: 1 } 100% { transform: scale(1) } }
  @keyframes va-kenburns { 0% { transform: scale(1.05) translate(0,0) } 50% { transform: scale(1.12) translate(-2%, -1.5%) } 100% { transform: scale(1.05) translate(0,0) } }
  @keyframes va-speakpulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.035) } }
  @keyframes va-bar { 0%,100% { transform: scaleY(0.3) } 50% { transform: scaleY(1) } }
`;

const GESTURE_DURATION_MS = 1500;

// Continuous mouth + blink signals for the drawn avatar.
function useFaceAnimation(state: AvatarState, gesture: AvatarGesture | null, reducedMotion: boolean) {
  const [mouth, setMouth] = React.useState(0);
  const [blink, setBlink] = React.useState(0);
  const frameRef = React.useRef<number | null>(null);
  const nextBlinkRef = React.useRef(0);

  React.useEffect(() => {
    if (reducedMotion) {
      setMouth(state === 'speaking' ? 0.4 : 0);
      setBlink(0);
      return;
    }
    let mounted = true;
    const tick = (time: number) => {
      if (!mounted) return;
      if (state === 'speaking' || gesture === 'surprise') {
        const base = 0.5 + 0.5 * Math.sin(time / 90);
        const flutter = 0.5 + 0.5 * Math.sin(time / 47 + 1.7);
        setMouth(gesture === 'surprise' ? 0.9 : Math.max(0, Math.min(1, base * 0.7 + flutter * 0.3)));
      } else {
        setMouth(current => (current > 0.02 ? current * 0.6 : 0));
      }
      if (nextBlinkRef.current === 0) nextBlinkRef.current = time + 1500 + Math.random() * 3500;
      const untilBlink = nextBlinkRef.current - time;
      if (gesture === 'surprise') {
        setBlink(0);
      } else if (untilBlink < 0 && untilBlink > -160) {
        const phase = -untilBlink / 160;
        setBlink(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
      } else {
        if (untilBlink < -160) nextBlinkRef.current = time + 1500 + Math.random() * 3500;
        setBlink(0);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [state, gesture, reducedMotion]);

  return { mouth, blink };
}

function Waveform({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 18 }}>
      {[0, 1, 2, 3, 4].map(index => (
        <span
          key={index}
          style={{
            width: 4,
            height: '100%',
            borderRadius: 2,
            background: color,
            transformOrigin: 'bottom',
            animation: `va-bar 0.7s ease-in-out ${index * 0.11}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function MediaFrame({
  state,
  gesture,
  gestureNonce,
  reducedMotion,
  children,
}: {
  state: AvatarState;
  gesture: AvatarGesture | null;
  gestureNonce: number;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  const ring = ringColor(state);
  const showRing = (state === 'listening' || state === 'speaking') && !reducedMotion;
  const animation = reducedMotion
    ? undefined
    : gesture
      ? 'va-g-bounce 0.7s ease'
      : state === 'speaking'
        ? 'va-speakpulse 0.9s ease-in-out infinite'
        : state === 'idle'
          ? 'va-kenburns 12s ease-in-out infinite'
          : undefined;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      <style>{SHARED_KEYFRAMES}</style>
      {showRing && (
        <>
          <span style={{ position: 'absolute', width: '82%', height: '82%', borderRadius: '50%', border: `2px solid ${ring}`, animation: 'va-ring 1.6s ease-out infinite' }} />
          <span style={{ position: 'absolute', width: '82%', height: '82%', borderRadius: '50%', border: `2px solid ${ring}`, animation: 'va-ring 1.6s ease-out infinite', animationDelay: '.8s' }} />
        </>
      )}
      <div
        key={gestureNonce}
        style={{
          position: 'relative',
          width: '84%',
          height: '84%',
          borderRadius: '18%',
          overflow: 'hidden',
          boxShadow: state === 'speaking' ? `0 0 0 3px ${ring}, 0 12px 30px rgba(0,0,0,.3)` : '0 10px 26px rgba(0,0,0,.25)',
          animation,
        }}
      >
        {children}
        {state === 'speaking' && !reducedMotion && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 8, display: 'grid', placeItems: 'center' }}>
            <div style={{ padding: '4px 8px', borderRadius: 12, background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(2px)' }}>
              <Waveform color="rgba(255,255,255,.9)" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageAvatar(props: { url: string; state: AvatarState; gesture: AvatarGesture | null; gestureNonce: number; reducedMotion: boolean }) {
  return (
    <MediaFrame state={props.state} gesture={props.gesture} gestureNonce={props.gestureNonce} reducedMotion={props.reducedMotion}>
      <img
        src={props.url}
        alt="avatar"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          animation: props.reducedMotion || props.state !== 'idle' ? undefined : 'va-kenburns 12s ease-in-out infinite',
        }}
      />
    </MediaFrame>
  );
}

function VideoAvatar(props: { url: string; state: AvatarState; gesture: AvatarGesture | null; gestureNonce: number; reducedMotion: boolean }) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (props.state === 'speaking' && !props.reducedMotion) {
      video.playbackRate = 1;
      void video.play().catch(() => {});
    } else if (props.state === 'listening' || props.state === 'thinking') {
      // Keep a subtle sign of life without full playback.
      video.playbackRate = 0.4;
      void video.play().catch(() => video.pause());
    } else {
      video.pause();
    }
  }, [props.state, props.reducedMotion]);

  return (
    <MediaFrame state={props.state} gesture={props.gesture} gestureNonce={props.gestureNonce} reducedMotion={props.reducedMotion}>
      <video
        ref={videoRef}
        src={props.url}
        muted
        loop
        playsInline
        preload="auto"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </MediaFrame>
  );
}

function DrawnAvatar(props: {
  preset: AvatarPreset;
  state: AvatarState;
  gesture: AvatarGesture | null;
  gestureNonce: number;
  reducedMotion: boolean;
}) {
  const { preset, state, gesture, reducedMotion } = props;
  const { mouth, blink } = useFaceAnimation(state, gesture, reducedMotion);
  const animate = !reducedMotion;

  const happy = gesture === 'happy';
  const surprise = gesture === 'surprise';
  const eyeOpen = surprise ? 1.3 : 1 - blink;
  const eyeHeight = happy ? 1.6 : 3.2 * eyeOpen + 0.6;
  const mouthHeight = surprise ? 11 : state === 'speaking' ? 2 + mouth * 9 : 2.2;
  const mouthWidth = surprise ? 9 : state === 'speaking' ? 13 - mouth * 3 : 13;
  const browLift = surprise ? -4 : state === 'speaking' ? -1.2 - mouth * 1.4 : state === 'listening' ? -1.6 : 0;
  const headTilt = state === 'listening' ? -5 : state === 'thinking' ? 4 : 0;
  const ring = ringColor(state);

  const showWave = gesture === 'wave' || state === 'speaking';
  const showThumb = gesture === 'thumbsUp';

  const headAnimation = gesture === 'nod'
    ? 'va-g-nod 0.7s ease'
    : gesture === 'shake'
      ? 'va-g-shake 0.7s ease'
      : animate && state === 'listening'
        ? 'va-nod 2.4s ease-in-out infinite'
        : animate && state === 'idle'
          ? 'va-breathe 4s ease-in-out infinite'
          : undefined;

  const bodyAnimation = (gesture === 'happy' || gesture === 'surprise') ? 'va-g-bounce 0.7s ease' : undefined;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      <style>{SHARED_KEYFRAMES}</style>
      {(state === 'listening' || state === 'speaking') && animate && (
        <>
          <span style={{ position: 'absolute', width: '78%', height: '78%', borderRadius: '50%', border: `2px solid ${ring}`, animation: 'va-ring 1.6s ease-out infinite' }} />
          <span style={{ position: 'absolute', width: '78%', height: '78%', borderRadius: '50%', border: `2px solid ${ring}`, animation: 'va-ring 1.6s ease-out infinite', animationDelay: '.8s' }} />
        </>
      )}
      <svg
        key={props.gestureNonce}
        viewBox="0 0 120 130"
        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'visible', animation: bodyAnimation }}
        role="img"
        aria-label={`avatar-${preset.id}-${state}`}
      >
        <defs>
          <radialGradient id={`bg-${preset.id}`} cx="50%" cy="38%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor={preset.clothDark} stopOpacity="0.12" />
          </radialGradient>
        </defs>

        <circle cx="60" cy="60" r="58" fill={`url(#bg-${preset.id})`} />

        <path
          d="M18 132 Q18 104 42 96 L78 96 Q102 104 102 132 Z"
          fill={preset.cloth}
          style={{ transformOrigin: '60px 132px', animation: animate ? 'va-sway 5s ease-in-out infinite' : undefined }}
        />
        <path d="M42 96 L60 112 L78 96 L72 100 Q60 108 48 100 Z" fill={preset.clothDark} opacity="0.6" />

        {showWave && (
          <g style={{ transformOrigin: '96px 104px', animation: animate ? (gesture === 'wave' ? 'va-g-wave 0.5s ease-in-out 3' : 'va-wave 1.1s ease-in-out infinite') : undefined }}>
            <rect x="92" y="86" width="7" height="22" rx="3.5" fill={preset.cloth} />
            <circle cx="95.5" cy="82" r="6" fill={preset.skin} />
          </g>
        )}

        {showThumb && (
          <g style={{ transformOrigin: '96px 104px', animation: animate ? 'va-pop 0.6s ease' : undefined }}>
            <rect x="90" y="90" width="12" height="16" rx="4" fill={preset.skin} />
            <rect x="94" y="80" width="5" height="14" rx="2.5" fill={preset.skin} />
          </g>
        )}

        <g style={{ transformOrigin: '60px 74px', transform: `rotate(${headTilt}deg)`, transition: 'transform .5s ease', animation: headAnimation }}>
          <path d="M30 58 Q30 26 60 26 Q90 26 90 58 L90 72 Q90 44 60 44 Q30 44 30 72 Z" fill={preset.hair} />
          <ellipse cx="60" cy="62" rx="27" ry="30" fill={preset.skin} />
          <circle cx="33" cy="64" r="5" fill={preset.skin} />
          <circle cx="87" cy="64" r="5" fill={preset.skin} />
          <path d="M32 58 Q32 30 60 30 Q88 30 88 58 Q78 46 60 46 Q49 46 44 52 Q40 56 36 62 Q34 60 32 58 Z" fill={preset.hairLight} />

          <g style={{ transform: `translateY(${browLift}px)`, transition: 'transform .25s ease' }}>
            <rect x="43" y="53" width="12" height="2.4" rx="1.2" fill={preset.hair} />
            <rect x="65" y="53" width="12" height="2.4" rx="1.2" fill={preset.hair} />
          </g>

          <g>
            {happy ? (
              <>
                <path d="M44 63 Q49 58 54 63" stroke="#20140f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <path d="M66 63 Q71 58 76 63" stroke="#20140f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
              </>
            ) : (
              <>
                <ellipse cx="49" cy="62" rx={surprise ? 5.4 : 4.6} ry={eyeHeight} fill="#ffffff" />
                <ellipse cx="71" cy="62" rx={surprise ? 5.4 : 4.6} ry={eyeHeight} fill="#ffffff" />
                {eyeOpen > 0.25 && (
                  <>
                    <circle cx="49.5" cy="62.5" r="2.3" fill="#20140f" />
                    <circle cx="71.5" cy="62.5" r="2.3" fill="#20140f" />
                    <circle cx="50.4" cy="61.6" r="0.7" fill="#ffffff" />
                    <circle cx="72.4" cy="61.6" r="0.7" fill="#ffffff" />
                  </>
                )}
              </>
            )}
          </g>

          <ellipse cx="45" cy="72" rx="4.5" ry="2.6" fill={preset.blush} opacity={happy ? 0.75 : 0.5} />
          <ellipse cx="75" cy="72" rx="4.5" ry="2.6" fill={preset.blush} opacity={happy ? 0.75 : 0.5} />

          <path d="M60 64 L57.5 70 Q60 71.5 62.5 70 Z" fill={preset.skinShadow} opacity="0.7" />

          <g style={{ transform: `translateX(${(mouthWidth - 13) / -2}px)` }}>
            {happy ? (
              <path d="M50 71 Q60 82 70 71 Q60 76 50 71 Z" fill="#7a2e2a" />
            ) : (
              <>
                <ellipse cx="60" cy={72 + (state === 'speaking' || surprise ? mouthHeight / 2 : 0)} rx={mouthWidth / 2} ry={mouthHeight / 2} fill="#7a2e2a" />
                {state !== 'speaking' && !surprise && (
                  <path d="M52 71 Q60 77 68 71" stroke="#7a2e2a" strokeWidth="2" fill="none" strokeLinecap="round" />
                )}
                {(state === 'speaking' && mouth > 0.4) && (
                  <ellipse cx="60" cy={74 + mouthHeight / 3} rx={mouthWidth / 3.4} ry={mouthHeight / 5} fill={preset.blush} opacity="0.85" />
                )}
              </>
            )}
          </g>
        </g>

        {state === 'thinking' && (
          <g fill={preset.clothDark}>
            <circle cx="96" cy="40" r="3">{animate && <animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" repeatCount="indefinite" />}</circle>
            <circle cx="105" cy="34" r="2.4">{animate && <animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" begin="0.2s" repeatCount="indefinite" />}</circle>
            <circle cx="112" cy="29" r="1.8">{animate && <animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" begin="0.4s" repeatCount="indefinite" />}</circle>
          </g>
        )}
      </svg>
    </div>
  );
}

export default function VoiceAvatar({ source, state, variant = 'full', gesture = null, gestureNonce = 0, className }: VoiceAvatarProps) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {source.type === 'image' && (
        <ImageAvatar url={source.url} state={state} gesture={gesture} gestureNonce={gestureNonce} reducedMotion={reducedMotion} />
      )}
      {source.type === 'video' && (
        <VideoAvatar url={source.url} state={state} gesture={gesture} gestureNonce={gestureNonce} reducedMotion={reducedMotion} />
      )}
      {source.type === 'preset' && (
        <DrawnAvatar preset={presetFor(source.presetId)} state={state} gesture={gesture} gestureNonce={gestureNonce} reducedMotion={reducedMotion} />
      )}
    </div>
  );
}

export { GESTURE_DURATION_MS };
export const AVATAR_GESTURES: AvatarGesture[] = ['wave', 'nod', 'shake', 'thumbsUp', 'happy', 'surprise'];
