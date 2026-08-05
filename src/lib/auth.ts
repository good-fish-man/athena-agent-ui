import { resolveRuntimeClientOrigin } from './runtimeConstants';

export interface AuthUser {
  ulid: string;
  member_code: string;
  nick_name: string;
  avatar_url?: string;
	admin_level?: number;
}

const TOKEN_KEY = 'agent-ui-access-token';
const USER_KEY = 'agent-ui-current-user';

export const authStore = {
  token: () => localStorage.getItem(TOKEN_KEY) || '',
  user: (): AuthUser | null => {
    try {
      const value = localStorage.getItem(USER_KEY);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },
  userID: () => authStore.user()?.ulid || '',
  save(token: string, user: AuthUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

let installed = false;

const runtimeOrigin = new URL(resolveRuntimeClientOrigin(), window.location.href).origin;

// Existing API modules use fetch directly, so install one narrow interceptor for runtime-client requests.
export function installAuthorizedFetch() {
  if (installed) return;
  installed = true;
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const token = authStore.token();
    const inputUrl = input instanceof Request ? input.url : input.toString();
    const isRuntimeRequest = new URL(inputUrl, window.location.href).origin === runtimeOrigin;
    if (isRuntimeRequest && token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await nativeFetch(input, { ...init, headers });
    if (isRuntimeRequest && response.status === 401) {
      authStore.clear();
      window.dispatchEvent(new CustomEvent('agent-ui:unauthorized'));
    } else if (isRuntimeRequest && response.status === 409) {
      const body = await response.clone().json().catch(() => null);
      if (body?.code === 409001001) {
        window.dispatchEvent(new CustomEvent('agent-ui:model-required'));
      }
    }
    return response;
  };
}
