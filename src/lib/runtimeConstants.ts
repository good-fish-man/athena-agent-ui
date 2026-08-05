export const RUNTIME_CLIENT_DEFAULT_ORIGIN = 'http://localhost:8090';
export const RUNTIME_CLIENT_WAILS_ORIGIN = 'http://wails.localhost:8090';
export const RUNTIME_CLIENT_STORAGE_KEY = 'athena-runtime-client-origin';

function validRuntimeOrigin(value?: string | null) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const loopback = host === 'localhost' || host === 'wails.localhost' || host === '::1' || host.startsWith('127.');
    if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback))
      || parsed.username || parsed.password || parsed.search || parsed.hash) return '';
    return value.replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function resolveRuntimeClientOrigin() {
  const pageURL = new URL(window.location.href);
  const fromLauncher = validRuntimeOrigin(pageURL.searchParams.get('runtime_client'));
  if (fromLauncher) {
    const previous = validRuntimeOrigin(localStorage.getItem(RUNTIME_CLIENT_STORAGE_KEY));
    if (previous !== fromLauncher) {
      localStorage.removeItem('agent-ui-access-token');
      localStorage.removeItem('agent-ui-current-user');
    }
    localStorage.setItem(RUNTIME_CLIENT_STORAGE_KEY, fromLauncher);
    pageURL.searchParams.delete('runtime_client');
    window.history.replaceState(null, '', `${pageURL.pathname}${pageURL.search}${pageURL.hash}`);
  }
  const saved = validRuntimeOrigin(localStorage.getItem(RUNTIME_CLIENT_STORAGE_KEY));
  if (saved) return saved;
  if (window.location.hostname === 'wails.localhost') return RUNTIME_CLIENT_WAILS_ORIGIN;
  return import.meta.env.VITE_AGENT_RUNTIME_CLIENT_URL
    || import.meta.env.VITE_AGENT_FRAME_API_URL
    || RUNTIME_CLIENT_DEFAULT_ORIGIN;
}

export const MODEL_PROVIDER = {
  OLLAMA: 'ollama',
  DIFFUSERS: 'diffusers',
} as const;

export const MODEL_RUNTIME_MODE = {
  ALWAYS_ON: 'always_on',
  ON_DEMAND: 'on_demand',
  OFF: 'off',
} as const;

export type ModelRuntimeMode = typeof MODEL_RUNTIME_MODE[keyof typeof MODEL_RUNTIME_MODE];
