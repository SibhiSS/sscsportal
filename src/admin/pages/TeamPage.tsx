import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, User } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { fetchTeam, siteMediaUrl, teamTenures } from '@/lib/club';
import type { TeamMember, TeamSection } from '@/types/club';
import {
  addTeamMember, deleteTeamMember, removeSiteImages, reorderTeam, updateTeamMember, uploadTeamPhoto,
} from '../api';
import PhotoCropper from '../PhotoCropper';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';

const SECTIONS: { key: TeamSection; title: string; quoteLabel: string }[] = [
  { key: 'faculty', title: 'Faculty coordinators', quoteLabel: 'Description' },
  { key: 'core', title: 'Board', quoteLabel: 'Quote' },
  { key: 'lead', title: 'Leads', quoteLabel: 'Quote' },
];

/** "2026-27" → "2027-28" */
const nextTenure = (t: string) => {
  const y = Number(t.slice(0, 4)) + 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
};

type Draft = { id: string | null; section: TeamSection; name: string; role: string; quote: string; image: string | null };

const Face = ({ src }: { src: string | null }) => {
  const [bad, setBad] = useState(false);
  const url = siteMediaUrl(src);
  return (
    <span className="tm-face">
      {url && !bad ? <img src={url} alt="" onError={() => setBad(true)} /> : <User className="w-5 h-5" />}
    </span>
  );
};

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [extraTenures, setExtraTenures] = useState<string[]>([]);
  const [tenure, setTenure] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const load = () => fetchTeam().then(setTeam).catch(err => { toast.error(errMsg(err)); setTeam([]); });
  useEffect(() => { load(); }, []);

  const tenures = useMemo(
    () => [...new Set([...extraTenures, ...teamTenures(team ?? [])])].sort().reverse(),
    [team, extraTenures],
  );
  useEffect(() => { if (!tenure && tenures.length) setTenure(tenures[0]); }, [tenures, tenure]);

  const list = (section: TeamSection) =>
    (team ?? []).filter(m => m.section === section && (section === 'faculty' || m.tenure === tenure));

  const addTenure = () => {
    const suggested = tenures.length ? nextTenure(tenures[0]) : '2026-27';
    const t = window.prompt('New tenure (YYYY-YY)', suggested)?.trim();
    if (!t) return;
    if (!/^\d{4}-\d{2}$/.test(t)) { toast.error('Use the form 2027-28.'); return; }
    setExtraTenures(x => [...x, t]);
    setTenure(t);
  };

  const move = async (section: TeamSection, idx: number, dir: -1 | 1) => {
    const rows = list(section);
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const ids = rows.map(r => r.id);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    setBusy(true);
    try { await reorderTeam(ids); await load(); }
    catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  const remove = async (m: TeamMember) => {
    if (!window.confirm(`Remove ${m.name} (${m.role}) from the team page?`)) return;
    setBusy(true);
    try { await deleteTeamMember(m); await load(); toast.success(`${m.name} removed.`); }
    catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  // ---- editor ----
  const [draft, setDraft] = useState<Draft | null>(null);
  const [original, setOriginal] = useState<string | null>(null);   // image before this edit
  const [uploaded, setUploaded] = useState<string[]>([]);          // uploaded during this edit
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openEditor = (section: TeamSection, m?: TeamMember) => {
    setDraft(m
      ? { id: m.id, section, name: m.name, role: m.role, quote: m.quote ?? '', image: m.image }
      : { id: null, section, name: '', role: '', quote: '', image: null });
    setOriginal(m?.image ?? null);
    setUploaded([]);
  };
  const closeEditor = async (discard: boolean) => {
    if (discard) await removeSiteImages(uploaded);
    if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
    setDraft(null); setCropSrc(null); setUploaded([]);
  };

  const pickFile = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error(`${f.name} is not an image.`); return; }
    setCropSrc(URL.createObjectURL(f));
  };

  const applyCrop = async (blob: Blob) => {
    setSaving(true);
    try {
      const path = await uploadTeamPhoto(blob);
      setUploaded(u => [...u, path]);
      setDraft(d => d && { ...d, image: path });
      if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    } catch (err) { toast.error(errMsg(err)); }
    finally { setSaving(false); }
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!draft) return;
    const name = draft.name.trim(), role = draft.role.trim();
    if (!name || !role) { toast.error('Name and role are required.'); return; }
    if (draft.section !== 'faculty' && !tenure) { toast.error('Pick a tenure first.'); return; }
    setSaving(true);
    try {
      const fields = { name, role, quote: draft.quote.trim() || null, image: draft.image };
      if (draft.id) {
        await updateTeamMember(draft.id, fields);
      } else {
        await addTeamMember({
          ...fields,
          section: draft.section,
          tenure: draft.section === 'faculty' ? null : tenure,
          sort_order: list(draft.section).length,
        });
      }
      // Drop photos that ended up unused: the replaced original and any abandoned uploads.
      await removeSiteImages([original, ...uploaded].filter(p => p && p !== draft.image));
      await load();
      toast.success(draft.id ? 'Saved.' : `${name} added.`);
      setDraft(null); setUploaded([]);
    } catch (err) { toast.error(errMsg(err)); }
    finally { setSaving(false); }
  };

  const sectionMeta = SECTIONS.find(s => s.key === draft?.section);

  return (
    <>
      <div className="top">
        <div>
          <h1>Team</h1>
          <div className="sub">
            Who appears on the public Team page. Faculty coordinators show for every tenure; the board and leads
            belong to one tenure. The newest tenure is shown first on the site.
          </div>
        </div>
        <div className="form-acts">
          <select aria-label="Tenure" value={tenure} onChange={e => setTenure(e.target.value)}>
            {tenures.map(t => <option key={t} value={t}>AY {t}</option>)}
          </select>
          <button className="mini-btn" onClick={addTenure}>New tenure</button>
        </div>
      </div>

      {team === null ? <section className="panel muted">Loading…</section> : SECTIONS.map(s => {
        const rows = list(s.key);
        return (
          <section key={s.key} className="panel">
            <div className="list-head">
              <h3 className="ph">{s.title}{s.key !== 'faculty' && tenure ? ` · AY ${tenure}` : ''}</h3>
              <button className="add-btn" onClick={() => openEditor(s.key)} disabled={busy}>Add</button>
            </div>
            {rows.length ? (
              <ul className="tm-list">
                {rows.map((m, i) => (
                  <li key={m.id} className="tm-row">
                    <button className="tm-face-btn" onClick={() => openEditor(s.key, m)} aria-label={`Edit ${m.name}`}>
                      <Face src={m.image} />
                    </button>
                    <div className="tm-meta">
                      <b>{m.name}</b>
                      <span className="muted">{m.role}</span>
                      {m.quote && <span className="tm-quote">"{m.quote}"</span>}
                    </div>
                    <div className="acts">
                      <button className="mini-btn" aria-label="Move up" disabled={busy || i === 0} onClick={() => move(s.key, i, -1)}><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button className="mini-btn" aria-label="Move down" disabled={busy || i === rows.length - 1} onClick={() => move(s.key, i, 1)}><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button className="mini-btn" disabled={busy} onClick={() => openEditor(s.key, m)}>Edit</button>
                      <button className="mini-btn danger" disabled={busy} onClick={() => remove(m)}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <div className="muted">No one here yet.</div>}
          </section>
        );
      })}

      {draft && (
        <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget && !saving) closeEditor(true); }}>
          <div className="modal adm-form ws-modal" role="dialog" aria-modal="true" aria-labelledby="tmTitle">
            <div className="modal-head">
              <h3 id="tmTitle">
                {cropSrc ? 'Crop photo' : draft.id ? `Edit ${draft.name || 'member'}` : `Add to ${sectionMeta?.title.toLowerCase()}`}
              </h3>
              <button type="button" className="x" onClick={() => closeEditor(true)} aria-label="Close" disabled={saving}>×</button>
            </div>

            {cropSrc ? (
              <PhotoCropper src={cropSrc} busy={saving} onDone={applyCrop}
                onCancel={() => { if (cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc); setCropSrc(null); }} />
            ) : (
              <form onSubmit={save}>
                <div className="frow"><label>Photo</label>
                  <div className="ws-images">
                    <Face key={draft.image ?? 'none'} src={draft.image} />
                    <label className="mini-btn ws-pick">
                      {draft.image ? 'Replace' : 'Upload photo'}
                      <input type="file" accept="image/*" hidden onChange={e => { pickFile(e.target.files); e.target.value = ''; }} />
                    </label>
                    {draft.image && (
                      <>
                        <button type="button" className="mini-btn" onClick={() => setCropSrc(siteMediaUrl(draft.image))}>Re-crop</button>
                        <button type="button" className="mini-btn danger" onClick={() => setDraft(d => d && { ...d, image: null })}>Remove</button>
                      </>
                    )}
                  </div>
                </div>

                <div className="frow"><label htmlFor="tmName">Name</label>
                  <input id="tmName" required maxLength={80} value={draft.name}
                    onChange={e => setDraft(d => d && { ...d, name: e.target.value })} /></div>

                <div className="frow"><label htmlFor="tmRole">Role</label>
                  <input id="tmRole" required maxLength={80} value={draft.role}
                    placeholder={draft.section === 'lead' ? 'Technical Lead' : draft.section === 'core' ? 'Chairperson' : 'Faculty Coordinator'}
                    onChange={e => setDraft(d => d && { ...d, role: e.target.value })} /></div>

                <div className="frow"><label htmlFor="tmQuote">{sectionMeta?.quoteLabel}</label>
                  <textarea id="tmQuote" className="inp" rows={2} maxLength={200} value={draft.quote}
                    placeholder="Optional"
                    onChange={e => setDraft(d => d && { ...d, quote: e.target.value })} /></div>

                {draft.section !== 'faculty' && <div className="note-sm">Tenure: AY {tenure}</div>}

                <div className="modal-foot">
                  <button type="button" className="ghost" onClick={() => closeEditor(true)} disabled={saving}>Cancel</button>
                  <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : draft.id ? 'Save' : 'Add'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
