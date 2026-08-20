import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarClock, ShieldAlert, Clock, AlertTriangle, CheckCircle2, XOctagon, Server } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRecruitmentWindow, formatCountdown } from '@/hooks/useRecruitmentWindow';
import { logAction } from '@/services/auditService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import HolographicCard from '@/components/ui/HolographicCard';
import CircuitBoardBackground from '@/components/ui/CircuitBoardBackground';
import LogoSpinner from '@/components/ui/LogoSpinner';

const SETTINGS_KEY = 'recruitment_status';

/** ISO-8601 -> the `yyyy-MM-ddTHH:mm` shape a datetime-local input expects, in local time. */
const toLocalInput = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return format(d, "yyyy-MM-dd'T'HH:mm");
};

/** datetime-local (local wall time, no zone) -> ISO-8601 UTC for storage. */
const fromLocalInput = (local: string): string | null => {
    if (!local) return null;
    const d = new Date(local);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
};

/**
 * date-fns format() throws on an invalid Date, which would blank the page — and the
 * inputs feed it half-typed values on every keystroke. Never render a stamp unguarded.
 */
const formatStamp = (value: string | null, fallback = 'Not scheduled'): string => {
    if (!value) return fallback;
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return 'Invalid date';
    return format(d, "d MMM yyyy, h:mm a");
};

