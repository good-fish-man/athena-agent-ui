import React from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../lib/api';
import { authStore, AuthUser } from '../lib/auth';
import { AthenaMark } from './AthenaMark';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

type AuthMode = 'login' | 'register';

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = React.useState<AuthMode>('login');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const currentLanguage = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('zh') ? 'zh' : 'en';

  React.useEffect(() => {
    document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
  }, [currentLanguage]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
  };

  const changeLanguage = (language: 'en' | 'zh') => {
    void i18n.changeLanguage(language);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = mode === 'login'
        ? await authApi.login(username.trim(), password)
        : await authApi.register(username.trim(), password, nickname.trim());
      authStore.save(result.access_token, result.user);
      onAuthenticated(result.user);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('auth.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = 'group mt-2 flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10';
  const inputClass = 'min-w-0 flex-1 bg-transparent py-3.5 text-[15px] text-slate-950 outline-none placeholder:text-slate-300 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#061410] text-white selection:bg-emerald-300 selection:text-emerald-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: 'radial-gradient(circle at 14% 12%, rgba(42, 184, 135, .34) 0, transparent 29%), radial-gradient(circle at 88% 82%, rgba(234, 179, 52, .2) 0, transparent 26%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.075]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'linear-gradient(to bottom, black 0%, black 80%, transparent 100%)',
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full border border-emerald-300/10" />
      <div className="pointer-events-none absolute -left-10 top-[42%] h-44 w-44 rounded-full border border-emerald-300/10" />

      <header className="relative z-20 mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-6 sm:px-10 lg:px-16 lg:py-9 xl:px-20">
        <div className="flex items-center gap-3 text-emerald-300">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 shadow-lg shadow-emerald-950/30 backdrop-blur-sm">
            <AthenaMark className="h-8 w-8" />
          </span>
          <span className="text-sm font-extrabold tracking-[0.12em] sm:text-base">ATHENA</span>
          <span className="hidden h-4 w-px bg-emerald-200/25 sm:block" />
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/55 sm:block">{t('auth.runtime')}</span>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1 text-xs font-bold shadow-lg shadow-black/10 backdrop-blur-md" role="group" aria-label={t('auth.language')}>
          <Globe2 className="ml-2 mr-1 text-emerald-300" size={15} aria-hidden="true" />
          {(['en', 'zh'] as const).map(language => (
            <button
              key={language}
              type="button"
              onClick={() => changeLanguage(language)}
              aria-pressed={currentLanguage === language}
              className={`rounded-full px-3 py-2 transition-colors ${currentLanguage === language ? 'bg-[#f6f0e5] text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
            >
              {language === 'en' ? 'EN' : '中文'}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-104px)] w-full max-w-[1600px] grid-cols-1 px-6 pb-10 sm:px-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(430px,.85fr)] lg:gap-14 lg:px-16 lg:pb-14 xl:gap-24 xl:px-20">
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="hidden min-w-0 flex-col justify-center pb-10 lg:flex"
        >
          <div className="max-w-3xl">
            <div className="mb-7 flex items-center gap-3">
              <span className="h-px w-10 bg-emerald-300" />
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-300">{t('auth.eyebrow')}</p>
            </div>
            <h1 className="text-[clamp(3.7rem,5.4vw,6.7rem)] font-black leading-[0.89] tracking-[-0.065em]">
              <span className="block">{t('auth.hero.models')}</span>
              <span className="block text-amber-300">{t('auth.hero.agents')}</span>
              <span className="block">{t('auth.hero.memory')}</span>
            </h1>
            <p className="mt-9 max-w-2xl text-base leading-7 text-slate-300/85 xl:text-lg xl:leading-8">{t('auth.hero.description')}</p>
          </div>

          <div className="mt-14 grid max-w-3xl grid-cols-3 gap-3">
            {[
              { icon: ShieldCheck, label: t('auth.features.isolation'), color: 'text-emerald-300', index: '01' },
              { icon: KeyRound, label: t('auth.features.keys'), color: 'text-amber-300', index: '02' },
              { icon: Sparkles, label: t('auth.features.memory'), color: 'text-sky-300', index: '03' },
            ].map(({ icon: Icon, label, color, index }) => (
              <div key={index} className="group rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 backdrop-blur-sm transition hover:border-white/15 hover:bg-white/[0.055]">
                <div className="flex items-center justify-between">
                  <Icon size={18} className={color} aria-hidden="true" />
                  <span className="font-mono text-[9px] text-slate-500">{index}</span>
                </div>
                <p className="mt-6 text-xs font-semibold leading-5 text-slate-300">{label}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: reduceMotion ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-w-0 items-center justify-center py-4 lg:py-10"
        >
          <div className="w-full max-w-[520px]">
            <div className="mb-7 lg:hidden">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.26em] text-emerald-300">{t('auth.eyebrow')}</p>
              <h1 className="mt-3 text-4xl font-black leading-[.95] tracking-[-0.045em]">
                {t('auth.mobileTitle')} <span className="text-amber-300">Athena.</span>
              </h1>
            </div>

            <form
              onSubmit={submit}
              aria-labelledby="auth-title"
              className="relative overflow-hidden rounded-[2rem] border border-white/45 bg-[#f6f0e5] p-6 text-slate-950 shadow-[0_36px_90px_rgba(0,0,0,.42)] sm:p-9 lg:p-10"
            >
              <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">{t('auth.secureAccess')}</p>
                  <p className="mt-1 text-xs text-slate-400">{t('auth.privateSession')}</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full border border-emerald-700/15 bg-emerald-600/10 text-emerald-700">
                  <LockKeyhole size={18} aria-hidden="true" />
                </span>
              </div>

              <div className="flex rounded-2xl bg-slate-200/75 p-1" role="tablist" aria-label={t('auth.modeLabel')}>
                {(['login', 'register'] as const).map(item => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={mode === item}
                    onClick={() => changeMode(item)}
                    className={`flex-1 rounded-xl px-3 py-3 text-sm font-extrabold transition-all ${mode === item ? 'bg-slate-950 text-white shadow-md shadow-slate-900/15' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {t(`auth.modes.${item}`)}
                  </button>
                ))}
              </div>

              <div className="mb-7 mt-8">
                <h2 id="auth-title" className="text-3xl font-black tracking-[-0.035em] sm:text-[2rem]">{t(`auth.${mode}.title`)}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{t(`auth.${mode}.description`)}</p>
              </div>

              <div className="space-y-4">
                <label className="block" htmlFor="auth-username">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{t('auth.fields.username')}</span>
                  <span className={fieldClass}>
                    <UserRound size={18} className="text-slate-400 transition group-focus-within:text-emerald-600" aria-hidden="true" />
                    <input
                      id="auth-username"
                      value={username}
                      onChange={event => setUsername(event.target.value)}
                      minLength={3}
                      required
                      autoFocus
                      autoCapitalize="none"
                      autoComplete="username"
                      spellCheck={false}
                      disabled={loading}
                      placeholder={t('auth.fields.usernamePlaceholder')}
                      className={inputClass}
                    />
                  </span>
                </label>

                {mode === 'register' && (
                  <label className="block" htmlFor="auth-nickname">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{t('auth.fields.nickname')}</span>
                    <span className={fieldClass}>
                      <Sparkles size={18} className="text-slate-400 transition group-focus-within:text-emerald-600" aria-hidden="true" />
                      <input
                        id="auth-nickname"
                        value={nickname}
                        onChange={event => setNickname(event.target.value)}
                        autoComplete="name"
                        disabled={loading}
                        placeholder={t('auth.fields.nicknamePlaceholder')}
                        className={inputClass}
                      />
                    </span>
                  </label>
                )}

                <label className="block" htmlFor="auth-password">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{t('auth.fields.password')}</span>
                  <span className={fieldClass}>
                    <KeyRound size={18} className="text-slate-400 transition group-focus-within:text-emerald-600" aria-hidden="true" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      minLength={6}
                      required
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      disabled={loading}
                      placeholder={t('auth.fields.passwordPlaceholder')}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(value => !value)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      aria-label={t(showPassword ? 'auth.fields.hidePassword' : 'auth.fields.showPassword')}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-extrabold text-white shadow-lg shadow-emerald-800/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-xl disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={19} aria-hidden="true" />
                    <span>{t('auth.submitting')}</span>
                  </>
                ) : (
                  <>
                    <span>{t(mode === 'login' ? 'auth.actions.login' : 'auth.actions.register')}</span>
                    <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </>
                )}
              </button>

              <div className="mt-6 flex items-start gap-2.5 border-t border-slate-200/90 pt-5 text-xs leading-5 text-slate-500">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>{t('auth.securityNote')}</span>
              </div>
            </form>

            <p className="mt-5 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
              {t('auth.footer')}
            </p>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
