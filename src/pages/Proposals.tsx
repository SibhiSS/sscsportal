import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Lightbulb, LogIn, UserX, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import HolographicCard from '@/components/ui/HolographicCard';
import LogoSpinner from '@/components/ui/LogoSpinner';
import ScrambleText from '@/components/fx/ScrambleText';
import TechGridBackground from '@/components/ui/TechGridBackground';
import MiniCalendar from '@/components/MiniCalendar';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchMemberCalendar, fetchMyMember, fetchMyProposals, fetchProposalVenues, friendlyError, submitProposal, todayIst,
  withdrawProposal,
} from '@/lib/club';
import { CAL_KINDS, fmtDayRange } from '@/lib/calendarKinds';
import type { EventProposal, MemberCalendarItem } from '@/types/club';

const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

const STATUS = {
  pending:  { label: 'Waiting for a decision', icon: Clock,        cls: 'text-yellow-200 border-yellow-300/30 bg-yellow-300/5' },
  accepted: { label: 'Accepted',               icon: CheckCircle2, cls: 'text-emerald-200 border-emerald-400/30 bg-emerald-400/5' },
  rejected: { label: 'Not taken up',           icon: XCircle,      cls: 'text-red-200 border-red-400/30 bg-red-400/5' },
} as const;

const inputCls = 'w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50';

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen relative bg-[#050505] flex items-center justify-center p-6">
    <TechGridBackground />
    <HolographicCard className="relative z-10 p-8 max-w-md w-full text-center">{children}</HolographicCard>
  </div>
);

const empty = { title: '', description: '', requirements: '', start: '', end: '', boardDecides: false, online: false, venueId: '' };

