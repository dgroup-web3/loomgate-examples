import { type Loomgate, loadLoomgate } from '@loompay/loomgate-react-sdk';

/**
 * One `loadLoomgate()` per publishable key: <LoomgateProvider> keeps the first value it gets, and renders must not
 * create new promises. A failed load is forgotten so that "Reload" can try again.
 */
const cache = new Map<string, Promise<Loomgate>>();

export function getLoomgate(publishableKey: string, apiBaseUrl: string): Promise<Loomgate> {
  const cacheKey = `${publishableKey}\n${apiBaseUrl}`;
  let promise = cache.get(cacheKey);
  if (!promise) {
    promise = loadLoomgate(publishableKey, { apiBaseUrl });
    promise.catch(() => cache.delete(cacheKey));
    cache.set(cacheKey, promise);
  }
  return promise;
}
