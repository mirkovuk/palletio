/**
 * config.js — settings that ship with the build.
 *
 * The distinction that matters: everything in Settings lives in the
 * visitor's own localStorage, so it only ever applies to the person who
 * typed it. Your Unsplash key being in your browser is exactly why every
 * beta tester falls back to Lorem Picsum.
 *
 * Anything that should be true for everyone has to be baked in at build
 * time, which is what this file is for. Set WORKER_URL once, push, and every
 * visitor gets imagery through your worker without configuring anything.
 *
 * The key itself never appears here — it stays on the worker as a secret.
 * This is only the address.
 */

export const WORKER_URL = 'https://palletio-proxy.mirkolovic.workers.dev';

/** Settings entered by hand still win, so you can point at a staging worker. */
export function resolveWorker(settings) {
  return (settings?.workerUrl || WORKER_URL || '').replace(/\/$/, '');
}

export function resolveProxy(settings) {
  return (settings?.proxyUrl || WORKER_URL || '').replace(/\/$/, '');
}
