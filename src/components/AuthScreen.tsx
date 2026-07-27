import React from 'react';
import { ArrowRight, KeyRound, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { authApi } from '../lib/api';
import { authStore, AuthUser } from '../lib/auth';
import { AthenaMark } from './AthenaMark';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = mode === 'login'
        ? await authApi.login(username, password)
        : await authApi.register(username, password, nickname);
      authStore.save(result.access_token, result.user);
      onAuthenticated(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071311] text-white overflow-hidden relative">
      <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'radial-gradient(circle at 20% 10%, #33d6a6 0, transparent 26%), radial-gradient(circle at 85% 80%, #e7b94c 0, transparent 25%)' }} />
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      <main className="relative min-h-screen grid lg:grid-cols-[1.1fr_0.9fr]">
        <section className="p-10 lg:p-20 flex flex-col justify-between">
          <div className="flex items-center gap-3 text-emerald-300 font-semibold tracking-wide">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 shadow-lg shadow-emerald-950/30">
              <AthenaMark className="h-8 w-8" />
            </span>
            ATHENA AGENT RUNTIME
          </div>
          <div className="max-w-2xl py-16">
            <p className="text-emerald-300 uppercase tracking-[0.28em] text-xs font-bold mb-6">Private agent workspace</p>
            <h1 className="text-5xl lg:text-7xl font-black leading-[0.95] tracking-tight">你的模型。<br /><span className="text-amber-300">你的 Agent。</span><br />你的记忆。</h1>
            <p className="mt-8 text-slate-300 text-lg max-w-xl leading-relaxed">每个账户拥有独立的模型凭据、Agent 和长期记忆。公共 Agent 可以直接选择，但运行前必须绑定你自己的模型。</p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-300" /> 服务端资源隔离</span>
            <span className="flex items-center gap-2"><KeyRound size={17} className="text-amber-300" /> API Key 不返回浏览器</span>
            <span className="flex items-center gap-2"><Sparkles size={17} className="text-sky-300" /> 用户级长期记忆</span>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 lg:p-14">
          <form onSubmit={submit} className="w-full max-w-md bg-[#f4f0e7] text-slate-900 rounded-[2rem] p-8 lg:p-10 shadow-2xl shadow-black/40">
            <div className="flex bg-slate-200/70 rounded-full p-1 mb-9">
              {(['login', 'register'] as const).map(item => (
                <button key={item} type="button" onClick={() => { setMode(item); setError(''); }} className={`flex-1 py-2.5 rounded-full text-sm font-bold transition ${mode === item ? 'bg-slate-950 text-white' : 'text-slate-500'}`}>
                  {item === 'login' ? '登录' : '创建账户'}
                </button>
              ))}
            </div>
            <h2 className="text-3xl font-black">{mode === 'login' ? '继续你的工作' : '建立独立空间'}</h2>
            <p className="text-slate-500 mt-2 mb-7">{mode === 'login' ? '登录后读取你的 Agent 与模型配置。' : '账户创建后先去绑定一个模型。'}</p>
            <div className="space-y-4">
              <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">用户名</span><input value={username} onChange={e => setUsername(e.target.value)} minLength={3} required className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500" /></label>
              {mode === 'register' && <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">昵称</span><input value={nickname} onChange={e => setNickname(e.target.value)} className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500" /></label>}
              <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">密码</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500" /></label>
            </div>
            {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button disabled={loading} className="mt-7 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-4 flex items-center justify-center gap-2 transition">
              {loading ? <Loader2 className="animate-spin" size={19} /> : <>{mode === 'login' ? '登录' : '创建并登录'}<ArrowRight size={19} /></>}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
