import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type BroadcastPriority = 'critical' | 'important' | 'info';
export type BroadcastAudience = 'everyone' | 'members' | 'admins';

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  priority: BroadcastPriority;
  audience: BroadcastAudience;
  starts_at: string;
  expires_at: string | null;
  created_by: string | null;
  created_at?: string;
}

/** A broadcast as its reader sees it, with their own read state. */
export type MyBroadcast = Broadcast & { seen_at: string | null; acked_at: string | null };

export interface BroadcastRead { broadcast_id: string; email: string; seen_at: string; acked_at: string | null }
export interface BroadcastPerson { email: string; name: string; is_admin: boolean }

export const PRIORITY_LABELS: Record<BroadcastPriority, string> = {
  critical: 'Critical',
  important: 'Important',
  info: 'Info',
};
export const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  everyone: 'Everyone signed in',
  members: 'Members only',
  admins: 'Admins only',
};

type PgError = { message: string } | null;
const check = <T,>({ data, error }: { data: T | null; error: PgError }): T => {
  if (error) throw new Error(error.message);
  return data as T;
};

// ---------------------------------------------------------------- reader side

export const fetchMyBroadcasts = async () =>
  (check(await supabase.rpc('my_broadcasts')) ?? []) as MyBroadcast[];

export const markBroadcast = async (id: string, ack = false) =>
  check(await supabase.rpc('broadcast_mark', { p_id: id, p_ack: ack }));

// ----------------------------------------------------------- super admin side

export const fetchBroadcasts = async () =>
  check(await supabase.from('broadcasts').select('*').order('starts_at', { ascending: false })) as Broadcast[];

export const createBroadcast = async (b: Pick<Broadcast, 'title' | 'body' | 'priority' | 'audience' | 'starts_at' | 'expires_at'>) =>
  check(await supabase.from('broadcasts').insert(b).select().single()) as Broadcast;

export const updateBroadcast = async (id: string, patch: Partial<Pick<Broadcast, 'expires_at' | 'starts_at'>>) =>
  check(await supabase.from('broadcasts').update(patch).eq('id', id).select().single()) as Broadcast;

export const deleteBroadcast = async (id: string) => check(await supabase.from('broadcasts').delete().eq('id', id));

export const fetchBroadcastReads = async () =>
  (check(await supabase.from('broadcast_reads').select('*')) ?? []) as BroadcastRead[];

export const fetchBroadcastPeople = async () =>
  (check(await supabase.rpc('broadcast_people')) ?? []) as BroadcastPerson[];

/** Live, scheduled or ended, judged against `now`. */
export const broadcastState = (b: Pick<Broadcast, 'starts_at' | 'expires_at'>, now = Date.now()) =>
  new Date(b.starts_at).getTime() > now ? 'scheduled'
    : b.expires_at && new Date(b.expires_at).getTime() <= now ? 'ended'
    : 'live';

/** Whether a person is in a broadcast's audience. */
export const reaches = (audience: BroadcastAudience, p: Pick<BroadcastPerson, 'is_admin'>) =>
  audience === 'everyone' || (audience === 'admins') === p.is_admin;

// ------------------------------------------------------------------- provider

interface BroadcastContextValue {
  items: MyBroadcast[];
  /** Ids that arrived live in this tab (not on first load), newest last. */
  arrived: string[];
  markSeen: (id: string) => void;
  acknowledge: (id: string) => void;
  /** The broadcast someone asked to read in full, if any. */
  reading: MyBroadcast | null;
  open: (id: string) => void;
  close: () => void;
}

const BroadcastContext = createContext<BroadcastContextValue | null>(null);

const REFRESH_MS = 5 * 60_000;

/**
 * Keeps the signed-in user's broadcasts fresh: on sign-in, on focus, every few
 * minutes (so scheduled ones go live) and the moment a super admin sends one.
 */
export function BroadcastProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const email = user?.email ?? null;
  const [items, setItems] = useState<MyBroadcast[]>([]);
  const [arrived, setArrived] = useState<string[]>([]);
  const [readingId, setReadingId] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchMyBroadcasts();
      // Anything new since the first load came in while the tab was open.
      if (known.current) {
        const fresh = next.filter(b => !known.current!.has(b.id) && !b.seen_at).map(b => b.id);
        if (fresh.length) setArrived(a => [...a, ...fresh]);
      }
      known.current = new Set(next.map(b => b.id));
      setItems(next);
    } catch {
      // Not migrated yet, offline, or the local dev bypass (no real session): stay quiet.
    }
  }, []);

  useEffect(() => {
    setItems([]); setArrived([]); setReadingId(null); known.current = null;
    if (!email) return;
    refresh();

    const channel = supabase
      .channel(`broadcasts:${email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, () => { refresh(); })
      .subscribe();
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [email, refresh]);

  const patch = useCallback((id: string, p: Partial<MyBroadcast>) =>
    setItems(xs => xs.map(b => (b.id === id ? { ...b, ...p } : b))), []);

  const markSeen = useCallback((id: string) => {
    const b = items.find(x => x.id === id);
    if (!b || b.seen_at) return;
    patch(id, { seen_at: new Date().toISOString() });
    markBroadcast(id).catch(() => {});
  }, [items, patch]);

  const acknowledge = useCallback((id: string) => {
    const now = new Date().toISOString();
    const b = items.find(x => x.id === id);
    if (!b || b.acked_at) return;
    patch(id, { seen_at: b.seen_at ?? now, acked_at: now });
    markBroadcast(id, true).catch(() => {});
  }, [items, patch]);

  const open = useCallback((id: string) => { setReadingId(id); markSeen(id); }, [markSeen]);
  const close = useCallback(() => setReadingId(null), []);

  const value = useMemo<BroadcastContextValue>(() => ({
    items, arrived, markSeen, acknowledge, open, close,
    reading: items.find(b => b.id === readingId) ?? null,
  }), [items, arrived, markSeen, acknowledge, open, close, readingId]);

  return <BroadcastContext.Provider value={value}>{children}</BroadcastContext.Provider>;
}

export const useBroadcasts = () => {
  const ctx = useContext(BroadcastContext);
  if (!ctx) throw new Error('useBroadcasts must be used within a BroadcastProvider');
  return ctx;
};
