/**
 * The developer's keys. Kept in sessionStorage (gone when the tab closes), or in localStorage when "Remember on this
 * device" is ticked. Storage can be unavailable (private mode, blocked site data): the page then keeps them in memory.
 */
export interface Keys {
  publishableKey: string;
  secretKey: string;
  remember: boolean;
}

const STORAGE_KEY = 'loomgate-playground:keys';
export const EMPTY_KEYS: Keys = { publishableKey: '', secretKey: '', remember: false };

function read(storage: () => Storage): Keys | null {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Keys>;
    return {
      publishableKey: typeof parsed.publishableKey === 'string' ? parsed.publishableKey : '',
      secretKey: typeof parsed.secretKey === 'string' ? parsed.secretKey : '',
      remember: parsed.remember === true,
    };
  } catch {
    return null;
  }
}

function attempt(action: () => void) {
  try {
    action();
  } catch {
    // Storage unavailable: keep the keys in memory only.
  }
}

export function loadKeys(): Keys {
  return read(() => window.localStorage) ?? read(() => window.sessionStorage) ?? EMPTY_KEYS;
}

export function saveKeys(keys: Keys) {
  const value = JSON.stringify(keys);
  if (keys.remember) {
    attempt(() => window.localStorage.setItem(STORAGE_KEY, value));
    attempt(() => window.sessionStorage.removeItem(STORAGE_KEY));
  } else {
    attempt(() => window.sessionStorage.setItem(STORAGE_KEY, value));
    attempt(() => window.localStorage.removeItem(STORAGE_KEY));
  }
}

export function forgetKeys() {
  attempt(() => window.localStorage.removeItem(STORAGE_KEY));
  attempt(() => window.sessionStorage.removeItem(STORAGE_KEY));
}
