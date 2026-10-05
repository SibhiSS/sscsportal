import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'sscs_chunk_reload';

/**
 * React.lazy that survives a deploy. After a new build goes live, a tab that
 * loaded the old one asks for chunk files that no longer exist, and the import
 * fails. Reload once to pick up the new build; if it fails again right after,
 * let the error through to the error boundary instead of looping.
 */
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return lazy(async () => {
    try {
      const mod = await load();
      try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* storage blocked */ }
      return mod;
    } catch (err) {
      let last = 0;
      try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch { /* storage blocked */ }
      if (Date.now() - last > 30_000) {
        try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* storage blocked */ }
        window.location.reload();
        return new Promise<never>(() => {}); // the reload takes over
      }
      throw err;
    }
  });
}
