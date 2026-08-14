import React from 'react';
import { Ban, CheckCircle2, FileKey2, Loader2, PackageCheck, Power, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { authStore } from '../lib/auth';
import { pluginRegistryApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { PluginInvocationTrace, PluginProvider } from '../types';

const statusTone: Record<PluginProvider['status'], string> = {
  INSTALLED: 'border-slate-200 bg-slate-50 text-slate-600',
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  DISABLED: 'border-amber-200 bg-amber-50 text-amber-700',
  REVOKED: 'border-red-200 bg-red-50 text-red-700',
  QUARANTINED: 'border-orange-200 bg-orange-50 text-orange-700',
};

export function PluginRegistryPanel() {
  const { t } = useTranslation();
  const isAdmin = (authStore.user()?.admin_level || 0) > 0;
  const [providers, setProviders] = React.useState<PluginProvider[]>([]);
  const [audit, setAudit] = React.useState<PluginInvocationTrace[]>([]);
  const [busy, setBusy] = React.useState('');
  const [showInstall, setShowInstall] = React.useState(false);
  const [manifest, setManifest] = React.useState('');
  const [signature, setSignature] = React.useState('');
  const [sbom, setSBOM] = React.useState('');
  const [visibility, setVisibility] = React.useState<'private' | 'public'>('private');
  const [activate, setActivate] = React.useState(true);

  const load = React.useCallback(async () => {
    setBusy(current => current || 'load');
    try {
      const [providerItems, auditItems] = await Promise.all([pluginRegistryApi.list(), pluginRegistryApi.audit()]);
      setProviders(providerItems);
      setAudit(auditItems);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('pluginRegistry.loadFailed'));
    } finally {
      setBusy('');
    }
  }, [t]);

  React.useEffect(() => { void load(); }, [load]);

  const reload = async () => {
    setBusy('reload');
    try {
      await pluginRegistryApi.reload();
      toast.success(t('pluginRegistry.reloaded'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('pluginRegistry.reloadFailed'));
    } finally {
      setBusy('');
    }
  };

  const transition = async (provider: PluginProvider, status: 'ACTIVE' | 'DISABLED' | 'REVOKED') => {
    const key = `${provider.provider_id}@${provider.version}`;
    if (status === 'REVOKED' && !window.confirm(t('pluginRegistry.revokeConfirm', { provider: key }))) return;
    setBusy(key);
    try {
      await pluginRegistryApi.transition(provider, status, status === 'REVOKED' ? 'revoked by administrator' : '');
      await pluginRegistryApi.reload();
      await load();
      toast.success(t('pluginRegistry.statusChanged', { status }));
    } catch (error) {
      await load();
      toast.error(error instanceof Error ? error.message : t('pluginRegistry.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const approve = async (provider: PluginProvider) => {
    const key = `${provider.provider_id}@${provider.version}`;
    setBusy(key);
    try {
      await pluginRegistryApi.approve(provider);
      await load();
      toast.success(t('pluginRegistry.reviewed'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('pluginRegistry.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const install = async () => {
    setBusy('install');
    try {
      const payload = { manifest: JSON.parse(manifest), signature: JSON.parse(signature), sbom: JSON.parse(sbom), visibility, activate: visibility === 'private' && activate };
      await pluginRegistryApi.install(payload);
      await pluginRegistryApi.reload();
      setManifest(''); setSignature(''); setSBOM(''); setShowInstall(false);
      await load();
      toast.success(t('pluginRegistry.installed'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('pluginRegistry.installFailed'));
    } finally {
      setBusy('');
    }
  };

  return <section className="theme-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-[linear-gradient(120deg,#071b2c,#0d3340)] px-5 py-5 text-white md:flex-row md:items-center">
      <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300"><PackageCheck size={15} /> Capability Provider Registry</div><h3 className="mt-2 text-lg font-black">{t('pluginRegistry.title')}</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">{t('pluginRegistry.subtitle')}</p></div>
      <div className="flex gap-2">
        {isAdmin && <button type="button" onClick={() => setShowInstall(value => !value)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold"><Upload size={14} />{t('pluginRegistry.install')}</button>}
        {isAdmin && <button type="button" onClick={() => void reload()} disabled={busy === 'reload'} className="flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-40"><RefreshCw size={14} className={busy === 'reload' ? 'animate-spin' : ''} />{t('pluginRegistry.reload')}</button>}
      </div>
    </div>

    {showInstall && <div className="grid gap-4 border-b border-slate-200 bg-slate-50 p-5 lg:grid-cols-3">
      <JSONInput label="plugin.json" value={manifest} onChange={setManifest} onFile={setManifest} />
      <JSONInput label="SIGNATURE" value={signature} onChange={setSignature} onFile={setSignature} />
      <JSONInput label="SBOM" value={sbom} onChange={setSBOM} onFile={setSBOM} />
      <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
        <select value={visibility} onChange={event => setVisibility(event.target.value as 'private' | 'public')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="private">{t('pluginRegistry.private')}</option><option value="public">{t('pluginRegistry.public')}</option></select>
        <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={activate} disabled={visibility === 'public'} onChange={event => setActivate(event.target.checked)} />{t('pluginRegistry.activateAfterInstall')}</label>
        <button type="button" onClick={() => void install()} disabled={!manifest || !signature || !sbom || busy === 'install'} className="ml-auto flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{busy === 'install' ? <Loader2 size={14} className="animate-spin" /> : <FileKey2 size={14} />}{t('pluginRegistry.verifyAndInstall')}</button>
      </div>
    </div>}

    <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {providers.map(provider => {
          const key = `${provider.provider_id}@${provider.version}`;
          const running = busy === key;
          return <article key={key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-sm text-slate-900">{key}</strong><span className={cn('rounded-full border px-2.5 py-1 text-[9px] font-black', statusTone[provider.status])}>{provider.status}</span><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase text-slate-500">{provider.visibility}</span></div><p className="mt-1 text-xs text-slate-500">{provider.description}</p><p className="mt-2 font-mono text-[9px] text-slate-400">sha256:{provider.manifest_sha256.slice(0, 20)}… · rev {provider.revision}</p></div><div className="flex flex-wrap gap-2">{isAdmin && provider.visibility === 'public' && provider.review_status !== 'APPROVED' && <SmallAction icon={ShieldCheck} label={t('pluginRegistry.approve')} onClick={() => void approve(provider)} disabled={running} />}{isAdmin && provider.status !== 'ACTIVE' && provider.status !== 'REVOKED' && <SmallAction icon={Power} label={t('pluginRegistry.enable')} onClick={() => void transition(provider, 'ACTIVE')} disabled={running} />}{isAdmin && provider.status === 'ACTIVE' && <SmallAction icon={Power} label={t('pluginRegistry.disable')} onClick={() => void transition(provider, 'DISABLED')} disabled={running} />}{isAdmin && provider.status !== 'REVOKED' && <SmallAction icon={Ban} label={t('pluginRegistry.revoke')} onClick={() => void transition(provider, 'REVOKED')} disabled={running} danger />}{running && <Loader2 size={15} className="animate-spin text-cyan-600" />}</div></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3"><MiniMetric label={t('pluginRegistry.capabilities')} value={String(provider.manifest.capabilities.length)} /><MiniMetric label={t('pluginRegistry.riskFloor')} value={provider.manifest.risk_floor} /><MiniMetric label={t('pluginRegistry.review')} value={`${provider.scan_status} / ${provider.review_status}`} good={provider.scan_status === 'PASSED' && provider.review_status === 'APPROVED'} /></div>
            <div className="mt-3 flex flex-wrap gap-1.5">{permissionLabels(provider).map(value => <span key={value} className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[9px] text-slate-500">{value}</span>)}{permissionLabels(provider).length === 0 && <span className="text-[10px] text-emerald-600">{t('pluginRegistry.noExternalPermissions')}</span>}</div>
          </article>;
        })}
        {providers.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-400">{busy === 'load' ? <Loader2 className="mx-auto animate-spin" /> : t('pluginRegistry.empty')}</div>}
      </div>
      <aside className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white"><div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /><h4 className="text-xs font-black uppercase tracking-wider">{t('pluginRegistry.audit')}</h4></div><div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">{audit.map(item => <div key={item.invocation_id} className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex items-center justify-between gap-2"><strong className="truncate font-mono text-[10px] text-cyan-200">{item.capability_id}</strong><span className={cn('text-[9px] font-black', item.status === 'SUCCEEDED' ? 'text-emerald-400' : 'text-amber-300')}>{item.status}</span></div><p className="mt-1 truncate font-mono text-[9px] text-slate-500">{item.provider_id}@{item.provider_version}</p><p className="mt-2 text-[9px] text-slate-400">{item.duration_ms} ms · {item.trace_id}</p></div>)}{audit.length === 0 && <p className="rounded-xl bg-white/5 p-3 text-[10px] text-slate-500">{t('pluginRegistry.noAudit')}</p>}</div></aside>
    </div>
  </section>;
}

function JSONInput({ label, value, onChange, onFile }: { label: string; value: string; onChange: (value: string) => void; onFile: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><textarea value={value} onChange={event => onChange(event.target.value)} className="mt-2 h-32 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-[10px] outline-none focus:border-cyan-400" /><input type="file" accept=".json,.txt" className="mt-2 block w-full text-[10px] text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-200 file:px-2 file:py-1" onChange={event => { const file = event.target.files?.[0]; if (file) void file.text().then(onFile); }} /></label>;
}

function SmallAction({ icon: Icon, label, onClick, disabled, danger }: { icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={cn('flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-2 text-[10px] font-bold disabled:opacity-40', danger ? 'border-red-200 text-red-600' : 'border-slate-200 text-slate-700')}><Icon size={12} />{label}</button>;
}

function MiniMetric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={cn('mt-1 truncate font-mono text-xs font-black', good ? 'text-emerald-600' : 'text-slate-800')}>{value}</p></div>;
}

function permissionLabels(provider: PluginProvider): string[] {
  const permissions = provider.manifest.permissions;
  const labels = [
    ...(permissions.network_domains || []).map(value => `net:${value}`),
    ...(permissions.filesystem_read || []).map(value => `fs:r:${value}`),
    ...(permissions.filesystem_write || []).map(value => `fs:w:${value}`),
    ...(permissions.credential_scopes || []).map(value => `credential:${value}`),
    ...(permissions.device_capabilities || []).map(value => `device:${value}`),
  ];
  if (permissions.external_effects) labels.push('external-effects');
  return labels;
}
