import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import type { RosterMember } from '@/types/admin';
import { useAdminData } from '../AdminData';
import { addMember, fetchNonMembers, updateMember } from '../api';
import { initials } from '../calendarLogic';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';
type Filter = 'active' | 'leads' | 'inactive' | 'all';

export default function MembersPage() {
  const { roster, leaderboard, attendance } = useAdminData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('active');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const standing = useMemo(() => new Map(leaderboard.map(r => [r.member_id, r])), [leaderboard]);
  const eventsBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attendance) m.set(a.member_id, (m.get(a.member_id) ?? 0) + 1);
    return m;
  }, [attendance]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return roster
      .filter(m => filter === 'all' || (filter === 'leads' ? m.is_lead : filter === 'inactive' ? m.member_status === 'inactive' : m.member_status === 'active'))
      .filter(m => !term || [m.full_name, m.email, m.roll_number ?? '', m.member_department ?? '', m.member_position ?? ''].some(x => x.toLowerCase().includes(term)))
      .sort((a, b) => (standing.get(a.id)?.rank ?? 9999) - (standing.get(b.id)?.rank ?? 9999) || a.full_name.localeCompare(b.full_name));
  }, [roster, filter, q, standing]);

  return (
    <>
      <div className="top">
        <div>
          <h1>Members</h1>
          <div className="sub">{roster.filter(m => m.member_status === 'active').length} active on the roster · open anyone for their card, contributions and events.</div>
        </div>
        <button className="add-btn" onClick={() => setAdding(true)}><span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add member</button>
      </div>

      <section className="panel">
        <div className="list-head">
          <div className="form-acts">
            {(['active', 'leads', 'inactive', 'all'] as Filter[]).map(f => (
              <button key={f} className={`pill-btn${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
            ))}
          </div>
          <input aria-label="Search members" placeholder="Search name, email, reg no, team" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Member</th><th className="hide-sm">Team</th><th className="hide-sm">Position</th><th>Points</th><th className="hide-sm">Events</th><th /></tr></thead>
            <tbody>
              {rows.length ? rows.map(m => {
                const s = standing.get(m.id);
                return (
                  <tr key={m.id} className="click" onClick={() => navigate(`/admin/members/${m.id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="avatar">{initials(m.full_name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <b>{m.full_name}</b>
                          <div className="m">{m.roll_number ?? m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-sm">{m.member_department ?? <span className="muted">—</span>}</td>
                    <td className="hide-sm">{m.member_position ?? <span className="muted">—</span>}</td>
                    <td className="tnum">{m.is_lead ? <span className="muted">Lead</span> : s ? <><b>{s.total_points}</b> <span className="m">#{s.rank}</span></> : <span className="muted">—</span>}</td>
                    <td className="hide-sm tnum">{eventsBy.get(m.id) ?? 0}</td>
                    <td className="acts">
                      {m.is_lead && <span className="tag lead">Lead</span>}{' '}
                      {m.member_status === 'inactive' && <span className="tag inactive">Inactive</span>}
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={6} className="muted">No members match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {adding && <AddMemberModal onClose={() => setAdding(false)} onAdded={id => { setAdding(false); if (id) navigate(`/admin/members/${id}`); }} />}
    </>
  );
}

function AddMemberModal({ onClose, onAdded }: { onClose: () => void; onAdded: (id?: string) => void }) {
  const { reload } = useAdminData();
  const [mode, setMode] = useState<'applicant' | 'new'>('applicant');
  const [applicants, setApplicants] = useState<RosterMember[] | null>(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', roll_number: '', phone: '', member_department: '', member_position: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchNonMembers().then(setApplicants).catch(err => { toast.error(errMsg(err)); setApplicants([]); }); }, []);

  const term = q.trim().toLowerCase();
  const matches = (applicants ?? []).filter(a => !term || [a.full_name, a.email, a.roll_number ?? ''].some(x => x.toLowerCase().includes(term))).slice(0, 40);

  const addApplicant = async (a: RosterMember) => {
    setBusy(true);
    try {
      await updateMember(a.id, { is_member: true, member_status: 'active', member_department: a.member_department ?? a.primary_dept });
      await reload('roster', 'leaderboard');
      toast.success(`${a.full_name} added to the roster.`);
      onAdded(a.id);
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  const addNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error('Enter a valid email.'); return; }
    setBusy(true);
    try {
      await addMember({
        full_name: form.full_name.trim(), email, roll_number: form.roll_number.trim().toUpperCase() || null,
        phone: form.phone.trim() || null, member_department: form.member_department.trim() || null,
        member_position: form.member_position.trim() || null, member_status: 'active',
      });
      await reload('roster', 'leaderboard');
      toast.success(`${form.full_name.trim()} added to the roster.`);
      onAdded();
    } catch (err) {
      const msg = errMsg(err);
      toast.error(/duplicate|unique/i.test(msg) ? 'Someone with that email or reg no already exists — add them from "Former applicants".' : msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal adm-form" role="dialog" aria-modal="true" aria-labelledby="addMemberTitle">
        <div className="modal-head"><h3 id="addMemberTitle">Add to the roster</h3><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="form-acts" style={{ marginBottom: 16 }}>
          <button className={`pill-btn${mode === 'applicant' ? ' on' : ''}`} onClick={() => setMode('applicant')}>Former applicant</button>
          <button className={`pill-btn${mode === 'new' ? ' on' : ''}`} onClick={() => setMode('new')}>Someone new</button>
        </div>
        {mode === 'applicant' ? (
          <>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search applicants by name, email or reg no" aria-label="Search applicants" />
            <div className="people" style={{ marginTop: 12, maxHeight: 340, overflow: 'auto' }}>
              {applicants === null ? <div className="muted">Loading…</div>
                : matches.length ? matches.map(a => (
                  <div key={a.id} className="person">
                    <span className="avatar">{initials(a.full_name)}</span>
                    <div className="who"><b>{a.full_name}</b><span>{[a.roll_number, a.primary_dept, a.email].filter(Boolean).join(' · ')}</span></div>
                    <button className="mini-btn" disabled={busy} onClick={() => addApplicant(a)}>Add</button>
                  </div>
                )) : <div className="muted">No applicants match.</div>}
            </div>
          </>
        ) : (
          <form onSubmit={addNew} autoComplete="off">
            <div className="grid2">
              <div className="fld wide"><label htmlFor="nmName">Full name</label><input id="nmName" required maxLength={100} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
              <div className="fld wide"><label htmlFor="nmEmail">VIT email</label><input id="nmEmail" required type="email" maxLength={120} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@vitstudent.ac.in" /></div>
              <div className="fld"><label htmlFor="nmRoll">Reg no</label><input id="nmRoll" maxLength={20} value={form.roll_number} onChange={e => setForm(f => ({ ...f, roll_number: e.target.value }))} /></div>
              <div className="fld"><label htmlFor="nmPhone">Phone</label><input id="nmPhone" maxLength={15} inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="fld"><label htmlFor="nmDept">Team</label><input id="nmDept" maxLength={60} value={form.member_department} onChange={e => setForm(f => ({ ...f, member_department: e.target.value }))} placeholder="e.g. Technical" /></div>
              <div className="fld"><label htmlFor="nmPos">Position</label><input id="nmPos" maxLength={60} value={form.member_position} onChange={e => setForm(f => ({ ...f, member_position: e.target.value }))} placeholder="e.g. Member" /></div>
            </div>
            <div className="modal-foot">
              <button type="button" className="ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary" disabled={busy}>{busy ? 'Adding…' : 'Add member'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
