import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CAL_KINDS, CAL_KIND_ORDER, fmtDay, isoDay } from '@/lib/calendarKinds';
import type { MemberCalendarItem } from '@/types/club';

type Props = {
  items: MemberCalendarItem[];
  start: string;
  end: string;
  /** First click picks the start; a later click picks the end (or restarts). */
  onChange: (start: string, end: string) => void;
  /** Days before this can't be picked. */
  min: string;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A compact month view for picking dates, showing what's already on the calendar. */
export default function MiniCalendar({ items, start, end, onChange, min }: Props) {
  const anchor = start || min;
  const [cursor, setCursor] = useState({ y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 });
  const [hover, setHover] = useState<string | null>(null);
  const [pickingEnd, setPickingEnd] = useState(false);

  const { y, m } = cursor;
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const on = (d: string) => items.filter(it => it.start_date <= d && it.end_date >= d)
    .sort((a, b) => CAL_KIND_ORDER.indexOf(a.kind) - CAL_KIND_ORDER.indexOf(b.kind));

  const move = (dir: -1 | 1) => setCursor(({ y, m }) => {
    const d = new Date(y, m + dir, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const canGoBack = isoDay(y, m, 1) > min;

  const pick = (d: string) => {
    if (pickingEnd && start && d >= start) { onChange(start, d); setPickingEnd(false); }
    else { onChange(d, d); setPickingEnd(true); }
  };

  const shown = hover ?? start;
  const shownItems = useMemo(() => (shown ? on(shown) : []), [shown, items]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 md:p-4">
      <div className="flex items-center justify-between mb-2">
        <button type="button" className="p-1.5 rounded-full hover:bg-white/5 disabled:opacity-30" disabled={!canGoBack} onClick={() => move(-1)} aria-label="Previous month">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">{new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
        <button type="button" className="p-1.5 rounded-full hover:bg-white/5" onClick={() => move(1)} aria-label="Next month">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground mb-1">
        {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = isoDay(y, m, i + 1);
          const its = on(d);
          const past = d < min;
          const inRange = start && end && d >= start && d <= end;
          const edge = d === start || d === end;
          return (
            <button
              type="button"
              key={d}
              disabled={past}
              onClick={() => pick(d)}
              onMouseEnter={() => setHover(d)}
              className={`h-10 rounded-md text-xs flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-25 disabled:cursor-not-allowed
                ${edge ? 'bg-primary text-white' : inRange ? 'bg-primary/25 text-white' : 'hover:bg-white/10 text-foreground'}`}
              aria-label={`${fmtDay(d)}${its.length ? `: ${its.map(it => it.title).join(', ')}` : ''}`}
              aria-pressed={!!inRange}
            >
              <span>{i + 1}</span>
              <span className="flex gap-0.5 h-1.5">
                {its.slice(0, 3).map((it, k) => <span key={k} className={`w-1.5 h-1.5 rounded-full ${CAL_KINDS[it.kind]?.dot ?? 'bg-white'}`} />)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[44px] mt-3 text-xs">
        {shown ? (
          shownItems.length ? (
            <ul className="space-y-1">
              {shownItems.map((it, k) => (
                <li key={k} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-none ${CAL_KINDS[it.kind]?.dot ?? ''}`} />
                  <span className="text-muted-foreground">{fmtDay(shown)}:</span>
                  <span className="truncate">{CAL_KINDS[it.kind]?.label ?? it.kind} · {it.title}</span>
                </li>
              ))}
            </ul>
          ) : <span className="text-muted-foreground">{fmtDay(shown)}: nothing on the calendar.</span>
        ) : <span className="text-muted-foreground">Pick a start day, then an end day for multi-day events.</span>}
      </div>
    </div>
  );
}
