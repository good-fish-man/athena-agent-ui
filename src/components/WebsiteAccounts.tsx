import React from 'react';
import { Eye, EyeOff, Globe2, KeyRound, Loader2, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { siteCredentialApi, type SiteCredential } from '../lib/api';

const emptyForm = { name: '', login_url: '', username: '', password: '' };

export function WebsiteAccounts() {
  const { t } = useTranslation();
  const [items, setItems] = React.useState<SiteCredential[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [editing, setEditing] = React.useState<SiteCredential | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await siteCredentialApi.findAll());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('websiteAccounts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { void load(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await siteCredentialApi.update(editing.ulid, form);
      } else {
        await siteCredentialApi.create(form);
      }
      setForm(emptyForm);
      setEditing(null);
      setShowForm(false);
      toast.success(t('websiteAccounts.saved'));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('websiteAccounts.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const edit = (item: SiteCredential) => {
    setEditing(item);
    setForm({ name: item.name, login_url: item.login_url, username: '', password: '' });
    setShowForm(true);
  };

  const toggleEnabled = async (item: SiteCredential) => {
    try {
      const updated = await siteCredentialApi.update(item.ulid, { enabled: !item.enabled });
      setItems(current => current.map(entry => entry.ulid === item.ulid ? updated : entry));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('websiteAccounts.saveFailed'));
    }
  };

  const remove = async (item: SiteCredential) => {
    if (!window.confirm(t('websiteAccounts.confirmDelete', { name: item.name }))) return;
    try {
      await siteCredentialApi.delete(item.ulid);
      setItems(current => current.filter(entry => entry.ulid !== item.ulid));
      toast.success(t('websiteAccounts.deleted'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('websiteAccounts.deleteFailed'));
    }
  };

  return (
    <div className="theme-canvas min-h-full p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
              <ShieldCheck size={14} /> Auth Vault
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">{t('websiteAccounts.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t('websiteAccounts.subtitle')}</p>
          </div>
          <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg">
            <Plus size={17} /> {t('websiteAccounts.add')}
          </button>
        </header>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {[['shield', t('websiteAccounts.localEncryption')], ['model', t('websiteAccounts.modelIsolation')], ['verify', t('websiteAccounts.manualVerification')]].map(([key, label]) => (
            <div key={key} className="theme-card rounded-2xl border border-slate-200/80 p-4 text-xs font-semibold leading-5 text-slate-600 shadow-sm">{label}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="animate-spin text-brand-600" /></div>
        ) : items.length === 0 ? (
          <div className="theme-card flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 p-8 text-center">
            <KeyRound size={34} className="mb-4 text-slate-300" />
            <p className="font-bold text-slate-800">{t('websiteAccounts.empty')}</p>
            <p className="mt-2 text-sm text-slate-500">{t('websiteAccounts.emptyHint')}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map(item => (
              <article key={item.ulid} className="theme-card rounded-3xl border border-slate-200/80 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Globe2 size={21} /></div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => edit(item)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={t('websiteAccounts.edit')}><Pencil size={16} /></button>
                    <button type="button" onClick={() => void remove(item)} className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label={t('websiteAccounts.deleteFailed')}><Trash2 size={16} /></button>
                  </div>
                </div>
                <h2 className="mt-5 truncate text-lg font-black text-slate-900">{item.name}</h2>
                <p className="mt-1 truncate text-xs font-bold uppercase tracking-wider text-brand-700">{item.domain}</p>
                <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('websiteAccounts.username')}</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-700">{item.username_masked}</p>
                </div>
                <button type="button" onClick={() => void toggleEnabled(item)} className={`mt-4 w-full rounded-xl px-3 py-2 text-xs font-bold ${item.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.enabled ? t('websiteAccounts.enabled') : t('websiteAccounts.disabled')}</button>
              </article>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <form onSubmit={save} className="theme-card w-full max-w-lg rounded-3xl border border-white/60 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div><h2 className="text-xl font-black text-slate-950">{editing ? t('websiteAccounts.editTitle') : t('websiteAccounts.addTitle')}</h2><p className="mt-1 text-xs text-slate-500">{editing ? t('websiteAccounts.updateHint') : t('websiteAccounts.passwordHint')}</p></div>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {(['name', 'login_url', 'username'] as const).map(field => (
                <label key={field} className="block text-xs font-bold text-slate-600">
                  {t(`websiteAccounts.${field}`)}
                  <input required={!editing || field !== 'username'} placeholder={editing && field === 'username' ? t('websiteAccounts.keepUsername') : ''} type={field === 'login_url' ? 'url' : 'text'} value={form[field]} onChange={e => setForm(current => ({ ...current, [field]: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand-500" />
                </label>
              ))}
              <label className="block text-xs font-bold text-slate-600">
                {t('websiteAccounts.password')}
                <span className="relative mt-2 block">
                  <input required={!editing} placeholder={editing ? t('websiteAccounts.keepPassword') : ''} type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(current => ({ ...current, password: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 pr-11 text-sm outline-none focus:border-brand-500" />
                  <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </span>
              </label>
            </div>
            <button disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}{t('websiteAccounts.save')}</button>
          </form>
        </div>
      )}
    </div>
  );
}
