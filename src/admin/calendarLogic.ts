// Pure helpers for the admin calendar, ported from club_calendar.html.
// Dates are "YYYY-MM-DD" strings in local time throughout.

import type { CalendarEntry, ClubEvent, Venue, VenueBooking } from '@/types/admin';

export const ENTRY_TYPES = {
  event: 'Club event',
  holiday: 'Holiday',
  blocked: 'Blocked',
  exam: 'Exam',
  buffer: 'Exam prep',
  noclass: 'No instructional day',
  vacation: 'Vacation',
} as const;
export type EntryType = keyof typeof ENTRY_TYPES;
export const NO_EVENT_TYPES: EntryType[] = ['holiday', 'vacation', 'blocked', 'exam', 'buffer', 'noclass'];
const PRIORITY: Record<EntryType, number> = { event: 0, holiday: 1, blocked: 2, exam: 3, noclass: 4, vacation: 5, buffer: 6 };

/** One thing on the calendar: a club event or a non-event entry, in one shape. */
export interface CalItem {
  key: string;
  kind: 'event' | 'entry';
  id: string;
  t: EntryType;
  s: string;
  e: string;
  title: string;
  venueId: string | null;
  online: boolean;
  note: string;
}

export const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
export const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const toDate = (iso: string) => new Date(iso + 'T00:00:00');
export const todayIso = () => { const n = new Date(); return isoDate(n.getFullYear(), n.getMonth(), n.getDate()); };
export const addDays = (iso: string, n: number) => { const d = toDate(iso); d.setDate(d.getDate() + n); return isoDate(d.getFullYear(), d.getMonth(), d.getDate()); };
export const fmtShort = (iso: string) => toDate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const fmtMed = (iso: string) => toDate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtLong = (iso: string) => toDate(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtRange = (s: string, e: string) => (s === e ? fmtShort(s) : `${fmtShort(s)} – ${fmtShort(e)}`);
export function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}
export function rangeDates(s: string, e: string): string[] {
  const out: string[] = [];
  for (let d = toDate(s); d <= toDate(e); d.setDate(d.getDate() + 1)) out.push(isoDate(d.getFullYear(), d.getMonth(), d.getDate()));
  return out;
}
export const dayCount = (s: string, e: string) => rangeDates(s, e).length;

export function toCalItems(events: ClubEvent[], entries: CalendarEntry[]): CalItem[] {
  return [
    ...events.map(ev => ({
      key: 'ev:' + ev.id, kind: 'event' as const, id: ev.id, t: 'event' as const, s: ev.start_date, e: ev.end_date,
      title: ev.title, venueId: ev.venue_id, online: ev.is_online, note: ev.description ?? '',
    })),
    ...entries.map(en => ({
      key: 'en:' + en.id, kind: 'entry' as const, id: en.id, t: en.entry_type, s: en.start_date, e: en.end_date,
      title: en.title, venueId: null, online: false, note: en.note ?? '',
    })),
  ];
}

/** Items per day, sorted the way the calendar file sorted them. */
export function indexByDate(items: CalItem[]): Map<string, CalItem[]> {
  const map = new Map<string, CalItem[]>();
  for (const it of items) for (const d of rangeDates(it.s, it.e)) {
    const list = map.get(d);
    if (list) list.push(it); else map.set(d, [it]);
  }
  for (const list of map.values()) list.sort((a, b) => PRIORITY[a.t] - PRIORITY[b.t]);
  return map;
}

export function indexBookings(bookings: VenueBooking[]): Map<string, VenueBooking[]> {
  const map = new Map<string, VenueBooking[]>();
  for (const b of bookings) {
    const k = b.venue_id + '|' + b.booking_date;
    const list = map.get(k);
    if (list) list.push(b); else map.set(k, [b]);
  }
  for (const list of map.values()) list.sort((a, b) => a.from_time.localeCompare(b.from_time));
  return map;
}

export type VenueState = 'free' | 'ours' | 'busy';
export function venueDay(map: Map<string, VenueBooking[]>, venueId: string, iso: string): { s: VenueState; bl: VenueBooking[] } {
  const bl = map.get(venueId + '|' + iso) ?? [];
  if (!bl.length) return { s: 'free', bl };
  return { s: bl.some(b => b.is_ours) ? 'ours' : 'busy', bl };
}

