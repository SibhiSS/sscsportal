import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Download, ExternalLink, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import type { ClubEvent, RosterMember } from '@/types/admin';
import { useAdminData } from '../AdminData';
import {
  addAttendance, deleteEvent, removeAttendance, removeEventFile, setAttendanceType, signEventFile, updateEvent,
  uploadEventFile, type EventFileKind,
} from '../api';
import {
  eventChecklist, eventHasOurBooking, fmtLong, fmtRange, fmtShort, fmtTime, formWarnings, initials, venueName, venueRange,
} from '../calendarLogic';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';

function Tick({ on }: { on: boolean }) {
  return <span className={`tick${on ? ' on' : ''}`} aria-label={on ? 'Done' : 'Not done'}>{on && <Check strokeWidth={3} />}</span>;
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="track"><span className="knob" /></span>
      <span>{label}</span>
    </label>
  );
}

/** Search the roster and pick someone. */
export function MemberPicker({ exclude, onPick, placeholder }: { exclude: Set<string>; onPick: (m: RosterMember) => void; placeholder: string }) {
  const { roster } = useAdminData();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const term = q.trim().toLowerCase();
  const options = roster
    .filter(m => m.member_status === 'active' && !exclude.has(m.id))
    .filter(m => !term || [m.full_name, m.email, m.roll_number ?? '', m.member_department ?? ''].some(x => x.toLowerCase().includes(term)))
    .slice(0, 30);
  return (
    <div className="picker adm-form" ref={ref}>
      <input value={q} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true); }} />
      {open && (
        <div className="picker-list">
          {options.length ? options.map(m => (
            <button key={m.id} type="button" onClick={() => { onPick(m); setQ(''); setOpen(false); }}>
              <span className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{initials(m.full_name)}</span>
              {m.full_name}
              <span className="m">{m.member_department ?? ''}{m.is_lead ? ' · Lead' : ''}</span>
            </button>
          )) : <div className="muted" style={{ padding: 8 }}>No matching active members.</div>}
        </div>
      )}
    </div>
  );
}

