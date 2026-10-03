import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, LogIn, UserX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HolographicCard from '@/components/ui/HolographicCard';
import LogoSpinner from '@/components/ui/LogoSpinner';
import ScrambleText from '@/components/fx/ScrambleText';
import TechGridBackground from '@/components/ui/TechGridBackground';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMemberCalendar, fetchMyMember, friendlyError, todayIst } from '@/lib/club';
import { CAL_KINDS, CAL_KIND_ORDER, fmtDay, fmtDayRange, isoDay, pad2 } from '@/lib/calendarKinds';
import type { MemberCalendarItem } from '@/types/club';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const KINDS = CAL_KINDS, ORDER = CAL_KIND_ORDER, pad = pad2, iso = isoDay, fmt = fmtDay, fmtRange = fmtDayRange;

/** The academic term members plan around: October to April. From July on, that's this October to next April. */
function termMonths(today: string) {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)) - 1;
  const startYear = m >= 6 ? y : y - 1;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startYear, 9 + i, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen relative text-foreground bg-[#050505]">
    <TechGridBackground />
    <div className="container mx-auto px-4 md:px-6 py-12 relative z-10">
      <div className="max-w-6xl mx-auto">{children}</div>
    </div>
  </div>
);

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen relative bg-[#050505] flex items-center justify-center p-6">
    <TechGridBackground />
    <HolographicCard className="relative z-10 p-8 max-w-md w-full text-center">{children}</HolographicCard>
  </div>
);

