import { useRef, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Pencil, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import type { DriveFile } from '@/types/admin';
import {
  deleteDriveFile, driveDownloadUrl, DRIVE_ACCEPT, DRIVE_MAX_FILE, fmtBytes, updateDriveFile, uploadDriveFile,
} from './api';
import { fmtMed } from './calendarLogic';
import { useIsSuperAdmin } from './SuperAdminOnly';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';

type Props = {
  files: DriveFile[];
  where: { folder_id: string | null; event_id: string | null };
  /** Called after any upload, rename or delete so the parent can refresh. */
  onChange: () => void | Promise<void>;
  /** Show which folder each file is in (search results). */
  locationOf?: (f: DriveFile) => string;
  canUpload?: boolean;
  emptyText?: string;
};

/** A drive file list with drag-and-drop upload, download, rename and delete. */
export default function DriveFiles({ files, where, onChange, locationOf, canUpload = true, emptyText }: Props) {
  const { user } = useAuth();
  const isSuper = useIsSuperAdmin();
  const me = user?.email.trim().toLowerCase() ?? '';
  const [uploading, setUploading] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | File[] | null) => {
    const all = Array.from(list ?? []);
    if (!all.length || !user) return;
    // Photos get shrunk on upload, so only other big files are refused up front.
    const tooBig = all.filter(f => f.size > DRIVE_MAX_FILE && !/^image\/(jpeg|png|webp)$/.test(f.type));
    if (tooBig.length) toast.error(`Over 5 MB, skipped: ${tooBig.map(f => f.name).join(', ')}`);
    const ok = all.filter(f => !tooBig.includes(f));
    let done = 0;
    for (const f of ok) {
      setUploading(`${f.name} (${done + 1}/${ok.length})`);
      try { await uploadDriveFile(f, where, user.email); done++; }
      catch (err) { toast.error(`${f.name}: ${errMsg(err)}`); }
    }
    setUploading(null);
    if (done) { toast.success(`Uploaded ${done} file${done === 1 ? '' : 's'}.`); await onChange(); }
  };

  const download = async (f: DriveFile) => {
    try {
      // The signed link is sent with a download header, so following it saves the file without leaving the page.
      const a = document.createElement('a');
      a.href = await driveDownloadUrl(f);
      a.rel = 'noopener';
      a.click();
    }
    catch (err) { toast.error(errMsg(err)); }
  };

  const rename = async (f: DriveFile) => {
    const name = window.prompt('Rename file', f.name)?.trim();
    if (!name || name === f.name) return;
    try { await updateDriveFile(f.id, { name }); await onChange(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const remove = async (f: DriveFile) => {
    if (!window.confirm(`Delete "${f.name}"? This can't be undone.`)) return;
    try { await deleteDriveFile(f); await onChange(); toast.success('File deleted.'); }
    catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div
      className={`drv-zone${drag ? ' drag' : ''}`}
      onDragOver={e => { if (!canUpload) return; e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { if (!canUpload) return; e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
    >
      {canUpload && (
        <div className="drv-up">
          <button className="mini-btn" onClick={() => input.current?.click()} disabled={!!uploading}><Upload size={13} /> Upload files</button>
          <span className="note-sm">{uploading ? `Uploading ${uploading}…` : 'or drop them here · 5 MB max each · PDF, Office, CSV, images, ZIP'}</span>
          <input ref={input} type="file" multiple hidden accept={DRIVE_ACCEPT} onChange={e => { upload(e.target.files); e.target.value = ''; }} />
        </div>
      )}

      {files.length ? (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Name</th>{locationOf && <th className="hide-sm">Folder</th>}<th>Size</th><th className="hide-sm">Uploaded</th><th /></tr></thead>
            <tbody>
              {files.map(f => {
                const mine = f.uploaded_by.trim().toLowerCase() === me;
                const Icon = f.mime?.startsWith('image/') ? ImageIcon : FileText;
                return (
                  <tr key={f.id}>
                    <td>
                      <button className="drv-name" onClick={() => download(f)} title="Download">
                        <Icon size={15} /> <span>{f.name}</span>
                      </button>
                    </td>
                    {locationOf && <td className="hide-sm muted">{locationOf(f)}</td>}
                    <td className="d">{fmtBytes(f.size)}</td>
                    <td className="hide-sm muted">{isSuper ? `${f.uploaded_by.split('@')[0]} · ` : ''}{fmtMed(f.created_at.slice(0, 10))}</td>
                    <td className="acts">
                      <button className="mini-btn" onClick={() => download(f)} aria-label={`Download ${f.name}`}><Download size={13} /></button>
                      {(mine || isSuper) && <>
                        <button className="mini-btn" onClick={() => rename(f)} aria-label={`Rename ${f.name}`}><Pencil size={13} /></button>
                        <button className="mini-btn danger" onClick={() => remove(f)} aria-label={`Delete ${f.name}`}><Trash2 size={13} /></button>
                      </>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="muted drv-empty">{emptyText ?? 'No files here yet.'}</div>}
    </div>
  );
}
