import React from 'react';
import {
  Cpu,
  CheckCircle2,
  Settings2,
  ChevronRight,
  BarChart3,
  Activity,
  Plus,
  X,
  Database,
  Globe,
  Key,
  Loader2,
  Trash2,
  Pencil,
  Download,
  FlaskConical,
  HardDrive,
  Laptop,
  PackageCheck,
  Power,
  Image as ImageIcon,
  Video
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { Model } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { modelApi, modelKeyApi } from '../lib/api';
import type { LocalModelEnvironment, LocalModelInstallJob, ModelCatalog, ModelKey } from '../lib/api';
import { toast } from 'sonner';
import { ModelTrainingLab } from './ModelTrainingLab';
import { authStore } from '../lib/auth';
import { MODEL_PROVIDER, MODEL_RUNTIME_MODE } from '../lib/runtimeConstants';

function isLocalKeyOptional(provider: string, baseUrl: string) {
  const normalized = provider.toLowerCase().replace(/[\s._-]/g, '');
  if ([MODEL_PROVIDER.OLLAMA, 'lmstudio', 'localai', 'vllm', 'llamacpp', 'xinference', 'tgi', 'textgenerationinference', 'llamafile', 'textgenerationwebui', MODEL_PROVIDER.DIFFUSERS, 'comfyui'].includes(normalized)) return true;
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === 'host.docker.internal' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true;
    return (!hostname.includes('.') && !hostname.includes(':')) || /^(0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.)/.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) || hostname === '::1';
  } catch {
    return false;
  }
}

function supportsRuntimeLifecycle(provider: string) {
	const normalized = provider.toLowerCase().replace(/[\s._-]/g, '');
	return normalized === MODEL_PROVIDER.OLLAMA || normalized === MODEL_PROVIDER.DIFFUSERS;
}