const CalendarPage = () => {
  const { user, loading: authLoading, error: authError, signInWithGoogle, logout } = useAuth();
  const today = todayIst();
  const months = useMemo(() => termMonths(today), [today]);
  const first = months[0], last = months[months.length - 1];
  const from = iso(first.y, first.m, 1);
  const to = iso(last.y, last.m, new Date(last.y, last.m + 1, 0).getDate());

  const [status, setStatus] = useState<'loading' | 'ready' | 'not-member' | 'error'>('loading');
  const [error, setError] = useState('');
  const [items, setItems] = useState<MemberCalendarItem[]>([]);
  const [monthIdx, setMonthIdx] = useState(() => {
    const i = months.findIndex(x => iso(x.y, x.m, 1).slice(0, 7) === today.slice(0, 7));
    return i >= 0 ? i : 0;
  });
  const [picked, setPicked] = useState<string | null>(null);

  const load = async () => {
    try {
      const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
      if (!isAdmin && !(await fetchMyMember())) { setStatus('not-member'); return; }
      setItems(await fetchMemberCalendar(from, to));
      setStatus('ready');
    } catch (err) {
      setError(friendlyError(err as { message?: string; code?: string }));
      setStatus('error');
    }
  };

  useEffect(() => {
    if (user) { setStatus('loading'); load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, from, to]);

  const { y, m } = months[monthIdx];
  const monthKey = `${y}-${pad(m + 1)}`;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const monthStart = iso(y, m, 1), monthEnd = iso(y, m, daysInMonth);

  const inMonth = useMemo(
    () => items.filter(it => it.end_date >= monthStart && it.start_date <= monthEnd)
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)),
    [items, monthStart, monthEnd],
  );
  const on = (day: string) => inMonth.filter(it => it.start_date <= day && it.end_date >= day);
  const listed = picked ? on(picked) : inMonth;

  if (authLoading || (user && status === 'loading')) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><LogoSpinner size="md" /></div>;
  }

  if (!user) {
    return (
      <Centered>
        <CalendarDays className="w-14 h-14 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Club Calendar</h1>
        <p className="text-muted-foreground mb-6">Sign in with your VIT Google account to see the club's calendar for the term.</p>
        {authError && <p className="text-sm text-red-400 mb-4">{authError}</p>}
        <div className="space-y-3">
          <Button onClick={signInWithGoogle} className="w-full"><LogIn className="w-4 h-4 mr-2" /> Sign in with Google</Button>
          <Button asChild variant="outline" className="w-full"><Link to="/">Return Home</Link></Button>
        </div>
      </Centered>
    );
  }

  if (status === 'not-member') {
    return (
      <Centered>
        <UserX className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Members only</h1>
        <p className="text-muted-foreground mb-6">{user.email} isn't on the club roster, so the calendar isn't available.</p>
        <div className="space-y-3">
          <Button asChild variant="outline" className="w-full"><Link to="/">Return Home</Link></Button>
          <Button onClick={logout} variant="ghost" className="w-full">Sign out</Button>
        </div>
      </Centered>
    );
  }

  if (status === 'error') {
    return (
      <Centered>
        <h1 className="text-2xl font-bold mb-2">Couldn't load the calendar</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => { setStatus('loading'); load(); }} className="w-full">Try again</Button>
      </Centered>
    );
  }

  const monthLabel = new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <Shell>
      <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-10 px-6 py-1.5 rounded-full bg-white/5 border border-white/10 group text-sm">
        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" /> Back to Home
      </Link>

      <div className="text-center mb-10">
        <span className="text-[10px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">Members</span>
        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight mt-4"><ScrambleText text="Club Calendar" /></h1>
        <p className="text-sm text-muted-foreground mt-3">
          {fmt(from)} {first.y} – {fmt(to)} {last.y} · confirmed events, holidays, exams and breaks
        </p>
      </div>

      {/* Month tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {months.map((mo, i) => (
          <button
            key={i}
            onClick={() => { setMonthIdx(i); setPicked(null); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase transition-colors ${i === monthIdx ? 'bg-primary text-white' : 'bg-white/5 border border-white/10 text-muted-foreground hover:text-white'}`}
          >
            {new Date(mo.y, mo.m, 1).toLocaleDateString('en-IN', { month: 'short' })}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <HolographicCard className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <button className="p-2 rounded-full hover:bg-white/5 disabled:opacity-30" disabled={monthIdx === 0}
              onClick={() => { setMonthIdx(i => i - 1); setPicked(null); }} aria-label="Previous month">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="font-heading text-lg md:text-xl font-bold">{monthLabel}</h2>
            <button className="p-2 rounded-full hover:bg-white/5 disabled:opacity-30" disabled={monthIdx === months.length - 1}
              onClick={() => { setMonthIdx(i => i + 1); setPicked(null); }} aria-label="Next month">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] md:text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {WEEKDAYS.map(d => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => <div key={`x${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = iso(y, m, i + 1);
              const its = on(day);
              const isToday = day === today, isPicked = day === picked;
              return (
                <button
                  key={day}
                  onClick={() => setPicked(isPicked ? null : day)}
                  className={`min-h-[52px] md:min-h-[92px] rounded-lg border p-1 md:p-1.5 text-left flex flex-col gap-1 transition-colors
                    ${isPicked ? 'border-primary/70 bg-primary/10' : 'border-white/5 bg-white/[0.02] hover:border-white/20'}`}
                  aria-label={`${fmt(day)}: ${its.length ? its.map(it => it.title).join(', ') : 'nothing'}`}
                >
                  <span className={`text-[11px] md:text-xs font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {isToday ? <span className="px-1.5 rounded-full bg-primary text-white">{i + 1}</span> : i + 1}
                  </span>
                  {/* Phones: coloured dots. Larger screens: titles. */}
                  <span className="flex flex-wrap gap-0.5 md:hidden">
                    {its.slice(0, 4).map((it, k) => <span key={k} className={`w-1.5 h-1.5 rounded-full ${KINDS[it.kind]?.dot ?? 'bg-white'}`} />)}
                  </span>
                  <span className="hidden md:flex flex-col gap-0.5 min-w-0">
                    {its.slice(0, 3).map((it, k) => (
                      <span key={k} className={`truncate text-[10px] leading-tight px-1 py-0.5 rounded border ${KINDS[it.kind]?.chip ?? ''}`}>{it.title}</span>
                    ))}
                    {its.length > 3 && <span className="text-[10px] text-muted-foreground">+{its.length - 3} more</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-5 text-[11px] text-muted-foreground">
            {ORDER.map(k => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${KINDS[k].dot}`} />{KINDS[k].label}</span>
            ))}
          </div>
        </HolographicCard>

        <HolographicCard className="p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{picked ? fmt(picked) : monthLabel}</h3>
            {picked && <button className="text-xs text-primary hover:underline" onClick={() => setPicked(null)}>Whole month</button>}
          </div>
          {listed.length ? (
            <ul className="space-y-3">
              {listed.map((it, k) => (
                <li key={`${monthKey}-${k}`} className={`rounded-xl border p-3 ${KINDS[it.kind]?.chip ?? ''}`}>
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest opacity-80">
                    <span>{KINDS[it.kind]?.label ?? it.kind}</span>
                    <span>{fmtRange(it.start_date, it.end_date)}</span>
                  </div>
                  <p className="font-semibold text-sm mt-1 text-white">{it.title}</p>
                  {it.kind === 'event' && it.coordinators.length > 0 && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1.5">
                      <Users className="w-3.5 h-3.5 mt-0.5 flex-none" /> {it.coordinators.join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nothing on the calendar {picked ? 'that day' : 'this month'}.</p>}
        </HolographicCard>
      </div>
    </Shell>
  );
};

export default CalendarPage;
