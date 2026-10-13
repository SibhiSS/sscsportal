import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import type { Venue } from '@/types/admin';
import { useAdminData } from '../AdminData';
import { addBooking, deleteBooking, saveVenue, setBookingOurs } from '../api';
import { fmtLong, fmtMed, fmtShort, fmtTime, todayIso, venueName } from '../calendarLogic';
import BookingImport from '../BookingImport';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function VenuesPage() {
  const { venues, bookings, settings, reload } = useAdminData();
  const navigate = useNavigate();
  const today = todayIso();
  const activeVenues = venues.filter(v => v.is_active);
  const asOf = typeof settings.venue_data_as_of === 'string' ? settings.venue_data_as_of : null;

  // ---- our bookings ----
  const ours = useMemo(() => bookings.filter(b => b.is_ours && b.booking_date >= today)
    .sort((a, b) => (a.booking_date + a.from_time).localeCompare(b.booking_date + b.from_time)), [bookings, today]);

  // ---- add one ----
  const blank = { venue_id: activeVenues[0]?.id ?? '', booking_date: today, from_time: '08:00', to_time: '17:00', event_name: '', booked_by: '', phone: '', is_ours: false };
  const [form, setForm] = useState(blank);
  const [adding, setAdding] = useState(false);
  const submitOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.to_time <= form.from_time) { toast.error('"To" must be after "From".'); return; }
    setAdding(true);
    try {
      await addBooking({
        ...form, event_name: form.event_name.trim(), booked_by: form.booked_by.trim().toUpperCase() || null,
        phone: form.phone.replace(/\s/g, '') || null,
      });
      await reload('bookings');
      setForm(f => ({ ...blank, venue_id: f.venue_id, booking_date: f.booking_date }));
      toast.success('Booking added.');
    } catch (err) { toast.error(errMsg(err)); }
    finally { setAdding(false); }
  };

  // ---- all bookings table ----
  const [fVenue, setFVenue] = useState('all');
  const [fWhen, setFWhen] = useState<'upcoming' | 'all'>('upcoming');
  const [fOurs, setFOurs] = useState(false);
  const [fText, setFText] = useState('');
  const [limit, setLimit] = useState(100);
  const filtered = useMemo(() => {
    const term = fText.trim().toLowerCase();
    return bookings.filter(b =>
      (fVenue === 'all' || b.venue_id === fVenue) && (fWhen === 'all' || b.booking_date >= today) && (!fOurs || b.is_ours)
      && (!term || [b.event_name, b.booked_by ?? ''].some(x => x.toLowerCase().includes(term))));
  }, [bookings, fVenue, fWhen, fOurs, fText, today]);
  const toggleOurs = async (id: string, v: boolean) => {
    try { await setBookingOurs(id, v); await reload('bookings'); } catch (err) { toast.error(errMsg(err)); }
  };
  const removeOne = async (id: string, label: string) => {
    if (!window.confirm(`Remove booking ${label}?`)) return;
    try { await deleteBooking(id); await reload('bookings'); } catch (err) { toast.error(errMsg(err)); }
  };

  // ---- venues manager ----
  const [venueEdit, setVenueEdit] = useState<{ v: Venue; isNew: boolean } | null>(null);
  const saveVenueForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueEdit) return;
    const v = { ...venueEdit.v, name: venueEdit.v.name.trim(), short_name: venueEdit.v.short_name.trim(), notes: venueEdit.v.notes?.trim() || null };
    if (venueEdit.isNew) v.id = slug(v.short_name || v.name);
    if (!v.name || !v.short_name || !v.id) { toast.error('Give the venue a name and a short name.'); return; }
    if (venueEdit.isNew && venues.some(x => x.id === v.id)) { toast.error('A venue with that short name already exists.'); return; }
    try { await saveVenue(v, venueEdit.isNew); await reload('venues'); setVenueEdit(null); toast.success('Venue saved.'); }
    catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <>
      <div className="top">
        <div>
          <h1>Venues</h1>
          <div className="sub">The halls IEEE SSCS uses, and who has them booked. {asOf && <>Venue data as of {fmtLong(asOf)}.</>}</div>
        </div>
        <button className="ghost" onClick={() => navigate('/admin/calendar?venues=1')}>Availability on the calendar</button>
      </div>

      <section className="panel">
        <div className="list-head">
          <h3 className="ph">Venue bookings</h3>
          <span className="asof">{bookings.length} bookings on file</span>
        </div>
        <div className="sec-lbl">Our upcoming bookings</div>
        <div className="ourlist">
          {ours.length ? ours.map(b => (
            <button key={b.id} className="ourcard" onClick={() => navigate(`/admin/calendar?d=${b.booking_date}&venues=1`)}>
              <div className="d">✓ {fmtShort(b.booking_date)} · {fmtTime(b.from_time)}–{fmtTime(b.to_time)}</div>
              <div className="v">{venueName(venues, b.venue_id)}</div>
              <div className="e" title={b.event_name}>{b.event_name}</div>
            </button>
          )) : <div className="muted">No upcoming venues marked as booked by SSCS. Tick “Booked by our club” when adding, or use “Mark as ours” on any booking.</div>}
        </div>

        <div className="bk-grid">
          <form className="subcard adm-form" onSubmit={submitOne} autoComplete="off">
            <div className="sec-lbl">Add one booking</div>
            <div className="grid2">
              <div className="fld"><label htmlFor="bVenue">Venue</label>
                <select id="bVenue" required value={form.venue_id} onChange={e => setForm(f => ({ ...f, venue_id: e.target.value }))}>
                  {activeVenues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="fld"><label htmlFor="bDate">Date</label>
                <input id="bDate" type="date" required value={form.booking_date} onChange={e => setForm(f => ({ ...f, booking_date: e.target.value }))} />
              </div>
              <div className="fld"><label htmlFor="bFrom">From</label>
                <input id="bFrom" type="time" required value={form.from_time} onChange={e => setForm(f => ({ ...f, from_time: e.target.value }))} />
              </div>
              <div className="fld"><label htmlFor="bTo">To</label>
                <input id="bTo" type="time" required value={form.to_time} onChange={e => setForm(f => ({ ...f, to_time: e.target.value }))} />
              </div>
              <div className="fld wide"><label htmlFor="bEvent">Event</label>
                <input id="bEvent" required maxLength={300} value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} />
              </div>
              <div className="fld"><label htmlFor="bName">Booked by</label>
                <input id="bName" maxLength={80} value={form.booked_by} onChange={e => setForm(f => ({ ...f, booked_by: e.target.value }))} />
              </div>
              <div className="fld"><label htmlFor="bPhone">Phone</label>
                <input id="bPhone" maxLength={15} inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <label className="chk wide"><input type="checkbox" checked={form.is_ours} onChange={e => setForm(f => ({ ...f, is_ours: e.target.checked }))} /> Booked by our club (SSCS)</label>
            </div>
            <div className="form-acts" style={{ marginTop: 14 }}><button type="submit" className="primary" disabled={adding}>{adding ? 'Adding…' : 'Add booking'}</button></div>
          </form>

          <BookingImport />
        </div>
      </section>

      <section className="panel">
        <div className="list-head">
          <h3 className="ph">All bookings</h3>
          <div className="form-acts">
            <input aria-label="Search bookings" placeholder="Search event or name" value={fText} onChange={e => setFText(e.target.value)} />
            <select aria-label="Venue" value={fVenue} onChange={e => setFVenue(e.target.value)}>
              <option value="all">All venues</option>
              {venues.map(v => <option key={v.id} value={v.id}>{v.short_name}</option>)}
            </select>
            <select aria-label="When" value={fWhen} onChange={e => setFWhen(e.target.value as 'upcoming' | 'all')}>
              <option value="upcoming">Upcoming</option>
              <option value="all">All dates</option>
            </select>
            <label className="chk"><input type="checkbox" checked={fOurs} onChange={e => setFOurs(e.target.checked)} /> Ours only</label>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Date</th><th>Time</th><th>Venue</th><th>Event</th><th className="hide-sm">Booked by</th><th /></tr></thead>
            <tbody>
              {filtered.length ? filtered.slice(0, limit).map(b => (
                <tr key={b.id}>
                  <td className="d"><button className="jump" onClick={() => navigate(`/admin/calendar?d=${b.booking_date}&venues=1`)}>{fmtMed(b.booking_date)}</button></td>
                  <td className="d">{fmtTime(b.from_time)}–{fmtTime(b.to_time)}</td>
                  <td>{venueName(venues, b.venue_id)}{b.is_ours && <span className="ourtag">SSCS</span>}</td>
                  <td style={{ maxWidth: 360 }}><div className="bk-title" title={b.event_name}>{b.event_name}</div></td>
                  <td className="hide-sm">{b.booked_by}{b.phone && <div className="m"><a className="tel" href={`tel:${b.phone}`}>{b.phone}</a></div>}</td>
                  <td className="acts">
                    <button className="mini-btn" onClick={() => toggleOurs(b.id, !b.is_ours)}>{b.is_ours ? 'Not ours' : 'Mark as ours'}</button>{' '}
                    <button className="mini-btn danger" onClick={() => removeOne(b.id, `"${b.event_name}" on ${fmtShort(b.booking_date)}`)}>Remove</button>
                  </td>
                </tr>
              )) : <tr><td colSpan={6} className="muted">No bookings match.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="pill-btn" onClick={() => setLimit(l => l + 200)}>Show more ({filtered.length - limit} left)</button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="list-head">
          <h3 className="ph">Venues IEEE SSCS uses</h3>
          <button className="add-btn" onClick={() => setVenueEdit({ v: { id: '', name: '', short_name: '', notes: null, is_active: true, is_room: false, sort_order: (venues.length + 1) * 10 }, isNew: true })}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add venue
          </button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Venue</th><th>Short name</th><th className="hide-sm">Notes</th><th>Upcoming (ours / all)</th><th>Status</th><th /></tr></thead>
            <tbody>
              {venues.map(v => {
                const up = bookings.filter(b => b.venue_id === v.id && b.booking_date >= today);
                return (
                  <tr key={v.id}>
                    <td><b>{v.name}</b></td>
                    <td>{v.short_name}</td>
                    <td className="hide-sm">{v.notes ?? <span className="muted">—</span>}</td>
                    <td className="tnum">{up.filter(b => b.is_ours).length} / {up.length}</td>
                    <td><span className={`tag ${v.is_active ? 'approved' : 'inactive'}`}>{v.is_active ? 'In use' : 'Hidden'}</span>{v.is_room && <span className="tag neutral" style={{ marginLeft: 6 }}>Room</span>}</td>
                    <td className="acts"><button className="mini-btn" onClick={() => setVenueEdit({ v, isNew: false })}>Edit</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {venueEdit && (
        <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) setVenueEdit(null); }}>
          <form className="modal adm-form" onSubmit={saveVenueForm} role="dialog" aria-modal="true" aria-labelledby="venueTitle">
            <div className="modal-head"><h3 id="venueTitle">{venueEdit.isNew ? 'Add venue' : 'Edit venue'}</h3>
              <button type="button" className="x" onClick={() => setVenueEdit(null)} aria-label="Close">×</button></div>
            <div className="frow"><label htmlFor="vName">Name</label>
              <input id="vName" required maxLength={80} value={venueEdit.v.name} placeholder="e.g. Anna Auditorium"
                onChange={e => setVenueEdit(s => s && ({ ...s, v: { ...s.v, name: e.target.value } }))} /></div>
            <div className="frow"><label htmlFor="vShort">Short name</label>
              <input id="vShort" required maxLength={24} value={venueEdit.v.short_name} placeholder="Used on the calendar and in imports"
                onChange={e => setVenueEdit(s => s && ({ ...s, v: { ...s.v, short_name: e.target.value } }))} /></div>
            <div className="frow"><label htmlFor="vNotes">Where</label>
              <input id="vNotes" maxLength={120} value={venueEdit.v.notes ?? ''} placeholder="e.g. AB1 7th floor"
                onChange={e => setVenueEdit(s => s && ({ ...s, v: { ...s.v, notes: e.target.value } }))} /></div>
            <div className="frow"><label>Status</label>
              <label className="switch"><input type="checkbox" checked={venueEdit.v.is_active}
                onChange={e => setVenueEdit(s => s && ({ ...s, v: { ...s.v, is_active: e.target.checked } }))} />
                <span className="track"><span className="knob" /></span><span>In use</span></label></div>
            <div className="frow"><label>Kind</label>
              <label className="switch"><input type="checkbox" checked={venueEdit.v.is_room}
                onChange={e => setVenueEdit(s => s && ({ ...s, v: { ...s.v, is_room: e.target.checked } }))} />
                <span className="track"><span className="knob" /></span>
                <span>Room <small className="muted">— type a number per event; not shown in availability</small></span></label></div>
            <div className="modal-foot">
              <button type="button" className="ghost" onClick={() => setVenueEdit(null)}>Cancel</button>
              <button type="submit" className="primary">Save</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
