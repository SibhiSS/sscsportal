import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import type { ClubMeet, MeetAttendance, RosterMember } from '@/types/admin';
import { useAdminData } from '../AdminData';
import { createMeet, deleteMeet, fetchMeetAttendance, fetchMeets, markMeet, meetPoints, unmarkMeet, updateMeet } from '../api';
import { fmtLong, initials, todayIso } from '../calendarLogic';
import { useIsSuperAdmin } from '../SuperAdminOnly';
import { MemberPicker } from './EventDetail';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';

/** Club meets: admins log who attended; 1 point for an online meet, 2 for offline. */
export default function MeetsPage() {
  const { user } = useAuth();
  const isSuper = useIsSuperAdmin();
  const { roster, reload } = useAdminData();
  const [meets, setMeets] = useState<ClubMeet[] | null>(null);
  const [att, setAtt] = useState<MeetAttendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', date: todayIso(), online: false });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([fetchMeets(), fetchMeetAttendance()]);
      setMeets(m); setAtt(a); setError(null);
    } catch (err) { setError(errMsg(err)); setMeets([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const memberById = useMemo(() => new Map(roster.map(m => [m.id, m])), [roster]);
  const byMeet = useMemo(() => {
    const m = new Map<string, MeetAttendance[]>();
    for (const a of att) m.set(a.meet_id, [...(m.get(a.meet_id) ?? []), a]);
    return m;
  }, [att]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { toast.error('Pick the date of the meet.'); return; }
    setCreating(true);
    try {
      const m = await createMeet({ title: form.title.trim() || 'Club meet', meet_date: form.date, is_online: form.online, created_by: user?.email ?? null });
      setMeets(xs => [m, ...(xs ?? [])].sort((a, b) => b.meet_date.localeCompare(a.meet_date)));
      setOpen(m.id);
      setForm(f => ({ ...f, title: '' }));
      toast.success('Meet added. Now mark who attended.');
    } catch (err) { toast.error(errMsg(err)); }
    finally { setCreating(false); }
  };

  const mark = async (meet: ClubMeet, m: RosterMember) => {
    try {
      const row = await markMeet(meet.id, m.id, user?.email ?? null);
      setAtt(xs => [...xs, row]);
      reload('leaderboard');
    } catch (err) { toast.error(/duplicate|unique/i.test(errMsg(err)) ? `${m.full_name} is already marked.` : errMsg(err)); }
  };

  const unmark = async (a: MeetAttendance) => {
    try { await unmarkMeet(a.id); setAtt(xs => xs.filter(x => x.id !== a.id)); reload('leaderboard'); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const setOnline = async (meet: ClubMeet, online: boolean) => {
    const n = byMeet.get(meet.id)?.length ?? 0;
    if (n && !window.confirm(`Make this an ${online ? 'online' : 'offline'} meet? The ${n} attendee${n === 1 ? '' : 's'} will get ${meetPoints(online)} point${meetPoints(online) === 1 ? '' : 's'} instead of ${meetPoints(!online)}.`)) return;
    try { const m = await updateMeet(meet.id, { is_online: online }); setMeets(xs => (xs ?? []).map(x => (x.id === m.id ? m : x))); reload('leaderboard'); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const rename = async (meet: ClubMeet, title: string) => {
    const t = title.trim();
    if (!t || t === meet.title) return;
    try { const m = await updateMeet(meet.id, { title: t }); setMeets(xs => (xs ?? []).map(x => (x.id === m.id ? m : x))); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const redate = async (meet: ClubMeet, date: string) => {
    if (!date || date === meet.meet_date) return;
    try { const m = await updateMeet(meet.id, { meet_date: date }); setMeets(xs => (xs ?? []).map(x => (x.id === m.id ? m : x)).sort((a, b) => b.meet_date.localeCompare(a.meet_date))); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const remove = async (meet: ClubMeet) => {
    const n = byMeet.get(meet.id)?.length ?? 0;
    if (!window.confirm(`Delete "${meet.title}" on ${fmtLong(meet.meet_date)}?${n ? ` The ${n} attendee${n === 1 ? '' : 's'} lose its points.` : ''}`)) return;
    try { await deleteMeet(meet.id); setMeets(xs => (xs ?? []).filter(x => x.id !== meet.id)); setAtt(xs => xs.filter(a => a.meet_id !== meet.id)); reload('leaderboard'); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const totalCredits = att.reduce((n, a) => {
    const m = meets?.find(x => x.id === a.meet_id);
    return n + (m ? meetPoints(m.is_online) : 0);
  }, 0);

  return (
    <>
      <div className="top">
        <div>
          <h1>Club meets</h1>
          <div className="sub">Mark who attended each club meet. Online meet: <b>1 point</b>. Offline meet: <b>2 points</b>. Points show on the leaderboard straight away (leads don't earn points).</div>
        </div>
      </div>

      {error && (
        <section className="panel">
          <h3 className="ph">Couldn't load club meets</h3>
          <p className="muted">{error}</p>
          <p className="note-sm">If this is new, run supabase/migrations/20261003002200_club_meets.sql in the Supabase SQL editor.</p>
        </section>
      )}

      <section className="panel">
        <h3 className="ph" style={{ marginBottom: 14 }}>New meet</h3>
        <form className="adm-form mt-form" onSubmit={create}>
          <div className="fld"><label htmlFor="mtTitle">Title</label>
            <input id="mtTitle" maxLength={120} placeholder="Club meet" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="fld"><label htmlFor="mtDate">Date</label>
            <input id="mtDate" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="fld"><span className="lbl">Mode</span>
            <div className="seg" role="radiogroup" aria-label="Online or offline">
              <button type="button" role="radio" aria-checked={!form.online} className={!form.online ? 'on' : ''} onClick={() => setForm(f => ({ ...f, online: false }))}>Offline · 2 pts</button>
              <button type="button" role="radio" aria-checked={form.online} className={form.online ? 'on' : ''} onClick={() => setForm(f => ({ ...f, online: true }))}>Online · 1 pt</button>
            </div>
          </div>
          <button className="primary" disabled={creating || !!error}>{creating ? 'Adding…' : 'Add meet'}</button>
        </form>
      </section>

      <section className="panel">
        <div className="list-head">
          <h3 className="ph">Meets</h3>
          <span className="asof">{meets?.length ?? 0} meets · {att.length} attendances · {totalCredits} points given</span>
        </div>
        {meets === null ? <div className="muted">Loading…</div> : meets.length ? (
          <div className="mt-list">
            {meets.map(meet => {
              const rows = byMeet.get(meet.id) ?? [];
              const isOpen = open === meet.id;
              const pts = meetPoints(meet.is_online);
              return (
                <article key={meet.id} className={`mt-card${isOpen ? ' open' : ''}`}>
                  <button className="mt-head" onClick={() => setOpen(isOpen ? null : meet.id)} aria-expanded={isOpen}>
                    <div className="mt-date"><b>{new Date(meet.meet_date + 'T00:00:00').getDate()}</b>
                      <span>{new Date(meet.meet_date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span></div>
                    <div className="mt-meta">
                      <b>{meet.title}</b>
                      <span className="muted">{fmtLong(meet.meet_date)}</span>
                    </div>
                    <span className={`tag ${meet.is_online ? 'pending' : 'approved'}`}>{meet.is_online ? 'Online' : 'Offline'} · {pts} pt{pts === 1 ? '' : 's'}</span>
                    <span className="mt-count"><Users size={14} /> {rows.length}</span>
                    <ChevronDown size={16} className="chev" />
                  </button>

                  {isOpen && (
                    <div className="mt-body">
                      <div className="mt-edit adm-form">
                        <input aria-label="Title" defaultValue={meet.title} maxLength={120} onBlur={e => rename(meet, e.target.value)} />
                        <input aria-label="Date" type="date" defaultValue={meet.meet_date} onBlur={e => redate(meet, e.target.value)} />
                        <div className="seg" role="radiogroup" aria-label="Online or offline">
                          <button type="button" className={!meet.is_online ? 'on' : ''} onClick={() => meet.is_online && setOnline(meet, false)}>Offline</button>
                          <button type="button" className={meet.is_online ? 'on' : ''} onClick={() => !meet.is_online && setOnline(meet, true)}>Online</button>
                        </div>
                        <button className="mini-btn danger" onClick={() => remove(meet)}><Trash2 size={13} /> Delete meet</button>
                      </div>

                      <MemberPicker exclude={new Set(rows.map(r => r.member_id))} placeholder="Add an attendee from the roster…" onPick={m => mark(meet, m)} />

                      {rows.length ? (
                        <div className="people" style={{ marginTop: 12 }}>
                          {rows.map(a => {
                            const m = memberById.get(a.member_id);
                            return (
                              <div key={a.id} className="person">
                                <span className="avatar">{initials(m?.full_name ?? '?')}</span>
                                <div className="who">
                                  <Link to={`/admin/members/${a.member_id}`} style={{ textDecoration: 'none' }}><b>{m?.full_name ?? 'Removed member'}</b></Link>
                                  <span>
                                    {m?.member_department ?? ''}{m?.is_lead ? ' · Lead (no points)' : ` · +${pts}`}
                                    {isSuper && a.marked_by ? ` · marked by ${a.marked_by.split('@')[0]}` : ''}
                                  </span>
                                </div>
                                <button className="circ" onClick={() => unmark(a)} aria-label={`Remove ${m?.full_name ?? 'attendee'}`}><X size={14} /></button>
                              </div>
                            );
                          })}
                        </div>
                      ) : <p className="muted" style={{ marginBottom: 0 }}>No one marked yet.</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : <div className="muted">No meets yet. Add the first one above.</div>}
      </section>
    </>
  );
}
