import React from 'react';
import {
  LayoutDashboard,
  Workflow,
  Users,
  Zap,
  Database,
  Cpu,
  MessageSquare,
  FolderCode,
  Settings,
  ChevronLeft,
  ChevronRight,
  Globe,
  Inbox,
  LogOut,
  Camera,
  WandSparkles,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { View } from '../types';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import type { AuthUser } from '../lib/auth';
import { authStore } from '../lib/auth';
import { authApi, resolveRuntimeAssetUrl } from '../lib/api';
import { AthenaMark } from './AthenaMark';
import { toast } from 'sonner';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  user: AuthUser;
  onUserChange: (user: AuthUser) => void;
  onLogout: () => void;
}

export function Sidebar({ activeView, onViewChange, user, onUserChange, onLogout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    const preference = localStorage.getItem('agent-ui.sidebar.collapsed');
    return preference ? preference === 'true' : window.innerWidth < 1024;
  });
  const { t, i18n } = useTranslation();
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [avatarLoading, setAvatarLoading] = React.useState(false);
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const avatarURL = resolveRuntimeAssetUrl(user.avatar_url);

  React.useEffect(() => setAvatarFailed(false), [avatarURL]);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
      toast.error('头像仅支持 PNG、JPEG 或 GIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('头像图片不能超过 5MB');
      return;
    }
    setAvatarLoading(true);
    try {
      const updated = await authApi.uploadAvatar(file);
      authStore.save(authStore.token(), updated);
      onUserChange(updated);
      toast.success('头像已更新');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '头像更新失败');
    } finally {
      setAvatarLoading(false);
    }
  };

  const navGroups: Array<{ label: string; items: Array<{ id: View; label: string; description: string; icon: LucideIcon }> }> = [
    {
      label: t('sidebar.groupOverview'),
      items: [
        { id: 'dashboard', label: t('sidebar.dashboard'), description: t('sidebar.dashboardDesc'), icon: LayoutDashboard },
        { id: 'inbox', label: t('sidebar.inbox'), description: t('sidebar.inboxDesc'), icon: Inbox },
      ],
    },
    {
      label: t('sidebar.groupWork'),
      items: [
        { id: 'chat', label: t('sidebar.chat'), description: t('sidebar.chatDesc'), icon: MessageSquare },
        { id: 'media', label: t('sidebar.media'), description: t('sidebar.mediaDesc'), icon: WandSparkles },
        { id: 'workspace', label: t('sidebar.workspace'), description: t('sidebar.workspaceDesc'), icon: FolderCode },
      ],
    },
    {
      label: t('sidebar.groupAgents'),
      items: [
        { id: 'agents', label: t('sidebar.agents'), description: t('sidebar.agentsDesc'), icon: Users },
        { id: 'orchestrator', label: t('sidebar.orchestrator'), description: t('sidebar.orchestratorDesc'), icon: Workflow },
      ],
    },
    {
      label: t('sidebar.groupResources'),
      items: [
        { id: 'models', label: t('sidebar.models'), description: t('sidebar.modelsDesc'), icon: Cpu },
        { id: 'skills', label: t('sidebar.skills'), description: t('sidebar.skillsDesc'), icon: Zap },
        { id: 'knowledge', label: t('sidebar.knowledge'), description: t('sidebar.knowledgeDesc'), icon: Database },
      ],
    },
  ];

  React.useEffect(() => {
    localStorage.setItem('agent-ui.sidebar.collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(nextLang);
  };

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col overflow-hidden border-r border-slate-800/80 bg-slate-950 text-slate-300 transition-[width] duration-300",
        isCollapsed ? "w-[72px]" : "w-[248px]"
      )}
    >
      <div className="sidebar-atmosphere pointer-events-none absolute inset-x-0 top-0 h-72" />

      <div className={cn("relative flex h-[72px] shrink-0 items-center border-b border-slate-800/70", isCollapsed ? "justify-center px-3" : "justify-between px-4")}>
        {!isCollapsed && (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-slate-950/50">
              <AthenaMark className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-white">{t('sidebar.brand')}</span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Agent Runtime</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(current => !current)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
          title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className={cn("relative flex-1 overflow-y-auto py-4 scrollbar-hide", isCollapsed ? "px-2" : "px-3")}>
        {navGroups.map((group, groupIndex) => (
          <div key={group.label} className={cn(groupIndex > 0 && (isCollapsed ? "mt-2 border-t border-slate-800/70 pt-2" : "mt-5"))}>
            {!isCollapsed && (
              <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">{group.label}</p>
            )}
            <div className="space-y-1">
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    title={isCollapsed ? `${item.label}: ${item.description}` : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      "group relative flex w-full items-center rounded-xl transition-all",
                      isCollapsed ? "h-11 justify-center" : "min-h-12 gap-3 px-2.5 py-2",
                      isActive
                        ? "bg-gradient-to-r from-brand-500/20 to-brand-500/5 text-white ring-1 ring-inset ring-brand-500/20"
                        : "text-slate-400 hover:bg-slate-900 hover:text-white"
                    )}
                  >
                    {isActive && <span className="absolute left-0 h-5 w-0.5 rounded-r-full bg-brand-500" style={{ boxShadow: '0 0 10px color-mix(in srgb, var(--theme-accent) 80%, transparent)' }} />}
                    <span className={cn(
                      "flex shrink-0 items-center justify-center rounded-lg transition-colors",
                      isCollapsed ? "h-8 w-8" : "h-8 w-8",
                      isActive ? "bg-brand-500/15 text-brand-100" : "text-slate-500 group-hover:bg-slate-800 group-hover:text-slate-200"
                    )}>
                      <Icon size={17} />
                    </span>
                    {!isCollapsed && (
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-xs font-semibold">{item.label}</span>
                        <span className={cn("mt-0.5 block truncate text-[9px]", isActive ? "text-brand-100/60" : "text-slate-600 group-hover:text-slate-500")}>{item.description}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("relative shrink-0 border-t border-slate-800/70 bg-slate-950/80 py-3", isCollapsed ? "px-2" : "px-3")}>
        <div className={cn("mb-2 flex items-center rounded-xl border border-slate-800/80 bg-slate-900/60", isCollapsed ? "h-11 justify-center" : "gap-2.5 px-2.5 py-2")}>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarLoading}
            className="group/avatar relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-xs font-bold text-white ring-1 ring-white/10"
            title="修改头像"
            aria-label="修改头像"
          >
            {avatarURL && !avatarFailed ? (
              <img src={avatarURL} alt="" className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} />
            ) : (
              (user.nick_name || user.member_code || 'U').slice(0, 1).toUpperCase()
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/65 opacity-0 transition-opacity group-hover/avatar:opacity-100">
              {avatarLoading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            </span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/gif" onChange={uploadAvatar} className="hidden" />
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{user.nick_name || user.member_code}</p>
              <p className="truncate text-[9px] text-slate-500">@{user.member_code}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleLanguage}
          title={isCollapsed ? (i18n.language === 'en' ? 'English' : '中文') : undefined}
          className={cn("group flex w-full items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-900 hover:text-white", isCollapsed ? "h-9 justify-center" : "gap-3 px-3 py-2")}
        >
          <Globe size={16} />
          {!isCollapsed && <span className="text-xs font-medium">{i18n.language === 'en' ? 'English' : '中文'}</span>}
          {!isCollapsed && <span className="ml-auto text-[9px] font-bold text-slate-600">{i18n.language === 'en' ? '中' : 'EN'}</span>}
        </button>
        <button
          type="button"
          onClick={() => onViewChange('settings')}
          title={isCollapsed ? t('sidebar.settings') : undefined}
          className={cn(
            "group flex w-full items-center rounded-lg transition-colors",
            isCollapsed ? "h-9 justify-center" : "gap-3 px-3 py-2",
            activeView === 'settings' ? "bg-brand-500/10 text-brand-100" : "text-slate-500 hover:bg-slate-900 hover:text-white"
          )}
        >
          <Settings size={16} />
          {!isCollapsed && <span className="text-xs font-medium">{t('sidebar.settings')}</span>}
        </button>
        <button
          type="button"
          onClick={onLogout}
          title={isCollapsed ? t('sidebar.logout') : undefined}
          className={cn("flex w-full items-center rounded-lg text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-300", isCollapsed ? "h-9 justify-center" : "gap-3 px-3 py-2")}
        >
          <LogOut size={16} />
          {!isCollapsed && <span className="text-xs font-medium">{t('sidebar.logout')}</span>}
        </button>
      </div>
    </aside>
  );
}
