import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminData } from '../AdminData';
import { ENTRY_TYPES, NO_EVENT_TYPES, addDays, fmtRange, fmtShort, fmtTime, initials, todayIso, venueName } from '../calendarLogic';
import { useEventProgress } from '../useEventProgress';
import { useIsSuperAdmin } from '../SuperAdminOnly';

export default function Overview() {
  const { user } = useAuth();
  const { events, roster, bookings, venues, leaderboard, pendingCount, byDate } = useAdminData();
  const progress = useEventProgress();
  const isSuper = useIsSuperAdmin();
  const today = todayIso();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const upcoming = useMemo(() => events.filter(e => e.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date)), [events, today]);
  const ourUpcoming = useMemo(() => bookings.filter(b => b.is_ours && b.booking_date >= today)
    .sort((a, b) => (a.booking_date + a.from_time).localeCompare(b.booking_date + b.from_time)), [bookings, today]);
  const nextTwoWeeks = useMemo(() => {
    const out: { d: string; items: ReturnType<typeof byDate.get> }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i);
      const items = byDate.get(d);
      if (items?.length) out.push({ d, items });
    }
    return out;
  }, [byDate, today]);
  const active = roster.filter(m => m.member_status === 'active').length;
  const firstName = (user?.displayName || '').split(' ')[0];

  return (
    <>
      <div className="top">
        <div>
          <h1>{greeting}{firstName ? `, ${firstName}` : ''}!</h1>
          <div className="sub">Here's what's coming up for IEEE SSCS VIT Chennai.</div>
        </div>
      </div>

      <div className="tiles">
        <Link className="tile" to="/admin/events"><div className="lbl">Upcoming events</div><div className="val">{upcoming.length}</div>
          <div className="hint">{upcoming[0] ? `Next: ${upcoming[0].title}, ${fmtShort(upcoming[0].start_date)}` : 'Nothing planned yet'}</div></Link>
        <Link className="tile" to="/admin/members"><div className="lbl">Active members</div><div className="val">{active}</div>
          <div className="hint">{roster.filter(m => m.is_lead).length} leads</div></Link>
        <Link className="tile" to="/admin/approvals"><div className="lbl">Contributions to review</div><div className="val">{pendingCount}</div>
          <div className="hint">{pendingCount ? 'Waiting in Approvals' : 'All caught up'}</div></Link>
        {isSuper
          ? <Link className="tile" to="/admin/venues"><div className="lbl">Our venue bookings</div><div className="val">{ourUpcoming.length}</div>
          <div className="hint">{ourUpcoming[0] ? `Next: ${venueName(venues, ourUpcoming[0].venue_id)}, ${fmtShort(ourUpcoming[0].booking_date)}` : 'None upcoming'}</div></Link>
          : <div className="tile"><div className="lbl">Our venue bookings</div><div className="val">{ourUpcoming.length}</div>
          <div className="hint">{ourUpcoming[0] ? `Next: ${venueName(venues, ourUpcoming[0].venue_id)}, ${fmtShort(ourUpcoming[0].booking_date)}` : 'None upcoming'}</div></div>}
      </div>

      <div className="bk-grid">
        <section className="panel" style={{ marginTop: 0 }}>
          <div className="list-head"><h3 className="ph">Event checklists</h3><Link className="linkbtn" to="/admin/events">All events</Link></div>
          {upcoming.length ? upcoming.slice(0, 6).map(ev => {
            const p = progress.get(ev.id)!;
            const missing = p.list.filter(i => !i.done).map(i => i.label);
            return (
              <Link key={ev.id} to={`/admin/events/${ev.id}`} className="entry event" style={{ display: 'block', textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div className="t">{ev.title}</div>
                  <span className="tnum" style={{ fontWeight: 700, fontSize: 13 }}>{p.done}/{p.total}</span>
                </div>
                <div className="m">{fmtRange(ev.start_date, ev.end_date)} · {ev.is_online ? 'Online' : venueName(venues, ev.venue_id) || 'Venue not decided'}</div>
                <div className={`prog${p.done === p.total ? ' done' : ''}`} style={{ marginTop: 10 }}><i style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
                {missing.length > 0 && <div className="m" style={{ marginTop: 8 }}>To do: {missing.join(', ')}</div>}
              </Link>
            );
          }) : <div className="muted">No upcoming events. <Link className="linkbtn" to="/admin/events">Plan one</Link></div>}
        </section>

        <div>
          <section className="panel" style={{ marginTop: 0 }}>
            <div className="list-head"><h3 className="ph">Next two weeks</h3><Link className="linkbtn" to="/admin/calendar">Calendar</Link></div>
            {nextTwoWeeks.length ? nextTwoWeeks.map(({ d, items }) => (
              <div key={d} className="kv" style={{ alignItems: 'flex-start' }}>
                <span className="tnum" style={{ minWidth: 70 }}>{fmtShort(d)}</span>
                <span>{items!.map(it => (
                  <span key={it.key} className={`tag ${it.t}`} style={{ margin: '0 0 4px 6px' }} title={ENTRY_TYPES[it.t]}>
                    {NO_EVENT_TYPES.includes(it.t) ? '⊘ ' : ''}{it.title}
                  </span>
                ))}</span>
              </div>
            )) : <div className="muted">Nothing on the calendar.</div>}
            {ourUpcoming.length > 0 && (
              <>
                <div className="divider" style={{ margin: '14px 0 8px' }}>Venues we hold</div>
                {ourUpcoming.slice(0, 4).map(b => (
                  <div key={b.id} className="kv"><span>{fmtShort(b.booking_date)} · {fmtTime(b.from_time)}</span><span>{venueName(venues, b.venue_id)}</span></div>
                ))}
              </>
            )}
          </section>

          <section className="panel">
            <div className="list-head"><h3 className="ph">Leaderboard</h3><Link className="linkbtn" to="/admin/members">Members</Link></div>
            {leaderboard.length ? leaderboard.slice(0, 5).map(r => (
              <Link key={r.member_id} to={`/admin/members/${r.member_id}`} className="person" style={{ textDecoration: 'none', marginBottom: 6 }}>
                <span className="tnum" style={{ width: 22, fontWeight: 700, color: 'var(--text-soft)' }}>#{r.rank}</span>
                <span className="avatar">{initials(r.full_name)}</span>
                <div className="who"><b>{r.full_name}</b><span>{r.department ?? ''}</span></div>
                <span className="pts">{r.total_points} pts</span>
              </Link>
            )) : <div className="muted">No points yet.</div>}
          </section>
        </div>
      </div>
    </>
  );
}
