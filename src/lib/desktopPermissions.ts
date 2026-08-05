const bridgePath = (path: string) => `/__athena/desktop/${path}`;

async function request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(bridgePath(path), init);
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error || `Desktop permission service returned ${response.status}`));
  return payload;
}

export const desktopPermissions = {
  async available(): Promise<boolean> {
    try {
      const result = await request('status');
      return result.available === true;
    } catch {
      return false;
    }
  },

  async selectFolder(): Promise<string> {
    const result = await request('select-folder', { method: 'POST' });
    return typeof result.path === 'string' ? result.path : '';
  },
};
