import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Award, CalendarCheck, Clock, ExternalLink, ImagePlus, LogIn, LogOut, Search, Send, Trash2,
  Trophy, UserX, X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import HolographicCard from '@/components/ui/HolographicCard';
import LogoSpinner from '@/components/ui/LogoSpinner';
import TechGridBackground from '@/components/ui/TechGridBackground';
import {
  ContributionWithRefs, fetchEventOptions, fetchLeaderboardRow, fetchMyAttendance,
  fetchMyContributions, fetchMyMember, fetchSubmissionTypes, friendlyError, prepareProofImage,
  removeProofImages, signProofImages, submitContribution, uploadProofImages, withdrawContribution,
} from '@/lib/club';
import { MAX_PROOF_IMAGES } from '@/types/club';
import type {
  ContributionStatus, ContributionType, EventOption, LeaderboardRow, MyAttendance, MyMember,
} from '@/types/club';

type PickedImage = { file: File; preview: string };


const NO_EVENT = 'none';

const STATUS_LABELS: Record<ContributionStatus, string> = {
  pending: 'Waiting for review',
  approved: 'Approved',
  rejected: 'Not approved',
};

type HistoryFilter = 'all' | ContributionStatus;

const STATUS_STYLES: Record<ContributionStatus, string> = {
  pending: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  approved: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  rejected: 'text-red-300 bg-red-500/10 border-red-500/30',
};

const formatDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-black text-foreground relative overflow-hidden">
    <TechGridBackground />
    <div className="relative z-10 px-4 py-8 md:p-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-8">
        {children}
      </motion.div>
    </div>
  </div>
);

const CenteredCard = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-black flex items-center justify-center p-4">
    <HolographicCard className="max-w-md w-full text-center p-8">{children}</HolographicCard>
  </div>
);

