import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DriveFile } from '@/types/admin';
import { fetchEventDriveFiles } from './api';
import DriveFiles from './DriveFiles';

/** The event's drive folder, on its checklist page. */
export default function EventDriveFiles({ eventId }: { eventId: string }) {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try { setFiles(await fetchEventDriveFiles(eventId)); setError(false); }
    catch { setError(true); setFiles([]); }
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="note-sm">The drive isn't set up yet (run the admin drive migration).</p>;
  if (files === null) return <div className="muted">Loading…</div>;
  return (
    <>
      <DriveFiles files={files} where={{ folder_id: null, event_id: eventId }} onChange={load}
        emptyText="No files yet: photos, permission letters, bills, certificates…" />
      <p className="note-sm" style={{ marginTop: 8, marginBottom: 0 }}>
        Also in the <Link className="linkbtn" to="/admin/drive">Drive</Link> under this event.
      </p>
    </>
  );
}
