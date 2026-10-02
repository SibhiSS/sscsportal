import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import type { ContributionType } from '@/types/club';
import { useAdminData } from '../AdminData';
import {
  addAdmin, deleteType, fetchAdmins, fetchAllTypes, removeAdmin, saveType, setAdminRole, type AdminRow,
} from '../api';
import { fmtMed, isoDate } from '../calendarLogic';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';
const localDay = (ts: string) => { const d = new Date(ts); return isoDate(d.getFullYear(), d.getMonth(), d.getDate()); };

export default function SettingsPage() {
  return (
    <>
      <div className="top">
        <div>
          <h1>Settings</h1>
          <div className="sub">Who can use this panel, and what each kind of contribution is worth.</div>
        </div>
      </div>
      <AdminsSection />
      <TypesSection />
    </>
  );
}

function AdminsSection() {
  const { user, logout } = useAuth();
  const isSuper = user?.role === 'super_admin';
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin');
  const [busy, setBusy] = useState(false);
  const me = (user?.email ?? '').toLowerCase();

  const load = useCallback(async () => {
    try { setAdmins(await fetchAdmins()); } catch (err) { toast.error(errMsg(err)); setAdmins([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast.error('Enter a valid email.'); return; }
    if (!/@(vitstudent\.ac\.in|vit\.ac\.in)$/.test(em) && !window.confirm(`${em} isn't a VIT address, and only VIT accounts can sign in. Add anyway?`)) return;
    if ((admins ?? []).some(a => a.email.toLowerCase() === em)) { toast.error('Already an admin.'); return; }
    setBusy(true);
    try { await addAdmin(em, role, me); setEmail(''); setRole('admin'); await load(); toast.success(`${em} can now use the admin panel.`); }
    catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };
  const changeRole = async (a: AdminRow, r: 'admin' | 'super_admin') => {
    if (a.email.toLowerCase() === me && r !== 'super_admin' && !window.confirm('Step down to admin? You will no longer be able to manage admins.')) return;
    try { await setAdminRole(a.id, r); await load(); if (a.email.toLowerCase() === me) toast.message('Your role changes the next time you sign in.'); }
    // Reload so the dropdown snaps back to the role the database kept.
    catch (err) { toast.error(errMsg(err)); await load(); }
  };
  const remove = async (a: AdminRow) => {
    const self = a.email.toLowerCase() === me;
    if (!window.confirm(self ? 'Remove yourself? You will lose access to the admin panel.' : `Remove ${a.email} from the admin panel?`)) return;
    try { await removeAdmin(a.id); if (self) { logout(); return; } await load(); toast.success('Removed.'); }
    catch (err) { toast.error(errMsg(err)); await load(); }
  };

  return (
    <section className="panel">
      <div className="list-head">
        <h3 className="ph">Admins</h3>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Email</th><th>Role</th><th className="hide-sm">Added</th><th /></tr></thead>
          <tbody>
            {admins === null ? <tr><td colSpan={4} className="muted">Loading…</td></tr>
              : admins.map(a => (
                <tr key={a.id}>
                  <td><b>{a.email}</b>{a.email.toLowerCase() === me && <span className="tag neutral" style={{ marginLeft: 8 }}>You</span>}</td>
                  <td className="adm-form" style={{ width: 170 }}>
                    {isSuper ? (
                      <select value={a.role} onChange={e => changeRole(a, e.target.value as 'admin' | 'super_admin')} aria-label={`Role for ${a.email}`}>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super admin</option>
                      </select>
                    ) : <span className={`tag ${a.role === 'super_admin' ? 'lead' : 'neutral'}`}>{a.role === 'super_admin' ? 'Super admin' : 'Admin'}</span>}
                  </td>
                  <td className="hide-sm">{a.created_at ? fmtMed(localDay(a.created_at)) : '—'}{a.added_by && <div className="m">by {a.added_by}</div>}</td>
                  <td className="acts">{isSuper && <button className="mini-btn danger" onClick={() => remove(a)}><Trash2 size={12} /> Remove</button>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {isSuper && (
        <form className="adm-form form-acts" onSubmit={add} style={{ marginTop: 16, alignItems: 'flex-end' }} autoComplete="off">
          <div className="fld" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="newAdmin">Add an admin</label>
            <input id="newAdmin" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@vitstudent.ac.in" required />
          </div>
          <div className="fld" style={{ width: 160 }}>
            <label htmlFor="newRole">Role</label>
            <select id="newRole" value={role} onChange={e => setRole(e.target.value as 'admin' | 'super_admin')}>
              <option value="admin">Admin</option>
              <option value="super_admin">Super admin</option>
            </select>
          </div>
          <button type="submit" className="primary" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
        </form>
      )}
      <p className="note-sm" style={{ marginTop: 12, marginBottom: 0 }}>
        Admins use everything in this panel. Super admins can also manage this list. There is always at least one super admin.
      </p>
    </section>
  );
}

type Draft = { name: string; points: string; active: boolean };

function TypesSection() {
  const { reload } = useAdminData();
  const [types, setTypes] = useState<ContributionType[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [showHidden, setShowHidden] = useState(false);
  const [adding, setAdding] = useState({ category: '', name: '', points: '', source: 'submission' as 'submission' | 'attendance' });

  const load = useCallback(async () => {
    try { setTypes(await fetchAllTypes()); setDrafts({}); } catch (err) { toast.error(errMsg(err)); setTypes([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, ContributionType[]>();
    for (const t of types ?? []) {
      if (!showHidden && !t.is_active) continue;
      const k = t.source === 'attendance' ? 'Event attendance (marked by admins)' : t.category;
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return [...map.entries()];
  }, [types, showHidden]);
  const categories = useMemo(() => [...new Set((types ?? []).filter(t => t.source === 'submission').map(t => t.category))], [types]);

  const draftOf = (t: ContributionType): Draft => drafts[t.id] ?? { name: t.name, points: String(t.default_points), active: t.is_active };
  const isDirty = (t: ContributionType) => {
    const d = drafts[t.id];
    return !!d && (d.name !== t.name || d.points !== String(t.default_points) || d.active !== t.is_active);
  };
  const edit = (t: ContributionType, patch: Partial<Draft>) => setDrafts(s => ({ ...s, [t.id]: { ...draftOf(t), ...patch } }));

  const saveRow = async (t: ContributionType) => {
    const d = draftOf(t);
    const pts = Number(d.points);
    if (!d.name.trim()) { toast.error('A type needs a name.'); return; }
    if (!Number.isInteger(pts) || pts < 0) { toast.error('Points must be a whole number, 0 or more.'); return; }
    if (t.source === 'attendance' && pts !== t.default_points
      && !window.confirm(`Change "${t.name}" to ${pts} points? This updates the points of everyone already marked for this role, at every event.`)) return;
    try {
      await saveType({ id: t.id, category: t.category, name: d.name.trim(), default_points: pts, is_active: d.active });
      await load();
      await reload('attendance', 'leaderboard');
      toast.success('Saved.');
    } catch (err) { toast.error(errMsg(err)); }
  };
  const removeRow = async (t: ContributionType) => {
    if (!window.confirm(`Delete "${t.name}"? Types already used can only be hidden.`)) return;
    try { await deleteType(t.id); await load(); toast.success('Deleted.'); }
    catch (err) { toast.error(errMsg(err)); }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const pts = Number(adding.points);
    const category = adding.source === 'attendance' ? 'Events' : adding.category.trim();
    if (!category || !adding.name.trim()) { toast.error('Give the type a category and a name.'); return; }
    if (!Number.isInteger(pts) || pts < 0) { toast.error('Points must be a whole number, 0 or more.'); return; }
    const order = Math.max(0, ...(types ?? []).filter(t => t.category === category).map(t => t.sort_order)) + 5;
    try {
      await saveType({ category, name: adding.name.trim(), default_points: pts, source: adding.source, sort_order: order, is_active: true });
      setAdding(a => ({ ...a, name: '', points: '' }));
      await load();
      await reload('attendance');
      toast.success('Type added.');
    } catch (err) {
      const msg = errMsg(err);
      toast.error(/duplicate|unique/i.test(msg) ? 'That category already has a type with this name.' : msg);
    }
  };

  return (
    <section className="panel">
      <div className="list-head">
        <h3 className="ph">Contribution types and points</h3>
        <label className="chk"><input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} /> Show hidden types</label>
      </div>
      <p className="note-sm">
        Changing points applies to <b>new approvals</b>; contributions already approved keep their points.
        Attendance roles are different: their points are always the current value, so changing them updates everyone's totals.
      </p>
      {types === null ? <div className="muted">Loading…</div> : groups.map(([group, list]) => (
        <div key={group} style={{ marginTop: 18 }}>
          <div className="sec-lbl">{group}</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Name</th><th style={{ width: 110 }}>Points</th><th style={{ width: 120 }}>Shown</th><th style={{ width: 170 }} /></tr></thead>
              <tbody>
                {list.map(t => {
                  const d = draftOf(t);
                  return (
                    <tr key={t.id} className="adm-form" style={{ opacity: d.active ? 1 : .55 }}>
                      <td><input value={d.name} maxLength={120} onChange={e => edit(t, { name: e.target.value })} aria-label="Name" /></td>
                      <td><input value={d.points} inputMode="numeric" onChange={e => edit(t, { points: e.target.value.replace(/[^0-9]/g, '') })} aria-label="Points" /></td>
                      <td>
                        <label className="switch"><input type="checkbox" checked={d.active} onChange={e => edit(t, { active: e.target.checked })} />
                          <span className="track"><span className="knob" /></span><span>{d.active ? 'Yes' : 'Hidden'}</span></label>
                      </td>
                      <td className="acts">
                        {isDirty(t) && <><button className="mini-btn" onClick={() => saveRow(t)}>Save</button>{' '}
                          <button className="mini-btn" onClick={() => setDrafts(s => { const n = { ...s }; delete n[t.id]; return n; })}>Undo</button>{' '}</>}
                        <button className="mini-btn danger" onClick={() => removeRow(t)} aria-label={`Delete ${t.name}`}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <form className="subcard adm-form" onSubmit={add} style={{ marginTop: 22 }} autoComplete="off">
        <div className="sec-lbl">Add a type</div>
        <div className="form-acts" style={{ alignItems: 'flex-end' }}>
          <div className="fld" style={{ width: 170 }}>
            <label htmlFor="ntSource">Kind</label>
            <select id="ntSource" value={adding.source} onChange={e => setAdding(a => ({ ...a, source: e.target.value as 'submission' | 'attendance' }))}>
              <option value="submission">Members submit it</option>
              <option value="attendance">Event role (admins mark)</option>
            </select>
          </div>
          {adding.source === 'submission' && (
            <div className="fld" style={{ width: 200 }}>
              <label htmlFor="ntCat">Category</label>
              <input id="ntCat" list="ntCats" value={adding.category} onChange={e => setAdding(a => ({ ...a, category: e.target.value }))} placeholder="e.g. Design" />
              <datalist id="ntCats">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          )}
          <div className="fld" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="ntName">Name</label>
            <input id="ntName" maxLength={120} value={adding.name} onChange={e => setAdding(a => ({ ...a, name: e.target.value }))} placeholder="e.g. Sticker design" />
          </div>
          <div className="fld" style={{ width: 100 }}>
            <label htmlFor="ntPts">Points</label>
            <input id="ntPts" inputMode="numeric" value={adding.points} onChange={e => setAdding(a => ({ ...a, points: e.target.value.replace(/[^0-9]/g, '') }))} />
          </div>
          <button type="submit" className="primary">Add</button>
        </div>
      </form>
    </section>
  );
}
