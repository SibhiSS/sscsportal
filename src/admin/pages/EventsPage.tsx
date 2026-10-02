import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminData } from '../AdminData';
import { fmtRange, todayIso, venueName } from '../calendarLogic';
import EntryModal from '../EntryModal';
import { useEventProgress } from '../useEventProgress';

type Filter = 'upcoming' | 'past' | 'all';

export default function EventsPage() {
  const { events, venues } = useAdminData();
  const progress = useEventProgress();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [adding, setAdding] = useState(false);
  const today = todayIso();

  const rows = useMemo(() => {
    const list = events.filter(e => filter === 'all' || (filter === 'upcoming' ? e.end_date >= today : e.end_date < today));
    return list.slice().sort((a, b) => filter === 'past' ? b.start_date.localeCompare(a.start_date) : a.start_date.localeCompare(b.start_date));
  }, [events, filter, today]);

  return (
    <>
      <div className="top">
        <div>
          <h1>Events</h1>
          <div className="sub">Plan each event with its checklist: venue, coordinators, poster, budget, report, attendance and OD.</div>
        </div>
        <button className="add-btn" onClick={() => setAdding(true)}><span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New event</button>
      </div>

      <section className="panel">
        <div className="list-head">
          <div className="form-acts">
            {(['upcoming', 'past', 'all'] as Filter[]).map(f => (
              <button key={f} className={`pill-btn${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <span className="asof">{rows.length} event{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Dates</th><th>Event</th><th className="hide-sm">Where</th><th style={{ width: '32%' }}>Checklist</th></tr></thead>
            <tbody>
              {rows.length ? rows.map(ev => {
                const p = progress.get(ev.id)!;
                const missing = p.list.filter(i => !i.done).map(i => i.label);
                return (
                  <tr key={ev.id} className="click" onClick={() => navigate(`/admin/events/${ev.id}`)}>
                    <td className="d">{fmtRange(ev.start_date, ev.end_date)}</td>
                    <td><b>{ev.title}</b></td>
                    <td className="hide-sm">{ev.is_online ? <span style={{ color: 'var(--online)' }}>Online</span> : venueName(venues, ev.venue_id) || <span className="muted">Venue not decided</span>}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className={`prog${p.done === p.total ? ' done' : ''}`} style={{ flex: 1 }}><i style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
                        <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700 }}>{p.done}/{p.total}</span>
                      </div>
                      {missing.length > 0 && <div className="m" style={{ marginTop: 4 }}>To do: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` +${missing.length - 3}` : ''}</div>}
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={4} className="muted">No {filter === 'all' ? '' : filter} events.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {adding && (
        <EntryModal
          editing={null}
          defaultDate={today}
          defaultType="event"
          onClose={() => setAdding(false)}
          onSaved={(_, id) => { setAdding(false); if (id) navigate(`/admin/events/${id}`); }}
        />
      )}
    </>
  );
}
