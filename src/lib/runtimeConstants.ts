export const RUNTIME_CLIENT_DEFAULT_ORIGIN = 'http://localhost:8090';
export const RUNTIME_CLIENT_WAILS_ORIGIN = 'http://wails.localhost:8090';

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
