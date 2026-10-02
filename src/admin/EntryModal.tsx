import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { useAdminData } from './AdminData';
import { createEvent, saveEntry, updateEvent } from './api';
import { ENTRY_TYPES, formWarnings, type CalItem, type EntryType } from './calendarLogic';
import type { CalendarEntryType } from '@/types/admin';

interface Props {
  /** null = add. */
  editing: CalItem | null;
  defaultDate: string;
  /** Pre-select a type when adding (e.g. "event" from the Events page). */
  defaultType?: EntryType;
  onClose: () => void;
  onSaved: (startDate: string, eventId?: string) => void;
}

/** The calendar's add/edit form: title, type, dates, online toggle, venue, note, live warnings. */
export default function EntryModal({ editing, defaultDate, defaultType = 'event', onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { venues, bookingMap, byDate, patchEvent, reload } = useAdminData();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [type, setType] = useState<EntryType>(editing?.t ?? defaultType);
  const [from, setFrom] = useState(editing?.s ?? defaultDate);
  const [to, setTo] = useState(editing?.e ?? defaultDate);
  const [online, setOnline] = useState(editing?.online ?? false);
  const [venueId, setVenueId] = useState(editing?.venueId ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 30); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isEvent = type === 'event';
  const effOnline = isEvent && online;
  const { warn, ours } = useMemo(() => formWarnings({
    s: from, e: to, type, venueId: effOnline ? '' : venueId, online: effOnline, editingKey: editing?.key ?? null,
    venues, bookingMap, byDate,
  }), [from, to, type, venueId, effOnline, editing, venues, bookingMap, byDate]);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const t = title.trim();
    const end = to || from;
    if (!t || !from) return;
    if (end < from) { toast.error('"To" is before "From".'); return; }
    setSaving(true);
    try {
      if (isEvent) {
        const fields = {
          title: t, start_date: from, end_date: end, is_online: effOnline,
          venue_id: effOnline ? null : (venueId || null), description: note.trim() || null,
        };
        const saved = editing?.kind === 'event'
          ? await updateEvent(editing.id, fields)
          : await createEvent({ ...fields, created_by: user?.email ?? null });
        patchEvent(saved);
        onSaved(from, saved.id);
      } else {
        await saveEntry({
          entry_type: type as CalendarEntryType, title: t, start_date: from, end_date: end, note: note.trim() || null,
        }, editing?.kind === 'entry' ? editing.id : undefined);
        await reload('entries');
        onSaved(from);
      }
      toast.success(editing ? 'Saved.' : 'Added to the calendar.');
    } catch (err) {
      toast.error((err as { message?: string })?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal adm-form" role="dialog" aria-modal="true" aria-labelledby="entryTitle">
        <div className="modal-head">
          <h3 id="entryTitle">{editing ? 'Edit entry' : 'Add to calendar'}</h3>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={submit} autoComplete="off">
          <div className="frow"><label htmlFor="fTitle">Title</label>
            <input id="fTitle" ref={titleRef} required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chip Design Workshop" />
          </div>
          <div className="frow"><label htmlFor="fType">Type</label>
            <select id="fType" value={type} onChange={e => setType(e.target.value as EntryType)}>
              {Object.entries(ENTRY_TYPES).map(([k, v]) => (
                <option key={k} value={k}
                  // An event keeps its checklist and attendance, so it can't turn into a holiday and back.
                  disabled={!!editing && ((editing.kind === 'event') !== (k === 'event'))}>{v}</option>
              ))}
            </select>
          </div>
          <div className="frow"><label>Date</label>
            <div className="two">
              <input type="date" required aria-label="From" value={from}
                onChange={e => { setFrom(e.target.value); if (!to || to < e.target.value) setTo(e.target.value); }} />
              <input type="date" aria-label="To" value={to} min={from} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
          {isEvent && (
            <div className="frow"><label>Mode</label>
              <label className="switch amber">
                <input type="checkbox" checked={online} onChange={e => setOnline(e.target.checked)} />
                <span className="track"><span className="knob" /></span>
                <span>Online event <small className="muted">— no venue needed</small></span>
              </label>
            </div>
          )}
          {isEvent && (
            <div className="frow"><label htmlFor="fVenue">Venue</label>
              <select id="fVenue" value={effOnline ? '' : venueId} disabled={effOnline} onChange={e => setVenueId(e.target.value)}>
                <option value="">Not decided</option>
                {venues.filter(v => v.is_active || v.id === venueId).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          <div className="frow top"><label htmlFor="fNote">{isEvent ? 'Details' : 'Note'}</label>
            <textarea id="fNote" maxLength={isEvent ? 4000 : 300} value={note} onChange={e => setNote(e.target.value)} placeholder="Add note" />
          </div>
          {(warn.length > 0 || ours.length > 0) && (
            <div className="form-warn">
              {warn.map(w => <div key={w} className="warn">{w}</div>)}
              {ours.map(w => <div key={w} className="note-ok">{w}</div>)}
            </div>
          )}
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
