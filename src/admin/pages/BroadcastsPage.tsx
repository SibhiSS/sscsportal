import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Send, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { BroadcastCard } from '@/components/broadcasts/BroadcastCenter';
import BroadcastBody from '@/components/broadcasts/BroadcastBody';
import {
  AUDIENCE_LABELS, PRIORITY_LABELS, broadcastState, createBroadcast, deleteBroadcast, fetchBroadcastPeople,
  fetchBroadcastReads, fetchBroadcasts, reaches, updateBroadcast,
  type Broadcast, type BroadcastAudience, type BroadcastPerson, type BroadcastPriority, type BroadcastRead,
} from '@/lib/broadcasts';
import { initials } from '../calendarLogic';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';

const PRIORITY_HELP: Record<BroadcastPriority, string> = {
  critical: 'Full-screen card the next time they open the site. They must press "Got it".',
  important: 'Banner at the bottom of every page until they dismiss it.',
  info: 'A short pop-up once, then it stays in their messages.',
};

const STATE_TAG: Record<ReturnType<typeof broadcastState>, string> = { live: 'approved', scheduled: 'pending', ended: 'neutral' };

/** datetime-local value <-> ISO, in the browser's own time zone. */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const EMPTY = { title: '', body: '', priority: 'info' as BroadcastPriority, audience: 'everyone' as BroadcastAudience, schedule: false, starts: '', expires: '' };