function formatCapacity(bytes: number) {
  if (!bytes) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '')} ${units[unitIndex]}`;
}

function formatTokenCount(value: number) {
	return new Intl.NumberFormat(undefined, {
		notation: value >= 1000 ? 'compact' : 'standard',
		maximumFractionDigits: 1,
	}).format(value || 0);
}

export function ModelManager() {
  const { t } = useTranslation();
	const currentUserId = authStore.userID();
	const isAdmin = (authStore.user()?.admin_level || 0) > 0;
  const [showAllUsers, setShowAllUsers] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'llm' | 'embedding' | 'image' | 'video'>('llm');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [newModelType, setNewModelType] = React.useState<'llm' | 'embedding' | 'image' | 'video'>('llm');
  const [editingModelId, setEditingModelId] = React.useState<string | null>(null);
  const [isTrainingOpen, setIsTrainingOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [catalog, setCatalog] = React.useState<ModelCatalog[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = React.useState('');
	const [localEnvironment, setLocalEnvironment] = React.useState<LocalModelEnvironment | null>(null);
	const [environmentLoading, setEnvironmentLoading] = React.useState(false);
	const [installJob, setInstallJob] = React.useState<LocalModelInstallJob | null>(null);
	const [keys, setKeys] = React.useState<ModelKey[]>([]);
	const [isKeyModalOpen, setIsKeyModalOpen] = React.useState(false);
	const [editingKeyId, setEditingKeyId] = React.useState<string | null>(null);

  const [models, setModels] = React.useState<Model[]>([]);
	const visibleLLMTokenTotal = models
		.filter(model => model.type === 'llm')
		.reduce((total, model) => total + (model.totalTokens || 0), 0);

  const loadModels = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = isAdmin && showAllUsers
        ? await modelApi.findAdminAll()
        : await modelApi.findAll(undefined, true);
      const mapped = data.map((m: any) => ({
        id: m.ulid,
        name: m.name,
        provider: m.provider,
        baseUrl: m.baseUrl,
        apiKey: '',
		enabled: m.enabled !== false,
		runtimeMode: m.runtimeMode || MODEL_RUNTIME_MODE.ON_DEMAND,
		status: (m.enabled === false ? 'disabled' : 'active') as 'active' | 'disabled',
		ownerId: m.created_by,
        latency: m.latency || 'N/A',
        contextWindow: m.contextWindow || 'N/A',
        usage: m.usage || 0,
		usageRate: m.usageRate || 0,
		usageCount: m.usageCount || 0,
		successRate: m.successRate || 0,
		inputTokens: m.inputTokens || 0,
		outputTokens: m.outputTokens || 0,
		totalTokens: m.totalTokens || 0,
        type: m.modelType as 'llm' | 'embedding' | 'image' | 'video',
		capabilities: m.capabilities || '',
		category: m.category as 'default' | 'rewrite' | 'skill' | 'summarize' | undefined,
		keyId: m.keyId,
		keyName: m.keyName,
      }));
      setModels(mapped);
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, showAllUsers]);

	const loadKeys = React.useCallback(async () => {
		try { setKeys(await modelKeyApi.findAll()); } catch (err) { console.error('Failed to load model keys:', err); }
	}, []);

  React.useEffect(() => {
	loadModels();
	loadKeys();
  }, [loadModels, loadKeys]);

  React.useEffect(() => {
    const loadCatalog = async () => {
      try {
        const data = await modelApi.findCatalog();
        setCatalog(data);
      } catch (err) {
        console.error('Failed to load model catalog:', err);
      }
    };
    loadCatalog();
  }, []);

  const [formData, setFormData] = React.useState({
    name: '',
    provider: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
	keyId: '',
    category: 'default' as 'default' | 'rewrite' | 'skill' | 'summarize',
    contextWindow: '',
	capabilities: '',
  });
	const [keyForm, setKeyForm] = React.useState({ name: '', provider: 'OpenAI', apiKey: '', baseUrl: '' });

  const filteredCatalog = React.useMemo(
    () => catalog.filter(item => item.modelType === newModelType),
    [catalog, newModelType]
  );
  const selectedCatalog = catalog.find(item => item.ulid === selectedCatalogId);
	const addModelLabel = (type: 'llm' | 'embedding' | 'image' | 'video') => t(type === 'llm' ? 'models.addModel' : type === 'embedding' ? 'models.addEmbedding' : type === 'image' ? 'models.addImage' : 'models.addVideo');
	const editModelLabel = (type: 'llm' | 'embedding' | 'image' | 'video') => t(type === 'llm' ? 'models.editModel' : type === 'embedding' ? 'models.editEmbedding' : type === 'image' ? 'models.editImage' : 'models.editVideo');

	React.useEffect(() => {
		let cancelled = false;
		if (!selectedCatalog?.isFree || !selectedCatalog.installable) {
			setLocalEnvironment(null);
			setEnvironmentLoading(false);
			return;
		}
		setEnvironmentLoading(true);
		modelApi.localEnvironment(selectedCatalog.ulid)
			.then(environment => { if (!cancelled) setLocalEnvironment(environment); })
			.catch(error => { if (!cancelled) toast.error(error instanceof Error ? error.message : t('models.environmentFailed')); })
			.finally(() => { if (!cancelled) setEnvironmentLoading(false); });
		return () => { cancelled = true; };
	}, [selectedCatalog?.ulid, selectedCatalog?.isFree, selectedCatalog?.installable, t]);

	React.useEffect(() => {
		if (!installJob?.jobId || !['queued', 'running'].includes(installJob.status)) return;
		let cancelled = false;
		const poll = async () => {
			try {
				const next = await modelApi.installJob(installJob.jobId);
				if (cancelled) return;
				setInstallJob(next);
				if (next.status === 'completed') {
					window.clearInterval(timer);
					toast.success(t('models.installComplete'));
					if (selectedCatalogId === next.catalogId) setLocalEnvironment(await modelApi.localEnvironment(next.catalogId));
				} else if (next.status === 'failed') {
					window.clearInterval(timer);
					toast.error(next.error || t('models.installFailed'));
				}
			} catch (error) {
				if (!cancelled) {
					window.clearInterval(timer);
					toast.error(error instanceof Error ? error.message : t('models.installStatusFailed'));
				}
			}
		};
		const timer = window.setInterval(poll, 1000);
		void poll();
		return () => { cancelled = true; window.clearInterval(timer); };
	}, [installJob?.jobId, selectedCatalogId, t]);

  const applyCatalogPreset = (catalogId: string) => {
    setSelectedCatalogId(catalogId);
    const preset = catalog.find(item => item.ulid === catalogId);
    if (!preset) return;

	setFormData(prev => ({
      ...prev,
      name: preset.modelVersion,
      provider: preset.provider,
      baseUrl: preset.defaultBaseUrl,
	  contextWindow: preset.contextWindow,
	  capabilities: preset.capabilities,
	  keyId: keys.find(key => key.enabled && key.provider.toLowerCase() === preset.provider.toLowerCase())?.ulid || '',
	}));
  };

	const installSelectedModel = async () => {
		if (!selectedCatalog) return;
		try {
			const result = await modelApi.installLocal(selectedCatalog.ulid);
			setInstallJob({
				jobId: result.jobId, catalogId: selectedCatalog.ulid, modelVersion: selectedCatalog.modelVersion,
				status: 'queued', stage: 'environment', progress: 0, message: t('models.installQueued'),
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t('models.installFailed'));
		}
	};

	const matchingKeys = keys.filter(key => key.enabled && key.provider.toLowerCase() === formData.provider.toLowerCase());
	const keyOptional = isLocalKeyOptional(formData.provider, formData.baseUrl);

  const handleAddModel = async (e: React.FormEvent) => {
	e.preventDefault();
	if (!formData.keyId && !keyOptional) {
	  toast.error('请先选择模型 Key');
	  return;
	}
	try {
      if (editingModelId) {
        await modelApi.update(editingModelId, {
          name: formData.name,
          provider: formData.provider,
          baseUrl: formData.baseUrl,
		  keyId: formData.keyId,
          modelType: newModelType,
          category: newModelType === 'llm' ? formData.category : undefined,
          contextWindow: formData.contextWindow,
		  capabilities: formData.capabilities,
        });
      } else {
        await modelApi.create({
          name: formData.name,
          provider: formData.provider,
          baseUrl: formData.baseUrl,
		  keyId: formData.keyId,
          modelType: newModelType,
          category: newModelType === 'llm' ? formData.category : '',
          contextWindow: formData.contextWindow,
		  capabilities: formData.capabilities,
        });
      }
      await loadModels();
	} catch (err) {
	  console.error('Failed to save model:', err);
	  toast.error(err instanceof Error ? err.message : '模型保存失败');
	  return;
	}
    setIsModalOpen(false);
    setEditingModelId(null);
    setSelectedCatalogId('');
	setFormData({ name: '', provider: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyId: '', category: 'default', contextWindow: '', capabilities: '' });
  };

  const handleEditClick = (model: Model) => {
    setEditingModelId(model.id);
    setNewModelType(model.type);
    setFormData({
      name: model.name,
      provider: model.provider,
      baseUrl: model.baseUrl || 'https://api.openai.com/v1',
	  keyId: model.keyId || '',
      category: model.category || 'default',
      contextWindow: model.contextWindow || '',
	  capabilities: model.capabilities || '',
    });
    setSelectedCatalogId('');
    setIsModalOpen(true);
  };

	const openNewKey = (provider = formData.provider) => {
		setEditingKeyId(null);
		setKeyForm({ name: `${provider} Key`, provider, apiKey: '', baseUrl: '' });
		setIsKeyModalOpen(true);
	};

	const editKey = (key: ModelKey) => {
		setEditingKeyId(key.ulid);
		setKeyForm({ name: key.name, provider: key.provider, apiKey: '', baseUrl: key.baseUrl || '' });
		setIsKeyModalOpen(true);
	};

	const saveKey = async (event: React.FormEvent) => {
		event.preventDefault();
		try {
			let savedKeyId = editingKeyId || '';
			if (editingKeyId) await modelKeyApi.update(editingKeyId, keyForm);
			else savedKeyId = (await modelKeyApi.create(keyForm)).ulid;
			await loadKeys();
			if (isModalOpen && keyForm.provider.toLowerCase() === formData.provider.toLowerCase()) setFormData(current => ({ ...current, keyId: savedKeyId }));
			setIsKeyModalOpen(false);
			toast.success(editingKeyId ? 'Key 已更新，引用它的模型会立即使用新值' : 'Key 已保存');
		} catch (err) { toast.error(err instanceof Error ? err.message : 'Key 保存失败'); }
	};

	const deleteKey = async (key: ModelKey) => {
		try { await modelKeyApi.delete(key.ulid); await loadKeys(); setIsKeyModalOpen(false); toast.success('Key 已删除'); }
		catch (err) { toast.error(err instanceof Error ? err.message : 'Key 删除失败'); }
	};

  const handleDeleteModel = async (id: string) => {
    try {
      await modelApi.delete(id);
      await loadModels();
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
    setIsModalOpen(false);
    setEditingModelId(null);
  };

	const toggleModel = async (model: Model) => {
		try {
			await modelApi.updateEnabled(model.id, !model.enabled);
			await loadModels();
			toast.success(model.enabled ? t('common.disabled') : t('common.enabled'));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : '模型状态更新失败');
		}
	};

	const updateRuntimeMode = async (model: Model, runtimeMode: Model['runtimeMode']) => {
		try {
			await modelApi.updateRuntimeMode(model.id, runtimeMode);
			await loadModels();
			toast.success(t('models.runtimeModeUpdated'));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t('models.runtimeModeFailed'));
		}
	};

  const filteredModels = models.filter(m => m.type === activeTab);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('models.title')}</h1>
          <p className="text-slate-500 mt-1">{t('models.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {isAdmin && (
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label={t('models.modelScope')}>
              <button
                type="button"
                onClick={() => setShowAllUsers(false)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                  !showAllUsers ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
                title={t('models.showMineHint')}
              >
                {t('models.myModels')}
              </button>
              <button
                type="button"
                onClick={() => setShowAllUsers(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                  showAllUsers ? "bg-amber-50 text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
                title={t('models.showAllHint')}
              >
                <Globe size={13} />
                {t('models.allUsersModels')}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold border border-green-100">
            <Activity size={14} />
            {t('models.systemStatus')}
          </div>
          <button
            onClick={() => setIsTrainingOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 font-bold text-brand-700 transition-all hover:border-brand-300 hover:bg-brand-100"
          >
            <FlaskConical size={18} />
            {t('models.training.open')}
          </button>
          <button
            onClick={() => {
              setEditingModelId(null);
              setNewModelType(activeTab);
              setSelectedCatalogId('');
			  setFormData({ name: '', provider: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyId: '', category: 'default', contextWindow: '', capabilities: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm"
          >
            <Plus size={20} />
            {addModelLabel(activeTab)}
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-8 w-fit">
        <button
          onClick={() => setActiveTab('llm')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'llm' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {t('models.llmTab')}
        </button>
        <button
          onClick={() => setActiveTab('embedding')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'embedding' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {t('models.embeddingTab')}
        </button>
        <button
          onClick={() => setActiveTab('image')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'image' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {t('models.imageTab')}
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'video' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {t('models.videoTab')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Model Cards */}
        <div className="lg:col-span-2 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-brand-500" size={32} />
            </div>
          )}
          {!loading && filteredModels.map((model) => (
            <div
              key={model.id}
			  onClick={() => { if (!isAdmin || model.ownerId === currentUserId) handleEditClick(model); }}
			  className={cn(
				"bg-white border border-slate-200 rounded-2xl p-6 transition-all group",
				model.enabled ? "hover:border-brand-500/30" : "opacity-60 grayscale-[0.35]",
				!isAdmin || model.ownerId === currentUserId ? "cursor-pointer" : "cursor-default"
			  )}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                    model.type === 'llm' ? "bg-slate-100 text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-500" : model.type === 'embedding' ? "bg-blue-50 text-blue-500 group-hover:bg-blue-100" : "bg-amber-50 text-amber-600 group-hover:bg-amber-100"
                  )}>
                    {model.type === 'llm' ? <Cpu size={24} /> : model.type === 'embedding' ? <Database size={24} /> : model.type === 'video' ? <Video size={24} /> : <ImageIcon size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900">{model.name}</h3>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                        model.type === 'llm' ? "bg-brand-100 text-brand-600" : "bg-blue-100 text-blue-600"
                      )}>
                        {model.type}
                      </span>
                      {model.category && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-tighter">
                          {t(`models.cat${model.category.charAt(0).toUpperCase() + model.category.slice(1)}`)}
                        </span>
                      )}
                    </div>
			<p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{model.provider}</p>
			{isAdmin && showAllUsers && <p className="mt-1 text-[10px] text-slate-400">{t('models.owner')}: {model.ownerId}</p>}
			{isAdmin && supportsRuntimeLifecycle(model.provider) && (
			  <div className="mt-3" onClick={event => event.stopPropagation()}>
				<label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('models.runtimeMode')}</label>
				<select
				  value={model.runtimeMode}
				  onChange={event => void updateRuntimeMode(model, event.target.value as Model['runtimeMode'])}
				  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:border-brand-400"
				>
				  <option value={MODEL_RUNTIME_MODE.ALWAYS_ON}>{t('models.runtimeAlwaysOn')}</option>
				  <option value={MODEL_RUNTIME_MODE.ON_DEMAND}>{t('models.runtimeOnDemand')}</option>
				  <option value={MODEL_RUNTIME_MODE.OFF}>{t('models.runtimeOff')}</option>
				</select>
			  </div>
			)}
			{model.keyName && <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1"><Key size={11} />{model.keyName}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
					model.enabled ? "bg-green-50 text-green-600" : "bg-rose-50 text-rose-600"
                  )}>
					{model.enabled ? t('common.enabled') : t('common.disabled')}
                  </div>
				  {isAdmin && (
					<button
					  type="button"
					  onClick={(event) => { event.stopPropagation(); void toggleModel(model); }}
					  className={cn("rounded-lg p-2 transition-colors", model.enabled ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100")}
					  title={model.enabled ? t('common.disabled') : t('common.enabled')}
					>
					  <Power size={18} />
					</button>
				  )}
                  <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
                    <Settings2 size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{t('models.latency')}</p>
                  <p className="text-sm font-bold text-slate-700">{model.latency}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{t('models.context')}</p>
                  <p className="text-sm font-bold text-slate-700">{model.contextWindow}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{t('models.successRate')}</p>
                  <p className="text-sm font-bold text-slate-700">
					{model.usageCount ? `${model.successRate?.toFixed(1)}%` : 'N/A'}
				  </p>
                </div>
              </div>

              <div className="space-y-2">
				{model.type === 'llm' && (
				  <div className="mb-4 grid grid-cols-3 gap-2">
					<div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" title={(model.totalTokens || 0).toLocaleString()}>
					  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('models.totalTokens24h')}</p>
					  <p className="mt-1 text-sm font-extrabold text-slate-800">{formatTokenCount(model.totalTokens || 0)}</p>
					</div>
					<div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" title={(model.inputTokens || 0).toLocaleString()}>
					  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('models.inputTokens')}</p>
					  <p className="mt-1 text-sm font-extrabold text-sky-700">{formatTokenCount(model.inputTokens || 0)}</p>
					</div>
					<div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" title={(model.outputTokens || 0).toLocaleString()}>
					  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('models.outputTokens')}</p>
					  <p className="mt-1 text-sm font-extrabold text-emerald-700">{formatTokenCount(model.outputTokens || 0)}</p>
					</div>
				  </div>
				)}
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
				  <span>{t('models.usageLast24h')}</span>
				  <span>{t('models.requestCount', { count: model.usageCount || 0 })} · {(model.usageRate || 0).toFixed(2)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      model.type === 'llm' ? "bg-brand-500" : "bg-blue-500"
                    )}
					style={{ width: `${model.usageCount ? Math.max(model.usageRate || 0, 0.5) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}

          {!loading && filteredModels.length === 0 && (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-4">
                <Cpu size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No models configured</h3>
              <p className="text-sm text-slate-500 mb-6">Add your first {activeTab === 'llm' ? 'LLM' : 'embedding'} model to get started.</p>
              <button
                onClick={() => {
                  setEditingModelId(null);
                  setNewModelType(activeTab);
                  setSelectedCatalogId('');
				  setFormData({ name: '', provider: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyId: '', category: 'default', contextWindow: '', capabilities: '' });
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-2 text-brand-500 font-bold hover:text-brand-600"
              >
                <Plus size={20} />
                {addModelLabel(activeTab)}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-brand-500" />
              {t('models.usage')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{t('models.totalModels')}</span>
                <span className="text-sm font-bold text-slate-900">{models.length}</span>
              </div>
			  <div className="flex items-center justify-between">
				<span className="text-sm text-slate-500">{t('models.totalTokens24h')}</span>
				<span className="text-sm font-bold text-slate-900" title={visibleLLMTokenTotal.toLocaleString()}>{formatTokenCount(visibleLLMTokenTotal)}</span>
			  </div>
            </div>
          </div>

		  <div className="bg-white border border-slate-200 rounded-2xl p-6">
			<div className="flex items-center justify-between mb-4">
			  <h3 className="font-bold text-slate-900">模型 Key 库</h3>
			  <button onClick={() => openNewKey()} className="p-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100"><Plus size={16} /></button>
			</div>
			<div className="space-y-3">
			  {keys.map(key => (
				<div key={key.ulid} className="p-3 bg-slate-50 rounded-xl border border-transparent hover:border-slate-200">
				  <div className="flex items-start justify-between gap-2">
					<div className="min-w-0"><p className="text-xs font-bold text-slate-700 truncate">{key.name}</p><p className="text-[10px] text-slate-400">{key.provider} · {key.keyMask}</p></div>
					<button onClick={() => editKey(key)} className="p-1 text-slate-400 hover:text-brand-500"><Pencil size={13} /></button>
				  </div>
				  <p className="text-[10px] text-emerald-600 mt-2">{key.modelCount} 个模型正在使用</p>
				</div>
			  ))}
			  {keys.length === 0 && (
				<button onClick={() => openNewKey()} className="w-full text-xs text-brand-500 text-center py-3 border border-dashed border-brand-200 rounded-xl">先添加一个模型 Key</button>
			  )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Model Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex h-[92vh] max-h-[56rem] w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingModelId
                    ? editModelLabel(newModelType)
                    : addModelLabel(newModelType)
                  }
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddModel} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="model-modal-scroll min-h-0 flex-1 overflow-auto overscroll-contain">
                  <div className="min-w-[42rem] space-y-4 p-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">{t('models.modelType')}</label>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setNewModelType('llm');
                          setSelectedCatalogId('');
                        }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                          newModelType === 'llm' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        <Cpu size={16} />
                        {t('models.llm')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewModelType('embedding');
                          setSelectedCatalogId('');
                        }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                          newModelType === 'embedding' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        <Database size={16} />
                        {t('models.embedding')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewModelType('image');
                          setSelectedCatalogId('');
                        }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                          newModelType === 'image' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        <ImageIcon size={16} />
                        {t('models.image')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewModelType('video');
                          setSelectedCatalogId('');
                        }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                          newModelType === 'video' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        <Video size={16} />
                        {t('models.video')}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">模型预设</label>
                    <select
                      value={selectedCatalogId}
                      onChange={e => applyCatalogPreset(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="">自定义模型</option>
                      {filteredCatalog.map(item => (
                        <option key={item.ulid} value={item.ulid}>
                          {item.provider} / {item.modelFamily} / {item.displayName}{item.isFree ? ` · ${t('models.freeLocal')}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

				  {selectedCatalog?.isFree && selectedCatalog.installable && (
					<div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
					  <div className="flex items-start justify-between gap-3">
						<div>
						  <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
							<PackageCheck size={17} />
							{t('models.freeLocalModel')}
						  </div>
						  <p className="mt-1 text-xs text-emerald-800/75">{t('models.localModelDescription', { family: selectedCatalog.modelFamily })}</p>
						  {selectedCatalog.capabilities?.split(',').some(capability => capability.trim().toLowerCase() === 'non-commercial') && (
							<p className="mt-2 rounded-lg bg-amber-100 px-2.5 py-2 text-[11px] font-semibold text-amber-800">{t('models.nonCommercialNotice')}</p>
						  )}
						</div>
						<span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-700">{selectedCatalog.runtime}</span>
					  </div>
					  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
						<div className="rounded-xl bg-white/80 p-2"><span className="block font-bold text-slate-800">{selectedCatalog.downloadSize}</span>{t('models.downloadSize')}</div>
						<div className="rounded-xl bg-white/80 p-2"><span className="block font-bold text-slate-800">{selectedCatalog.minMemoryGB}GB</span>{t('models.minimumMemory')}</div>
						<div className="rounded-xl bg-white/80 p-2"><span className="block font-bold text-slate-800">{selectedCatalog.contextWindow}</span>{t('models.context')}</div>
					  </div>
					  {environmentLoading ? (
						<div className="mt-3 flex items-center gap-2 text-xs text-emerald-800"><Loader2 size={14} className="animate-spin" />{t('models.detectingEnvironment')}</div>
					  ) : localEnvironment && (
						<>
						  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
							<Laptop size={14} />
							{localEnvironment.os} / {localEnvironment.arch}{localEnvironment.memoryGB ? ` · ${localEnvironment.memoryGB}GB RAM` : ''} · {localEnvironment.runtime === MODEL_PROVIDER.DIFFUSERS ? 'Diffusers' : 'Ollama'} {localEnvironment.runtimeInstalled ? (localEnvironment.runtimeRunning ? t('models.running') : t('models.installed')) : t('models.notInstalled')}
						  </div>
						  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
							<div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white/75 px-3 py-2.5">
							  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Cpu size={16} /></span>
							  <div>
								<span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('models.memoryResource')}</span>
								<span className="block whitespace-nowrap text-xs font-semibold text-slate-700">{t('models.availableOfTotal', { available: formatCapacity(localEnvironment.memoryAvailableBytes), total: formatCapacity(localEnvironment.memoryTotalBytes) })}</span>
							  </div>
							</div>
							<div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white/75 px-3 py-2.5">
							  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><HardDrive size={16} /></span>
							  <div>
								<span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('models.storageResource')}</span>
								<span className="block whitespace-nowrap text-xs font-semibold text-slate-700">{t('models.availableOfTotal', { available: formatCapacity(localEnvironment.storageAvailableBytes), total: formatCapacity(localEnvironment.storageTotalBytes) })}</span>
							  </div>
							</div>
						  </div>
						  <p className={cn('mt-2 text-xs', localEnvironment.compatible ? 'text-emerald-700' : 'text-rose-600')}>{localEnvironment.message}</p>
						</>
					  )}
					  {installJob && ['queued', 'running'].includes(installJob.status) && installJob.catalogId === selectedCatalog.ulid && (
						<div className="mt-3">
						  <div className="mb-1 flex justify-between text-[11px] text-emerald-800"><span>{installJob.message}</span><span>{installJob.progress}%</span></div>
						  <div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${installJob.progress}%` }} /></div>
						</div>
					  )}
					  <button
						type="button"
						onClick={installSelectedModel}
						disabled={
						  environmentLoading
						  || !localEnvironment?.compatible
						  || (!localEnvironment.runtimeInstalled && !localEnvironment.runtimeInstallSupported)
						  || localEnvironment.modelInstalled
						  || Boolean(installJob && ['queued', 'running'].includes(installJob.status))
						}
						className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
					  >
						{installJob && ['queued', 'running'].includes(installJob.status) ? <Loader2 size={16} className="animate-spin" /> : localEnvironment?.modelInstalled ? <CheckCircle2 size={16} /> : <Download size={16} />}
						{localEnvironment?.modelInstalled ? t('models.modelInstalled') : t('models.downloadInstall')}
					  </button>
					</div>
				  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">{t('models.modelName')}</label>
                    <div className="relative">
                      <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. gpt-4o"
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {newModelType === 'llm' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">{t('models.category')}</label>
                      <select
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                      >
                        <option value="default">{t('models.catDefault')}</option>
                        <option value="rewrite">{t('models.catRewrite')}</option>
                        <option value="skill">{t('models.catSkill')}</option>
                        <option value="summarize">{t('models.catSummarize')}</option>
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">{t('models.provider')}</label>
                    <select
                      value={formData.provider}
					  onChange={e => setFormData({ ...formData, provider: e.target.value, keyId: '' })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="OpenAI">OpenAI</option>
                      <option value="Anthropic">Anthropic</option>
					  <option value="Google">Google</option>
					  <option value="DeepSeek">DeepSeek</option>
					  <option value="Ollama">Ollama</option>
					  <option value="Stability AI">Stability AI</option>
					  <option value="Diffusers">Diffusers (Local)</option>
					  <option value="ComfyUI">ComfyUI (Local)</option>
					  <option value="LM Studio">LM Studio</option>
					  <option value="LocalAI">LocalAI</option>
					  <option value="vLLM">vLLM</option>
					  <option value="llama.cpp">llama.cpp</option>
					  <option value="Xinference">Xinference</option>
					  <option value="TGI">TGI</option>
					  <option value="llamafile">llamafile</option>
					  <option value="Custom">Custom (OpenAI Compatible)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">{t('models.baseUrl')}</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        required
                        type="url"
                        value={formData.baseUrl}
                        onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">{t('models.context')}</label>
                    <input
                      type="text"
                      value={formData.contextWindow}
                      onChange={e => setFormData({ ...formData, contextWindow: e.target.value })}
                      placeholder="e.g. 128k"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    />
                  </div>

                  {(newModelType === 'image' || newModelType === 'video') && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">{t('models.capabilities')}</label>
                      <input
                        type="text"
                        value={formData.capabilities}
                        onChange={e => setFormData({ ...formData, capabilities: e.target.value })}
                        placeholder={newModelType === 'video' ? 'text-to-video,image-to-video,async' : 'text-to-image,image-to-image'}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                      />
                    </div>
                  )}

				  <div className="space-y-1">
					<div className="flex items-center justify-between">
					  <label className="text-xs font-bold text-slate-400 uppercase">模型 Key</label>
					  <button type="button" onClick={() => openNewKey(formData.provider)} className="text-xs font-bold text-brand-500">新增 Key</button>
					</div>
					<select required={!keyOptional} value={formData.keyId} onChange={e => setFormData({ ...formData, keyId: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none">
					  <option value="">{keyOptional ? '无需 Key（本地模型）' : (matchingKeys.length ? '请选择 Key' : `暂无 ${formData.provider} Key，请先新增`)}</option>
					  {matchingKeys.map(key => <option key={key.ulid} value={key.ulid}>{key.name} · {key.keyMask}</option>)}
					</select>
					<p className="text-[11px] text-slate-400">{keyOptional ? '检测到本地或私网模型，可不绑定 Key；如果服务启用了鉴权，也可以选择一个 Key。' : '模型只保存 Key 引用，后续更新 Key 会自动作用于所有引用模型。'}</p>
				  </div>

                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
                  {editingModelId && (
                    <button
                      type="button"
                      onClick={() => handleDeleteModel(editingModelId)}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all mr-auto"
                    >
                      {t('models.delete')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    {t('models.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20"
                  >
                    {t('models.save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
	  </AnimatePresence>

	  {isTrainingOpen && (
		<ModelTrainingLab models={models} onClose={() => setIsTrainingOpen(false)} onModelCreated={loadModels} />
	  )}

	  <AnimatePresence>
		{isKeyModalOpen && (
		  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-sm">
			<motion.form onSubmit={saveKey} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
			  <div className="p-6 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-xl font-bold">{editingKeyId ? '更新模型 Key' : '添加模型 Key'}</h2><p className="text-xs text-slate-400 mt-1">一个 Key 可以被多个模型复用</p></div><button type="button" onClick={() => setIsKeyModalOpen(false)} className="p-2 text-slate-400"><X size={20} /></button></div>
			  <div className="p-6 space-y-4">
				<label className="block"><span className="text-xs font-bold text-slate-400 uppercase">名称</span><input required value={keyForm.name} onChange={e => setKeyForm({ ...keyForm, name: e.target.value })} className="mt-1 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="例如：OpenAI 生产 Key" /></label>
				<label className="block"><span className="text-xs font-bold text-slate-400 uppercase">供应商</span><select value={keyForm.provider} onChange={e => setKeyForm({ ...keyForm, provider: e.target.value })} className="mt-1 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"><option>OpenAI</option><option>Anthropic</option><option>Google</option><option>DeepSeek</option><option>Ollama</option><option>LM Studio</option><option>LocalAI</option><option>vLLM</option><option>llama.cpp</option><option>Xinference</option><option>TGI</option><option>llamafile</option><option>Custom</option></select></label>
				<label className="block"><span className="text-xs font-bold text-slate-400 uppercase">API Key</span><div className="relative mt-1"><Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input required={!editingKeyId} type="password" value={keyForm.apiKey} onChange={e => setKeyForm({ ...keyForm, apiKey: e.target.value })} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder={editingKeyId ? '留空表示不更换' : 'sk-...'} /></div></label>
				<label className="block"><span className="text-xs font-bold text-slate-400 uppercase">请求地址（可选）</span><input type="url" value={keyForm.baseUrl} onChange={e => setKeyForm({ ...keyForm, baseUrl: e.target.value })} className="mt-1 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="https://api.openai.com/v1" /></label>
			  </div>
			  <div className="p-6 pt-0 flex gap-3">
				{editingKeyId && <button type="button" onClick={() => { const key = keys.find(item => item.ulid === editingKeyId); if (key) void deleteKey(key); }} className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600"><Trash2 size={17} /></button>}
				<button type="button" onClick={() => setIsKeyModalOpen(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600">取消</button>
				<button className="flex-1 py-2.5 rounded-xl bg-slate-950 text-white font-bold">{editingKeyId ? '保存并应用' : '保存 Key'}</button>
			  </div>
			</motion.form>
		  </div>
		)}
	  </AnimatePresence>
	</div>
  );
}
