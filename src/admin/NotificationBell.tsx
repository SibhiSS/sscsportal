import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckSquare, Lightbulb, Megaphone, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBroadcasts } from '@/lib/broadcasts';
import { useAdminData } from './AdminData';
import { useIsSuperAdmin } from './SuperAdminOnly';

const SEEN_KEY = 'adm-notifications-seen';
const REFRESH_MS = 60_000;

const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) ?? ''; } catch { return ''; } };
const writeSeen = (v: string) => { try { localStorage.setItem(SEEN_KEY, v); } catch { /* private mode */ } };

type Note = { key: string; to: string; icon: typeof Bell; text: string; sub?: string; unread: boolean; onOpen?: () => void };

/**
 * The bell in the admin top bar. Each role sees what it can act on:
 * super admins get proposals waiting for a decision; every admin gets
 * contributions waiting for approval and decisions on their own proposals.
 */
export default function NotificationBell() {
  const { user } = useAuth();
  const isSuper = useIsSuperAdmin();
  const { pendingCount, proposals, reload } = useAdminData();
  const broadcasts = useBroadcasts();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const ref = useRef<HTMLDivElement>(null);

  // Keep counts fresh while the panel is open in a tab.
  useEffect(() => {
    const t = setInterval(() => { reload('pending', 'proposals').catch(() => {}); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const notes = useMemo<Note[]>(() => {
    const out: Note[] = [];
    // Messages from super admins, newest first; unread until opened.
    for (const b of broadcasts.items.slice(0, 5)) {
      out.push({
        key: `b:${b.id}`, to: '', icon: Megaphone, unread: !b.seen_at,
        text: b.title, sub: 'Message from the board', onOpen: () => broadcasts.open(b.id),
      });
    }
    if (isSuper) {
      const waiting = proposals.filter(p => p.status === 'pending');
      for (const p of waiting.slice(0, 5)) {
        out.push({
          key: `p:${p.id}`, to: '/admin/proposals', icon: Lightbulb, unread: true,
          text: `New proposal: ${p.title}`, sub: `by ${p.proposer_name || p.proposer_email} · waiting for your decision`,
        });
      }
      if (waiting.length > 5) out.push({ key: 'p:more', to: '/admin/proposals', icon: Lightbulb, unread: true, text: `+${waiting.length - 5} more proposals waiting` });
    }
    if (pendingCount > 0) {
      out.push({
        key: 'approvals', to: '/admin/approvals', icon: CheckSquare, unread: true,
        text: `${pendingCount} contribution${pendingCount === 1 ? '' : 's'} waiting for approval`,
      });
    }
    const me = user?.email.trim().toLowerCase();
    for (const p of proposals) {
      if (!me || p.proposer_email.trim().toLowerCase() !== me || p.status === 'pending' || !p.reviewed_at) continue;
      out.push({
        key: `d:${p.id}`, to: p.event_id ? `/admin/events/${p.event_id}` : '/admin/proposals',
        icon: p.status === 'accepted' ? ThumbsUp : ThumbsDown,
        text: `Your proposal “${p.title}” was ${p.status}`, sub: p.review_note ?? undefined,
        unread: p.reviewed_at > seen,
      });
    }
    return out.slice(0, 12);
  }, [isSuper, proposals, pendingCount, user?.email, seen, broadcasts]);

  const unread = notes.filter(n => n.unread).length;

  const toggle = () => {
    setOpen(o => !o);
    // Opening marks decisions as read; the to-do items stay until they're done.
    const now = new Date().toISOString();
    writeSeen(now);
    setTimeout(() => setSeen(now), 4000);
  };

  return (
    <div className="adm-bell" ref={ref}>
      <button className="adm-bell-btn" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} new` : ''}`} aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span className="adm-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="adm-bell-pop" role="menu">
          <div className="adm-bell-head">Notifications</div>
          {notes.length ? notes.map(n => n.onOpen ? (
            <button key={n.key} type="button" className={`adm-note${n.unread ? ' unread' : ''}`} onClick={() => { setOpen(false); n.onOpen!(); }} role="menuitem">
              <span className="ic"><n.icon size={15} /></span>
              <span className="tx"><b>{n.text}</b>{n.sub && <small>{n.sub}</small>}</span>
            </button>
          ) : (
            <Link key={n.key} to={n.to} className={`adm-note${n.unread ? ' unread' : ''}`} onClick={() => setOpen(false)} role="menuitem">
              <span className="ic"><n.icon size={15} /></span>
              <span className="tx"><b>{n.text}</b>{n.sub && <small>{n.sub}</small>}</span>
            </Link>
          )) : <div className="adm-note muted">You're all caught up.</div>}
        </div>
      )}
    </div>
  );
}
