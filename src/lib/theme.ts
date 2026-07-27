export const THEME_STORAGE_KEY = 'agent-ui.theme.accent';
export const THEME_BACKGROUND_STORAGE_KEY = 'agent-ui.theme.background';
export const THEME_CARD_STORAGE_KEY = 'agent-ui.theme.card';
export const DEFAULT_THEME_COLOR = '#0ea5e9';
export const DEFAULT_THEME_BACKGROUND = '#edf3ff';
export const DEFAULT_THEME_CARD = '#ffffff';

export const THEME_PRESETS = [
  { name: '海洋', color: '#0ea5e9' },
  { name: '经典蓝', color: '#2563eb' },
  { name: '青绿', color: '#0f9d8a' },
  { name: '森林', color: '#16a34a' },
  { name: '琥珀', color: '#d97706' },
  { name: '珊瑚', color: '#ea580c' },
  { name: '玫红', color: '#e11d48' },
  { name: '石墨', color: '#475569' },
] as const;

export const THEME_BACKGROUND_PRESETS = [
  { name: '云蓝', color: '#edf3ff' },
  { name: '薄荷', color: '#eaf8f2' },
  { name: '暖沙', color: '#fbf4e8' },
  { name: '晨雾', color: '#f1f5f9' },
  { name: '桃粉', color: '#fceff2' },
  { name: '青瓷', color: '#eaf7f7' },
] as const;

export const THEME_CARD_PRESETS = [
  { name: '纯白', color: '#ffffff' },
  { name: '冰蓝', color: '#f2f7ff' },
  { name: '薄荷白', color: '#f1faf6' },
  { name: '奶油', color: '#fff9ed' },
  { name: '浅粉', color: '#fff3f5' },
  { name: '雾灰', color: '#f4f6f8' },
] as const;

function normalizeHex(value: string, fallback = DEFAULT_THEME_COLOR) {
  const hex = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : fallback;
}

function mixColors(first: string, second: string, secondWeight: number) {
  const a = normalizeHex(first).slice(1).match(/.{2}/g)!.map(part => Number.parseInt(part, 16));
  const b = normalizeHex(second).slice(1).match(/.{2}/g)!.map(part => Number.parseInt(part, 16));
  const mixed = a.map((channel, index) => Math.round(channel * (1 - secondWeight) + b[index] * secondWeight));
  return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function applyThemeColor(value: string) {
  const color = normalizeHex(value);
  const root = document.documentElement;
  root.style.setProperty('--color-brand-50', mixColors(color, '#ffffff', 0.94));
  root.style.setProperty('--color-brand-100', mixColors(color, '#ffffff', 0.84));
  root.style.setProperty('--color-brand-500', color);
  root.style.setProperty('--color-brand-600', mixColors(color, '#000000', 0.14));
  root.style.setProperty('--color-brand-700', mixColors(color, '#000000', 0.28));
  root.style.setProperty('--theme-accent', color);
  root.style.colorScheme = 'light';
  return color;
}

export function applyThemeBackground(value: string) {
  const color = normalizeHex(value, DEFAULT_THEME_BACKGROUND);
  const root = document.documentElement;
  root.style.setProperty('--theme-page-bg', color);
  root.style.setProperty('--theme-page-bg-alt', mixColors(color, '#f8fafc', 0.42));
  root.style.setProperty('--theme-surface', mixColors(color, '#ffffff', 0.82));
  return color;
}

export function applyThemeCard(value: string) {
  const color = normalizeHex(value, DEFAULT_THEME_CARD);
  const root = document.documentElement;
  root.style.setProperty('--theme-card-bg', color);
  root.style.setProperty('--theme-card-border', mixColors(color, '#64748b', 0.2));
  root.style.setProperty('--theme-card-subtle', mixColors(color, '#f8fafc', 0.42));
  root.style.setProperty('--theme-editor-bg', color);
  root.style.setProperty('--theme-editor-toolbar', mixColors(color, '#ffffff', 0.48));
  return color;
}

export function saveThemeColor(value: string) {
  const color = applyThemeColor(value);
  localStorage.setItem(THEME_STORAGE_KEY, color);
  window.dispatchEvent(new CustomEvent('agent-ui:theme-change', { detail: color }));
  return color;
}

export function saveThemeBackground(value: string) {
  const color = applyThemeBackground(value);
  localStorage.setItem(THEME_BACKGROUND_STORAGE_KEY, color);
  window.dispatchEvent(new CustomEvent('agent-ui:theme-change', { detail: { background: color } }));
  return color;
}

export function saveThemeCard(value: string) {
  const color = applyThemeCard(value);
  localStorage.setItem(THEME_CARD_STORAGE_KEY, color);
  window.dispatchEvent(new CustomEvent('agent-ui:theme-change', { detail: { card: color } }));
  return color;
}

export function currentThemeColor() {
  return normalizeHex(localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_COLOR);
}

export function currentThemeBackground() {
  return normalizeHex(localStorage.getItem(THEME_BACKGROUND_STORAGE_KEY) || DEFAULT_THEME_BACKGROUND, DEFAULT_THEME_BACKGROUND);
}

export function currentThemeCard() {
  return normalizeHex(localStorage.getItem(THEME_CARD_STORAGE_KEY) || DEFAULT_THEME_CARD, DEFAULT_THEME_CARD);
}

export function initializeTheme() {
  applyThemeColor(currentThemeColor());
  applyThemeBackground(currentThemeBackground());
  applyThemeCard(currentThemeCard());
}