/** Super admins send messages to everyone signed in, and see who has read them. */
export default function BroadcastsPage() {
  const [list, setList] = useState<Broadcast[] | null>(null);
  const [reads, setReads] = useState<BroadcastRead[]>([]);
  const [people, setPeople] = useState<BroadcastPerson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, r, p] = await Promise.all([fetchBroadcasts(), fetchBroadcastReads(), fetchBroadcastPeople()]);
      setList(b); setReads(r); setPeople(p); setError(null);
    } catch (err) { setError(errMsg(err)); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // Receipts trickle in as people sign in.
  useEffect(() => {
    const t = setInterval(() => { fetchBroadcastReads().then(setReads).catch(() => {}); }, 30_000);
    return () => clearInterval(t);
  }, []);

  const readsBy = useMemo(() => {
    const m = new Map<string, Map<string, BroadcastRead>>();
    for (const r of reads) {
      if (!m.has(r.broadcast_id)) m.set(r.broadcast_id, new Map());
      m.get(r.broadcast_id)!.set(r.email, r);
    }
    return m;
  }, [reads]);

  const reach = (a: BroadcastAudience) => people.filter(p => reaches(a, p)).length;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) { toast.error('Give the message a title.'); return; }
    const starts_at = (form.schedule && fromLocalInput(form.starts)) || new Date().toISOString();
    const expires_at = form.schedule ? fromLocalInput(form.expires) : null;
    if (expires_at && expires_at <= starts_at) { toast.error('The end time has to be after the start time.'); return; }
    const n = reach(form.audience);
    const later = new Date(starts_at).getTime() > Date.now() + 60_000;
    if (form.priority === 'critical' && !window.confirm(`Send a critical message to ${AUDIENCE_LABELS[form.audience].toLowerCase()}${n ? ` (about ${n} people)` : ''}? It takes over their screen until they acknowledge it.`)) return;
    setSending(true);
    try {
      const b = await createBroadcast({ title, body: form.body.trim(), priority: form.priority, audience: form.audience, starts_at, expires_at });
      setList(xs => [b, ...(xs ?? [])]);
      setForm(EMPTY);
      setOpen(b.id);
      toast.success(later ? `Scheduled for ${when(starts_at)}.` : 'Sent. Anyone online sees it now.');
    } catch (err) { toast.error(errMsg(err)); }
    finally { setSending(false); }
  };

  const endNow = async (b: Broadcast) => {
    if (!window.confirm(`Stop showing "${b.title}"? People who haven't seen it won't get it.`)) return;
    try {
      const u = await updateBroadcast(b.id, { expires_at: new Date().toISOString() });
      setList(xs => (xs ?? []).map(x => (x.id === u.id ? u : x)));
    } catch (err) { toast.error(errMsg(err)); }
  };

  const remove = async (b: Broadcast) => {
    if (!window.confirm(`Delete "${b.title}" and its read receipts? This can't be undone.`)) return;
    try { await deleteBroadcast(b.id); setList(xs => (xs ?? []).filter(x => x.id !== b.id)); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const preview = { id: 'preview', title: form.title.trim(), body: form.body, priority: form.priority, starts_at: (form.schedule && fromLocalInput(form.starts)) || new Date().toISOString() };
  const live = (list ?? []).filter(b => broadcastState(b) === 'live').length;

  return (
    <>
      <div className="top">
        <div>
          <h1>Broadcasts</h1>
          <div className="sub">Send a message to everyone who signs in: members, admins, or both. It arrives live for anyone already on the site.</div>
        </div>
      </div>

      {error && (
        <section className="panel">
          <h3 className="ph">Couldn't load broadcasts</h3>
          <p className="muted">{error}</p>
          <p className="note-sm">If this is new, run supabase/migrations/20261006000000_broadcasts.sql in the Supabase SQL editor.</p>
        </section>
      )}

      <section className="panel bc-compose">
        <form className="adm-form bc-form" onSubmit={send}>
          <h3 className="ph">New message</h3>
          <div className="fld"><label htmlFor="bcTitle">Title</label>
            <input id="bcTitle" maxLength={120} required placeholder="e.g. Membership renewal closes Friday" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="fld"><label htmlFor="bcBody">Message <span className="bc-count">{form.body.length}/2000</span></label>
            <textarea id="bcBody" rows={5} maxLength={2000} placeholder="Plain text. Links like https://… become clickable." value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))} /></div>

          <div className="fld"><span className="lbl">Priority</span>
            <div className="seg" role="radiogroup" aria-label="Priority">
              {(['info', 'important', 'critical'] as const).map(p => (
                <button key={p} type="button" role="radio" aria-checked={form.priority === p} className={form.priority === p ? `on bc-seg-${p}` : ''}
                  onClick={() => setForm(f => ({ ...f, priority: p }))}>{PRIORITY_LABELS[p]}</button>
              ))}
            </div>
            <span className="note-sm" style={{ margin: 0 }}>{PRIORITY_HELP[form.priority]}</span>
          </div>

          <div className="fld"><span className="lbl">Send to</span>
            <div className="seg bc-seg-wrap" role="radiogroup" aria-label="Audience">
              {(['everyone', 'members', 'admins'] as const).map(a => (
                <button key={a} type="button" role="radio" aria-checked={form.audience === a} className={form.audience === a ? 'on' : ''}
                  onClick={() => setForm(f => ({ ...f, audience: a }))}>{AUDIENCE_LABELS[a]}</button>
              ))}
            </div>
            {people.length > 0 && <span className="note-sm" style={{ margin: 0 }}>Reaches about {reach(form.audience)} people on the roster and admin list.</span>}
          </div>

          <label className="bc-check">
            <input type="checkbox" checked={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.checked, starts: f.starts || toLocalInput(new Date()) }))} />
            Schedule it, or set when it stops showing
          </label>
          {form.schedule && (
            <div className="bc-when">
              <div className="fld"><label htmlFor="bcStart">Goes live</label>
                <input id="bcStart" type="datetime-local" value={form.starts} onChange={e => setForm(f => ({ ...f, starts: e.target.value }))} /></div>
              <div className="fld"><label htmlFor="bcEnd">Stops showing (optional)</label>
                <input id="bcEnd" type="datetime-local" value={form.expires} min={form.starts || undefined} onChange={e => setForm(f => ({ ...f, expires: e.target.value }))} /></div>
            </div>
          )}

          <div>
            <button className="primary" disabled={sending || !!error}>
              <Send size={14} /> {sending ? 'Sending…' : form.schedule && form.starts && new Date(form.starts).getTime() > Date.now() + 60_000 ? 'Schedule' : 'Send now'}
            </button>
          </div>
        </form>

        <div className="bc-preview" aria-label="Preview">
          <div className="bc-preview-lbl">What they'll see</div>
          {form.priority === 'critical' ? (
            <div className="bc-preview-stage"><BroadcastCard b={preview} mode="preview" /></div>
          ) : form.priority === 'important' ? (
            <div className="bc-preview-stage bc-preview-banner">
              <div className="bc-pv-banner">
                <b>{preview.title || 'Your title'}</b>
                <span>{form.body || 'Your message appears here.'}</span>
              </div>
            </div>
          ) : (
            <div className="bc-preview-stage bc-preview-toast">
              <div className="bc-pv-toast">
                <b>{preview.title || 'Your title'}</b>
                <span>{form.body ? (form.body.length > 140 ? `${form.body.slice(0, 140)}…` : form.body) : 'Your message appears here.'}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="list-head">
          <h3 className="ph">Sent</h3>
          <span className="asof">{list?.length ?? 0} messages · {live} live now</span>
        </div>
        {list === null ? <div className="muted">Loading…</div> : list.length ? (
          <div className="bc-list">
            {list.map(b => {
              const st = broadcastState(b);
              const mine = readsBy.get(b.id) ?? new Map<string, BroadcastRead>();
              const audience = people.filter(p => reaches(b.audience, p));
              const seen = [...mine.values()];
              const acked = seen.filter(r => r.acked_at).length;
              const notYet = audience.filter(p => !mine.has(p.email));
              const total = Math.max(audience.length, seen.length);
              const pct = total ? Math.round((seen.length / total) * 100) : 0;
              const name = (email: string) => people.find(p => p.email === email)?.name ?? email;
              const isOpen = open === b.id;
              return (
                <article key={b.id} className={`bc-item${isOpen ? ' open' : ''}`}>
                  <button className="bc-item-head" onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen}>
                    <span className={`bc-dot bc-dot-${b.priority}`} aria-label={PRIORITY_LABELS[b.priority]} />
                    <span className="bc-item-main">
                      <b>{b.title}</b>
                      <small>{AUDIENCE_LABELS[b.audience]} · {st === 'scheduled' ? `goes live ${when(b.starts_at)}` : `sent ${when(b.starts_at)}`}{b.expires_at && st !== 'ended' ? ` · until ${when(b.expires_at)}` : ''}</small>
                    </span>
                    <span className="bc-reach" title={`${seen.length} of ${total} have seen it`}>
                      <span className="bc-bar"><i style={{ width: `${pct}%` }} /></span>
                      <small>{seen.length}/{total} seen</small>
                    </span>
                    <span className={`tag ${STATE_TAG[st]}`}>{st === 'live' ? 'Live' : st === 'scheduled' ? 'Scheduled' : 'Ended'}</span>
                    <ChevronDown size={16} className="bc-chev" />
                  </button>
                  {isOpen && (
                    <div className="bc-item-body">
                      <BroadcastBody text={b.body} className="bc-item-text" />
                      <div className="chips" style={{ margin: '12px 0' }}>
                        <span className="chip">{PRIORITY_LABELS[b.priority]}</span>
                        <span className="chip">Seen<b>{seen.length}</b></span>
                        {b.priority !== 'info' && <span className="chip">{b.priority === 'critical' ? 'Acknowledged' : 'Dismissed'}<b>{acked}</b></span>}
                        <span className="chip">Not yet<b>{notYet.length}</b></span>
                        {b.created_by && <span className="chip">By<b>{b.created_by}</b></span>}
                      </div>
                      <div className="bc-receipts">
                        <div>
                          <div className="bc-rc-head">Seen ({seen.length})</div>
                          {seen.length ? seen.sort((x, y) => y.seen_at.localeCompare(x.seen_at)).map(r => (
                            <div key={r.email} className="bc-person">
                              <span className="bc-av">{initials(name(r.email))}</span>
                              <span className="bc-pn">{name(r.email)}</span>
                              <small>{r.acked_at && b.priority !== 'info' ? '✓ ' : ''}{when(r.seen_at)}</small>
                            </div>
                          )) : <div className="muted note-sm">Nobody yet.</div>}
                        </div>
                        <div>
                          <div className="bc-rc-head">Not yet ({notYet.length})</div>
                          {notYet.length ? notYet.map(p => (
                            <div key={p.email} className="bc-person dim">
                              <span className="bc-av">{initials(p.name)}</span>
                              <span className="bc-pn">{p.name}</span>
                              {p.is_admin && <small>admin</small>}
                            </div>
                          )) : <div className="muted note-sm">{seen.length ? 'Everyone has seen it.' : 'Nobody on the list.'}</div>}
                        </div>
                      </div>
                      <div className="bc-actions">
                        {st === 'live' && <button className="mini-btn" onClick={() => endNow(b)}>End now</button>}
                        <button className="mini-btn danger" onClick={() => remove(b)}><Trash2 size={12} /> {st === 'scheduled' ? 'Cancel' : 'Delete'}</button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : <div className="muted">Nothing sent yet. Your first message will show up here with its read receipts.</div>}
      </section>
    </>
  );
}
