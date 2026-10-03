import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Mail, MapPin, Phone, Trophy } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { ProposalStatus } from '@/types/club';
import { useAdminData } from '../AdminData';
import { acceptProposal, rejectProposal } from '../api';
import {
  ENTRY_TYPES, fmtLong, fmtMed, fmtRange, fmtShort, fmtTime, initials, rangeDates, todayIso, venueName, venueRange,
} from '../calendarLogic';
import { useIsSuperAdmin } from '../SuperAdminOnly';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';
const TAG: Record<ProposalStatus, string> = { pending: 'pending', accepted: 'approved', rejected: 'rejected' };
const LABEL: Record<ProposalStatus, string> = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export default function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isSuper = useIsSuperAdmin();
  const {
    proposals, roster, leaderboard, attendance, coordinatorTypeId, events, venues, byDate, bookingMap, reload,
  } = useAdminData();
  const p = proposals.find(x => x.id === id);

  const [dates, setDates] = useState<{ start: string; end: string } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);

  const start = dates?.start ?? p?.expected_start ?? '';
  const end = dates?.end ?? p?.expected_end ?? '';

  // Who proposed it, from the roster (admins who aren't members won't be on it).
  const email = p?.proposer_email.trim().toLowerCase() ?? '';
  const member = useMemo(() => roster.find(m => m.email.trim().toLowerCase() === email), [roster, email]);
  const board = member ? leaderboard.find(r => r.member_id === member.id) : undefined;
  const mine = member ? attendance.filter(a => a.member_id === member.id) : [];
  const coordinated = mine.filter(a => a.type_id === coordinatorTypeId).length;
  const history = proposals.filter(x => x.id !== id && x.proposer_email.trim().toLowerCase() === email);
  const eventTitle = (eid: string) => events.find(e => e.id === eid)?.title;

  // What's already on the chosen days, and whether the venue is free.
  const clashes = useMemo(() => {
    if (!start || !end || end < start) return [];
    const seen = new Map<string, { title: string; t: string; s: string; e: string }>();
    for (const d of rangeDates(start, end)) {
      for (const it of byDate.get(d) ?? []) {
        if (it.kind === 'event' && it.id === p?.event_id) continue;
        seen.set(it.key, { title: it.title, t: ENTRY_TYPES[it.t], s: it.s, e: it.e });
      }
    }
    return [...seen.values()];
  }, [start, end, byDate, p?.event_id]);
  const venue = p && !p.is_online && p.venue_id && start && end >= start ? venueRange(bookingMap, p.venue_id, start, end) : null;

  if (!p) {
    return (
      <div className="panel">
        <h3 className="ph">Proposal not found</h3>
        <p className="muted">It may have been withdrawn. <Link className="linkbtn" to="/admin/proposals">Back to proposals</Link></p>
      </div>
    );
  }

  const today = todayIso();
  const lead = daysBetween(today, start);

  const decide = async (mode: 'accept' | 'reject') => {
    if (mode === 'accept' && (!start || end < start)) { toast.error('Check the dates.'); return; }
    if (mode === 'reject' && !window.confirm(`Reject "${p.title}"?`)) return;
    setBusy(mode);
    try {
      if (mode === 'accept') {
        const eventId = await acceptProposal(p.id, start, end || start, note.trim());
        await reload('proposals', 'events');
        toast.success(`"${p.title}" is now an event.`);
        navigate(`/admin/events/${eventId}`);
      } else {
        await rejectProposal(p.id, note.trim());
        await reload('proposals');
        toast.success('Proposal rejected.');
      }
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(null); }
  };

  return (
    <>
      <div className="top">
        <div style={{ minWidth: 0 }}>
          <Link className="linkbtn" to="/admin/proposals" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ArrowLeft size={14} /> All proposals
          </Link>
          <h1>{p.title}</h1>
          <div className="sub">
            Proposed {fmtMed(p.created_at.slice(0, 10))} by {p.proposer_name || (isSuper ? p.proposer_email : 'a club member')}
          </div>
        </div>
        <span className={`tag ${TAG[p.status]}`} style={{ fontSize: 13, padding: '6px 14px' }}>{LABEL[p.status]}</span>
      </div>

      <div className="check-grid">
        {/* The proposal */}
        <div className="check-card wide">
          <div className="check-head"><h4>The idea</h4>
            <span className="asof">{fmtRange(p.expected_start, p.expected_end)} · {p.is_online ? 'Online' : venueName(venues, p.venue_id) || 'No venue preference'}</span>
          </div>
          <p className="pr-body" style={{ marginTop: 0 }}>{p.description}</p>
          {p.requirements && (
            <>
              <h5 className="pd-sub">Requirements</h5>
              <p className="pr-body" style={{ marginTop: 0 }}>{p.requirements}</p>
            </>
          )}
          {p.status !== 'pending' && (
            <div className={`vstat ${p.status === 'accepted' ? 'ok' : 'no'}`} style={{ marginTop: 14 }}>
              <span className="ic" />
              {LABEL[p.status]}{p.reviewed_at ? ` ${fmtMed(p.reviewed_at.slice(0, 10))}` : ''}{p.reviewed_by ? ` by ${p.reviewed_by}` : ''}
              {p.review_note ? ` — “${p.review_note}”` : ''}
              {p.event_id && <> · <Link className="linkbtn" to={`/admin/events/${p.event_id}`}>Open the event</Link></>}
            </div>
          )}
        </div>

        {/* Proposer: contact details and record are for super admins only */}
        {!isSuper ? (
          <div className="check-card">
            <div className="check-head"><h4>Proposed by</h4></div>
            <div className="person">
              <span className="avatar">{initials(p.proposer_name ?? p.proposer_email)}</span>
              <div className="who"><b>{p.proposer_name || 'A club member'}</b></div>
            </div>
          </div>
        ) : <>
        <div className="check-card">
          <div className="check-head"><h4>Proposed by</h4>
            {member && <Link className="linkbtn" to={`/admin/members/${member.id}`}>Member page →</Link>}
          </div>
          <div className="person" style={{ marginBottom: 12 }}>
            <span className="avatar">{initials(member?.full_name ?? p.proposer_name ?? p.proposer_email)}</span>
            <div className="who">
              {member ? <Link to={`/admin/members/${member.id}`} style={{ textDecoration: 'none' }}><b>{member.full_name}</b></Link>
                : <b>{p.proposer_name || p.proposer_email}</b>}
              <span>{member ? [member.member_position, member.member_department].filter(Boolean).join(' · ') || 'Member' : 'Not on the roster (an admin)'}</span>
            </div>
          </div>
          <div className="pd-facts">
            <a href={`mailto:${p.proposer_email}`}><Mail size={13} /> {p.proposer_email}</a>
            {member?.phone && <a href={`tel:${member.phone}`}><Phone size={13} /> {member.phone}</a>}
          </div>
          {member && (
            <div className="pd-stats">
              <div><b>{board ? `#${board.rank}` : '—'}</b><span><Trophy size={11} /> Rank</span></div>
              <div><b>{board?.total_points ?? 0}</b><span>Points</span></div>
              <div><b>{coordinated}</b><span>Coordinated</span></div>
              <div><b>{mine.length - coordinated}</b><span>Volunteered / attended</span></div>
            </div>
          )}
          {member?.is_lead && <p className="note-sm" style={{ marginBottom: 0 }}>A lead, so they don't earn points.</p>}
        </div>

        {/* Their other proposals */}
        <div className="check-card">
          <div className="check-head"><h4>Their other proposals</h4><span className="asof">{history.length}</span></div>
          {history.length ? (
            <ul className="pd-history">
              {history.slice(0, 6).map(h => (
                <li key={h.id}>
                  <Link to={`/admin/proposals/${h.id}`}>{h.title}</Link>
                  <span className={`tag ${TAG[h.status]}`}>{LABEL[h.status]}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted" style={{ margin: 0 }}>This is their first proposal.</p>}
          {history.some(h => h.event_id) && (
            <p className="note-sm" style={{ marginBottom: 0 }}>
              Ran before: {history.filter(h => h.event_id).map(h => eventTitle(h.event_id!) ?? h.title).join(', ')}
            </p>
          )}
        </div>
        </>}

        {/* Date check */}
        <div className="check-card">
          <div className="check-head"><CalendarDays size={16} /><h4>Date check</h4>
            <span className="asof">{start ? (lead >= 0 ? `${lead} day${lead === 1 ? '' : 's'} away` : `${-lead} days ago`) : ''}</span>
          </div>
          {start && <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{fmtLong(start)}{end !== start ? ` – ${fmtLong(end)}` : ''}</div>}
          {clashes.length ? (
            <>
              <div className="warn" style={{ marginTop: 0 }}>Already on these days:</div>
              <div className="chips" style={{ marginTop: 8 }}>
                {clashes.map((c, i) => <span key={i} className="chip">{c.t}<b>{c.title}{c.s !== c.e ? ` (${fmtRange(c.s, c.e)})` : ''}</b></span>)}
              </div>
            </>
          ) : <div className="vstat ok"><span className="ic" />Nothing else on the calendar those days.</div>}
          {lead >= 0 && lead < 7 && p.status === 'pending' && <div className="warn">Less than a week away: little time to book a venue and publicise it.</div>}
        </div>

        {/* Venue check */}
        {!p.is_online && (
          <div className="check-card">
            <div className="check-head"><MapPin size={16} /><h4>Venue check</h4></div>
            {!p.venue_id ? <p className="muted" style={{ margin: 0 }}>No preferred venue. Pick one on the event once it's accepted.</p>
              : !venue ? <p className="muted" style={{ margin: 0 }}>Pick valid dates to check {venueName(venues, p.venue_id)}.</p>
              : venue.state === 'busy' ? (
                <div className="vstat no"><span className="ic" />
                  {venueName(venues, p.venue_id)} is booked by another club: {venue.othersOn.flatMap(d => d.bl.filter(b => !b.is_ours)
                    .map(b => `${fmtShort(d.d)} ${fmtTime(b.from_time)}–${fmtTime(b.to_time)}`)).join('; ')}
                </div>
              ) : venue.state === 'ours' ? (
                <div className="vstat ok"><span className="ic" />We already have {venueName(venues, p.venue_id)} booked on {venue.oursOn.map(d => fmtShort(d.d)).join(', ')}.</div>
              ) : <div className="vstat ok"><span className="ic" />{venueName(venues, p.venue_id)} has no bookings on these days.</div>}
          </div>
        )}

        {/* Decision */}
        {p.status === 'pending' && (
          <div className="check-card wide adm-form">
            <div className="check-head"><h4>Decision</h4>{!isSuper && <span className="asof">Only super admins decide</span>}</div>
            {isSuper ? (
              <>
                <div className="grid2" style={{ marginBottom: 12 }}>
                  <div className="fld"><label htmlFor="pdFrom">From</label>
                    <input id="pdFrom" type="date" value={start}
                      onChange={e => setDates({ start: e.target.value, end: end < e.target.value ? e.target.value : end })} /></div>
                  <div className="fld"><label htmlFor="pdTo">To</label>
                    <input id="pdTo" type="date" value={end} min={start} onChange={e => setDates({ start, end: e.target.value })} /></div>
                </div>
                <div className="fld" style={{ marginBottom: 14 }}><label htmlFor="pdNote">Note to the proposer (optional)</label>
                  <textarea id="pdNote" rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Great idea, moved it a week later to avoid CAT-I" /></div>
                <div className="pr-acts" style={{ marginTop: 0 }}>
                  <button className="mini-btn danger" onClick={() => decide('reject')} disabled={!!busy}>{busy === 'reject' ? 'Rejecting…' : 'Reject'}</button>
                  <button className="primary" onClick={() => decide('accept')} disabled={!!busy}>{busy === 'accept' ? 'Creating…' : 'Accept and create event'}</button>
                </div>
              </>
            ) : <p className="muted" style={{ margin: 0 }}>A super admin will accept or reject this proposal.</p>}
          </div>
        )}
      </div>
    </>
  );
}
