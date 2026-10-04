import { type Loomgate, loadLoomgate } from '@loompay/loomgate-react-sdk';
import type { Appearance } from './layouts';

/**
 * One `loadLoomgate()` per publishable key and appearance (the card form's styling is set when it loads):
 * <LoomgateProvider> keeps the first value it gets, and renders must not create new promises. A failed load is
 * forgotten so that "Reload" can try again.
 */
const cache = new Map<string, Promise<Loomgate>>();

export function getLoomgate(publishableKey: string, apiBaseUrl: string, appearance?: Appearance): Promise<Loomgate> {
  const cacheKey = `${publishableKey}\n${apiBaseUrl}\n${JSON.stringify(appearance ?? null)}`;
  let promise = cache.get(cacheKey);
  if (!promise) {
    promise = loadLoomgate(publishableKey, { apiBaseUrl, ...(appearance ? { appearance } : {}) });
    promise.catch(() => cache.delete(cacheKey));
    cache.set(cacheKey, promise);
  }
  return promise;
}
