import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays, CheckSquare, LayoutDashboard, LogIn, LogOut, MapPin, Menu, Search, Settings, ShieldAlert, Ticket, Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import TechGridBackground from '@/components/ui/TechGridBackground';
import { AdminDataProvider, useAdminData } from './AdminData';
import { findContributionByCode } from './api';
import { fmtShort, initials } from './calendarLogic';
import './admin.css';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/events', label: 'Events', icon: Ticket },
  { to: '/admin/venues', label: 'Venues', icon: MapPin, superOnly: true },
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/approvals', label: 'Approvals', icon: CheckSquare },
];
const ACCOUNT_NAV = [
  { to: '/admin/settings', label: 'Settings', icon: Settings, superOnly: true },
];

/** Admin pages use the normal cursor and no noise overlay (both belong to the public site). */
function useAdminBodyClass() {
  useEffect(() => {
    document.body.classList.add('adm-body');
    return () => document.body.classList.remove('adm-body');
  }, []);
}

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading, error, signInWithGoogle, loginAsLocalAdmin, logout } = useAuth();
  if (loading) return <div className="adm center-card"><TechGridBackground /><div className="muted">Loading…</div></div>;
  if (!user) {
    return (
      <div className="adm center-card">
        <TechGridBackground />
        <div className="box">
          <img src="/logo.png" alt="" width={44} height={44} style={{ objectFit: 'contain' }} />
          <h1>Admin panel</h1>
          <p>Sign in with your VIT Google account.</p>
          {error && <p className="warn">{error}</p>}
          <div className="stack">
            <button className="primary" onClick={signInWithGoogle}><LogIn size={15} /> Sign in with Google</button>
            <Link className="ghost" to="/">Back to the site</Link>
            {import.meta.env.DEV && (
              <button className="ghost" onClick={loginAsLocalAdmin}>Bypass OAuth (local dev only)</button>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return (
      <div className="adm center-card">
        <TechGridBackground />
        <div className="box">
          <ShieldAlert size={40} color="var(--busy)" />
          <h1>No access</h1>
          <p>{user.email} isn't an admin. Ask a super admin to add you.</p>
          <div className="stack">
            <Link className="ghost" to="/">Back to the site</Link>
            <button className="ghost" onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Crumbs() {
  const { pathname } = useLocation();
  const { events, roster } = useAdminData();
  const parts = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
  const section = [...NAV, ...ACCOUNT_NAV].find(n => n.to === '/admin/' + (parts[0] ?? '')) ?? NAV[0];
  let last = '';
  if (parts[0] === 'events' && parts[1]) last = events.find(e => e.id === parts[1])?.title ?? 'Event';
  if (parts[0] === 'members' && parts[1]) last = roster.find(m => m.id === parts[1])?.full_name ?? 'Member';
  return (
    <div className="adm-crumbs">
      {last ? (
        <>
          <Link to={section.to}>{section.label}</Link>
          <span className="sep">/</span>
          <span className="last">{last}</span>
        </>
      ) : <span>{section.label}</span>}
    </div>
  );
}

type Hit = { kind: 'code' | 'member' | 'event'; label: string; sub?: string; go: () => void | Promise<void> };

function GlobalSearch() {
  const navigate = useNavigate();
  const { events, roster } = useAdminData();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Hit[] = [];
    if (/^[a-z0-9]{4}$/i.test(term)) {
      const code = term.toUpperCase();
      out.push({
        kind: 'code', label: `Find contribution ${code}`, go: async () => {
          const c = await findContributionByCode(code).catch(() => null);
          if (!c) { toast.error(`No contribution with code ${code}.`); return; }
          navigate(`/admin/members/${c.member_id}?c=${c.code}`);
        },
      });
    }
    for (const m of roster) {
      if ([m.full_name, m.email, m.roll_number ?? ''].some(x => x.toLowerCase().includes(term))) {
        out.push({ kind: 'member', label: m.full_name, sub: m.member_department ?? m.email, go: () => navigate(`/admin/members/${m.id}`) });
      }
    }
    for (const e of events) {
      if (e.title.toLowerCase().includes(term)) {
        out.push({ kind: 'event', label: e.title, sub: fmtShort(e.start_date), go: () => navigate(`/admin/events/${e.id}`) });
      }
    }
    return out.slice(0, 12);
  }, [q, roster, events, navigate]);

  const pick = async (h: Hit) => { setOpen(false); setQ(''); await h.go(); };

  return (
    <div className="adm-search" ref={box}>
      <Search />
      <input
        value={q}
        placeholder="Search members, events or a code like K7Q2"
        aria-label="Search"
        onChange={e => { setQ(e.target.value); setOpen(true); setCursor(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, hits.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
          if (e.key === 'Enter' && hits[cursor]) { e.preventDefault(); pick(hits[cursor]); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && q.trim() && (
        <div className="adm-search-results" role="listbox">
          {hits.length ? hits.map((h, i) => (
            <button key={h.kind + h.label + i} className={i === cursor ? 'on' : ''} onMouseEnter={() => setCursor(i)} onClick={() => pick(h)}>
              <span className="k">{h.kind}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{h.label}</span>
              {h.sub && <span className="muted" style={{ fontSize: 12 }}>{h.sub}</span>}
            </button>
          )) : <div className="empty">No matches.</div>}
        </div>
      )}
    </div>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const { loading, error, pendingCount } = useAdminData();
  const isSuper = user?.role === 'super_admin';
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className={`adm adm-app${navOpen ? ' nav-open' : ''}`}>
      <TechGridBackground />
      {navOpen && <div className="adm-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <aside className="adm-side">
        <Link to="/admin" className="adm-brand" style={{ textDecoration: 'none' }} aria-label="IEEE SSCS admin">
          <img src="/logo.png" alt="" />
          <div className="lbl">IEEE <span>SSCS</span></div>
        </Link>
        <div className="adm-nav-label">Menu</div>
        <nav className="adm-nav">
          {NAV.filter(n => isSuper || !n.superOnly).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} data-tip={label} aria-label={label} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ic"><Icon /></span><span className="lbl">{label}</span>
              {to === '/admin/approvals' && pendingCount > 0 && <span className="adm-badge" aria-label={`${pendingCount} waiting`}>{pendingCount}</span>}
            </NavLink>
          ))}
        </nav>
        {isSuper && (
          <>
            <div className="adm-nav-label">Account</div>
            <nav className="adm-nav">
              {ACCOUNT_NAV.filter(n => isSuper || !n.superOnly).map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} data-tip={label} aria-label={label} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <span className="ic"><Icon /></span><span className="lbl">{label}</span>
                </NavLink>
              ))}
            </nav>
          </>
        )}
        <div className="adm-side-foot">
          <div className="avatar" title={user?.displayName || user?.email || ''}>{initials(user?.displayName || user?.email || '')}</div>
          <div className="who lbl">
            <b>{user?.displayName || user?.email}</b>
            <span>{user?.role === 'super_admin' ? 'Super admin' : 'Admin'}</span>
          </div>
          <button className="circ" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={15} /></button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <button className="adm-menu-btn" onClick={() => setNavOpen(o => !o)} aria-label="Open menu"><Menu size={18} /></button>
          <Crumbs />
          <GlobalSearch />
        </header>
        <main className="adm-page">
          {loading ? <div className="muted">Loading club data…</div>
            : error ? (
              <div className="panel">
                <h3 className="ph">Couldn't load the admin data</h3>
                <p className="muted">{error}</p>
                <p className="note-sm">If this is a fresh setup, run the SQL files in supabase/migrations/ in the Supabase SQL editor, in filename order.</p>
              </div>
            ) : <Outlet />}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  useAdminBodyClass();
  return (
    <Gate>
      <AdminDataProvider>
        <Shell />
      </AdminDataProvider>
    </Gate>
  );
}