const Me = () => {
  const { user, loading: authLoading, error: authError, signInWithGoogle, logout } = useAuth();

  const [status, setStatus] = useState<'loading' | 'ready' | 'not-member' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [member, setMember] = useState<MyMember | null>(null);
  const [types, setTypes] = useState<ContributionType[]>([]);
  const [contributions, setContributions] = useState<ContributionWithRefs[]>([]);
  const [attendance, setAttendance] = useState<MyAttendance[]>([]);
  const [standing, setStanding] = useState<LeaderboardRow | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);

  const [typeId, setTypeId] = useState('');
  const [eventId, setEventId] = useState(NO_EVENT);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'log' | 'history'>('log');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  const load = useCallback(async () => {
    try {
      const me = await fetchMyMember();
      if (!me) {
        setStatus('not-member');
        return;
      }
      const [t, e, c, a, s] = await Promise.all([
        fetchSubmissionTypes(),
        fetchEventOptions(),
        fetchMyContributions(me.id),
        fetchMyAttendance(),
        fetchLeaderboardRow(me.id),
      ]);
      setMember(me);
      setTypes(t);
      setEvents(e);
      setContributions(c);
      setAttendance(a);
      setStanding(s);
      setStatus('ready');
    } catch (err) {
      setLoadError(friendlyError(err as { message?: string }));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Private images need short-lived signed links to display.
  useEffect(() => {
    const paths = contributions.flatMap(c => c.proof_images ?? []);
    if (!paths.length) return;
    signProofImages(paths).then(setImageUrls).catch(() => setImageUrls({}));
  }, [contributions]);

  // Preview object URLs are released when an image is removed, the form resets,
  // or the page unmounts (via the ref, so the cleanup sees the latest list).
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach(img => URL.revokeObjectURL(img.preview)), []);

  const eventTitles = useMemo(() => new Map(events.map(ev => [ev.id, ev.title])), [events]);

  const visibleContributions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contributions.filter(c =>
      (historyFilter === 'all' || c.status === historyFilter)
      && (!term || c.code?.toLowerCase().includes(term) || c.title.toLowerCase().includes(term)));
  }, [contributions, search, historyFilter]);

  const showHistory = (filter: HistoryFilter) => {
    setHistoryFilter(filter);
    setTab('history');
  };

  const typesByCategory = useMemo(() => {
    const groups = new Map<string, ContributionType[]>();
    for (const t of types) {
      groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
    }
    return [...groups.entries()];
  }, [types]);

  const selectedType = types.find(t => t.id === typeId);
  const pendingCount = contributions.filter(c => c.status === 'pending').length;
  const approvedCount = contributions.filter(c => c.status === 'approved').length;
  const canEarn = member?.member_status === 'active' && !member.is_lead;

  const resetForm = () => {
    setTypeId('');
    setEventId(NO_EVENT);
    setTitle('');
    setDescription('');
    setProofUrl('');
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
  };

  const handlePickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    const room = MAX_PROOF_IMAGES - images.length;
    if (picked.length > room) {
      toast.error(`You can attach up to ${MAX_PROOF_IMAGES} images.`);
    }
    const accepted = picked.slice(0, Math.max(room, 0)).filter(file => {
      if (file.type.startsWith('image/')) return true;
      toast.error(`${file.name} is not an image.`);
      return false;
    });
    if (accepted.length) {
      setImages(prev => [...prev, ...accepted.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
    }
  };

  const removePickedImage = (index: number) => {
    URL.revokeObjectURL(images[index].preview);
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    if (!typeId) return toast.error('Pick what kind of contribution this is.');
    if (!title.trim()) return toast.error('Give your contribution a short title.');
    if (proofUrl.trim() && !isHttpUrl(proofUrl.trim())) {
      return toast.error('The proof link must start with http:// or https://');
    }

    setSubmitting(true);
    let uploaded: string[] = [];
    try {
      const prepared = await Promise.all(images.map(img => prepareProofImage(img.file)));
      uploaded = await uploadProofImages(member.id, prepared);
      const code = await submitContribution({
        member_id: member.id,
        type_id: typeId,
        title: title.trim(),
        description: description.trim() || null,
        proof_url: proofUrl.trim() || null,
        proof_images: uploaded,
        event_id: eventId === NO_EVENT ? null : eventId,
      });
      uploaded = [];
      toast.success(`Submitted. Your code is ${code}.`, { description: 'An admin will review it. Track it under My submissions.' });
      resetForm();
      setContributions(await fetchMyContributions(member.id));
    } catch (err) {
      await removeProofImages(uploaded);
      toast.error(friendlyError(err as { message?: string }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (contribution: ContributionWithRefs) => {
    const { id } = contribution;
    if (!member || !window.confirm('Withdraw this submission?')) return;
    setWithdrawingId(id);
    try {
      await withdrawContribution(contribution);
      setContributions(prev => prev.filter(c => c.id !== id));
      toast.success('Submission withdrawn.');
    } catch (err) {
      toast.error(friendlyError(err as { message?: string }));
      setContributions(await fetchMyContributions(member.id));
    } finally {
      setWithdrawingId(null);
    }
  };

  if (authLoading || (user && status === 'loading')) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><LogoSpinner size="md" /></div>;
  }

  if (!user) {
    return (
      <CenteredCard>
        <Award className="w-14 h-14 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">My Contributions</h1>
        <p className="text-muted-foreground mb-6">Sign in with your VIT Google account to log your work and see your points.</p>
        {authError && <p className="text-sm text-red-400 mb-4">{authError}</p>}
        <div className="space-y-3">
          <Button onClick={signInWithGoogle} className="w-full">
            <LogIn className="w-4 h-4 mr-2" />
            Sign in with Google
          </Button>
          <Button asChild variant="outline" className="w-full"><Link to="/">Return Home</Link></Button>
        </div>
      </CenteredCard>
    );
  }

  if (status === 'not-member') {
    return (
      <CenteredCard>
        <UserX className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Not on the roster</h1>
        <p className="text-muted-foreground mb-6">
          {user.email} isn't on the club roster yet. Ask an admin to add you, then come back.
        </p>
        <div className="space-y-3">
          <Button asChild variant="outline" className="w-full"><Link to="/">Return Home</Link></Button>
          <Button onClick={logout} variant="ghost" className="w-full">Sign out</Button>
        </div>
      </CenteredCard>
    );
  }

  if (status === 'error') {
    return (
      <CenteredCard>
        <h1 className="text-2xl font-bold mb-2">Couldn't load your page</h1>
        <p className="text-muted-foreground mb-6">{loadError}</p>
        <Button onClick={() => { setStatus('loading'); load(); }} className="w-full">Try again</Button>
      </CenteredCard>
    );
  }

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-4">
          <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-xs tracking-widest uppercase">
            <ArrowLeft className="w-3 h-3 mr-2 transition-transform group-hover:-translate-x-1" />
            Home
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold font-heading tracking-tight break-words">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-primary to-primary/50">
                {member?.full_name}
              </span>
            </h1>
            <p className="text-muted-foreground mt-2">
              {[member?.member_position, member?.member_department].filter(Boolean).join(' · ') || 'Member'}
              {member?.is_lead && <span className="ml-2 text-xs font-bold uppercase tracking-widest text-primary">Lead</span>}
            </p>
          </div>
        </div>
        <Button onClick={logout} variant="outline" size="sm" className="h-9">
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign out
        </Button>
      </div>

      {/* Standing */}
      {canEarn ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Points', value: standing?.total_points ?? 0, icon: Award },
            { label: 'Rank', value: standing ? `#${standing.rank}` : '—', icon: Trophy },
            { label: 'Approved', value: approvedCount, icon: CalendarCheck, filter: 'approved' as const },
            { label: 'Pending', value: pendingCount, icon: Clock, filter: 'pending' as const },
          ].map(({ label, value, icon: Icon, filter }) => {
            const body = (
              <HolographicCard className={`p-5 h-full${filter ? ' transition-colors hover:border-primary/40' : ''}`}>
                <Icon className="w-4 h-4 text-primary mb-3" />
                <div className="text-3xl font-bold tabular-nums">{value}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
              </HolographicCard>
            );
            return filter ? (
              <button key={label} type="button" className="text-left" onClick={() => showHistory(filter)}
                aria-label={`Show ${label.toLowerCase()} submissions`}>{body}</button>
            ) : <div key={label}>{body}</div>;
          })}
        </div>
      ) : (
        <HolographicCard className="p-6 text-muted-foreground">
          {member?.is_lead
            ? "Leads don't earn points or appear on the leaderboard, so there's nothing to submit here."
            : 'Your membership is marked inactive, so you can’t submit new contributions. Your history is below.'}
        </HolographicCard>
      )}

      {/* Tabs: log something new, or look back at what was submitted */}
      {canEarn && (
        <div className="flex gap-2 border-b border-white/10" role="tablist">
          {([['log', 'Log a contribution'], ['history', `My submissions (${contributions.length})`]] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors ${tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Submit */}
      {canEarn && tab === 'log' && (
        <HolographicCard className="p-6 md:p-8">
          <h2 className="text-xl font-bold mb-1">Log a contribution</h2>
          <p className="text-sm text-muted-foreground mb-6">An admin reviews every submission before the points count.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="type">What did you do?</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger id="type"><SelectValue placeholder="Choose a contribution type" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {typesByCategory.map(([category, items]) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{category}</SelectLabel>
                      {items.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} · {t.default_points} pts
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <p className="text-xs text-muted-foreground">
                  Usually worth {selectedType.default_points} point{selectedType.default_points === 1 ? '' : 's'}. The reviewer may adjust it.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="event">Which event was this for? (optional)</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger id="event"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={NO_EVENT}>Not for a specific event</SelectItem>
                  {events.map(ev => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.title} · {formatDate(ev.start_date)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120}
                placeholder="e.g. Poster for Capture the Signal" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Details (optional)</Label>
              <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)}
                maxLength={1000} rows={3} placeholder="Anything the reviewer should know" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proof">Proof link (optional)</Label>
              <Input id="proof" type="url" value={proofUrl} onChange={e => setProofUrl(e.target.value)}
                placeholder="Drive, Instagram post, GitHub PR…" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="images">Proof images (optional, up to {MAX_PROOF_IMAGES})</Label>
              <div className="flex flex-wrap gap-3">
                {images.map((img, i) => (
                  <div key={img.preview} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10">
                    <img src={img.preview} alt={img.file.name} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePickedImage(i)} aria-label={`Remove ${img.file.name}`}
                      className="absolute top-1 right-1 rounded-full bg-black/70 p-1 hover:bg-black">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < MAX_PROOF_IMAGES && (
                  <label htmlFor="images"
                    className="w-24 h-24 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground cursor-pointer hover:border-primary/50 hover:text-foreground transition-colors">
                    <ImagePlus className="w-5 h-5" />
                    Add image
                  </label>
                )}
              </div>
              <input id="images" type="file" accept="image/*" multiple className="sr-only" onChange={handlePickImages} />
            </div>

            <Button type="submit" disabled={submitting} className="w-full md:w-auto">
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting…' : 'Submit for review'}
            </Button>
          </form>
        </HolographicCard>
      )}

      {/* History */}
      {(tab === 'history' || !canEarn) && (
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {(['all', 'pending', 'approved', 'rejected'] as HistoryFilter[]).map(f => {
              const n = f === 'all' ? contributions.length : contributions.filter(c => c.status === f).length;
              return (
                <button key={f} type="button" onClick={() => setHistoryFilter(f)} aria-pressed={historyFilter === f}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${historyFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-white/10 text-muted-foreground hover:text-foreground'}`}>
                  {f === 'all' ? 'All' : f === 'pending' ? 'Waiting' : STATUS_LABELS[f]} · {n}
                </button>
              );
            })}
          </div>
          {contributions.length > 0 && (
            <div className="relative sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code or title"
                aria-label="Search submissions" className="pl-9" />
            </div>
          )}
        </div>
        {contributions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing submitted yet.</p>
        ) : visibleContributions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {search.trim() ? <>No submission matches “{search}”.</> : 'Nothing here.'}
          </p>
        ) : (
          <div className="space-y-3">
            {visibleContributions.map(c => (
              <HolographicCard key={c.id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold break-words">
                      <span className="font-mono text-xs font-bold tracking-widest text-primary bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 mr-2 align-middle">
                        {c.code}
                      </span>
                      {c.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.contribution_types?.name}
                      {c.event_id && eventTitles.get(c.event_id) && <> · {eventTitles.get(c.event_id)}</>}
                      {' · '}{formatDate(c.created_at)}
                    </p>
                    {c.proof_url && (
                      <a href={c.proof_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-primary hover:underline">
                        Proof <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                    {c.proof_images?.length > 0 && (
                      <div className="flex gap-2 pt-1">
                        {c.proof_images.map(path => imageUrls[path] ? (
                          <a key={path} href={imageUrls[path]} target="_blank" rel="noopener noreferrer"
                            className="block w-14 h-14 rounded-lg overflow-hidden border border-white/10 hover:border-primary/50">
                            <img src={imageUrls[path]} alt="Proof" className="w-full h-full object-cover" />
                          </a>
                        ) : (
                          <div key={path} className="w-14 h-14 rounded-lg bg-white/5 border border-white/10" />
                        ))}
                      </div>
                    )}
                    {c.status === 'pending' && (
                      <p className="text-xs text-muted-foreground">Waiting for an admin to review it. You can withdraw it until then.</p>
                    )}
                    {c.status !== 'pending' && c.reviewed_at && (
                      <p className="text-xs text-muted-foreground">
                        {c.status === 'approved' ? 'Approved' : 'Reviewed'} on {formatDate(c.reviewed_at)}
                        {c.status === 'approved' && c.contribution_types && c.points_awarded !== c.contribution_types.default_points
                          && <> · usually {c.contribution_types.default_points} pts</>}
                      </p>
                    )}
                    {c.review_note && <p className="text-sm text-muted-foreground">Reviewer: {c.review_note}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.status === 'approved' && (
                      <span className="text-lg font-bold tabular-nums">+{c.points_awarded} pts</span>
                    )}
                    <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border whitespace-nowrap ${STATUS_STYLES[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                    {c.status === 'pending' && (
                      <Button variant="ghost" size="icon" aria-label="Withdraw submission"
                        disabled={withdrawingId === c.id} onClick={() => handleWithdraw(c)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </HolographicCard>
            ))}
          </div>
        )}
      </section>
      )}

      <section className="space-y-4 pb-8">
        <h2 className="text-xl font-bold">Events & club meets</h2>
        {attendance.length === 0 ? (
          <p className="text-muted-foreground text-sm">No attendance marked yet. Admins mark it after each event or club meet.</p>
        ) : (
          <div className="space-y-3">
            {attendance.map(a => (
              <HolographicCard key={a.id} className="p-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{a.event_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.role} · {formatDate(a.start_date)}
                  </p>
                </div>
                {!member?.is_lead && (
                  <span className="text-lg font-bold tabular-nums shrink-0">+{a.points}</span>
                )}
              </HolographicCard>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
};

export default Me;
