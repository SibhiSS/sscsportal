import type { MemberCalendarKind } from '@/types/club';

/** Labels and colours for what can be on the members' calendar. */
export const CAL_KINDS: Record<MemberCalendarKind, { label: string; dot: string; chip: string }> = {
  event:    { label: 'Club event',   dot: 'bg-primary',     chip: 'bg-primary/20 text-white border-primary/50' },
  holiday:  { label: 'Holiday',      dot: 'bg-emerald-400', chip: 'bg-emerald-400/10 text-emerald-200 border-emerald-400/30' },
  exam:     { label: 'Exam',         dot: 'bg-orange-400',  chip: 'bg-orange-400/10 text-orange-200 border-orange-400/30' },
  buffer:   { label: 'Exam prep',    dot: 'bg-yellow-300',  chip: 'bg-yellow-300/[0.06] text-yellow-100 border-yellow-300/40 border-dashed' },
  vacation: { label: 'Vacation',     dot: 'bg-sky-400',     chip: 'bg-sky-400/10 text-sky-200 border-sky-400/30' },
  noclass:  { label: 'No-class day', dot: 'bg-violet-400',  chip: 'bg-violet-400/10 text-violet-200 border-violet-400/30' },
  blocked:  { label: 'Blocked',      dot: 'bg-zinc-400',    chip: 'bg-white/5 text-zinc-300 border-white/15' },
};
export const CAL_KIND_ORDER: MemberCalendarKind[] = ['event', 'holiday', 'exam', 'buffer', 'vacation', 'noclass', 'blocked'];

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const isoDay = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
export const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const fmtDayRange = (s: string, e: string) => (s === e ? fmtDay(s) : `${fmtDay(s)} – ${fmtDay(e)}`);
