import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { EventActivity } from '@/types/admin';
import { fetchEventActivity } from './api';

const when = (iso: string) => {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** Who did what on an event, newest first (super admins only; enforced by RLS). */
export default function EventActivityLog({ eventId, version }: { eventId: string; version: string }) {
  const [rows, setRows] = useState<EventActivity[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await fetchEventActivity(eventId)); setError(false); }
    catch { setError(true); setRows([]); }
  }, [eventId]);
  // Reload when the event itself changes; the button covers people and budget edits.
  useEffect(() => { load(); }, [load, version]);

  if (error) return <p className="note-sm">The activity log needs the latest database migration.</p>;
  if (rows === null) return <div className="muted">Loading…</div>;
  return (
    <>
      <button className="mini-btn" onClick={load} style={{ marginBottom: 10 }}><RefreshCw size={12} /> Refresh</button>
      {rows.length ? (
        <ol className="act-log">
          {rows.map(r => (
            <li key={r.id}>
              <span className="who" title={r.actor}>{r.actor === 'system' ? 'System' : r.actor.split('@')[0]}</span>
              <span className="what">{r.action}</span>
              <time dateTime={r.created_at}>{when(r.created_at)}</time>
            </li>
          ))}
        </ol>
      ) : <p className="muted" style={{ margin: 0 }}>Nothing logged yet. Changes from now on appear here.</p>}
    </>
  );
}
