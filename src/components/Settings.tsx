import React from 'react';
import { Settings as SettingsIcon, Save, RotateCcw, FileCode, Info, FileJson, Loader2, Power, CheckCircle2, AlertTriangle, Palette, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { configApi } from '../lib/api';
import {
  currentThemeBackground,
  currentThemeCard,
  currentThemeColor,
  DEFAULT_THEME_BACKGROUND,
  DEFAULT_THEME_CARD,
  DEFAULT_THEME_COLOR,
  saveThemeBackground,
  saveThemeCard,
  saveThemeColor,
  THEME_BACKGROUND_PRESETS,
  THEME_CARD_PRESETS,
  THEME_PRESETS,
} from '../lib/theme';

const DEFAULT_APP_CONFIG = `# agent-runtime-client configuration
server:
  name: "agent-runtime-client"
  http_addr: ":8090"
  mode: "debug"
  public_prefix: "/api/agent-runtime-client/v1"

runtime:
  grpc_addr: "localhost:18080"
  http_addr: "http://127.0.0.1:18081"
  request_timeout_sec: 60
  dial_timeout_sec: 5

log:
  level: "debug"

db:
  db_type: "postgres"
  username: "postgres"
  password: ""
  db_host: "127.0.0.1"
  db_port: 5432
  db_name: "agent_runtime"
  charset: "utf8mb4"
  max_open_conn: 50
  max_idle_conn: 10
  conn_max_lifetime: 500
  log_mode: 4
  slow_threshold: 10

paths:
  app_config_file: ""
  skills_config_file: ""
  uploads_dir: ""
`;

const DEFAULT_SKILLS_CONFIG = `# Skill Global Configuration

# Global Settings
aws.region: us-east-1
aws.timeout: 30
log.level: info

# S3 Skill
s3-skill.bucket: my-bucket
s3-skill.region: cn-north-1
s3-skill.secret: your-aws-secret-key
s3-skill.access_key: your-aws-access-key
s3-skill.endpoint: https://s3.cn-north-1.amazonaws.com.cn

# PDF Skill
pdf-skill.output_dir: /tmp/pdf-output
pdf-skill.quality: high

# PPTX Skill
pptx-skill.template_dir: /workspace/templates
pptx-skill.output_dir: /workspace/outputs

# Sandbox Environment
skills:
  s3-skill:
    env:
      AWS_REGION: cn-north-1
      AWS_ACCESS_KEY_ID: your-access-key
      AWS_SECRET_ACCESS_KEY: your-secret-key
      S3_BUCKET: my-bucket
      S3_ENDPOINT: https://s3.cn-north-1.amazonaws.com.cn
  pdf-skill:
    env:
      OUTPUT_DIR: /tmp/pdf-output
      PDF_QUALITY: high
`;

const DEFAULT_RUNTIME_CONFIG = `# agent-runtime configuration
server:
  grpc_addr: ":18080"
  http_addr: ":18081"
  default_model:
    provider: "openai"
    name: "gpt-4o-mini"
    api_key: "\${DEFAULT_API_KEY}"
    api_base: "https://api.openai.com/v1"

db:
  enabled: true
  db_type: "postgres"
  username: "postgres"
  password: ""
  db_host: "localhost"
  db_port: 5432
  db_name: "agent_runtime"
  ssl_mode: "disable"

memory:
  enabled: false
  auto_migrate: true
  inject_into_prompt: true
  background_review: true
  max_review_memory: 10

skills:
  dir: "skills"
  config_path: "config/skills-config.yaml"
`;

type ConfigTab = 'client' | 'runtime' | 'skills';

export function Settings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<ConfigTab>('client');
  const [appConfig, setAppConfig] = React.useState(DEFAULT_APP_CONFIG);
  const [runtimeConfig, setRuntimeConfig] = React.useState(DEFAULT_RUNTIME_CONFIG);
  const [skillsConfig, setSkillsConfig] = React.useState(DEFAULT_SKILLS_CONFIG);
  const [savedConfigs, setSavedConfigs] = React.useState<Record<ConfigTab, string>>({
    client: DEFAULT_APP_CONFIG,
    runtime: DEFAULT_RUNTIME_CONFIG,
    skills: DEFAULT_SKILLS_CONFIG,
  });
  const [isSaved, setIsSaved] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRestarting, setIsRestarting] = React.useState(false);
  const [restartRequired, setRestartRequired] = React.useState({ client: false, runtime: false });
  const [restartSupported, setRestartSupported] = React.useState({ client: false, runtime: false });
  const [configPaths, setConfigPaths] = React.useState({ client: '', runtime: '', skills: '' });
  const [configAvailable, setConfigAvailable] = React.useState({ client: false, runtime: false, skills: false });
  const [serviceMessage, setServiceMessage] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [themeColor, setThemeColor] = React.useState(currentThemeColor);
  const [themeBackground, setThemeBackground] = React.useState(currentThemeBackground);
  const [themeCard, setThemeCard] = React.useState(currentThemeCard);

  const updateThemeColor = (color: string) => {
    setThemeColor(saveThemeColor(color));
  };

  const updateThemeBackground = (color: string) => {
    setThemeBackground(saveThemeBackground(color));
  };

  const updateThemeCard = (color: string) => {
    setThemeCard(saveThemeCard(color));
  };

  // Load configs on mount
  React.useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [appResult, runtimeResult, skillsResult, statusResult, runtimeStatusResult] = await Promise.allSettled([
        configApi.getAppConfig(),
        configApi.getRuntimeConfig(),
        configApi.getRuntimeSkillsConfig(),
        configApi.getStatus(),
        configApi.getRuntimeStatus(),
      ]);
      const app = appResult.status === 'fulfilled' ? appResult.value : null;
      const runtime = runtimeResult.status === 'fulfilled' ? runtimeResult.value : null;
      const skills = skillsResult.status === 'fulfilled' ? skillsResult.value : null;
      const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
      const runtimeStatus = runtimeStatusResult.status === 'fulfilled' ? runtimeStatusResult.value : null;
      if (app) {
        setAppConfig(app.content);
        setSavedConfigs(current => ({ ...current, client: app.content }));
      }
      if (runtime) {
        setRuntimeConfig(runtime.content);
        setSavedConfigs(current => ({ ...current, runtime: runtime.content }));
      }
      if (skills) {
        setSkillsConfig(skills.content);
        setSavedConfigs(current => ({ ...current, skills: skills.content }));
      }
      setConfigPaths({
        client: status?.app_config_file || app?.path || '',
        runtime: runtimeStatus?.runtime_config_file || runtime?.path || '',
        skills: runtimeStatus?.skills_config_file || skills?.path || '',
      });
      setConfigAvailable({ client: Boolean(app), runtime: Boolean(runtime), skills: Boolean(skills) });
      setRestartSupported({ client: Boolean(status?.restart_supported), runtime: Boolean(runtimeStatus?.restart_supported) });
      const failures: string[] = [];
      if (!app) failures.push(t('settings.configLoadClientError'));
      if (!runtime || !skills) failures.push(t('settings.configLoadRuntimeError'));
      setError(failures.length > 0 ? failures.join('；') : null);
    } catch (e: any) {
      setError(e.message || t('settings.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const result = activeTab === 'client'
        ? await configApi.saveAppConfig(appConfig)
        : activeTab === 'runtime'
          ? await configApi.saveRuntimeConfig(runtimeConfig)
          : await configApi.saveRuntimeSkillsConfig(skillsConfig);
      setConfigPaths(current => ({ ...current, [activeTab]: result.path }));
      setSavedConfigs(current => ({ ...current, [activeTab]: currentConfig }));
      const target = activeTab === 'client' ? 'client' : 'runtime';
      setRestartRequired(current => ({ ...current, [target]: current[target] || result.restart_required }));
      setIsSaved(true);
      setServiceMessage(result.restart_required ? t('settings.savedRestartRequired', { target }) : t('settings.savedToFile'));
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || t('settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestart = async () => {
    const target = activeTab === 'client' ? 'client' : 'runtime';
    const serviceName = target === 'client' ? 'agent-runtime-client' : 'agent-runtime';
    setIsRestarting(true);
    setError(null);
    try {
      const check = await configApi.checkRestart(target);
      const externalConflicts = check.conflicts.filter(conflict => !conflict.managed && !conflict.same_service);
      const sameServiceConflicts = check.conflicts.filter(conflict => !conflict.managed && conflict.same_service);
      const conflictDetails = externalConflicts.map(conflict =>
        `${conflict.protocol.toUpperCase()} :${conflict.port} · PID ${conflict.pid} · ${conflict.command || t('settings.unknownProgram')}`
      ).join('\n');
      const prompt = externalConflicts.length > 0
        ? t('settings.confirmPortConflict', { service: serviceName, details: conflictDetails })
        : sameServiceConflicts.length > 0
          ? t('settings.confirmOldInstances', { count: sameServiceConflicts.length, service: serviceName })
          : t('settings.confirmRestart', { service: serviceName });
      if (!window.confirm(prompt)) {
        setServiceMessage(t('settings.restartCancelled'));
        return;
      }
      setServiceMessage(t('settings.restartStarting', { service: serviceName }));
      const killPids = [...new Set(externalConflicts.map(conflict => conflict.pid))];
      if (target === 'client') await configApi.restart(killPids);
      else await configApi.restartRuntime(killPids);
      await new Promise(resolve => window.setTimeout(resolve, 800));
      let recovered = false;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          if (target === 'client') await configApi.getStatus();
          else await configApi.getRuntimeStatus();
          recovered = true;
          break;
        } catch {
          await new Promise(resolve => window.setTimeout(resolve, 1000));
        }
      }
      if (!recovered) throw new Error(t('settings.restartTimeout'));
      setRestartRequired(current => ({ ...current, [target]: false }));
      setServiceMessage(t('settings.restartComplete', { service: serviceName }));
      await loadConfigs();
    } catch (e: any) {
      setError(e.message || t('settings.restartFailed'));
      setServiceMessage(t('settings.restartFailed'));
    } finally {
      setIsRestarting(false);
    }
  };

  const handleReset = () => {
    if (window.confirm(t('settings.confirmReset'))) {
      if (activeTab === 'client') {
        setAppConfig(DEFAULT_APP_CONFIG);
      } else if (activeTab === 'runtime') {
        setRuntimeConfig(DEFAULT_RUNTIME_CONFIG);
      } else {
        setSkillsConfig(DEFAULT_SKILLS_CONFIG);
      }
    }
  };

  const handleResetAll = () => {
    if (window.confirm(t('settings.confirmResetAll'))) {
      setAppConfig(DEFAULT_APP_CONFIG);
      setRuntimeConfig(DEFAULT_RUNTIME_CONFIG);
      setSkillsConfig(DEFAULT_SKILLS_CONFIG);
    }
  };

  const currentConfig = activeTab === 'client' ? appConfig : activeTab === 'runtime' ? runtimeConfig : skillsConfig;
  const setCurrentConfig = (value: string) => {
    if (activeTab === 'client') {
      setAppConfig(value);
    } else if (activeTab === 'runtime') {
      setRuntimeConfig(value);
    } else {
      setSkillsConfig(value);
    }
  };

  const restartTarget = activeTab === 'client' ? 'client' : 'runtime';
  const needsRestart = restartRequired[restartTarget];
  const canRestart = restartSupported[restartTarget];
  const isConfigDirty = currentConfig !== savedConfigs[activeTab];
  const saveDisabled = isSaving || !configAvailable[activeTab] || !isConfigDirty;

  return (
    <div className="theme-canvas" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ height: '64px', borderBottom: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SettingsIcon size={20} color="#64748b" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>{t('settings.title')}</h1>
            <p style={{ fontSize: '12px', color: '#64748b' }}>{t('settings.subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleRestart}
            disabled={!canRestart || isRestarting || isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: needsRestart ? '#fff7ed' : 'white', border: `1px solid ${needsRestart ? '#fdba74' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: needsRestart ? '#c2410c' : '#475569', cursor: !canRestart || isRestarting ? 'not-allowed' : 'pointer', opacity: !canRestart ? 0.5 : 1 }}
          >
            {isRestarting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Power size={16} />}
            {isRestarting ? t('settings.restarting') : needsRestart ? t('settings.restartApply', { target: restartTarget }) : t('settings.restart', { target: restartTarget })}
          </button>
          <button
            onClick={handleResetAll}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}
          >
            <RotateCcw size={16} />
            {t('settings.resetAll')}
          </button>
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            title={isConfigDirty ? t('settings.saveCurrentTitle') : t('settings.unchangedTitle')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: saveDisabled ? 'not-allowed' : 'pointer',
              backgroundColor: isSaved ? '#22c55e' : saveDisabled ? '#94a3b8' : 'var(--color-brand-500)',
              color: 'white', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          >
            <Save size={16} />
            {isSaving ? t('settings.saving') : isSaved ? t('settings.saved') : isConfigDirty ? t('settings.saveCurrent') : t('settings.unchanged')}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ margin: '16px 24px', padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '14px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {serviceMessage && !error && (
        <div style={{ margin: '16px 24px 0', padding: '12px', backgroundColor: needsRestart ? '#fff7ed' : '#f0fdf4', border: `1px solid ${needsRestart ? '#fed7aa' : '#bbf7d0'}`, borderRadius: '8px', fontSize: '13px', color: needsRestart ? '#c2410c' : '#15803d', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {needsRestart ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {serviceMessage}
        </div>
      )}

      <div style={{ flex: 1, padding: '24px', display: 'flex', gap: '24px', overflow: 'hidden' }}>
        {/* Main Editor Area */}
        <div className="theme-editor" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '16px', border: '1px solid #d8e0ec', overflow: 'hidden' }}>
          {/* Tabs */}
          <div className="theme-editor-toolbar" style={{ padding: '8px', display: 'flex', gap: '4px', borderBottom: '1px solid #d8e0ec' }}>
            <button
              onClick={() => setActiveTab('client')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
                backgroundColor: activeTab === 'client' ? 'white' : 'transparent',
                color: activeTab === 'client' ? '#0f172a' : '#64748b',
                border: 'none', cursor: 'pointer'
              }}
            >
              <FileCode size={16} />
              {t('settings.clientConfig')}
            </button>
            <button
              onClick={() => setActiveTab('runtime')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
                backgroundColor: activeTab === 'runtime' ? 'white' : 'transparent',
                color: activeTab === 'runtime' ? '#0f172a' : '#64748b',
                border: 'none', cursor: 'pointer'
              }}
            >
              <FileCode size={16} />
              {t('settings.runtimeConfig')}
            </button>
            <button
              onClick={() => setActiveTab('skills')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
                backgroundColor: activeTab === 'skills' ? 'white' : 'transparent',
                color: activeTab === 'skills' ? '#0f172a' : '#64748b',
                border: 'none', cursor: 'pointer'
              }}
            >
              <FileJson size={16} />
              {t('settings.skillsConfig')}
            </button>
          </div>

          {/* Editor Header */}
          <div className="theme-editor-toolbar" style={{ padding: '12px 16px', borderBottom: '1px solid #d8e0ec', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeTab === 'skills' ? <FileJson size={16} color="#94a3b8" /> : <FileCode size={16} color="#94a3b8" />}
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                {activeTab === 'client' ? 'client/config.yaml' : activeTab === 'runtime' ? 'runtime/config.yaml' : 'runtime/skills-config.yaml'}
              </span>
              <span title={configPaths[activeTab]} style={{ maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '10px', color: '#94a3b8' }}>
                {configPaths[activeTab] || t('settings.pathLoading')}
              </span>
            </div>
            <button
              onClick={handleReset}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '12px', color: '#64748b', backgroundColor: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              <RotateCcw size={12} />
              {t('settings.reset')}
            </button>
          </div>

          {/* Editor Content */}
          <div className="theme-editor" style={{ flex: 1, minHeight: '300px', position: 'relative' }}>
            {isLoading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={24} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <textarea
                value={currentConfig}
                onChange={(e) => setCurrentConfig(e.target.value)}
                spellCheck={false}
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  width: '100%', height: '100%', padding: '24px',
                  fontFamily: 'monospace', fontSize: '14px', color: '#1e293b',
                  backgroundColor: 'transparent', resize: 'none', border: 'none', outline: 'none'
                }}
              />
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="scrollbar-hide" style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '2px' }}>
          <div className="theme-card" style={{ borderRadius: '16px', border: '1px solid var(--theme-card-border)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={18} color="var(--color-brand-500)" />
                <h2 style={{ fontWeight: 'bold', color: '#0f172a' }}>{t('settings.appearanceTitle')}</h2>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>{themeColor}</span>
            </div>
            <p style={{ marginBottom: '12px', fontSize: '11px', lineHeight: 1.6, color: '#64748b' }}>
              {t('settings.appearanceDescription')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', padding: '7px 9px', borderRadius: '9px', backgroundColor: '#f0fdf4', color: '#15803d', fontSize: '10px', fontWeight: 'bold' }}>
              <CheckCircle2 size={13} />
              {t('settings.appearanceAutoSaved')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {THEME_PRESETS.map(preset => {
                const selected = themeColor === preset.color;
                return (
                  <button
                    type="button"
                    key={preset.color}
                    onClick={() => updateThemeColor(preset.color)}
                    title={t('settings.useAccentColor', { color: preset.color })}
                    aria-label={t('settings.useAccentColor', { color: preset.color })}
                    style={{
                      position: 'relative', height: '42px', borderRadius: '12px', cursor: 'pointer',
                      border: selected ? `3px solid ${preset.color}` : '3px solid transparent',
                      backgroundColor: `${preset.color}18`, boxShadow: selected ? 'inset 0 0 0 2px white' : 'none'
                    }}
                  >
                    <span style={{ position: 'absolute', inset: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', backgroundColor: preset.color, color: 'white' }}>
                      {selected && <Check size={14} strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <label style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '9px 12px', overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: themeColor, boxShadow: '0 0 0 2px white, 0 0 0 3px #cbd5e1' }} />
                {t('settings.customAccent')}
                <input
                  type="color"
                  value={themeColor}
                  onInput={event => updateThemeColor(event.currentTarget.value)}
                  onChange={event => updateThemeColor(event.target.value)}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', opacity: 0 }}
                />
              </label>
              <button
                type="button"
                onClick={() => updateThemeColor(DEFAULT_THEME_COLOR)}
                title={t('settings.resetAccent')}
                style={{ display: 'flex', width: '38px', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: 'white', color: '#64748b', cursor: 'pointer' }}
              >
                <RotateCcw size={14} />
              </button>
            </div>

            <div style={{ height: '1px', margin: '18px 0 14px', backgroundColor: '#e2e8f0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>{t('settings.backgroundTitle')}</div>
                <div style={{ marginTop: '2px', fontSize: '10px', color: '#64748b' }}>{t('settings.backgroundDescription')}</div>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>{themeBackground}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
              {THEME_BACKGROUND_PRESETS.map(preset => {
                const selected = themeBackground === preset.color;
                return (
                  <button
                    type="button"
                    key={preset.color}
                    onClick={() => updateThemeBackground(preset.color)}
                    title={t('settings.useBackgroundColor', { color: preset.color })}
                    aria-label={t('settings.useBackgroundColor', { color: preset.color })}
                    style={{
                      position: 'relative', height: '34px', borderRadius: '10px', cursor: 'pointer',
                      border: selected ? '2px solid var(--color-brand-500)' : '1px solid #dbe3ee',
                      backgroundColor: preset.color,
                      boxShadow: selected ? '0 0 0 2px white, 0 0 0 3px var(--color-brand-100)' : 'none',
                      color: '#475569'
                    }}
                  >
                    {selected && <Check size={13} strokeWidth={3} style={{ margin: 'auto' }} />}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <label style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '9px 12px', overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: themeBackground, boxShadow: '0 0 0 1px #cbd5e1' }} />
                {t('settings.customBackground')}
                <input
                  type="color"
                  value={themeBackground}
                  onInput={event => updateThemeBackground(event.currentTarget.value)}
                  onChange={event => updateThemeBackground(event.target.value)}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', opacity: 0 }}
                />
              </label>
              <button
                type="button"
                onClick={() => updateThemeBackground(DEFAULT_THEME_BACKGROUND)}
                title={t('settings.resetBackground')}
                style={{ display: 'flex', width: '38px', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: 'white', color: '#64748b', cursor: 'pointer' }}
              >
                <RotateCcw size={14} />
              </button>
            </div>

            <div style={{ height: '1px', margin: '18px 0 14px', backgroundColor: 'var(--theme-card-border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>{t('settings.cardTitle')}</div>
                <div style={{ marginTop: '2px', fontSize: '10px', color: '#64748b' }}>{t('settings.cardDescription')}</div>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>{themeCard}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
              {THEME_CARD_PRESETS.map(preset => {
                const selected = themeCard === preset.color;
                return (
                  <button
                    type="button"
                    key={preset.color}
                    onClick={() => updateThemeCard(preset.color)}
                    title={t('settings.useCardColor', { color: preset.color })}
                    aria-label={t('settings.useCardColor', { color: preset.color })}
                    style={{
                      position: 'relative', height: '34px', borderRadius: '10px', cursor: 'pointer',
                      border: selected ? '2px solid var(--color-brand-500)' : '1px solid #cbd5e1',
                      backgroundColor: preset.color,
                      boxShadow: selected ? '0 0 0 2px var(--theme-card-bg), 0 0 0 3px var(--color-brand-100)' : 'none',
                      color: '#475569'
                    }}
                  >
                    {selected && <Check size={13} strokeWidth={3} style={{ margin: 'auto' }} />}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <label style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '9px 12px', overflow: 'hidden', border: '1px solid var(--theme-card-border)', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: themeCard, boxShadow: '0 0 0 1px #94a3b8' }} />
                {t('settings.customCard')}
                <input
                  type="color"
                  value={themeCard}
                  onInput={event => updateThemeCard(event.currentTarget.value)}
                  onChange={event => updateThemeCard(event.target.value)}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', opacity: 0 }}
                />
              </label>
              <button
                type="button"
                onClick={() => updateThemeCard(DEFAULT_THEME_CARD)}
                title={t('settings.resetCard')}
                style={{ display: 'flex', width: '38px', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--theme-card-border)', borderRadius: '10px', backgroundColor: 'var(--theme-card-bg)', color: '#64748b', cursor: 'pointer' }}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          <div className="theme-card" style={{ borderRadius: '16px', border: '1px solid var(--theme-card-border)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', marginBottom: '16px' }}>
              <Info size={18} color="var(--color-brand-500)" />
              <h2 style={{ fontWeight: 'bold' }}>{t('settings.infoTitle')}</h2>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              {t('settings.infoDescription')}
            </p>
            <div style={{ padding: '12px', backgroundColor: 'var(--color-brand-50)', borderRadius: '12px', border: '1px solid var(--color-brand-100)' }}>
              <p style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-brand-600)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {t('settings.tipTitle')}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--color-brand-700)' }}>
                {t('settings.tipDescription')}
              </p>
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', borderRadius: '16px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', marginBottom: '12px' }}>{t('settings.helpTitle')}</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--color-brand-500)', marginTop: '6px', flexShrink: 0 }} />
                <span>{t('settings.help1')}</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--color-brand-500)', marginTop: '6px', flexShrink: 0 }} />
                <span>{t('settings.help2')}</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11px', color: '#94a3b8' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--color-brand-500)', marginTop: '6px', flexShrink: 0 }} />
                <span>{t('settings.help3')}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
