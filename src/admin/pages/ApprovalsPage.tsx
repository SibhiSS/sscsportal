import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, ExternalLink, RotateCcw, Trash2, X } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { signProofImages } from '@/lib/club';
import type { AdminContribution } from '@/types/admin';
import { useAdminData } from '../AdminData';
import {
  deleteContribution, fetchContributionsForReview, reopenContribution, reviewContribution, updateEvent, type ReviewFilter,
} from '../api';
import { fmtMed, fmtRange, isoDate, todayIso } from '../calendarLogic';
import { useIsSuperAdmin } from '../SuperAdminOnly';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';
const localDay = (ts: string) => { const d = new Date(ts); return isoDate(d.getFullYear(), d.getMonth(), d.getDate()); };

export default function ApprovalsPage() {
  const { roster, events, pendingCount, reload } = useAdminData();
  const isSuper = useIsSuperAdmin();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('s') as ReviewFilter) || 'pending';
  const [rows, setRows] = useState<AdminContribution[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [q, setQ] = useState(params.get('q') ?? '');
  const [category, setCategory] = useState('all');
  const [lightbox, setLightbox] = useState<{ paths: string[]; i: number } | null>(null);

  const memberById = useMemo(() => new Map(roster.map(m => [m.id, m])), [roster]);
  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);

  const load = useCallback(async () => {
    setRows(null);
    try { setRows(await fetchContributionsForReview(filter)); }
    catch (err) { toast.error(errMsg(err)); setRows([]); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const paths = (rows ?? []).flatMap(r => r.proof_images ?? []);
    if (paths.length) signProofImages(paths).then(u => setUrls(prev => ({ ...prev, ...u }))).catch(() => {});
  }, [rows]);

  const categories = useMemo(() => [...new Set((rows ?? []).map(r => r.contribution_types?.category ?? 'Other'))].sort(), [rows]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter(r =>
      (category === 'all' || (r.contribution_types?.category ?? 'Other') === category)
      && (!term || [r.code, r.title, memberById.get(r.member_id)?.full_name ?? ''].some(x => x.toLowerCase().includes(term))));
  }, [rows, q, category, memberById]);

  const setFilter = (s: ReviewFilter) => setParams(p => { p.set('s', s); return p; }, { replace: true });

  /** A card was reviewed, moved back to pending (next = the updated row) or deleted (next = null). */
  const onChanged = async (id: string, next: AdminContribution | null) => {
    setRows(prev => (prev ?? []).flatMap(r => {
      if (r.id !== id) return [r];
      if (!next || (filter !== 'all' && next.status !== filter)) return [];
      return [{ ...r, ...next, contribution_types: r.contribution_types }];
    }));
    await reload('pending', 'leaderboard');
  };

  return (
    <>
      <div className="top">
        <div>
          <h1>Approvals</h1>
          <div className="sub">Review what members submitted. Points count on the leaderboard once approved.</div>
        </div>
      </div>

      <section className="panel">
        <div className="list-head">
          <div className="form-acts">
            {(['pending', 'approved', 'rejected', 'all'] as ReviewFilter[]).map(s => (
              <button key={s} className={`pill-btn${filter === s ? ' on' : ''}`} onClick={() => setFilter(s)}>
                {s[0].toUpperCase() + s.slice(1)}{s === 'pending' && pendingCount ? ` · ${pendingCount}` : ''}
              </button>
            ))}
          </div>
          <div className="form-acts">
            <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input aria-label="Search submissions" placeholder="Code, title or member" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>

        {rows === null ? <div className="muted">Loading…</div>
          : shown.length === 0 ? (
            <div className="muted" style={{ padding: '18px 0' }}>
              {filter === 'pending' && !q && category === 'all' ? 'Nothing waiting for review. 🎉' : 'Nothing matches.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {shown.map(c => (
                <ReviewCard key={c.id} c={c}
                  memberName={memberById.get(c.member_id)?.full_name ?? 'Former member'}
                  memberTeam={memberById.get(c.member_id)?.member_department ?? null}
                  isLead={!!memberById.get(c.member_id)?.is_lead}
                  eventTitle={c.event_id ? eventById.get(c.event_id)?.title ?? null : null}
                  urls={urls}
                  onOpenImage={i => setLightbox({ paths: c.proof_images, i })}
                  onChanged={next => onChanged(c.id, next)} />
              ))}
            </div>
          )}
        {rows && rows.length >= 300 && <p className="note-sm" style={{ marginTop: 12 }}>Showing the 300 most relevant. Use search to narrow down.</p>}
      </section>

      {isSuper && <EventsForMembers />}

      {lightbox && (
        <Lightbox urls={lightbox.paths.map(p => urls[p]).filter(Boolean)} start={lightbox.i} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

/** Super admins choose which upcoming events members may tag their work with. */
function EventsForMembers() {
  const { events, patchEvent } = useAdminData();
  const [busy, setBusy] = useState<string | null>(null);
  const today = todayIso();
  const upcoming = useMemo(() => events.filter(e => e.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date)), [events, today]);
  const pastCount = events.length - upcoming.length;

  const toggle = async (id: string, shown: boolean) => {
    setBusy(id);
    try { patchEvent(await updateEvent(id, { shown_to_members: shown })); }
    catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(null); }
  };

  return (
    <section className="panel">
      <div className="list-head">
        <h3 className="ph">Events members can pick</h3>
        <span className="asof">{upcoming.filter(e => e.shown_to_members).length} of {upcoming.length} upcoming shown</span>
      </div>
      <p className="note-sm">
        When members log a contribution they can say which event it was for. Past events ({pastCount}) are always in that list;
        upcoming events only appear once you switch them on here.
      </p>
      {upcoming.length ? (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Dates</th><th>Event</th><th style={{ width: 200 }}>Members can pick it</th></tr></thead>
            <tbody>
              {upcoming.map(e => (
                <tr key={e.id}>
                  <td className="d">{fmtRange(e.start_date, e.end_date)}</td>
                  <td><Link to={`/admin/events/${e.id}`} style={{ textDecoration: 'none', fontWeight: 600 }}>{e.title}</Link></td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={e.shown_to_members} disabled={busy === e.id}
                        onChange={ev => toggle(e.id, ev.target.checked)} aria-label={`Show ${e.title} to members`} />
                      <span className="track"><span className="knob" /></span>
                      <span>{e.shown_to_members ? 'Shown' : 'Hidden'}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="muted">No upcoming events.</div>}
    </section>
  );
}

function ReviewCard({ c, memberName, memberTeam, isLead, eventTitle, urls, onOpenImage, onChanged }: {
  c: AdminContribution; memberName: string; memberTeam: string | null; isLead: boolean; eventTitle: string | null;
  urls: Record<string, string>; onOpenImage: (i: number) => void; onChanged: (next: AdminContribution | null) => void;
}) {
  const def = c.contribution_types?.default_points ?? 0;
  const [points, setPoints] = useState(String(def));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (status: 'approved' | 'rejected') => {
    let pts: number | null = null;
    if (status === 'approved') {
      pts = Number(points);
      if (!Number.isInteger(pts) || pts < 0) { toast.error('Points must be a whole number, 0 or more.'); return; }
    }
    setBusy(true);
    try {
      const next = await reviewContribution(c.id, status, pts, note.trim() || null);
      toast.success(status === 'approved' ? `${c.code} approved · +${pts} for ${memberName}` : `${c.code} rejected`);
      setBusy(false);
      onChanged(next);
    } catch (err) { toast.error(errMsg(err)); setBusy(false); }
  };

  const reopen = async () => {
    const lose = c.status === 'approved' ? ` Its ${c.points_awarded} points come off ${memberName}'s total until it's approved again.` : '';
    if (!window.confirm(`Move ${c.code} back to pending?${lose}`)) return;
    setBusy(true);
    try {
      const next = await reopenContribution(c.id);
      toast.success(`${c.code} is waiting for review again.`);
      setBusy(false);
      setPoints(String(def));
      setNote('');
      onChanged(next);
    } catch (err) { toast.error(errMsg(err)); setBusy(false); }
  };

  const remove = async () => {
    const lose = c.status === 'approved' ? ` ${memberName} loses its ${c.points_awarded} points.` : '';
    if (!window.confirm(`Delete ${c.code} "${c.title}" permanently?${lose} This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteContribution(c);
      toast.success(`${c.code} deleted.`);
      onChanged(null);
    } catch (err) { toast.error(errMsg(err)); setBusy(false); }
  };

  return (
    <div className="entry" style={{ marginBottom: 0 }}>
      <div className="citem" style={{ padding: 0 }}>
        <span className="code">{c.code}</span>
        <div className="body">
          <b>{c.title}</b>
          <div className="m">
            <Link to={`/admin/members/${c.member_id}?c=${c.code}`} className="tel">{memberName}</Link>
            {memberTeam && <> · {memberTeam}</>}
            {' · '}{c.contribution_types?.name} ({def} pts)
            {eventTitle && <> · {eventTitle}</>}
            {' · '}{fmtMed(localDay(c.created_at))}
          </div>
          {c.description && <div className="m" style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{c.description}</div>}
          {c.proof_url && (
            <a className="mini-btn" style={{ marginTop: 8 }} href={c.proof_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Proof link</a>
          )}
          {c.proof_images?.length > 0 && (
            <div className="thumbs">
              {c.proof_images.map((p, i) => urls[p]
                ? <button key={p} type="button" onClick={() => onOpenImage(i)} style={{ padding: 0, border: '1px solid var(--line)', borderRadius: 9, width: 64, height: 64, overflow: 'hidden', background: 'none' }} aria-label={`Open image ${i + 1}`}><img src={urls[p]} alt="Proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></button>
                : <div key={p} style={{ width: 64, height: 64 }} />)}
            </div>
          )}
          {isLead && c.status === 'pending' && <div className="warn">Submitted before they became a lead — leads earn no points.</div>}
          {c.status !== 'pending' && (
            <div className="m" style={{ marginTop: 8 }}>
              <span className={`tag ${c.status}`}>{c.status}</span>
              {c.status === 'approved' && <b className="pts" style={{ marginLeft: 8 }}>+{c.points_awarded}</b>}
              {c.reviewed_by && <> · by {c.reviewed_by}</>}
              {c.reviewed_at && <> · {fmtMed(localDay(c.reviewed_at))}</>}
              {c.review_note && <div style={{ marginTop: 4 }}>Note: {c.review_note}</div>}
              <div className="form-acts" style={{ marginTop: 10 }}>
                <button className="mini-btn" disabled={busy} onClick={reopen}><RotateCcw size={12} /> Move back to pending</button>
                <button className="mini-btn danger" disabled={busy} onClick={remove}><Trash2 size={12} /> Delete</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {c.status === 'pending' && (
        <div className="adm-form" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div className="fld" style={{ width: 110 }}>
            <label htmlFor={'pts-' + c.id}>Points</label>
            <input id={'pts-' + c.id} inputMode="numeric" value={points} onChange={e => setPoints(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
          <div className="fld" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor={'note-' + c.id}>Note to the member (optional)</label>
            <input id={'note-' + c.id} maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder={Number(points) !== def ? 'Why the points were adjusted' : ''} />
          </div>
          <div className="form-acts">
            <button className="mini-btn danger" disabled={busy} onClick={remove} title="Delete permanently" aria-label={`Delete ${c.code}`}><Trash2 size={12} /></button>
            <button className="ghost" disabled={busy} onClick={() => act('rejected')} style={{ color: 'var(--busy)' }}><X size={14} /> Reject</button>
            <button className="primary" disabled={busy} onClick={() => act('approved')}><Check size={14} /> Approve</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Lightbox({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(Math.min(start, urls.length - 1));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI(x => Math.min(x + 1, urls.length - 1));
      if (e.key === 'ArrowLeft') setI(x => Math.max(x - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, urls.length]);
  if (!urls.length) return null;
  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Proof image">
      <div style={{ position: 'relative', maxWidth: 'min(1000px, 100%)' }}>
        <img src={urls[i]} alt={`Proof ${i + 1} of ${urls.length}`} style={{ maxWidth: '100%', maxHeight: '82vh', borderRadius: 14, border: '1px solid var(--line-2)', display: 'block' }} />
        <div className="form-acts" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="circ" disabled={i === 0} onClick={() => setI(x => x - 1)} aria-label="Previous image"><ChevronLeft size={16} /></button>
          <span className="asof">{i + 1} / {urls.length}</span>
          <button className="circ" disabled={i === urls.length - 1} onClick={() => setI(x => x + 1)} aria-label="Next image"><ChevronRight size={16} /></button>
          <a className="mini-btn" href={urls[i]} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Full size</a>
          <button className="mini-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

