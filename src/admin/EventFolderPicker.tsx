import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FolderOpen, Search } from 'lucide-react';
import type { ClubEvent } from '@/types/admin';
import { fmtMed, todayIso } from './calendarLogic';

/** "2026-03-19" → "AY 2025-26" (the academic year runs July to June). */
const academicYear = (iso: string) => {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
  const start = m >= 7 ? y : y - 1;
  return `AY ${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

type Props = {
  events: ClubEvent[];
  /** Files per event id, shown as a count. */
  counts: Map<string, number>;
  onPick: (eventId: string) => void;
};

/** A searchable list of every event, grouped by academic year, for opening its drive folder. */
export default function EventFolderPicker({ events, counts, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const today = todayIso();

  useEffect(() => {
    if (!open) return;
    setTimeout(() => search.current?.focus(), 0);
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = events
      .filter(e => !needle || e.title.toLowerCase().includes(needle))
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
    const out: { year: string; items: ClubEvent[] }[] = [];
    for (const e of list) {
      const year = academicYear(e.start_date);
      if (out[out.length - 1]?.year !== year) out.push({ year, items: [] });
      out[out.length - 1].items.push(e);
    }
    return out;
  }, [events, q]);

  const pick = (id: string) => { onPick(id); setOpen(false); setQ(''); };

  return (
    <div className="efp" ref={ref}>
      <button type="button" className={`efp-btn${open ? ' on' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="listbox">
        <FolderOpen size={15} /> <span>Open an event folder</span> <ChevronDown size={15} className="chev" />
      </button>
      {open && (
        <div className="efp-pop">
          <label className="efp-search">
            <Search size={14} />
            <input ref={search} value={q} onChange={e => setQ(e.target.value)} placeholder="Search events" aria-label="Search events"
              onKeyDown={e => { if (e.key === 'Enter' && groups[0]?.items[0]) pick(groups[0].items[0].id); }} />
          </label>
          <div className="efp-list" role="listbox">
            {groups.length ? groups.map(g => (
              <div key={g.year}>
                <div className="efp-group">{g.year}</div>
                {g.items.map(e => {
                  const n = counts.get(e.id) ?? 0;
                  return (
                    <button key={e.id} type="button" role="option" aria-selected={false} className="efp-item" onClick={() => pick(e.id)}>
                      <span className="t">{e.title}</span>
                      <span className="m">
                        {e.end_date >= today && <span className="efp-tag up">Upcoming</span>}
                        {n > 0 && <span className="efp-tag">{n} file{n === 1 ? '' : 's'}</span>}
                        <span className="d">{fmtMed(e.start_date)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )) : <div className="efp-empty">No events match.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
