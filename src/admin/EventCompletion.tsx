import { useState } from 'react';
import { CheckCircle2, RotateCcw, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import type { ClubEvent } from '@/types/admin';
import { useAdminData } from './AdminData';
import { updateEvent } from './api';
import { fmtMed, todayIso } from './calendarLogic';
import { useIsSuperAdmin } from './SuperAdminOnly';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';

/**
 * "Event completed successfully". Until a super admin marks it, the event's
 * coordinators, volunteers and attendees are listed but earn no points.
 * `unlinked` counts coordinators not on the roster: they're credited once linked.
 */
export default function EventCompletion({ ev, credited, unlinked = 0 }: { ev: ClubEvent; credited: number; unlinked?: number }) {
  const { user } = useAuth();
  const isSuper = useIsSuperAdmin();
  const { patchEvent, reload } = useAdminData();
  const [busy, setBusy] = useState(false);
  const started = ev.start_date <= todayIso();
  const people = `${credited} ${credited === 1 ? 'person' : 'people'}`;
  const pendingNote = unlinked
    ? ` ${unlinked} coordinator${unlinked === 1 ? " isn't" : "s aren't"} on the roster yet and get${unlinked === 1 ? 's' : ''} points once linked.`
    : '';

  const set = async (done: boolean) => {
    const ask = done
      ? `Mark "${ev.title}" as completed successfully?\n\nThis credits points to the ${people} marked on it (coordinators, volunteers, attendees).${pendingNote}`
      : `Reopen "${ev.title}"?\n\nThe ${people} marked on it lose this event's points until it is completed again.`;
    if (!window.confirm(ask)) return;
    setBusy(true);
    try {
      patchEvent(await updateEvent(ev.id, done
        ? { completed_at: new Date().toISOString(), completed_by: user?.email ?? null }
        : { completed_at: null, completed_by: null }));
      await reload('leaderboard');
      toast.success(done ? `Completed. Points credited to ${people}.` : 'Event reopened; its points are withdrawn.');
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  if (ev.completed_at) {
    const legacy = ev.completed_by === 'already ended';
    return (
      <div className="ev-done ok">
        <CheckCircle2 size={22} />
        <div className="tx">
          <b>Completed successfully</b>
          <span>
            {legacy ? 'Counted as completed (it ended before this button existed)' : `On ${fmtMed(ev.completed_at.slice(0, 10))}`}
            {isSuper && !legacy && ev.completed_by ? ` by ${ev.completed_by}` : ''} · points credited to {people}{pendingNote}
          </span>
        </div>
        {isSuper && <button className="mini-btn" onClick={() => set(false)} disabled={busy}><RotateCcw size={13} /> Reopen</button>}
      </div>
    );
  }

  return (
    <div className="ev-done">
      <Trophy size={22} />
      <div className="tx">
        <b>Not completed yet</b>
        <span>
          {credited
            ? `${people} marked on this event will get their points once it's marked completed.${pendingNote}`
            : 'Mark coordinators, volunteers and attendees below; they get points once the event is completed.'}
        </span>
      </div>
      {isSuper ? (
        <button className="primary" onClick={() => set(true)} disabled={busy || !started} title={started ? undefined : 'Available once the event has started'}>
          {busy ? 'Saving…' : 'Event completed successfully'}
        </button>
      ) : <span className="asof">A super admin marks it completed</span>}
    </div>
  );
}
