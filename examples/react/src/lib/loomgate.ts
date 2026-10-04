import { loadLoomgate } from '@loompay/loomgate-react-sdk';
import { getConfig } from './api';

/**
 * Loaded ONCE, at module scope, as the React SDK requires: <LoomgateProvider> keeps the first value it gets, so a new
 * promise on every render would be ignored. The publishable key comes from the server (/api/config) so that keys live
 * in one place; you can also hard-code it, it is safe in the browser.
 */
export const loomgatePromise = getConfig().then((config) =>
  loadLoomgate(config.publishableKey, { apiBaseUrl: config.apiBaseUrl }),
);
