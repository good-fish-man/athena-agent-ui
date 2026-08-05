import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { installAuthorizedFetch } from './lib/auth';
import { initializeTheme } from './lib/theme';

installAuthorizedFetch();
initializeTheme();

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Athena UI] render crashed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#eef6ff', padding: 24 }}>
        <div style={{ maxWidth: 560, width: '100%', borderRadius: 24, background: 'white', border: '1px solid #dbe4ef', boxShadow: '0 24px 80px rgba(15,23,42,0.12)', padding: 28 }}>
          <p style={{ margin: 0, color: '#2563eb', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Athena UI recovered</p>
          <h1 style={{ margin: '10px 0 8px', color: '#0f172a', fontSize: 24 }}>界面渲染遇到问题</h1>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>Athena 已拦截白屏错误。你可以刷新界面继续使用；详细错误已写入控制台日志。</p>
          <pre style={{ marginTop: 16, maxHeight: 160, overflow: 'auto', borderRadius: 14, background: '#f8fafc', color: '#334155', padding: 12, fontSize: 12, whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 18, width: '100%', border: 0, borderRadius: 14, background: '#0f172a', color: 'white', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
          >
            重新加载 Athena
          </button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
