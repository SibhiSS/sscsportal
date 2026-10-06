import { useEffect, useMemo, useState } from 'react';
import type { VenueBooking } from '@/types/admin';
import { fetchAvailabilityVenues, fetchBusySlots, fetchVenueDataAsOf, type AvailabilityVenue } from '../api';
import { addDays, fmtLong, fmtShort, fmtTime, indexBookings, isoDate, todayIso, toDate, venueDay } from '../calendarLogic';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Collaborators' whole panel: which venues are free or booked, and when.
 * It reads only venue_busy_slots()/availability_venues(), which return no
 * event names, bookers, phones, or which bookings are SSCS's.
 */
export default function VenueAvailabilityPage() {
  const today = todayIso();
  const [view, setView] = useState(() => { const d = toDate(today); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState(today);
  const [venueFilter, setVenueFilter] = useState('all');
  const [venues, setVenues] = useState<AvailabilityVenue[]>([]);
  const [slots, setSlots] = useState<VenueBooking[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const from = isoDate(view.y, view.m, 1);
  const to = isoDate(view.y, view.m, new Date(view.y, view.m + 1, 0).getDate());

  useEffect(() => {
    Promise.all([fetchAvailabilityVenues(), fetchVenueDataAsOf()])
      .then(([v, d]) => { setVenues(v); setAsOf(d); })
      .catch(err => setError(err?.message || 'Could not load venues.'));
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchBusySlots(from, to)
      .then(s => { if (live) setSlots(s); })
      .catch(err => { if (live) setError(err?.message || 'Could not load venue availability.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [from, to]);

  const map = useMemo(() => indexBookings(slots), [slots]);
  const shown = venueFilter === 'all' ? venues : venues.filter(v => v.id === venueFilter);

  const cells = useMemo(() => {
    const first = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out: (string | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) out.push(isoDate(view.y, view.m, d));
    return out;
  }, [view]);

  const shiftMonth = (n: number) => setView(v => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const selectDate = (iso: string) => {
    setSelected(iso);
    const d = toDate(iso);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const day = shown.map(v => ({ v, ...venueDay(map, v.id, selected) }));
  const free = day.filter(x => x.s === 'free');
  const busy = day.filter(x => x.s !== 'free');

  if (error) {
    return <div className="panel"><h3 className="ph">Couldn't load venue availability</h3><p className="muted">{error}</p></div>;
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Venue availability</h1>
          <div className="sub">Which venues are free or booked, by day.{asOf ? ` Booking data as of ${fmtShort(asOf)}.` : ''}</div>
        </div>
      </div>

      <div className="board">
        <section className="cal">
          <div className="cal-head">
            <div className="cal-title">{MONTHS[view.m]}, {view.y}</div>
            <div className="cal-nav">
              <button className="pill-btn" onClick={() => selectDate(today)}>Today</button>
              <button className="circ" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
              <button className="circ" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
            </div>
          </div>

          <div className="toolbar">
            <div className="vfilter">
              {[{ id: 'all', short_name: 'All venues' }, ...venues].map(v => (
                <button key={v.id} className={`vchipbtn${venueFilter === v.id ? ' active' : ''}`} onClick={() => setVenueFilter(v.id)}>{v.short_name}</button>
              ))}
            </div>
          </div>

          <div className="grid7">{DOWS.map(d => <div key={d} className="dow">{d}</div>)}</div>
          <div className="grid7 vmode" style={{ marginTop: 4, opacity: loading ? 0.6 : 1 }}>
            {cells.map((iso, i) => {
              if (!iso) return <div key={'e' + i} className="day empty" />;
              let cls = 'day';
              if (iso === today) cls += ' today';
              if (iso === selected) cls += ' selected';
              let body: React.ReactNode;
              if (venueFilter === 'all') {
                const freeHere = venues.filter(v => venueDay(map, v.id, iso).s === 'free');
                cls += freeHere.length ? ' v-free' : ' v-busy';
                body = (
                  <>
                    <div className="vchips">
                      {freeHere.map(v => <span key={v.id} className="vchip">{v.short_name}</span>)}
                      {!freeHere.length && <span className="vchip none">None free</span>}
                    </div>
                    <div className="vcount">{freeHere.length} free</div>
                  </>
                );
              } else {
                const free1 = venueDay(map, venueFilter, iso).s === 'free';
                cls += free1 ? ' v-free' : ' v-busy';
                body = <div className={`vstate ${free1 ? 'free' : 'busy'}`}>{free1 ? 'Free' : 'Booked'}</div>;
              }
              return (
                <div key={iso} className={cls} role="button" tabIndex={0} aria-label={fmtLong(iso)}
                  onClick={() => setSelected(iso)}
                  onKeyDown={e => { if (e.key === 'Enter') setSelected(iso); }}>
                  <div className="num">{toDate(iso).getDate()}</div>
                  {body}
                </div>
              );
            })}
          </div>

          <div className="legend">
            <span><span className="swatch" style={{ background: 'rgba(108,194,147,.22)', border: '1px solid var(--free)' }} />{venueFilter === 'all' ? 'At least one venue free' : 'Free'}</span>
            <span><span className="swatch" style={{ background: 'rgba(215,116,116,.22)', border: '1px solid var(--busy)' }} />{venueFilter === 'all' ? 'No venue free' : 'Booked'}</span>
          </div>
        </section>

        <aside className="sched">
          <div className="sched-head">
            <div>
              <h2>Venues</h2>
              <div className="sched-date">{fmtLong(selected)}</div>
            </div>
            <div className="cal-nav">
              <button className="circ" onClick={() => selectDate(addDays(selected, -1))} aria-label="Previous day">‹</button>
              <button className="circ" onClick={() => selectDate(addDays(selected, 1))} aria-label="Next day">›</button>
            </div>
          </div>
          <div>
            {free.length > 0 && <div className="free-row">{free.map(x => <span key={x.v.id} className="fchip">{x.v.short_name} · free</span>)}</div>}
            {busy.map(x => (
              <div key={x.v.id} className="vcard">
                <div className="vc-head"><span className="vc-name">{x.v.name}</span><span className="vc-badge">Booked</span></div>
                {x.bl.map(b => (
                  <div key={b.id} className="bkrow"><span className="bk-time">{fmtTime(b.from_time)} – {fmtTime(b.to_time)}</span></div>
                ))}
              </div>
            ))}
            {!shown.length && <div className="muted">No venues to show.</div>}
          </div>
        </aside>
      </div>
    </>
  );
}
