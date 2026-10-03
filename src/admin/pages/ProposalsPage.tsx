import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import type { EventProposal, ProposalStatus } from '@/types/club';
import { useAdminData } from '../AdminData';
import { acceptProposal, rejectProposal } from '../api';
import { fmtMed, fmtRange, venueName } from '../calendarLogic';
import { useIsSuperAdmin } from '../SuperAdminOnly';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';
type Filter = ProposalStatus | 'all';
const TAG: Record<ProposalStatus, string> = { pending: 'pending', accepted: 'approved', rejected: 'rejected' };
const LABEL: Record<ProposalStatus, string> = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' };

export default function ProposalsPage() {
  const { proposals, venues, reload } = useAdminData();
  const isSuper = useIsSuperAdmin();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('pending');
  const [deciding, setDeciding] = useState<{ p: EventProposal; mode: 'accept' | 'reject' } | null>(null);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => proposals.filter(p => filter === 'all' || p.status === filter), [proposals, filter]);
  const pending = proposals.filter(p => p.status === 'pending').length;

  const open = (p: EventProposal, mode: 'accept' | 'reject') => {
    setDeciding({ p, mode });
    setDates({ start: p.expected_start, end: p.expected_end });
    setNote('');
  };

  const decide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deciding) return;
    setBusy(true);
    try {
      if (deciding.mode === 'accept') {
        if (!dates.start || dates.end < dates.start) { toast.error('Check the dates.'); setBusy(false); return; }
        const id = await acceptProposal(deciding.p.id, dates.start, dates.end || dates.start, note.trim());
        await reload('proposals', 'events');
        toast.success(`"${deciding.p.title}" is now an event.`);
        setDeciding(null);
        navigate(`/admin/events/${id}`);
      } else {
        await rejectProposal(deciding.p.id, note.trim());
        await reload('proposals');
        toast.success('Proposal rejected.');
        setDeciding(null);
      }
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="top">
        <div>
          <h1>Proposals</h1>
          <div className="sub">
            Event ideas from members and admins. {isSuper
              ? 'Accepting one creates the event with its checklist; you can adjust the dates first.'
              : 'Only super admins can accept or reject them.'}
          </div>
        </div>
        <Link className="add-btn" to="/proposals" style={{ textDecoration: 'none' }}><span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Propose an event</Link>
      </div>

      <section className="panel">
        <div className="list-head">
          <div className="form-acts">
            {(['pending', 'accepted', 'rejected', 'all'] as Filter[]).map(f => (
              <button key={f} className={`pill-btn${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : LABEL[f]}{f === 'pending' && pending ? ` (${pending})` : ''}
              </button>
            ))}
          </div>
          <span className="asof">{rows.length} proposal{rows.length === 1 ? '' : 's'}</span>
        </div>

        {rows.length ? (
          <div className="pr-list">
            {rows.map(p => (
              <article key={p.id} className="pr-card">
                <div className="pr-head">
                  <div style={{ minWidth: 0 }}>
                    <b className="pr-title">{p.title}</b>
                    <div className="muted pr-sub">
                      {fmtRange(p.expected_start, p.expected_end)} · {p.is_online ? 'Online' : venueName(venues, p.venue_id) || 'No venue preference'}
                      {' · '}by {p.proposer_name || p.proposer_email} · {fmtMed(p.created_at.slice(0, 10))}
                    </div>
                  </div>
                  <span className={`tag ${TAG[p.status]}`}>{LABEL[p.status]}</span>
                </div>
                <p className="pr-body">{p.description}</p>
                {p.requirements && <p className="pr-body"><b>Requirements:</b> {p.requirements}</p>}
                {p.review_note && <p className="note-sm">Note: {p.review_note}</p>}
                <div className="pr-acts">
                  {p.event_id && <Link className="mini-btn" to={`/admin/events/${p.event_id}`}>Open event</Link>}
                  {isSuper && p.status === 'pending' && (
                    <>
                      <button className="mini-btn danger" onClick={() => open(p, 'reject')}>Reject</button>
                      <button className="primary" onClick={() => open(p, 'accept')}>Accept</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : <div className="muted">No {filter === 'all' ? '' : LABEL[filter].toLowerCase()} proposals.</div>}
      </section>

      {deciding && (
        <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setDeciding(null); }}>
          <form className="modal adm-form" onSubmit={decide} role="dialog" aria-modal="true" aria-labelledby="prTitle">
            <div className="modal-head">
              <h3 id="prTitle">{deciding.mode === 'accept' ? 'Accept' : 'Reject'} “{deciding.p.title}”</h3>
              <button type="button" className="x" onClick={() => setDeciding(null)} aria-label="Close" disabled={busy}>×</button>
            </div>
            {deciding.mode === 'accept' && (
              <>
                <div className="frow"><label htmlFor="prFrom">From</label>
                  <input id="prFrom" type="date" value={dates.start} required
                    onChange={e => setDates(d => ({ start: e.target.value, end: d.end < e.target.value ? e.target.value : d.end }))} /></div>
                <div className="frow"><label htmlFor="prTo">To</label>
                  <input id="prTo" type="date" value={dates.end} min={dates.start} onChange={e => setDates(d => ({ ...d, end: e.target.value }))} /></div>
              </>
            )}
            <div className="frow"><label htmlFor="prNote">Note</label>
              <textarea id="prNote" className="inp" rows={3} maxLength={1000} value={note}
                placeholder={deciding.mode === 'accept' ? 'Optional, shown to the proposer' : 'Why, shown to the proposer (optional)'}
                onChange={e => setNote(e.target.value)} /></div>
            <div className="modal-foot">
              <button type="button" className="ghost" onClick={() => setDeciding(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Saving…' : deciding.mode === 'accept' ? 'Accept and create event' : 'Reject proposal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