function FileSlot({ ev, kind, path, accept, label, onSaved }: {
  ev: ClubEvent; kind: EventFileKind; path: string | null; accept: string; label: string; onSaved: (ev: ClubEvent) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const column = ({ poster: 'poster_path', report: 'report_path', budget: 'budget_sheet_path' } as const)[kind];
  const isImage = !!path && /\.(jpe?g|png|webp|gif)$/i.test(path);

  useEffect(() => {
    let live = true;
    setPreview(null);
    if (path && isImage) signEventFile(path).then(u => { if (live) setPreview(u); }).catch(() => {});
    return () => { live = false; };
  }, [path, isImage]);

  const upload = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) { toast.error('Files can be at most 15 MB.'); return; }
    setBusy(true);
    try {
      const newPath = await uploadEventFile(ev.id, kind, file);
      const saved = await updateEvent(ev.id, { [column]: newPath });
      await removeEventFile(path);
      onSaved(saved);
      toast.success(`${label} uploaded.`);
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!path || !window.confirm(`Remove the ${label.toLowerCase()}?`)) return;
    setBusy(true);
    try {
      const saved = await updateEvent(ev.id, { [column]: null });
      await removeEventFile(path);
      onSaved(saved);
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };
  const open = async (download: boolean) => {
    if (!path) return;
    try {
      const url = await signEventFile(path, download ? `${ev.title} ${label}.${path.split('.').pop()}` : undefined);
      window.open(url, '_blank', 'noopener');
    } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div>
      {preview && <img className="poster-prev" src={preview} alt={`${ev.title} ${label}`} />}
      <div className="filebox">
        {path ? (
          <>
            <button className="mini-btn" onClick={() => open(false)}><ExternalLink size={12} /> Open</button>
            <button className="mini-btn" onClick={() => open(true)}><Download size={12} /> .{path.split('.').pop()}</button>
            <button className="mini-btn" disabled={busy} onClick={() => input.current?.click()}><Upload size={12} /> Replace</button>
            <button className="mini-btn danger" disabled={busy} onClick={remove}><Trash2 size={12} /></button>
          </>
        ) : (
          <button className="mini-btn" disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={12} /> {busy ? 'Uploading…' : `Upload ${label.toLowerCase()}`}
          </button>
        )}
        <input ref={input} type="file" accept={accept} hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f); }} />
      </div>
    </div>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    events, venues, roster, attendance, attendanceTypes, coordinatorTypeId, bookingMap, byDate, patchEvent, reload,
  } = useAdminData();
  const ev = events.find(e => e.id === id);

  const [draft, setDraft] = useState({ title: '', start_date: '', end_date: '', description: '', budget_planned: '', budget_actual: '' });
  const [saving, setSaving] = useState(false);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!ev || loadedFor.current === ev.id + ev.updated_at) return;
    loadedFor.current = ev.id + ev.updated_at;
    setDraft({
      title: ev.title, start_date: ev.start_date, end_date: ev.end_date, description: ev.description ?? '',
      budget_planned: ev.budget_planned?.toString() ?? '', budget_actual: ev.budget_actual?.toString() ?? '',
    });
  }, [ev]);

  const rows = useMemo(() => attendance.filter(a => a.event_id === id), [attendance, id]);
  const memberById = useMemo(() => new Map(roster.map(m => [m.id, m])), [roster]);
  const coordinators = rows.filter(a => a.type_id === coordinatorTypeId);
  const others = rows.filter(a => a.type_id !== coordinatorTypeId);
  const onEvent = useMemo(() => new Set(rows.map(r => r.member_id)), [rows]);
  const nonCoordTypes = attendanceTypes.filter(t => t.id !== coordinatorTypeId);

  if (!ev) {
    return (
      <div className="panel">
        <h3 className="ph">Event not found</h3>
        <p className="muted">It may have been deleted. <Link className="linkbtn" to="/admin/events">Back to events</Link></p>
      </div>
    );
  }

  const hasOurBooking = eventHasOurBooking(ev, bookingMap);
  const checklist = eventChecklist(ev, coordinators.length, hasOurBooking);
  const done = checklist.filter(i => i.done).length;
  const isDone = (k: string) => checklist.find(i => i.key === k)?.done ?? false;

  const dirty = draft.title !== ev.title || draft.start_date !== ev.start_date || draft.end_date !== ev.end_date
    || draft.description !== (ev.description ?? '') || draft.budget_planned !== (ev.budget_planned?.toString() ?? '')
    || draft.budget_actual !== (ev.budget_actual?.toString() ?? '');

  const save = async (patch: Partial<ClubEvent>) => {
    try { patchEvent(await updateEvent(ev.id, patch)); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const saveDraft = async () => {
    const title = draft.title.trim();
    if (!title) { toast.error('The event needs a title.'); return; }
    if (!draft.start_date || (draft.end_date && draft.end_date < draft.start_date)) { toast.error('Check the dates: "To" is before "From".'); return; }
    const money = (s: string) => (s.trim() === '' ? null : Number(s));
    const planned = money(draft.budget_planned), actual = money(draft.budget_actual);
    if ([planned, actual].some(v => v !== null && (!Number.isFinite(v) || v < 0))) { toast.error('Budget amounts must be positive numbers.'); return; }
    setSaving(true);
    try {
      patchEvent(await updateEvent(ev.id, {
        title, start_date: draft.start_date, end_date: draft.end_date || draft.start_date,
        description: draft.description.trim() || null, budget_planned: planned, budget_actual: actual,
      }));
      toast.success('Saved.');
    } catch (err) { toast.error(errMsg(err)); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${ev.title}"? This removes its checklist, files and attendance.`)) return;
    try {
      await deleteEvent(ev.id);
      await Promise.all([ev.poster_path, ev.report_path, ev.budget_sheet_path].map(p => removeEventFile(p)));
      await reload('events', 'attendance', 'leaderboard');
      navigate('/admin/events');
      toast.success('Event deleted.');
    } catch (err) { toast.error(errMsg(err)); }
  };

  const mark = async (m: RosterMember, typeId: string | null) => {
    if (!typeId) { toast.error('Attendance roles are missing — run the club panel migration.'); return; }
    try { await addAttendance(ev.id, m.id, typeId, user?.email ?? ''); await reload('attendance', 'leaderboard'); }
    catch (err) { toast.error(errMsg(err)); }
  };
  const changeRole = async (rowId: string, typeId: string) => {
    try { await setAttendanceType(rowId, typeId); await reload('attendance', 'leaderboard'); }
    catch (err) { toast.error(errMsg(err)); }
  };
  const unmark = async (rowId: string) => {
    try { await removeAttendance(rowId); await reload('attendance', 'leaderboard'); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const start = draft.start_date || ev.start_date, end = draft.end_date || start;
  const { warn: dateWarn } = formWarnings({
    s: start, e: end, type: 'event', venueId: '', online: true, editingKey: 'ev:' + ev.id, venues, bookingMap, byDate,
  });
  const venueOptions = venues.filter(v => v.is_active || v.id === ev.venue_id).map(v => ({ v, ...venueRange(bookingMap, v.id, start, end) }));
  const chosen = venueOptions.find(o => o.v.id === ev.venue_id);
  const ourBookingsForEvent = chosen ? chosen.oursOn.flatMap(d => d.bl.filter(b => b.is_ours)) : [];

  return (
    <>
      <div className="top">
        <div style={{ minWidth: 0 }}>
          <h1>{ev.title}</h1>
          <div className="sub">
            {fmtLong(ev.start_date)}{ev.end_date !== ev.start_date ? ` – ${fmtLong(ev.end_date)}` : ''}
            {' · '}{ev.is_online ? 'Online' : venueName(venues, ev.venue_id) || 'Venue not decided'}
          </div>
        </div>
        <div className="form-acts">
          <Link className="ghost" to={`/admin/calendar?d=${ev.start_date}`}>Open in calendar</Link>
          <button className="ghost" onClick={remove} style={{ color: 'var(--busy)' }}><Trash2 size={14} /> Delete</button>
          <button className="primary" onClick={saveDraft} disabled={!dirty || saving}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <b style={{ fontSize: 15 }}>Checklist</b>
          <div className={`prog${done === checklist.length ? ' done' : ''}`} style={{ flex: 1 }}><i style={{ width: `${(done / checklist.length) * 100}%` }} /></div>
          <span className="tnum" style={{ fontWeight: 700 }}>{done}/{checklist.length}</span>
        </div>
        <div className="chips">
          {checklist.map(i => (
            <span key={i.key} className="chip" style={{ opacity: i.done ? 1 : .6 }}>{i.done ? '✓ ' : ''}{i.label}</span>
          ))}
        </div>
      </div>

      <div className="check-grid">
        {/* Basics */}
        <div className="check-card adm-form">
          <div className="check-head"><Tick on /><h4>Event</h4></div>
          <div className="fld" style={{ marginBottom: 12 }}><label htmlFor="evTitle">Title</label>
            <input id="evTitle" value={draft.title} maxLength={120} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
          </div>
          <div className="grid2">
            <div className="fld"><label htmlFor="evFrom">From</label>
              <input id="evFrom" type="date" value={draft.start_date}
                onChange={e => setDraft(d => ({ ...d, start_date: e.target.value, end_date: !d.end_date || d.end_date < e.target.value ? e.target.value : d.end_date }))} />
            </div>
            <div className="fld"><label htmlFor="evTo">To</label>
              <input id="evTo" type="date" value={draft.end_date} min={draft.start_date} onChange={e => setDraft(d => ({ ...d, end_date: e.target.value }))} />
            </div>
          </div>
          {dateWarn.map(w => <div key={w} className="warn">{w}</div>)}
          <div style={{ marginTop: 14 }}>
            <label className="switch amber">
              <input type="checkbox" checked={ev.is_online} onChange={e => {
                const goingOnline = e.target.checked;
                if (goingOnline && (ev.venue_id || ev.venue_booked || ev.od_posted)
                  && !window.confirm('Make this an online event? Its venue, "venue booked" and "OD posted" will be cleared.')) return;
                save({ is_online: goingOnline });
              }} />
              <span className="track"><span className="knob" /></span>
              <span>Online event <small className="muted">— no venue or OD needed</small></span>
            </label>
          </div>
        </div>

        {/* Details */}
        <div className="check-card adm-form">
          <div className="check-head"><Tick on={isDone('details')} /><h4>Event details</h4></div>
          <textarea rows={7} maxLength={4000} value={draft.description} placeholder="What, who it's for, schedule, speakers, rules…"
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
        </div>

        {/* Venue */}
        {!ev.is_online && (
          <div className="check-card">
            <div className="check-head"><Tick on={isDone('venue')} /><h4>Preferred venue</h4>
              <span className="asof">{fmtRange(start, end)}</span>
            </div>
            <div className="vopts">
              {venueOptions.map(o => (
                <button key={o.v.id} type="button" className={`vopt${ev.venue_id === o.v.id ? ' sel' : ''}`}
                  onClick={() => save({ venue_id: ev.venue_id === o.v.id ? null : o.v.id })}>
                  <span className="nm">{o.v.name}</span>
                  <span className={`st ${o.state}`}>
                    {o.state === 'free' ? 'Free' : o.state === 'ours' ? '★ Booked by us' : `Taken ${o.othersOn.map(d => fmtShort(d.d)).join(', ')}`}
                  </span>
                </button>
              ))}
            </div>
            {chosen && chosen.state === 'busy' && (
              <div className="warn">{chosen.v.name} is booked by another club: {chosen.othersOn.flatMap(d => d.bl.filter(b => !b.is_ours).map(b => `${fmtShort(d.d)} ${fmtTime(b.from_time)}–${fmtTime(b.to_time)} ${b.event_name.slice(0, 40)}`)).join('; ')}</div>
            )}
          </div>
        )}

        {/* Venue booked */}
        {!ev.is_online && (
          <div className="check-card">
            <div className="check-head"><Tick on={isDone('booked')} /><h4>Venue booked</h4></div>
            <Toggle checked={ev.venue_booked} onChange={v => save({ venue_booked: v })} label="We have booked the venue" />
            {ourBookingsForEvent.length > 0 ? (
              <div className="vstat ok"><span className="ic" />Our VTOP booking: {ourBookingsForEvent.map(b => `${fmtShort(b.booking_date)} ${fmtTime(b.from_time)}–${fmtTime(b.to_time)}`).join(', ')}</div>
            ) : (
              <div className="vstat no"><span className="ic" />{ev.venue_id ? `No booking marked as ours at ${venueName(venues, ev.venue_id)} on these dates.` : 'Pick a venue first.'}</div>
            )}
            <p className="note-sm" style={{ marginTop: 10, marginBottom: 0 }}>
              Ticks itself when a booking marked “ours” exists for this venue and date. <Link className="linkbtn" to="/admin/venues">Venue bookings</Link>
            </p>
          </div>
        )}

        {/* Coordinators */}
        <div className="check-card">
          <div className="check-head"><Tick on={isDone('coordinators')} /><h4>Student coordinators</h4>
            <span className="asof">{coordinators.length}</span>
          </div>
          <div className="people" style={{ marginBottom: 10 }}>
            {coordinators.map(a => {
              const m = memberById.get(a.member_id);
              return (
                <div key={a.id} className="person">
                  <span className="avatar">{initials(m?.full_name ?? '?')}</span>
                  <div className="who">
                    <Link to={`/admin/members/${a.member_id}`} style={{ textDecoration: 'none' }}><b>{m?.full_name ?? 'Removed member'}</b></Link>
                    <span>{[m?.member_department, m?.phone, m?.email].filter(Boolean).join(' · ')}</span>
                  </div>
                  <button className="circ" onClick={() => unmark(a.id)} aria-label="Remove coordinator"><X size={14} /></button>
                </div>
              );
            })}
          </div>
          <MemberPicker exclude={onEvent} placeholder="Add a coordinator from the roster…" onPick={m => mark(m, coordinatorTypeId)} />
          <p className="note-sm" style={{ marginTop: 8, marginBottom: 0 }}>Coordinators get the coordinator points automatically (leads excepted).</p>
        </div>

        {/* Poster */}
        <div className="check-card">
          <div className="check-head"><Tick on={isDone('poster')} /><h4>Poster</h4></div>
          <FileSlot ev={ev} kind="poster" path={ev.poster_path} accept="image/*" label="Poster" onSaved={patchEvent} />
        </div>

        {/* Budget */}
        <div className="check-card adm-form">
          <div className="check-head"><Tick on={isDone('budget')} /><h4>Budget</h4></div>
          <div className="grid2" style={{ marginBottom: 12 }}>
            <div className="fld"><label htmlFor="bPlan">Planned (₹)</label>
              <input id="bPlan" inputMode="decimal" value={draft.budget_planned} onChange={e => setDraft(d => ({ ...d, budget_planned: e.target.value }))} placeholder="0" />
            </div>
            <div className="fld"><label htmlFor="bAct">Actual spent (₹)</label>
              <input id="bAct" inputMode="decimal" value={draft.budget_actual} onChange={e => setDraft(d => ({ ...d, budget_actual: e.target.value }))} placeholder="—" />
            </div>
          </div>
          <label style={{ display: 'block', marginBottom: 6 }}>Budget sheet (optional)</label>
          <FileSlot ev={ev} kind="budget" path={ev.budget_sheet_path} label="Budget sheet"
            accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,image/*" onSaved={patchEvent} />
        </div>

        {/* Report */}
        <div className="check-card">
          <div className="check-head"><Tick on={isDone('report')} /><h4>Event report</h4></div>
          <FileSlot ev={ev} kind="report" path={ev.report_path} label="Report" accept=".pdf,.doc,.docx" onSaved={patchEvent} />
        </div>

        {/* Posted flags */}
        <div className="check-card">
          <div className="check-head"><Tick on={isDone('attendance') && (ev.is_online || isDone('od'))} /><h4>After the event</h4></div>
          <div style={{ display: 'grid', gap: 14 }}>
            <Toggle checked={ev.attendance_posted} onChange={v => save({ attendance_posted: v })} label="Attendance posted" />
            {!ev.is_online && <Toggle checked={ev.od_posted} onChange={v => save({ od_posted: v })} label="OD posted" />}
          </div>
        </div>

        {/* Attendance */}
        <div className="check-card wide">
          <div className="check-head"><Tick on={others.length > 0} /><h4>Volunteers and attendees</h4>
            <span className="asof">{others.length} marked · points are added automatically</span>
          </div>
          <div className="people" style={{ marginBottom: 10 }}>
            {others.map(a => {
              const m = memberById.get(a.member_id);
              return (
                <div key={a.id} className="person adm-form">
                  <span className="avatar">{initials(m?.full_name ?? '?')}</span>
                  <div className="who">
                    <Link to={`/admin/members/${a.member_id}`} style={{ textDecoration: 'none' }}><b>{m?.full_name ?? 'Removed member'}</b></Link>
                    <span>{m?.member_department ?? ''}{m?.is_lead ? ' · Lead (no points)' : ''}</span>
                  </div>
                  <select value={a.type_id} onChange={e => changeRole(a.id, e.target.value)} style={{ width: 'auto' }} aria-label="Role">
                    {attendanceTypes.map(t => <option key={t.id} value={t.id}>{t.name.replace(/ (at|for) an event$/i, '')} · {t.default_points} pts</option>)}
                  </select>
                  <button className="circ" onClick={() => unmark(a.id)} aria-label="Remove"><X size={14} /></button>
                </div>
              );
            })}
          </div>
          <div className="grid2">
            {nonCoordTypes.map(t => (
              <MemberPicker key={t.id} exclude={onEvent} placeholder={`Add ${t.name.replace(/ (at|for) an event$/i, '').toLowerCase()}…`} onPick={m => mark(m, t.id)} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
