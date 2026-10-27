import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/** Optional parts of the admin panel a super admin switches on in Admin > Settings > Features. Off by default. */
export const FEATURE_KEYS = { recruitment: 'feature_recruitment', grid: 'feature_grid_maker', anyEmail: 'allow_any_email' } as const;

export interface FeatureFlags { recruitment: boolean; grid: boolean; anyEmail: boolean }

const OFF: FeatureFlags = { recruitment: false, grid: false, anyEmail: false };
const listeners = new Set<(f: FeatureFlags) => void>();
let cache: FeatureFlags | null = null;

async function load(): Promise<FeatureFlags> {
  const { data, error } = await supabase
    .from('club_settings').select('key, value').in('key', Object.values(FEATURE_KEYS));
  if (error || !data) return OFF;
  const on = (k: string) => data.some(r => r.key === k && r.value === true);
  return { recruitment: on(FEATURE_KEYS.recruitment), grid: on(FEATURE_KEYS.grid), anyEmail: on(FEATURE_KEYS.anyEmail) };
}

/** Called after a switch is saved so every open menu updates at once. */
export function publishFeatureFlags(next: FeatureFlags) {
  cache = next;
  listeners.forEach(l => l(next));
}

/** Only admins can read the settings table, so everyone else always sees the features as off. */
export function useFeatureFlags() {
  const { user } = useAuth();
  const isPanelUser = user?.role === 'super_admin' || user?.role === 'admin';
  const [flags, setFlags] = useState<FeatureFlags>(cache ?? OFF);
  const [loading, setLoading] = useState(isPanelUser && !cache);

  useEffect(() => {
    listeners.add(setFlags);
    return () => { listeners.delete(setFlags); };
  }, []);

  const refresh = useCallback(async () => {
    const next = await load();
    publishFeatureFlags(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isPanelUser) { setLoading(false); return; }
    if (cache) { setFlags(cache); setLoading(false); return; }
    refresh();
  }, [isPanelUser, refresh]);

  return { ...(isPanelUser ? flags : OFF), loading, refresh };
}
