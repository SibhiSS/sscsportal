import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Award, CalendarCheck, Contact, Info, Layers, Pencil } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { signProofImages } from '@/lib/club';
import type { AdminContribution, RosterMember } from '@/types/admin';
import { useAdminData } from '../AdminData';
import { fetchMemberContributions, updateMember } from '../api';
import { fmtMed, initials, isoDate, rangeDates, toDate, todayIso } from '../calendarLogic';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const localDay = (ts: string) => { const d = new Date(ts); return isoDate(d.getFullYear(), d.getMonth(), d.getDate()); };

export default function MemberCard() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const highlight = params.get('c')?.toUpperCase() ?? null;
  const { roster, leaderboard, attendance, events, attendanceTypes, reload } = useAdminData();
  const m = roster.find(r => r.id === id);

  const [contribs, setContribs] = useState<AdminContribution[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    if (!id) return;
    setContribs(null);
    fetchMemberContributions(id).then(setContribs).catch(err => { toast.error(errMsg(err)); setContribs([]); });
  }, [id]);
  useEffect(() => {
    const paths = (contribs ?? []).flatMap(c => c.proof_images ?? []);
    if (paths.length) signProofImages(paths).then(setUrls).catch(() => {});
  }, [contribs]);
  useEffect(() => {
    if (highlight && contribs) document.getElementById('c-' + highlight)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight, contribs]);

  const standing = leaderboard.find(r => r.member_id === id);
  const typeById = useMemo(() => new Map(attendanceTypes.map(t => [t.id, t])), [attendanceTypes]);
  const myEvents = useMemo(() => attendance
    .filter(a => a.member_id === id)
    .map(a => ({ a, ev: events.find(e => e.id === a.event_id), type: typeById.get(a.type_id) }))
    .filter(x => x.ev)
    .sort((x, y) => y.ev!.start_date.localeCompare(x.ev!.start_date)), [attendance, events, id, typeById]);

  const list = useMemo(() => contribs ?? [], [contribs]);
  const approved = list.filter(c => c.status === 'approved');
  const pending = list.filter(c => c.status === 'pending');
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of list.filter(x => x.status === 'approved')) {
      const k = c.contribution_types?.category ?? 'Other';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  // activity calendar
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const activity = useMemo(() => {
    const map = new Map<string, { label: string; cls: string }[]>();
    const push = (d: string, x: { label: string; cls: string }) => { const l = map.get(d); if (l) l.push(x); else map.set(d, [x]); };
    for (const { ev, type } of myEvents) for (const d of rangeDates(ev!.start_date, ev!.end_date)) push(d, { label: `${ev!.title}${type ? ` (${type.name.split(' ')[0]})` : ''}`, cls: 'event' });
    for (const c of list) push(localDay(c.created_at), { label: c.title, cls: 'contrib' });
    return map;
  }, [myEvents, list]);
  const cells = useMemo(() => {
    const first = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out: (string | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) out.push(isoDate(view.y, view.m, d));
    return out;
  }, [view]);
  const today = todayIso();

  if (!m) {
    return (
      <div className="panel">
        <h3 className="ph">Member not found</h3>
        <p className="muted">They may have been removed from the roster. <Link className="linkbtn" to="/admin/members">Back to members</Link></p>
      </div>
    );
  }

  const shown = list.filter(c => statusFilter === 'all' || c.status === statusFilter);

  return (
    <>
      <div className="profile">
        <aside className="profile-side">
          <div className="p-head">
            <div className="avatar lg">{initials(m.full_name)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2>{m.full_name}</h2>
              <div className="s">{[m.member_position, m.member_department].filter(Boolean).join(' · ') || 'Member'}</div>
              <div className="form-acts" style={{ marginTop: 8 }}>
                {m.is_lead && <span className="tag lead">Lead</span>}
                {m.member_status === 'inactive' && <span className="tag inactive">Inactive</span>}
              </div>
              <div className="p-pts">
                <Award size={14} color="var(--accent)" />
                {m.is_lead ? 'Leads earn no points' : standing ? <>{standing.total_points} pts · #{standing.rank}</> : '0 pts'}
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="mini-btn" onClick={() => setEditing(true)}><Pencil size={12} /> Edit</button>
              </div>
            </div>
          </div>

          <div className="p-sec">
            <div className="p-sec-h"><span className="ic"><Layers /></span>Contributions</div>
            <div className="statbars" style={{ marginBottom: 12 }}>
              <div className="statbar" style={{ '--c': 'var(--free)' } as React.CSSProperties}>Approved <b>{approved.length}</b></div>
              <div className="statbar" style={{ '--c': 'var(--t-exam)' } as React.CSSProperties}>Pending <b>{pending.length}</b></div>
            </div>
            {byCategory.length ? (
              <div className="chips">{byCategory.map(([k, n]) => <span key={k} className="chip">{k}<b>{n}</b></span>)}</div>
            ) : <div className="muted">{contribs === null ? 'Loading…' : 'No approved contributions yet.'}</div>}
          </div>

          <div className="p-sec">
            <div className="p-sec-h"><span className="ic"><Info /></span>General</div>
            <div className="kv"><span>Reg no</span><span>{m.roll_number ?? '—'}</span></div>
            <div className="kv"><span>Team</span><span>{m.member_department ?? '—'}</span></div>
            <div className="kv"><span>Position</span><span>{m.member_position ?? '—'}</span></div>
            <div className="kv"><span>Status</span><span>{m.member_status === 'active' ? 'Active' : 'Inactive'}</span></div>
            <div className="kv"><span>Events</span><span>{myEvents.length}</span></div>
          </div>

          <div className="p-sec">
            <div className="p-sec-h"><span className="ic"><Contact /></span>Contacts</div>
            <div className="kv"><span>Phone</span><span>{m.phone ? <a className="tel" href={`tel:${m.phone}`}>{m.phone}</a> : '—'}</span></div>
            <div className="kv"><span>E-mail</span><span><a className="tel" href={`mailto:${m.email}`}>{m.email}</a></span></div>
          </div>
        </aside>

        <section className="profile-main">
          <div className="cal-head">
            <div className="cal-title">{MONTHS[view.m]}, {view.y}</div>
            <div className="cal-nav">
              <button className="pill-btn" onClick={() => { const d = new Date(); setView({ y: d.getFullYear(), m: d.getMonth() }); }}>Today</button>
              <button className="circ" aria-label="Previous month" onClick={() => setView(v => { const d = new Date(v.y, v.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; })}>‹</button>
              <button className="circ" aria-label="Next month" onClick={() => setView(v => { const d = new Date(v.y, v.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; })}>›</button>
            </div>
          </div>
          <div className="grid7">{DOWS.map(d => <div key={d} className="dow">{d}</div>)}</div>
          <div className="grid7" style={{ marginTop: 4 }}>
            {cells.map((iso, i) => {
              if (!iso) return <div key={'e' + i} className="day empty" />;
              const acts = activity.get(iso) ?? [];
              const dow = toDate(iso).getDay();
              const cls = `day${acts.some(a => a.cls === 'event') ? ' has-event' : ''}${!acts.length && (dow === 0 || dow === 6) ? ' hatched' : ''}${iso === today ? ' today' : ''}`;
              return (
                <div key={iso} className={cls} style={{ height: 92, cursor: 'default' }}>
                  <div className="num">{toDate(iso).getDate()}</div>
                  <div className="lines">
                    {acts.slice(0, 2).map((a, j) => <div key={j} className={`evline ${a.cls}`} title={a.label}><span>{a.label}</span></div>)}
                    {acts.length > 2 && <span className="morechip">+{acts.length - 2}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="legend">
            <span><span className="swatch" style={{ background: 'var(--t-event)' }} />Event attended</span>
            <span><span className="swatch" style={{ background: 'var(--t-holiday)' }} />Contribution submitted</span>
          </div>

          <div className="divider" style={{ margin: '26px 0 6px' }}>Contributions</div>
          <div className="form-acts" style={{ marginBottom: 6 }}>
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} className={`pill-btn${statusFilter === f ? ' on' : ''}`} onClick={() => setStatusFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
            ))}
          </div>
          {contribs === null ? <div className="muted">Loading…</div> : shown.length ? shown.map(c => (
            <div key={c.id} id={'c-' + c.code} className={`citem${highlight === c.code ? ' hl' : ''}`}>
              <span className="code">{c.code}</span>
              <div className="body">
                <b>{c.title}</b>
                <div className="m">{c.contribution_types?.name} · {fmtMed(localDay(c.created_at))}</div>
                {c.description && <div className="m" style={{ whiteSpace: 'pre-wrap' }}>{c.description}</div>}
                {c.proof_url && <a className="linkbtn" style={{ padding: 0 }} href={c.proof_url} target="_blank" rel="noopener noreferrer">Proof link ↗</a>}
                {c.proof_images?.length > 0 && (
                  <div className="thumbs">
                    {c.proof_images.map(p => urls[p]
                      ? <a key={p} href={urls[p]} target="_blank" rel="noopener noreferrer"><img src={urls[p]} alt="Proof" /></a>
                      : <div key={p} />)}
                  </div>
                )}
                {c.review_note && <div className="m" style={{ marginTop: 4 }}>Reviewer: {c.review_note}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`tag ${c.status}`}>{c.status}</span>
                {c.status === 'approved' && <div className="pts" style={{ marginTop: 6 }}>+{c.points_awarded}</div>}
              </div>
            </div>
          )) : <div className="muted">No {statusFilter === 'all' ? '' : statusFilter} contributions.</div>}

          <div className="divider" style={{ margin: '26px 0 6px' }}>Events</div>
          {myEvents.length ? myEvents.map(({ a, ev, type }) => (
            <div key={a.id} className="citem">
              <CalendarCheck size={18} color="var(--t-event)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div className="body">
                <Link to={`/admin/events/${ev!.id}`} style={{ textDecoration: 'none' }}><b>{ev!.title}</b></Link>
                <div className="m">{type?.name ?? 'Attended'} · {fmtMed(ev!.start_date)}</div>
              </div>
              {!m.is_lead && <div className="pts">+{type?.default_points ?? 0}</div>}
            </div>
          )) : <div className="muted">No events marked yet.</div>}
        </section>
      </div>

      {editing && <EditMemberModal m={m} onClose={() => setEditing(false)} onSaved={async () => { await reload('roster', 'leaderboard'); setEditing(false); }} />}
    </>
  );
}

function EditMemberModal({ m, onClose, onSaved }: { m: RosterMember; onClose: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({
    full_name: m.full_name, roll_number: m.roll_number ?? '', phone: m.phone ?? '', member_department: m.member_department ?? '',
    member_position: m.member_position ?? '', is_lead: m.is_lead, active: m.member_status === 'active',
  });
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.full_name.trim()) { toast.error('Name is required.'); return; }
    setBusy(true);
    try {
      await updateMember(m.id, {
        full_name: f.full_name.trim(), roll_number: f.roll_number.trim().toUpperCase() || null, phone: f.phone.trim() || null,
        member_department: f.member_department.trim() || null, member_position: f.member_position.trim() || null,
        is_lead: f.is_lead, member_status: f.active ? 'active' : 'inactive',
      });
      await onSaved();
      toast.success('Member updated.');
    } catch (err) { toast.error(errMsg(err)); setBusy(false); }
  };
  const removeFromRoster = async () => {
    if (!window.confirm(`Take ${m.full_name} off the roster? Their history is kept, and they can be added back later.`)) return;
    setBusy(true);
    try { await updateMember(m.id, { is_member: false }); await onSaved(); toast.success('Removed from the roster.'); }
    catch (err) { toast.error(errMsg(err)); setBusy(false); }
  };
  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal adm-form" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="editMemberTitle">
        <div className="modal-head"><h3 id="editMemberTitle">Edit member</h3><button type="button" className="x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="grid2">
          <div className="fld wide"><label htmlFor="emName">Full name</label><input id="emName" required maxLength={100} value={f.full_name} onChange={e => setF(s => ({ ...s, full_name: e.target.value }))} /></div>
          <div className="fld"><label htmlFor="emRoll">Reg no</label><input id="emRoll" maxLength={20} value={f.roll_number} onChange={e => setF(s => ({ ...s, roll_number: e.target.value }))} /></div>
          <div className="fld"><label htmlFor="emPhone">Phone</label><input id="emPhone" maxLength={15} value={f.phone} onChange={e => setF(s => ({ ...s, phone: e.target.value }))} /></div>
          <div className="fld"><label htmlFor="emDept">Team</label><input id="emDept" maxLength={60} value={f.member_department} onChange={e => setF(s => ({ ...s, member_department: e.target.value }))} /></div>
          <div className="fld"><label htmlFor="emPos">Position</label><input id="emPos" maxLength={60} value={f.member_position} onChange={e => setF(s => ({ ...s, member_position: e.target.value }))} /></div>
          <label className="switch wide"><input type="checkbox" checked={f.is_lead} onChange={e => setF(s => ({ ...s, is_lead: e.target.checked }))} /><span className="track"><span className="knob" /></span><span>Lead <small className="muted">— no points, not on the leaderboard</small></span></label>
          <label className="switch wide"><input type="checkbox" checked={f.active} onChange={e => setF(s => ({ ...s, active: e.target.checked }))} /><span className="track"><span className="knob" /></span><span>Active member</span></label>
        </div>
        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="ghost" style={{ color: 'var(--busy)' }} onClick={removeFromRoster} disabled={busy}>Remove from roster</button>
          <div className="form-acts">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
