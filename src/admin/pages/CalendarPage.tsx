import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { useAdminData } from '../AdminData';
import { deleteBooking, deleteEntry, deleteEvent, removeEventFile, setBookingOurs } from '../api';
import {
  ENTRY_TYPES, NO_EVENT_TYPES, addDays, dayCount, fmtLong, fmtRange, fmtTime, isoDate, ourBookingsOn, todayIso,
  toDate, venueDay, venueName, type CalItem,
} from '../calendarLogic';
import EntryModal from '../EntryModal';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarPage() {
  const data = useAdminData();
  const { venues, bookings, bookingMap, byDate, items, events, reload } = data;
  const [params, setParams] = useSearchParams();
  const today = todayIso();
  const [selected, setSelected] = useState(params.get('d') || today);
  const [view, setView] = useState(() => { const d = toDate(params.get('d') || today); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [showVenues, setShowVenues] = useState(params.get('venues') === '1');
  const [venueFilter, setVenueFilter] = useState('all');
  const [listFilter, setListFilter] = useState<'all' | keyof typeof ENTRY_TYPES>('all');
  const [modal, setModal] = useState<{ editing: CalItem | null; date: string } | null>(null);

  const activeVenues = useMemo(() => venues.filter(v => v.is_active), [venues]);

  const selectDate = (iso: string, jump = false) => {
    setSelected(iso);
    if (jump) { const d = toDate(iso); setView({ y: d.getFullYear(), m: d.getMonth() }); }
    setParams(p => { p.set('d', iso); return p; }, { replace: true });
  };
  const shiftMonth = (n: number) => setView(v => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const cells = useMemo(() => {
    const first = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out: (string | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) out.push(isoDate(view.y, view.m, d));
    return out;
  }, [view]);

  const removeItem = async (it: CalItem) => {
    const what = it.kind === 'event' ? 'This also removes its checklist, files and attendance.' : '';
    if (!window.confirm(`Delete "${it.title}" (${fmtRange(it.s, it.e)})? ${what}`)) return;
    try {
      if (it.kind === 'event') {
        const ev = events.find(e => e.id === it.id);
        await deleteEvent(it.id);
        await Promise.all([ev?.poster_path, ev?.report_path, ev?.budget_sheet_path].map(p => removeEventFile(p ?? null)));
        await reload('events', 'attendance', 'leaderboard');
      } else {
        await deleteEntry(it.id);
        await reload('entries');
      }
      toast.success('Deleted.');
    } catch (err) {
      toast.error((err as { message?: string })?.message || 'Could not delete.');
    }
  };

  const toggleOurs = async (id: string, ours: boolean) => {
    try { await setBookingOurs(id, !ours); await reload('bookings'); }
    catch (err) { toast.error((err as { message?: string })?.message || 'Could not update.'); }
  };
  const removeBooking = async (id: string, label: string) => {
    if (!window.confirm(`Remove booking ${label}?`)) return;
    try { await deleteBooking(id); await reload('bookings'); }
    catch (err) { toast.error((err as { message?: string })?.message || 'Could not remove.'); }
  };

  const listRows = useMemo(() => items
    .filter(e => listFilter === 'all' || e.t === listFilter)
    .slice().sort((a, b) => a.s.localeCompare(b.s)), [items, listFilter]);

  return (
    <>
      <div className="top">
        <div>
          <h1>Club calendar</h1>
          <div className="sub">Events, academic dates and venue availability for IEEE SSCS VIT Chennai.</div>
        </div>
      </div>

      <div className="board">
        <section className="cal">
          <div className="cal-head">
            <div className="cal-title">{MONTHS[view.m]}, {view.y}</div>
            <div className="cal-nav">
              <button className="add-btn" onClick={() => setModal({ editing: null, date: selected })}><span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add</button>
              <button className="pill-btn" onClick={() => selectDate(today, true)}>Today</button>
              <button className="circ" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
              <button className="circ" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
            </div>
          </div>

          <div className="toolbar">
            <label className="switch">
              <input type="checkbox" checked={showVenues} onChange={e => setShowVenues(e.target.checked)} />
              <span className="track"><span className="knob" /></span>
              <span>Show venue availability</span>
            </label>
            {showVenues && (
              <div className="vfilter">
                {[{ id: 'all', short_name: 'All venues' }, ...activeVenues].map(v => (
                  <button key={v.id} className={`vchipbtn${venueFilter === v.id ? ' active' : ''}`} onClick={() => setVenueFilter(v.id)}>{v.short_name}</button>
                ))}
              </div>
            )}
          </div>

          <div className="grid7">{DOWS.map(d => <div key={d} className="dow">{d}</div>)}</div>
          <div className={`grid7${showVenues ? ' vmode' : ''}`} style={{ marginTop: 4 }}>
            {cells.map((iso, i) => {
              if (!iso) return <div key={'e' + i} className="day empty" />;
              const ents = byDate.get(iso) ?? [];
              const hasEvent = ents.some(e => e.t === 'event');
              let cls = 'day';
              if (hasEvent) cls += ' has-event';
              if (ents.some(e => NO_EVENT_TYPES.includes(e.t))) cls += ' hatched';
              if (ents.some(e => e.t === 'exam')) cls += ' exam-day';
              if (iso === today) cls += ' today';
              if (iso === selected) cls += ' selected';

              let badge: React.ReactNode = null;
              if (hasEvent) {
                const inPerson = ents.some(e => e.t === 'event' && !e.online);
                if (!inPerson) badge = <span className="vdot online" title="Online event — no venue needed" />;
                else {
                  const ok = ourBookingsOn(bookings, iso).length > 0;
                  badge = <span className={`vdot ${ok ? 'ok' : 'no'}`} title={ok ? 'Venue booked by SSCS' : 'No venue booked by SSCS yet'} />;
                }
              }

              const maxTags = showVenues ? 2 : 3;
              let vhtml: React.ReactNode = null;
              if (showVenues) {
                if (venueFilter === 'all') {
                  const st = activeVenues.map(v => ({ v, ...venueDay(bookingMap, v.id, iso) }));
                  const free = st.filter(x => x.s === 'free'), ours = st.filter(x => x.s === 'ours');
                  cls += free.length ? ' v-free' : ' v-busy';
                  vhtml = (
                    <>
                      <div className="vchips">
                        {ours.map(x => <span key={x.v.id} className="vchip ours" title="Booked by us">★ {x.v.short_name}</span>)}
                        {free.map(x => <span key={x.v.id} className="vchip">{x.v.short_name}</span>)}
                        {!ours.length && !free.length && <span className="vchip none">None free</span>}
                      </div>
                      <div className="vcount">{ours.length ? `★${ours.length} · ` : ''}{free.length} free</div>
                    </>
                  );
                } else {
                  const vd = venueDay(bookingMap, venueFilter, iso);
                  cls += ' v-' + vd.s;
                  vhtml = <div className={`vstate ${vd.s}`}>{vd.s === 'free' ? 'Free' : vd.s === 'ours' ? '★ Ours' : 'Booked'}</div>;
                }
              }

              return (
                <div key={iso} className={cls} role="button" tabIndex={0} aria-label={fmtLong(iso)}
                  onClick={() => selectDate(iso)}
                  onDoubleClick={() => setModal({ editing: null, date: iso })}
                  onKeyDown={e => { if (e.key === 'Enter') selectDate(iso); }}>
                  {badge}
                  <div className="num">{toDate(iso).getDate()}</div>
                  {vhtml}
                  <div className="lines">
                    {ents.slice(0, maxTags).map(e => (
                      <div key={e.key} className={`evline ${e.t}`} title={e.title}><span>{e.title}</span></div>
                    ))}
                    {ents.length > maxTags && <span className="morechip">+{ents.length - maxTags}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="legend">
            <span><span className="swatch" style={{ background: 'var(--t-holiday)' }} />Holiday</span>
            <span><span className="swatch" style={{ background: 'var(--t-blocked)' }} />Blocked</span>
            <span><span className="swatch" style={{ background: 'var(--t-exam)' }} />Exam</span>
            <span><span className="swatch" style={{ border: '1.5px dashed var(--t-buffer)' }} />Exam prep</span>
            <span><span className="swatch" style={{ background: 'var(--t-noclass)' }} />No instructional day</span>
            <span><span className="swatch" style={{ background: 'var(--t-vacation)' }} />Vacation</span>
          </div>
          <div className="legend">
            <span><span className="swatch" style={{ background: 'rgba(194,67,75,.3)', border: '1px solid rgba(224,101,108,.5)' }} />Planned club event</span>
            <span><span className="vdot ok" />SSCS venue booked</span>
            <span><span className="vdot no" />No venue booked yet</span>
            <span><span className="vdot online" />Online event</span>
            <span><span className="swatch" style={{ background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.3) 0 2px,transparent 2px 5px)', border: '1px solid var(--line-2)' }} />Slanted lines = no events</span>
            <span><span className="swatch" style={{ background: 'rgba(212,180,74,.3)', border: '1px solid rgba(212,180,74,.55)' }} />CAT / FAT day</span>
          </div>
          {showVenues && (
            <div className="legend">
              <span><span className="swatch" style={{ background: 'rgba(108,194,147,.22)', border: '1px solid var(--free)' }} />{venueFilter === 'all' ? 'At least one venue free' : 'Free'}</span>
              <span><span className="swatch" style={{ background: 'rgba(215,116,116,.22)', border: '1px solid var(--busy)' }} />{venueFilter === 'all' ? 'No venue free' : 'Booked by another club'}</span>
              <span><span className="swatch" style={{ background: 'rgba(217,154,108,.25)', border: '1px solid var(--ours)' }} />Booked by us</span>
            </div>
          )}
        </section>

        <aside className="sched">
          <div className="sched-head">
            <div>
              <h2>Scheduled</h2>
              <div className="sched-date">{fmtLong(selected)}</div>
            </div>
            <div className="cal-nav">
              <button className="circ" onClick={() => selectDate(addDays(selected, -1), true)} aria-label="Previous day">‹</button>
              <button className="circ" onClick={() => selectDate(addDays(selected, 1), true)} aria-label="Next day">›</button>
            </div>
          </div>
          <DayDetail
            iso={selected}
            showVenues={showVenues}
            venueFilter={venueFilter}
            onAdd={() => setModal({ editing: null, date: selected })}
            onEdit={it => setModal({ editing: it, date: it.s })}
            onDelete={removeItem}
            onToggleOurs={toggleOurs}
            onRemoveBooking={removeBooking}
          />
        </aside>
      </div>

      <section className="panel">
        <div className="list-head">
          <h3 className="ph">All entries</h3>
          <select aria-label="Filter entries" value={listFilter} onChange={e => setListFilter(e.target.value as typeof listFilter)}>
            <option value="all">All types</option>
            {Object.entries(ENTRY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Dates</th><th>Type</th><th>Title</th><th className="hide-sm">Venue</th><th /></tr></thead>
            <tbody>
              {listRows.length ? listRows.map(e => (
                <tr key={e.key}>
                  <td className="d"><button className="jump" onClick={() => { selectDate(e.s, true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{fmtRange(e.s, e.e)}</button></td>
                  <td><span className={`tag ${e.t}`}>{ENTRY_TYPES[e.t]}</span></td>
                  <td>
                    {e.kind === 'event' ? <Link to={`/admin/events/${e.id}`} style={{ textDecoration: 'none', fontWeight: 600 }}>{e.title}</Link> : e.title}
                    {e.note && <div className="m">{e.note}</div>}
                  </td>
                  <td className="hide-sm">{e.online ? <span style={{ color: 'var(--online)' }}>Online</span> : venueName(venues, e.venueId) || <span className="muted">—</span>}</td>
                  <td className="acts">
                    <button className="mini-btn" onClick={() => setModal({ editing: e, date: e.s })}>Edit</button>{' '}
                    <button className="mini-btn danger" onClick={() => removeItem(e)}>Delete</button>
                  </td>
                </tr>
              )) : <tr><td colSpan={5} className="muted">No entries.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <EntryModal
          editing={modal.editing}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
          onSaved={s => { setModal(null); selectDate(s, true); }}
        />
      )}
    </>
  );
}

function DayDetail({ iso, showVenues, venueFilter, onAdd, onEdit, onDelete, onToggleOurs, onRemoveBooking }: {
  iso: string; showVenues: boolean; venueFilter: string;
  onAdd: () => void; onEdit: (it: CalItem) => void; onDelete: (it: CalItem) => void;
  onToggleOurs: (id: string, ours: boolean) => void; onRemoveBooking: (id: string, label: string) => void;
}) {
  const { venues, bookings, bookingMap, byDate } = useAdminData();
  const ents = byDate.get(iso) ?? [];
  const blockers = ents.filter(e => NO_EVENT_TYPES.includes(e.t));
  const exam = blockers.find(e => e.t === 'exam');
  const lead = exam || blockers[0];
  const ourToday = ourBookingsOn(bookings, iso);

  const clash = (e: CalItem) => {
    if (!e.venueId || e.online) return null;
    const vd = venueDay(bookingMap, e.venueId, iso);
    if (vd.s === 'free') return null;
    if (vd.s === 'ours' && vd.bl.every(b => b.is_ours)) {
      return <div className="note-ok">★ {venueName(venues, e.venueId)} booked by us</div>;
    }
    return <div className="warn">{venueName(venues, e.venueId)} is booked this day: {vd.bl.map(b => `${fmtTime(b.from_time)}–${fmtTime(b.to_time)} ${b.event_name.slice(0, 40)}`).join('; ')}</div>;
  };

  const list = venueFilter === 'all' ? venues.filter(v => v.is_active) : venues.filter(v => v.id === venueFilter);
  const st = list.map(v => ({ v, ...venueDay(bookingMap, v.id, iso) }));
  const free = st.filter(x => x.s === 'free');
  const busy = st.filter(x => x.s !== 'free').sort((a, b) => (a.s === 'ours' ? 0 : 1) - (b.s === 'ours' ? 0 : 1));

  return (
    <div>
      {lead && (
        <div className={`daynote${exam ? ' exam' : ''}`} style={{ marginBottom: 10 }}>
          <span>{exam ? '⚠' : '⊘'}</span>
          <span>Not a day for events — {lead.title}
            <small>{[...new Set(blockers.map(b => ENTRY_TYPES[b.t]))].join(' · ')}</small>
          </span>
        </div>
      )}
      <div className="divider">On the calendar</div>
      {ents.length ? ents.map(e => (
        <div key={e.key} className={`entry ${e.t}`} style={{ marginTop: 10 }}>
          <div className="bar" />
          <div className="t">{e.title}</div>
          <div className="m">{ENTRY_TYPES[e.t]}{e.online ? ' · Online' : e.venueId ? ' · ' + venueName(venues, e.venueId) : ''}</div>
          {e.note && <div className="m" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{e.note.length > 220 ? e.note.slice(0, 220) + '…' : e.note}</div>}
          {clash(e)}
          {e.t === 'event' && e.online && <div className="vstat online"><span className="ic" />Online event — no venue needed</div>}
          {e.t === 'event' && !e.online && (ourToday.length
            ? <div className="vstat ok"><span className="ic" />Venue booked: {ourToday.map(b => `${venueName(venues, b.venue_id)} · ${fmtTime(b.from_time)}–${fmtTime(b.to_time)}`).join(', ')}</div>
            : <div className="vstat no"><span className="ic" />No venue booked by SSCS for this day yet</div>)}
          <div className="meta"><span>{fmtRange(e.s, e.e)}</span><span>{dayCount(e.s, e.e) === 1 ? '1 day' : `${dayCount(e.s, e.e)} days`}</span></div>
          <div className="acts">
            {e.kind === 'event' && <Link className="mini-btn" to={`/admin/events/${e.id}`}>Checklist</Link>}
            <button className="mini-btn" onClick={() => onEdit(e)}>Edit</button>
            <button className="mini-btn danger" onClick={() => onDelete(e)}>Delete</button>
          </div>
        </div>
      )) : (
        <div className="muted" style={{ margin: '10px 0' }}>Nothing scheduled. <button className="linkbtn" onClick={onAdd}>Add something</button></div>
      )}

      {showVenues && (
        <>
          <div className="divider" style={{ marginTop: 14 }}>Venues</div>
          <div style={{ marginTop: 10 }}>
            {free.length > 0 && <div className="free-row">{free.map(x => <span key={x.v.id} className="fchip">{x.v.short_name} · free</span>)}</div>}
            {busy.map(x => (
              <div key={x.v.id} className={`vcard${x.s === 'ours' ? ' ours' : ''}`}>
                <div className="vc-head"><span className="vc-name">{x.v.name}</span><span className="vc-badge">{x.s === 'ours' ? '✓ Ours' : 'Booked'}</span></div>
                {x.bl.map(b => (
                  <div key={b.id} className="bkrow">
                    <span className="bk-time">{fmtTime(b.from_time)} – {fmtTime(b.to_time)}</span>
                    {b.is_ours && <span className="ourtag">SSCS</span>}
                    <div className="bk-title" title={b.event_name}>{b.event_name}</div>
                    {(b.booked_by || b.phone) && (
                      <div className="bk-by">{b.booked_by}{b.phone && <> · <a className="tel" href={`tel:${b.phone}`}>{b.phone}</a></>}</div>
                    )}
                    <div className="bk-acts">
                      <button className="mini-btn" onClick={() => onToggleOurs(b.id, b.is_ours)}>{b.is_ours ? 'Not ours' : 'Mark as ours'}</button>
                      <button className="mini-btn danger" onClick={() => onRemoveBooking(b.id, `"${b.event_name}" at ${x.v.name}`)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
