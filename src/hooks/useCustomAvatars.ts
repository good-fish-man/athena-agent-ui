import React from 'react';
import { putAvatarBlob, getAvatarBlob, deleteAvatarBlob } from '../lib/avatarStore';
import { authStore } from '../lib/auth';
import { voiceAvatarApi } from '../lib/api';

export type CustomAvatarKind = 'image' | 'video';

export type CustomAvatarMeta = {
  id: string;
  name: string;
  kind: CustomAvatarKind;
};

export type CustomAvatar = CustomAvatarMeta & {
  url: string;
};

type AvatarOrigin = 'backend' | 'local';

const META_KEY = 'chat.voice.customAvatars';
const MAX_BYTES = 25 * 1024 * 1024; // 25MB per upload

function hasToken(): boolean {
  return !!authStore.token();
}

function loadMeta(): CustomAvatarMeta[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CustomAvatarMeta =>
        item && typeof item.id === 'string' && typeof item.name === 'string' && (item.kind === 'image' || item.kind === 'video'),
    );
  } catch {
    return [];
  }
}

function saveMeta(meta: CustomAvatarMeta[]) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function randomId(): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  const uuid = cryptoObj?.randomUUID ? cryptoObj.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `custom:${uuid}`;
}

function validateFile(file: File): { kind: CustomAvatarKind } | { error: string } {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) return { error: 'unsupportedType' };
  if (file.size > MAX_BYTES) return { error: 'tooLarge' };
  return { kind: isVideo ? 'video' : 'image' };
}

function deriveName(file: File, kind: CustomAvatarKind): string {
  return file.name.replace(/\.[^.]+$/, '').slice(0, 24) || (kind === 'video' ? 'Video' : 'Photo');
}

export function useCustomAvatars() {
  const [avatars, setAvatars] = React.useState<CustomAvatar[]>([]);
  const [error, setError] = React.useState('');
  const urlsRef = React.useRef<Map<string, string>>(new Map());
  const originRef = React.useRef<Map<string, AvatarOrigin>>(new Map());

  const revokeAll = React.useCallback(() => {
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }, []);

  const hydrateLocal = React.useCallback(async () => {
    const meta = loadMeta();
    const resolved: CustomAvatar[] = [];
    const stale: string[] = [];
    for (const item of meta) {
      const blob = await getAvatarBlob(item.id);
      if (!blob) {
        stale.push(item.id);
        continue;
      }
      let url = urlsRef.current.get(item.id);
      if (!url) {
        url = URL.createObjectURL(blob);
        urlsRef.current.set(item.id, url);
      }
      originRef.current.set(item.id, 'local');
      resolved.push({ ...item, url });
    }
    if (stale.length) saveMeta(meta.filter(item => !stale.includes(item.id)));
    setAvatars(resolved);
  }, []);

  const hydrate = React.useCallback(async () => {
    if (hasToken()) {
      try {
        const items = await voiceAvatarApi.list();
        items.forEach(item => originRef.current.set(item.id, 'backend'));
        setAvatars(items.map(item => ({ id: item.id, name: item.name, kind: item.kind, url: item.url })));
        return;
      } catch {
        // Backend unavailable — fall back to browser-local avatars.
      }
    }
    await hydrateLocal();
  }, [hydrateLocal]);

  React.useEffect(() => {
    void hydrate();
    return () => revokeAll();
  }, [hydrate, revokeAll]);

  const addLocal = React.useCallback(async (file: File, kind: CustomAvatarKind): Promise<CustomAvatar | null> => {
    const id = randomId();
    const name = deriveName(file, kind);
    try {
      await putAvatarBlob(id, file);
    } catch {
      setError('storageFailed');
      return null;
    }
    saveMeta([...loadMeta(), { id, name, kind }]);
    const url = URL.createObjectURL(file);
    urlsRef.current.set(id, url);
    originRef.current.set(id, 'local');
    const created: CustomAvatar = { id, name, kind, url };
    setAvatars(current => [...current, created]);
    return created;
  }, []);

  const addAvatar = React.useCallback(async (file: File): Promise<CustomAvatar | null> => {
    setError('');
    const validation = validateFile(file);
    if ('error' in validation) {
      setError(validation.error);
      return null;
    }
    if (hasToken()) {
      try {
        const item = await voiceAvatarApi.upload(file);
        originRef.current.set(item.id, 'backend');
        const created: CustomAvatar = { id: item.id, name: item.name, kind: item.kind, url: item.url };
        setAvatars(current => [...current, created]);
        return created;
      } catch {
        // Backend upload failed — persist in the browser so the feature still works.
      }
    }
    return addLocal(file, validation.kind);
  }, [addLocal]);

  const removeAvatar = React.useCallback(async (id: string) => {
    const origin = originRef.current.get(id);
    setAvatars(current => current.filter(item => item.id !== id));
    originRef.current.delete(id);
    if (origin === 'backend') {
      try {
        await voiceAvatarApi.remove(id);
      } catch {
        // Ignore; item already removed from UI.
      }
      return;
    }
    saveMeta(loadMeta().filter(item => item.id !== id));
    const url = urlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(id);
    }
    try {
      await deleteAvatarBlob(id);
    } catch {
      // Metadata already dropped; ignore blob cleanup failures.
    }
  }, []);

  return { avatars, error, addAvatar, removeAvatar };
}
