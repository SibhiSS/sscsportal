import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPublicLeaderboard } from '@/lib/club';
import type { LeaderboardRow } from '@/types/club';

const REFRESH_MS = 60_000;

/**
 * The public leaderboard, kept fresh: fetched on mount, every minute while the
 * tab is visible, and again whenever the tab comes back into view. A failed
 * refresh keeps the last good rows on screen.
 */
export function useLeaderboard(limit?: number) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const hasRows = useRef(false);

  const load = useCallback(async (isActive: () => boolean) => {
    try {
      const data = await fetchPublicLeaderboard(limit);
      if (!isActive()) return;
      setRows(data);
      setError(null);
      setUpdatedAt(new Date());
      hasRows.current = true;
    } catch (err) {
      if (!isActive()) return;
      console.warn('[leaderboard] Could not load:', err);
      if (!hasRows.current) setError("The leaderboard couldn't be loaded right now.");
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    let active = true;
    const isActive = () => active;
    load(isActive);

    const timer = window.setInterval(() => {
      if (!document.hidden) load(isActive);
    }, REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) load(isActive);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { rows, loading, error, updatedAt };
}
