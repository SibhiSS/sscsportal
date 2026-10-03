import { useCallback, useEffect, useMemo, useState } from 'react';
import { Folder, FolderPlus, HardDrive, Ticket, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import type { BucketUsage, DriveFile, DriveFolder } from '@/types/admin';
import { useAdminData } from '../AdminData';
import {
  createDriveFolder, deleteDriveFolder, DRIVE_BUCKET, DRIVE_QUOTA, fetchDriveFiles, fetchDriveFolders, fetchStorageUsage,
  fmtBytes, STORAGE_PLAN_BYTES,
} from '../api';
import { fmtShort } from '../calendarLogic';
import DriveFiles from '../DriveFiles';
import { useIsSuperAdmin } from '../SuperAdminOnly';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';

type Place = { kind: 'general' } | { kind: 'folder'; id: string } | { kind: 'event'; id: string };

const BUCKET_LABEL: Record<string, string> = {
  [DRIVE_BUCKET]: 'Drive',
  'event-files': 'Event checklist files',
  'contribution-proofs': 'Contribution proofs',
  'site-media': 'Website photos',
};

const Meter = ({ used, total, label }: { used: number; total: number; label: string }) => {
  const pct = Math.min(100, (used / total) * 100);
  return (
    <div className="drv-meter">
      <div className="drv-meter-top"><span>{label}</span><b>{fmtBytes(used)} of {fmtBytes(total)}</b></div>
      <div className={`prog${pct > 90 ? ' warn' : ''}`}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
};

export default function DrivePage() {
  const { user } = useAuth();
  const isSuper = useIsSuperAdmin();
  const { events } = useAdminData();
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [usage, setUsage] = useState<BucketUsage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<Place>({ kind: 'general' });
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const [fo, fi, us] = await Promise.all([fetchDriveFolders(), fetchDriveFiles(), fetchStorageUsage()]);
      setFolders(fo); setFiles(fi); setUsage(us); setError(null);
    } catch (err) { setError(errMsg(err)); setFiles([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const all = useMemo(() => files ?? [], [files]);
  const driveUsed = all.reduce((n, f) => n + f.size, 0);
  const totalUsed = usage.reduce((n, u) => n + u.bytes, 0);
  const eventTitle = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);

  const count = (p: Place) => all.filter(f => inPlace(f, p)).length;
  const eventsWithFiles = useMemo(() => {
    const ids = new Set(all.filter(f => f.event_id).map(f => f.event_id as string));
    return events.filter(e => ids.has(e.id)).sort((a, b) => b.start_date.localeCompare(a.start_date));
  }, [all, events]);
  const otherEvents = useMemo(
    () => events.filter(e => !eventsWithFiles.includes(e)).sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [events, eventsWithFiles],
  );

  const q = query.trim().toLowerCase();
  const shown = q ? all.filter(f => f.name.toLowerCase().includes(q)) : all.filter(f => inPlace(f, place));

  const where = place.kind === 'folder' ? { folder_id: place.id, event_id: null }
    : place.kind === 'event' ? { folder_id: null, event_id: place.id }
    : { folder_id: null, event_id: null };

  const title = place.kind === 'folder' ? folders.find(f => f.id === place.id)?.name ?? 'Folder'
    : place.kind === 'event' ? eventTitle.get(place.id)?.title ?? 'Event'
    : 'General';

  const locationOf = (f: DriveFile) => f.event_id ? `Event · ${eventTitle.get(f.event_id)?.title ?? '—'}`
    : f.folder_id ? folders.find(x => x.id === f.folder_id)?.name ?? 'Folder' : 'General';

  const newFolder = async () => {
    const name = window.prompt('New folder name (e.g. Sponsorship, Templates)')?.trim();
    if (!name || !user) return;
    try { const f = await createDriveFolder(name, user.email); await load(); setPlace({ kind: 'folder', id: f.id }); }
    catch (err) { toast.error(/duplicate|unique/i.test(errMsg(err)) ? 'A folder with that name already exists.' : errMsg(err)); }
  };

  const removeFolder = async (id: string) => {
    if (count({ kind: 'folder', id })) { toast.error('Move or delete the files in this folder first.'); return; }
    if (!window.confirm('Delete this empty folder?')) return;
    try { await deleteDriveFolder(id); setPlace({ kind: 'general' }); await load(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const isAt = (p: Place) => !q && p.kind === place.kind && (p.kind === 'general' || (place.kind !== 'general' && p.id === place.id));

  return (
    <>
      <div className="top">
        <div>
          <h1>Drive</h1>
          <div className="sub">Club documents for admins and super admins only. Up to 5 MB per file, {fmtBytes(DRIVE_QUOTA)} in total.</div>
        </div>
        <input className="drv-search" aria-label="Search all files" placeholder="Search all files" value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {error && (
        <section className="panel">
          <h3 className="ph">Couldn't load the drive</h3>
          <p className="muted">{error}</p>
          <p className="note-sm">If the drive is new, run supabase/migrations/20261003001600_admin_drive.sql in the Supabase SQL editor.</p>
        </section>
      )}

      <section className="panel drv-usage">
        <Meter used={driveUsed} total={DRIVE_QUOTA} label="Drive" />
        <Meter used={totalUsed} total={STORAGE_PLAN_BYTES} label="All Supabase storage (free plan)" />
        {usage.length > 0 && (
          <div className="chips">
            {usage.map(u => <span key={u.bucket_id} className="chip">{BUCKET_LABEL[u.bucket_id] ?? u.bucket_id}<b>{fmtBytes(u.bytes)}</b></span>)}
          </div>
        )}
      </section>

      <div className="drv-grid">
        <aside className="panel drv-side">
          <button className={`drv-place${isAt({ kind: 'general' }) ? ' on' : ''}`} onClick={() => { setQuery(''); setPlace({ kind: 'general' }); }}>
            <HardDrive size={15} /> <span>General</span> <small>{count({ kind: 'general' })}</small>
          </button>
          {folders.map(f => (
            <button key={f.id} className={`drv-place sub${isAt({ kind: 'folder', id: f.id }) ? ' on' : ''}`} onClick={() => { setQuery(''); setPlace({ kind: 'folder', id: f.id }); }}>
              <Folder size={15} /> <span>{f.name}</span> <small>{count({ kind: 'folder', id: f.id })}</small>
            </button>
          ))}
          <button className="drv-place add" onClick={newFolder}><FolderPlus size={15} /> <span>New folder</span></button>

          <div className="drv-side-label">Events</div>
          {eventsWithFiles.map(e => (
            <button key={e.id} className={`drv-place${isAt({ kind: 'event', id: e.id }) ? ' on' : ''}`} onClick={() => { setQuery(''); setPlace({ kind: 'event', id: e.id }); }}>
              <Ticket size={15} /> <span>{e.title}</span> <small>{count({ kind: 'event', id: e.id })}</small>
            </button>
          ))}
          <select aria-label="Open an event's folder" value="" onChange={e => { if (e.target.value) { setQuery(''); setPlace({ kind: 'event', id: e.target.value }); } }}>
            <option value="">{eventsWithFiles.length ? 'Another event…' : 'Open an event folder…'}</option>
            {otherEvents.map(e => <option key={e.id} value={e.id}>{e.title} · {fmtShort(e.start_date)}</option>)}
          </select>
        </aside>

        <section className="panel drv-main">
          <div className="list-head">
            <h3 className="ph">{q ? `Search: “${query.trim()}”` : title}</h3>
            {!q && place.kind === 'folder' && isSuper && (
              <button className="mini-btn danger" onClick={() => removeFolder(place.id)}><Trash2 size={13} /> Delete folder</button>
            )}
          </div>
          {files === null ? <div className="muted">Loading…</div> : (
            <DriveFiles
              files={shown}
              where={where}
              onChange={load}
              canUpload={!q && !error}
              locationOf={q ? locationOf : undefined}
              emptyText={q ? 'No files match.' : 'No files here yet. Upload or drop some.'}
            />
          )}
        </section>
      </div>
    </>
  );
}

function inPlace(f: DriveFile, p: Place) {
  if (p.kind === 'event') return f.event_id === p.id;
  if (p.kind === 'folder') return f.folder_id === p.id;
  return !f.event_id && !f.folder_id;
}