const Proposals = () => {
  const { user, loading: authLoading, error: authError, signInWithGoogle, logout } = useAuth();
  const today = todayIst();
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-member' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [calendar, setCalendar] = useState<MemberCalendarItem[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [mine, setMine] = useState<EventProposal[]>([]);
  const [form, setForm] = useState(empty);
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      if (!isAdmin && !(await fetchMyMember())) { setStatus('not-member'); return; }
      const [cal, vs, my] = await Promise.all([
        fetchMemberCalendar(today, addMonths(today, 12)),
        fetchProposalVenues(),
        fetchMyProposals(user.email),
      ]);
      setCalendar(cal); setVenues(vs); setMine(my);
      setStatus('ready');
    } catch (err) {
      setLoadError(friendlyError(err as { message?: string; code?: string }));
      setStatus('error');
    }
  };

  useEffect(() => {
    if (user) { setStatus('loading'); load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // Anything already on the chosen days, so people can steer clear of exams and other events.
  const clashes = useMemo(() => {
    if (form.boardDecides || !form.start) return [];
    const end = form.end || form.start;
    return calendar.filter(it => it.start_date <= end && it.end_date >= form.start);
  }, [calendar, form.start, form.end, form.boardDecides]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const title = form.title.trim(), description = form.description.trim();
    if (title.length < 3) { toast.error('Give the event a name.'); return; }
    if (description.length < 10) { toast.error('Describe the event in a sentence or two.'); return; }
    if (!form.boardDecides && !form.start) { toast.error('Pick the expected date on the calendar, or leave it to the board.'); return; }
    setSending(true);
    try {
      await submitProposal({
        title, description,
        requirements: form.requirements.trim() || null,
        expected_start: form.boardDecides ? null : form.start,
        expected_end: form.boardDecides ? null : form.end || form.start,
        is_online: form.online,
        venue_id: form.online ? null : form.venueId || null,
        proposer_email: user.email,
        proposer_name: user.displayName || null,
      });
      toast.success('Proposal sent. A super admin will review it.');
      setForm(empty);
      setMine(await fetchMyProposals(user.email));
    } catch (err) {
      toast.error(friendlyError(err as { message?: string; code?: string }));
    } finally { setSending(false); }
  };

  const withdraw = async (p: EventProposal) => {
    if (!window.confirm(`Withdraw your proposal "${p.title}"?`)) return;
    try { await withdrawProposal(p.id); setMine(m => m.filter(x => x.id !== p.id)); toast.success('Proposal withdrawn.'); }
    catch (err) { toast.error(friendlyError(err as { message?: string; code?: string })); }
  };

  if (authLoading || (user && status === 'loading')) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><LogoSpinner size="md" /></div>;
  }

  if (!user) {
    return (
      <Centered>
        <Lightbulb className="w-14 h-14 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Propose an Event</h1>
        <p className="text-muted-foreground mb-6">Sign in with your VIT Google account to propose an event to the club.</p>
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
        <p className="text-muted-foreground mb-6">{user.email} isn't on the club roster, so you can't propose events yet.</p>
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
        <h1 className="text-2xl font-bold mb-2">Couldn't load proposals</h1>
        <p className="text-muted-foreground mb-6">{loadError}</p>
        <Button onClick={() => { setStatus('loading'); load(); }} className="w-full">Try again</Button>
      </Centered>
    );
  }

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  return (
    <div className="min-h-screen relative text-foreground bg-[#050505]">
      <TechGridBackground />
      <div className="container mx-auto px-4 md:px-6 py-12 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-3 mb-10">
            <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors px-6 py-1.5 rounded-full bg-white/5 border border-white/10 group text-sm">
              <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" /> Back to Home
            </Link>
            {isAdmin && (
              <Link to="/admin/proposals" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors px-6 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm">
                All proposals (admin)
              </Link>
            )}
          </div>

          <div className="text-center mb-10">
            <span className="text-[10px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">Members & admins</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight mt-4"><ScrambleText text="Propose an Event" /></h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
              Have an idea? Tell us what it is, what it needs and when it could happen. A super admin reviews every proposal.
            </p>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
            <HolographicCard className="p-5 md:p-8">
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label htmlFor="pTitle" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Event name</label>
                  <input id="pTitle" className={inputCls} maxLength={120} value={form.title} placeholder="e.g. PCB Design Bootcamp"
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="pDesc" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">What is the event?</label>
                  <textarea id="pDesc" className={inputCls} rows={4} maxLength={4000} value={form.description}
                    placeholder="What happens, who it's for, the format (workshop, talk, contest…), rough schedule."
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="pReq" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Requirements <span className="normal-case tracking-normal font-normal">(optional)</span></label>
                  <textarea id="pReq" className={inputCls} rows={3} maxLength={2000} value={form.requirements}
                    placeholder="Equipment, components, speakers, budget estimate, volunteers, lab access…"
                    onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))} />
                </div>

                <div>
                  <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Expected date {!form.boardDecides && form.start && <span className="normal-case tracking-normal font-semibold text-foreground ml-1">· {fmtDayRange(form.start, form.end || form.start)}</span>}
                  </span>
                  <label className="flex items-start gap-3 mb-3 p-3 rounded-xl border border-white/10 bg-white/[0.02] cursor-pointer select-none hover:border-white/20 transition-colors">
                    <input type="checkbox" className="w-4 h-4 mt-0.5 accent-[hsl(var(--primary))]" checked={form.boardDecides}
                      onChange={e => setForm(f => ({ ...f, boardDecides: e.target.checked }))} />
                    <span className="text-sm">
                      Leave the date to the board
                      <span className="block text-xs text-muted-foreground mt-0.5">The board picks a slot that fits around exams and other events.</span>
                    </span>
                  </label>
                  {!form.boardDecides && (
                    <MiniCalendar items={calendar} start={form.start} end={form.end} min={today}
                      onChange={(s, e) => setForm(f => ({ ...f, start: s, end: e }))} />
                  )}
                  {clashes.length > 0 && (
                    <div className="mt-3 rounded-xl border border-yellow-300/30 bg-yellow-300/5 p-3 text-xs text-yellow-100">
                      <b>Already on these days:</b>{' '}
                      {clashes.map(c => `${CAL_KINDS[c.kind]?.label ?? c.kind}: ${c.title}`).join(' · ')}
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 accent-[hsl(var(--primary))]" checked={form.online}
                      onChange={e => setForm(f => ({ ...f, online: e.target.checked }))} />
                    Online event
                  </label>
                  {!form.online && (
                    <div>
                      <label htmlFor="pVenue" className="sr-only">Preferred venue</label>
                      <select id="pVenue" className={`${inputCls} [color-scheme:dark] [&>option]:bg-[#141416] [&>option]:text-white`} value={form.venueId} onChange={e => setForm(f => ({ ...f, venueId: e.target.value }))}>
                        <option value="">Preferred venue: no preference</option>
                        {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={sending}>{sending ? 'Sending…' : 'Send proposal'}</Button>
              </form>
            </HolographicCard>

            <HolographicCard className="p-5 md:p-6">
              <h2 className="font-semibold mb-4">Your proposals</h2>
              {mine.length ? (
                <ul className="space-y-3">
                  {mine.map(p => {
                    const st = STATUS[p.status];
                    return (
                      <li key={p.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <b className="text-sm">{p.title}</b>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{p.expected_start ? fmtDayRange(p.expected_start, p.expected_end ?? p.expected_start) : 'Board decides'}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full border text-[11px] ${st.cls}`}>
                          <st.icon className="w-3 h-3" /> {st.label}
                        </span>
                        {p.review_note && <p className="text-xs text-muted-foreground mt-2">“{p.review_note}”</p>}
                        {p.status === 'pending' && (
                          <button className="block text-xs text-muted-foreground hover:text-red-300 mt-2" onClick={() => withdraw(p)}>Withdraw</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-sm text-muted-foreground">You haven't proposed anything yet.</p>}
            </HolographicCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Proposals;