const RecruitmentSchedule = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const {
        isOpen,
        manualOpen,
        opensAt,
        closesAt,
        message,
        loading: windowLoading,
        unavailable,
        serverNow,
        refresh,
    } = useRecruitmentWindow();

    // Draft state — the form is not bound to the live window, so an admin can stage
    // a change and still see what is currently in force above it.
    const [opensDraft, setOpensDraft] = useState('');
    const [closesDraft, setClosesDraft] = useState('');
    const [messageDraft, setMessageDraft] = useState('');
    const [masterSwitch, setMasterSwitch] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tick, setTick] = useState(0);

    const isSuperAdmin = user?.role === 'super_admin';

    // Seed the draft ONCE, when the live window first arrives. Not on every change:
    // the hook re-fetches by itself when the window flips, and re-seeding then would
    // wipe whatever a super admin was halfway through typing.
    const seeded = useRef(false);
    useEffect(() => {
        if (windowLoading || seeded.current) return;
        seeded.current = true;
        setOpensDraft(toLocalInput(opensAt));
        setClosesDraft(toLocalInput(closesAt));
        setMessageDraft(message);
        setMasterSwitch(manualOpen);
    }, [windowLoading, opensAt, closesAt, message, manualOpen]);

    // Drives the countdown. Server time, not device time.
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    const countdown = useMemo(() => {
        void tick; // re-evaluate every second
        const now = serverNow();

        if (!isOpen && opensAt) {
            const opens = new Date(opensAt).getTime();
            if (Number.isFinite(opens) && opens > now) {
                return { label: 'Opens in', value: formatCountdown(opens - now) };
            }
        }
        if (isOpen && closesAt) {
            const closes = new Date(closesAt).getTime();
            if (Number.isFinite(closes) && closes > now) {
                return { label: 'Closes in', value: formatCountdown(closes - now) };
            }
        }
        return null;
    }, [tick, isOpen, opensAt, closesAt, serverNow]);

    const applyPreset = (hours: number) => {
        const target = new Date(serverNow() + hours * 3600 * 1000);
        setClosesDraft(format(target, "yyyy-MM-dd'T'HH:mm"));
    };

    const handleSave = async () => {
        const nextOpensAt = fromLocalInput(opensDraft);
        const nextClosesAt = fromLocalInput(closesDraft);

        if (opensDraft && !nextOpensAt) {
            toast.error('Open time is not a valid date.');
            return;
        }
        if (closesDraft && !nextClosesAt) {
            toast.error('Close time is not a valid date.');
            return;
        }
        if (nextOpensAt && nextClosesAt && new Date(nextClosesAt) <= new Date(nextOpensAt)) {
            toast.error('The close time must be after the open time.');
            return;
        }
        if (nextClosesAt && new Date(nextClosesAt).getTime() <= serverNow()) {
            const proceed = window.confirm(
                'That close time is already in the past. Saving will shut the form immediately. Continue?'
            );
            if (!proceed) return;
        }

        setSaving(true);
        try {
            // Read-modify-write. The row also carries currentPhase (and anything a
            // future migration adds); a blind overwrite from this page's state would
            // silently drop them.
            const { data: current, error: readError } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', SETTINGS_KEY)
                .single();
            if (readError) throw readError;

            const merged = {
                ...(current?.value ?? {}),
                isOpen: masterSwitch,
                message: messageDraft,
                opensAt: nextOpensAt,
                closesAt: nextClosesAt,
            };

            const { error: writeError } = await supabase
                .from('app_settings')
                .update({ value: merged })
                .eq('key', SETTINGS_KEY);
            if (writeError) throw writeError;

            await logAction(user?.email || 'unknown', 'UPDATE_RECRUITMENT_WINDOW', undefined, {
                isOpen: masterSwitch,
                opensAt: nextOpensAt,
                closesAt: nextClosesAt,
            });

            await refresh();
            toast.success('Recruitment window updated.');
        } catch (err: unknown) {
            // Supabase rejects with a PostgrestError — a plain object, not an Error.
            const msg =
                typeof err === 'object' && err !== null && 'message' in err
                    ? String((err as { message: unknown }).message)
                    : 'Unknown error';
            if (msg.includes('super admin')) {
                // Raised by tr_guard_recruitment_schedule.
                toast.error('Rejected by the database: only a super admin may change the schedule.');
            } else {
                toast.error('Failed to save: ' + msg);
            }
            console.error('[RecruitmentSchedule] save failed', err);
        } finally {
            setSaving(false);
        }
    };

    const clearSchedule = () => {
        setOpensDraft('');
        setClosesDraft('');
    };

    if (authLoading || windowLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <LogoSpinner size="md" />
            </div>
        );
    }

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <HolographicCard className="max-w-md w-full text-center p-8 border-red-500/50">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
                    <p className="text-muted-foreground mb-6">
                        The recruitment schedule is restricted to super admins. The database enforces this
                        independently — changing it from another account will be rejected server-side.
                    </p>
                    <Button onClick={() => navigate('/admin')} variant="outline" className="w-full border-red-500/50 text-red-500 hover:bg-red-950/30">
                        Back to Dashboard
                    </Button>
                </HolographicCard>
            </div>
        );
    }

    const dirty =
        opensDraft !== toLocalInput(opensAt) ||
        closesDraft !== toLocalInput(closesAt) ||
        messageDraft !== message ||
        masterSwitch !== manualOpen;

    return (
        <div className="min-h-screen bg-black text-foreground relative overflow-hidden">
            <CircuitBoardBackground />

            <div className="relative z-10 p-6 md:p-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-4xl mx-auto space-y-8"
                >
                    <div>
                        <Link
                            to="/admin"
                            className="inline-flex items-center text-muted-foreground hover:text-primary transition-all px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-xs tracking-widest uppercase"
                        >
                            <ArrowLeft className="w-3 h-3 mr-2 transition-transform group-hover:-translate-x-1" />
                            Admin Dashboard
                        </Link>
                        <h1 className="text-3xl md:text-4xl font-heading font-bold mt-6 flex items-center gap-3">
                            <CalendarClock className="w-8 h-8 text-primary" />
                            Recruitment Schedule
                        </h1>
                        <p className="text-muted-foreground mt-2 max-w-2xl">
                            Set the instant applications open and close. Enforced by the database — the form,
                            the homepage buttons and the API all read the same verdict, so a closed window
                            cannot be worked around from the browser.
                        </p>
                    </div>

                    {/* ── Live state ─────────────────────────────────────── */}
                    <Card className={isOpen ? 'border-emerald-500/30' : 'border-red-500/30'}>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                {isOpen ? (
                                    <>
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        <span className="text-emerald-400">Applications are OPEN</span>
                                    </>
                                ) : (
                                    <>
                                        <XOctagon className="w-5 h-5 text-red-400" />
                                        <span className="text-red-400">Applications are CLOSED</span>
                                    </>
                                )}
                            </CardTitle>
                            <CardDescription>
                                {unavailable
                                    ? 'Could not reach the server — showing the fail-safe (closed) state.'
                                    : 'Live verdict from is_recruitment_open(), the same function the insert policy uses.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-3">
                            <div className="bg-muted/40 rounded-lg p-4 border">
                                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Opens</p>
                                <p className="font-medium">{formatStamp(opensAt)}</p>
                            </div>
                            <div className="bg-muted/40 rounded-lg p-4 border">
                                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Closes</p>
                                <p className="font-medium">{formatStamp(closesAt)}</p>
                            </div>
                            <div className="bg-muted/40 rounded-lg p-4 border">
                                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                                    {countdown ? countdown.label : 'Master switch'}
                                </p>
                                <p className="font-mono font-bold">
                                    {countdown ? countdown.value : manualOpen ? 'ON' : 'OFF (force closed)'}
                                </p>
                            </div>
                            <div className="sm:col-span-3 flex items-center gap-2 text-xs text-muted-foreground">
                                <Server className="w-3 h-3" />
                                Server time now: {format(new Date(serverNow()), "d MMM yyyy, h:mm:ss a")} — countdowns
                                use this, not your device clock.
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Editor ─────────────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary" />
                                Schedule
                            </CardTitle>
                            <CardDescription>
                                Times are in your local timezone and stored as UTC. Leave a field empty for
                                "no schedule" — the master switch alone then decides.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="opens-at">Open applications at</Label>
                                    <Input
                                        id="opens-at"
                                        type="datetime-local"
                                        value={opensDraft}
                                        onChange={(e) => setOpensDraft(e.target.value)}
                                        className="h-11 bg-background"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Before this instant the form stays shut even with the switch on.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="closes-at">Close applications at</Label>
                                    <Input
                                        id="closes-at"
                                        type="datetime-local"
                                        value={closesDraft}
                                        onChange={(e) => setClosesDraft(e.target.value)}
                                        className="h-11 bg-background"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Exclusive: at this exact minute submissions stop being accepted.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs uppercase tracking-wider text-muted-foreground mr-2">
                                    Close in
                                </span>
                                {[
                                    { label: '6 hours', hours: 6 },
                                    { label: '24 hours', hours: 24 },
                                    { label: '3 days', hours: 72 },
                                    { label: '7 days', hours: 168 },
                                ].map((preset) => (
                                    <Button
                                        key={preset.hours}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() => applyPreset(preset.hours)}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-full text-muted-foreground"
                                    onClick={clearSchedule}
                                >
                                    Clear schedule
                                </Button>
                            </div>

                            <div className="flex items-center justify-between bg-muted/40 border p-5 rounded-lg">
                                <div className="space-y-1 pr-4">
                                    <Label htmlFor="master-switch" className="text-base font-medium">
                                        Master switch
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Off means closed regardless of the schedule. The same switch as
                                        Settings → Recruitment Phase → Emergency Stop.
                                    </p>
                                </div>
                                <Switch
                                    id="master-switch"
                                    checked={masterSwitch}
                                    onCheckedChange={setMasterSwitch}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="closed-message">Message shown when closed</Label>
                                <Input
                                    id="closed-message"
                                    value={messageDraft}
                                    onChange={(e) => setMessageDraft(e.target.value)}
                                    placeholder="We are not accepting applications right now. Catch us next time!"
                                    className="h-11 bg-background"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Rendered on the closed screen at /apply. Blank falls back to the default copy.
                                </p>
                            </div>

                            {closesDraft && (
                                <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                    <p className="text-sm text-muted-foreground">
                                        At{' '}
                                        <span className="text-amber-300 font-medium">
                                            {formatStamp(closesDraft, '')}
                                        </span>{' '}
                                        the form stops accepting submissions and already-submitted applications
                                        become read-only. Interview slot booking keeps working.
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    disabled={!dirty || saving}
                                    onClick={() => {
                                        setOpensDraft(toLocalInput(opensAt));
                                        setClosesDraft(toLocalInput(closesAt));
                                        setMessageDraft(message);
                                        setMasterSwitch(manualOpen);
                                    }}
                                >
                                    Discard changes
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={!dirty || saving}
                                    className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 rounded-xl shadow-lg"
                                >
                                    {saving ? 'Saving…' : 'Save schedule'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};

export default RecruitmentSchedule;
