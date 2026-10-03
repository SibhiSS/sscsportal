import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AttendanceRow, CalendarEntry, ClubEvent, RosterMember, Venue, VenueBooking } from '@/types/admin';
import type { ContributionType, EventProposal, LeaderboardRow } from '@/types/club';
import * as api from './api';
import { indexBookings, indexByDate, toCalItems, type CalItem } from './calendarLogic';

type Collection = 'venues' | 'bookings' | 'entries' | 'events' | 'settings' | 'roster' | 'attendance' | 'leaderboard' | 'pending' | 'proposals';

interface AdminDataValue {
  loading: boolean;
  error: string | null;
  venues: Venue[];
  bookings: VenueBooking[];
  entries: CalendarEntry[];
  events: ClubEvent[];
  settings: Record<string, unknown>;
  roster: RosterMember[];
  attendanceTypes: ContributionType[];
  attendance: AttendanceRow[];
  leaderboard: LeaderboardRow[];
  pendingCount: number;
  proposals: EventProposal[];
  // derived
  items: CalItem[];
  byDate: Map<string, CalItem[]>;
  bookingMap: Map<string, VenueBooking[]>;
  coordinatorTypeId: string | null;
  ourNames: string[];
  reload: (...which: Collection[]) => Promise<void>;
  /** Replace one event in place after a save, without a full reload. */
  patchEvent: (ev: ClubEvent) => void;
}

const Ctx = createContext<AdminDataValue | null>(null);

export const useAdminData = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdminData must be used inside AdminDataProvider');
  return v;
};

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [attendanceTypes, setAttendanceTypes] = useState<ContributionType[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [proposals, setProposals] = useState<EventProposal[]>([]);

  const loaders = useMemo<Record<Collection, () => Promise<void>>>(() => ({
    venues: async () => setVenues(await api.fetchVenues()),
    bookings: async () => setBookings(await api.fetchBookings()),
    entries: async () => setEntries(await api.fetchEntries()),
    events: async () => setEvents(await api.fetchEvents()),
    settings: async () => setSettings(await api.fetchSettings()),
    roster: async () => setRoster(await api.fetchRoster()),
    attendance: async () => {
      const [types, rows] = await Promise.all([api.fetchAttendanceTypes(), api.fetchAllAttendance()]);
      setAttendanceTypes(types);
      setAttendance(rows);
    },
    leaderboard: async () => setLeaderboard(await api.fetchLeaderboard()),
    pending: async () => setPendingCount(await api.countPendingContributions()),
    // Optional until the proposals migration has run, so it never blocks the panel.
    proposals: async () => setProposals(await api.fetchProposals().catch(err => {
      console.warn('[admin] Proposals unavailable:', err?.message);
      return [];
    })),
  }), []);

  const reload = useCallback(async (...which: Collection[]) => {
    const list = which.length ? which : (Object.keys(loaders) as Collection[]);
    await Promise.all(list.map(k => loaders[k]()));
  }, [loaders]);

  useEffect(() => {
    reload()
      .catch(err => setError(err?.message || 'Could not load admin data.'))
      .finally(() => setLoading(false));
  }, [reload]);

  const patchEvent = useCallback((ev: ClubEvent) => {
    setEvents(prev => prev.some(x => x.id === ev.id) ? prev.map(x => (x.id === ev.id ? ev : x)) : [...prev, ev]);
  }, []);

  const items = useMemo(() => toCalItems(events, entries), [events, entries]);
  const byDate = useMemo(() => indexByDate(items), [items]);
  const bookingMap = useMemo(() => indexBookings(bookings), [bookings]);
  const coordinatorTypeId = useMemo(
    () => attendanceTypes.find(t => /coordinator/i.test(t.name))?.id ?? null, [attendanceTypes]);
  const ourNames = useMemo(() => {
    const raw = settings.our_names;
    return (typeof raw === 'string' ? raw : '').split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
  }, [settings]);

  const value: AdminDataValue = {
    loading, error, venues, bookings, entries, events, settings, roster, attendanceTypes, attendance,
    leaderboard, pendingCount, proposals, items, byDate, bookingMap, coordinatorTypeId, ourNames, reload, patchEvent,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
