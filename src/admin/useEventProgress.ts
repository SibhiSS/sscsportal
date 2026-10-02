import { useMemo } from 'react';
import { useAdminData } from './AdminData';
import { eventChecklist, eventHasOurBooking } from './calendarLogic';

/** Checklist progress for every event, keyed by event id. */
export function useEventProgress() {
  const { events, attendance, coordinatorTypeId, bookingMap } = useAdminData();
  return useMemo(() => new Map(events.map(ev => {
    const coords = attendance.filter(a => a.event_id === ev.id && a.type_id === coordinatorTypeId).length;
    const list = eventChecklist(ev, coords, eventHasOurBooking(ev, bookingMap));
    return [ev.id, { list, done: list.filter(i => i.done).length, total: list.length }];
  })), [events, attendance, coordinatorTypeId, bookingMap]);
}