/** A venue's state across a date range: busy if another club holds it on any day. */
export function venueRange(map: Map<string, VenueBooking[]>, venueId: string, s: string, e: string) {
  const days = rangeDates(s, e).map(d => ({ d, ...venueDay(map, venueId, d) }));
  const othersOn = days.filter(x => x.s !== 'free' && !x.bl.every(b => b.is_ours));
  const oursOn = days.filter(x => x.bl.some(b => b.is_ours));
  const state: VenueState = othersOn.length ? 'busy' : oursOn.length ? 'ours' : 'free';
  return { state, othersOn, oursOn, days };
}

export const ourBookingsOn = (bookings: VenueBooking[], iso: string) => bookings.filter(b => b.is_ours && b.booking_date === iso);

export function venueName(venues: Venue[], id: string | null) {
  return (id && venues.find(v => v.id === id)?.name) || '';
}

/** Warnings for the add/edit form, same rules as the calendar file. */
export function formWarnings(opts: {
  s: string; e: string; type: EntryType; venueId: string; online: boolean; editingKey: string | null;
  venues: Venue[]; bookingMap: Map<string, VenueBooking[]>; byDate: Map<string, CalItem[]>;
}): { warn: string[]; ours: string[] } {
  const { s, e, type, venueId, online, editingKey, venues, bookingMap, byDate } = opts;
  const warn: string[] = [], ours: string[] = [];
  if (!s) return { warn, ours };
  if (e && e < s) return { warn: ['"To" is before "From".'], ours };
  const end = e || s;
  if (venueId && !online) {
    const r = venueRange(bookingMap, venueId, s, end);
    const name = venueName(venues, venueId);
    if (r.othersOn.length) warn.push(`${name} is booked by another club on ${r.othersOn.map(h => fmtShort(h.d)).join(', ')}.`);
    if (r.oursOn.length) ours.push(`★ Already booked by us on ${r.oursOn.map(h => fmtShort(h.d)).join(', ')}.`);
  }
  if (type === 'event') {
    const clashes = new Set<string>();
    for (const d of rangeDates(s, end)) for (const x of byDate.get(d) ?? []) {
      if (x.key !== editingKey && ['exam', 'buffer', 'holiday', 'vacation', 'noclass'].includes(x.t)) clashes.add(x.title);
    }
    if (clashes.size) warn.push(`Overlaps ${[...clashes].join(', ')}.`);
  }
  return { warn, ours };
}

// ---------------------------------------------------------------------------
// Bulk import (paste rows) and the VTOP screenshot prompt
// ---------------------------------------------------------------------------

const norm = (x: string) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');

export function venueAliases(venues: Venue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of venues) for (const k of [v.id, v.short_name, v.name]) map[norm(k)] = v.id;
  // Spellings seen on VTOP for the original six halls.
  const extra: Record<string, string> = {
    netaji: 'nethaji', netajiauditorium: 'nethaji', kasturbagandhi: 'kasturba', ab1miniconferenceroom: 'ab1',
    ab1mini: 'ab1', mgauditorium: 'mg', vocauditorium: 'voc',
  };
  for (const [k, id] of Object.entries(extra)) if (venues.some(v => v.id === id) && !map[k]) map[k] = id;
  return map;
}

export function parseDate(x: string): string | null {
  x = x.trim();
  let m: RegExpMatchArray | null, y: number, mo: number, d: number;
  if ((m = x.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = x.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/))) { y = +m[3]; mo = +m[2]; d = +m[1]; }
  else return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return isoDate(y, mo - 1, d);
}

export function parseTime(x: string): string | null {
  const m = x.trim().toUpperCase().match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = +m[1];
  const mi = +m[2];
  if (m[3]) { if (h === 12) h = 0; if (m[3] === 'PM') h += 12; }
  if (h > 23 || mi > 59) return null;
  return pad(h) + ':' + pad(mi);
}

