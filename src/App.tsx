/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { AgentManager } from './components/AgentManager';
import { ChatInterface } from './components/ChatInterface';
import { KnowledgeBaseManager } from './components/KnowledgeBaseManager';
import { SkillManager } from './components/SkillManager';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { ModelManager } from './components/ModelManager';
import { MediaStudio } from './components/MediaStudio';
import { Settings } from './components/Settings';
import { Inbox } from './components/Inbox';
import { CommandCenter } from './components/CommandCenter';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { WebsiteAccounts } from './components/WebsiteAccounts';
import { View, Agent } from './types';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { AuthScreen } from './components/AuthScreen';
import { authApi, modelApi } from './lib/api';
import { authStore, AuthUser } from './lib/auth';

export default function App() {
	const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(() => authStore.user());
  const [activeView, setActiveView] = React.useState<View>('dashboard');
  const [preselectedAgent, setPreselectedAgent] = React.useState<Agent | null>(null);
  const [editingAgent, setEditingAgent] = React.useState<Agent | null>(null);
  const [pendingKBConfig, setPendingKBConfig] = React.useState<Record<string, any> | null>(null);

	React.useEffect(() => {
		const unauthorized = () => setCurrentUser(null);
		const modelRequired = () => {
			setActiveView('models');
			toast.warning('请先绑定模型', { description: '公共 Agent 需要使用你自己的模型配置。' });
		};
		window.addEventListener('agent-ui:unauthorized', unauthorized);
		window.addEventListener('agent-ui:model-required', modelRequired);
		if (authStore.token()) {
			authApi.me().then(user => {
				authStore.save(authStore.token(), user);
				setCurrentUser(user);
				return modelApi.findAll('llm');
			}).then(models => {
				if (models && models.length === 0) setActiveView('models');
			}).catch(() => setCurrentUser(null));
		}
		return () => {
			window.removeEventListener('agent-ui:unauthorized', unauthorized);
			window.removeEventListener('agent-ui:model-required', modelRequired);
		};
	}, []);

	const logout = async () => {
		await authApi.logout().catch(() => undefined);
		authStore.clear();
		setCurrentUser(null);
	};

	const authenticated = (user: AuthUser) => {
		setCurrentUser(user);
		modelApi.findAll('llm').then(models => {
			if (models.length === 0) {
				setActiveView('models');
				toast.info('先绑定一个模型', { description: '已为你准备公共 Agent，绑定模型后即可开始使用。' });
			}
		}).catch(() => undefined);
	};

	if (!currentUser) {
		return <AuthScreen onAuthenticated={authenticated} />;
	}

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setActiveView('orchestrator');
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onViewChange={setActiveView} />;
      case 'agents':
        return <AgentManager onViewChange={setActiveView} onPlayAgent={(agent) => {
          setPreselectedAgent(agent);
        }} onEditAgent={handleEditAgent} />;
      case 'chat':
        return <ChatInterface
          preselectedAgent={preselectedAgent}
          onAgentUsed={() => setPreselectedAgent(null)}
          onCreateAgent={() => {
            setEditingAgent(null);
            setActiveView('orchestrator');
          }}
        />;
      case 'workspace':
        return <ProjectWorkspace />;
      case 'website-accounts':
        return <WebsiteAccounts />;
      case 'knowledge':
        return <KnowledgeBaseManager pendingConfig={pendingKBConfig} onConfigConsumed={() => setPendingKBConfig(null)} />;
      case 'skills':
        return <SkillManager initialTab="skills" />;
      case 'orchestrator':
        return <AgentOrchestrator editingAgent={editingAgent} onSaved={() => {
          setEditingAgent(null);
        }} />
      case 'models':
        return <ModelManager />;
      case 'media':
        return <MediaStudio />;
      case 'settings':
        return <Settings />;
      case 'inbox':
        return <Inbox onViewChange={setActiveView} />;
      default:
        return <Dashboard onViewChange={setActiveView} />;
    }
  };

  return (
    <div className="theme-shell flex h-screen overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} user={currentUser} onUserChange={setCurrentUser} onLogout={logout} />

      <main className="theme-page relative min-w-0 flex-1 overflow-y-auto scrollbar-hide">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      <CommandCenter onViewChange={(view, data) => {
        if (view === 'knowledge' && data) {
          setPendingKBConfig(data);
        }
        setActiveView(view);
      }} />
      <Toaster position="top-right" richColors />
    </div>
  );
}