export function splitRow(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map(c => c.trim());
  const out: string[] = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export interface ImportRow {
  venue_id: string; booking_date: string; from_time: string; to_time: string;
  event_name: string; booked_by: string; phone: string; is_ours: boolean;
}

/** Parses pasted rows. Any bad line rejects the whole paste, like the calendar file. */
export function parseImport(text: string, venues: Venue[], ourNames: string[]) {
  const aliases = venueAliases(venues);
  const good: ImportRow[] = [], bad: string[] = [], notes: string[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('```')) return;
    if (line.startsWith('#')) { notes.push(line.replace(/^#\s*/, '')); return; }
    const c = splitRow(line);
    if (i === 0 && /venue/i.test(c[0]) && /date/i.test(c[1] || '')) return;
    const v = aliases[norm(c[0] || '')] || null, d = parseDate(c[1] || ''), f = parseTime(c[2] || ''), t = parseTime(c[3] || '');
    const why: string[] = [];
    if (!v) why.push('venue'); if (!d) why.push('date'); if (!f) why.push('from'); if (!t) why.push('to');
    if (!(c[4] || '').trim()) why.push('event');
    if (f && t && t <= f) why.push('to is not after from');
    if (why.length) { bad.push(`Line ${i + 1}: bad ${why.join(', ')} — "${line.slice(0, 60)}"`); return; }
    const by = (c[5] || '').toUpperCase();
    good.push({
      venue_id: v!, booking_date: d!, from_time: f!, to_time: t!, event_name: c[4], booked_by: by,
      phone: (c[6] || '').replace(/\s/g, ''),
      is_ours: /^(y|yes|1|true|ours|us|sscs)$/i.test((c[7] || '').trim()) || (!!by && ourNames.includes(by)),
    });
  });
  return { good, bad, notes };
}

export function buildPrompt(venues: Venue[], ourNames: string[]) {
  const active = venues.filter(v => v.is_active);
  return `Extract venue bookings from the attached VTOP booking screenshots. Output ONLY the rows below, inside one code block, with no explanation before or after.

FORMAT — one booking per line, comma-separated, exactly 8 columns:
venue, date, from, to, event, booked by, phone, ours

RULES
1. venue: use ONLY one of these exact words: ${active.map(v => v.short_name).join(', ')}
${active.map(v => `   - ${v.short_name} = ${v.name}${v.notes ? ` (${v.notes})` : ''}`).join('\n')}
   Skip bookings for any other venue.
2. date: YYYY-MM-DD.
3. from / to: 24-hour HH:MM (e.g. 14:30).
4. event: the event title as shown. If it contains a comma, wrap it in double quotes. Shorten descriptions longer than 120 characters but keep the meaning.
5. booked by: the person's name in CAPITALS.
6. phone: digits only, no spaces.
7. ours: ${ourNames.length ? `write yes if "booked by" is one of: ${ourNames.join(', ')}. Otherwise leave it empty.` : 'leave it empty.'}
8. Do not guess. If any value in a row is unreadable or cut off, do NOT output that row as data. Instead put it at the end as a line starting with # and describe what is unclear, e.g.
   # UNCLEAR: MG, 2027-02-14 — end time cut off in screenshot 3
9. Output every booking visible in the screenshots, including ones that span several screenshots, but list each booking only once.
10. No header row, no numbering, no blank lines between rows.`;
}

// ---------------------------------------------------------------------------
// Event checklist
// ---------------------------------------------------------------------------

export interface ChecklistItem { key: string; label: string; done: boolean }

export function eventChecklist(ev: ClubEvent, coordinatorCount: number, hasOurBooking: boolean): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  if (!ev.is_online) {
    items.push({ key: 'venue', label: 'Venue chosen', done: !!ev.venue_id });
    items.push({ key: 'booked', label: 'Venue booked', done: ev.venue_booked || hasOurBooking });
  }
  items.push({ key: 'coordinators', label: 'Student coordinators', done: coordinatorCount > 0 });
  items.push({ key: 'poster', label: 'Poster', done: !!ev.poster_path });
  items.push({ key: 'details', label: 'Event details', done: !!ev.description?.trim() });
  items.push({ key: 'budget', label: 'Budget', done: ev.budget_planned !== null });
  items.push({ key: 'report', label: 'Event report', done: !!ev.report_path });
  items.push({ key: 'attendance', label: 'Attendance posted', done: ev.attendance_posted });
  if (!ev.is_online) items.push({ key: 'od', label: 'OD posted', done: ev.od_posted });
  return items;
}

/** Whether we hold a booking for the event's venue on any of its days. */
export function eventHasOurBooking(ev: ClubEvent, bookingMap: Map<string, VenueBooking[]>) {
  if (ev.is_online || !ev.venue_id) return false;
  return rangeDates(ev.start_date, ev.end_date).some(d => (bookingMap.get(ev.venue_id + '|' + d) ?? []).some(b => b.is_ours));
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '?';
