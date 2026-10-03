import { useMemo, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { byFeatureOrder, HOME_EVENT_SLOTS, siteMediaUrl, splitHomeEvents } from '@/lib/club';
import type { ClubEvent } from '@/types/admin';
import { useAdminData } from '../AdminData';
import { removeSiteImages, updateEvent, uploadSiteImage } from '../api';
import { fmtMed } from '../calendarLogic';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';
const MAX_GALLERY = 8;

type Draft = {
  blurb: string;
  details: string;   // one highlight per line
  tags: string;      // comma-separated
  link: string;
  cover: string | null;
  gallery: string[];
};

const toDraft = (e: ClubEvent): Draft => ({
  blurb: e.website_blurb ?? '',
  details: e.website_details.join('\n'),
  tags: e.website_tags.join(', '),
  link: e.website_link ?? '',
  cover: e.website_cover,
  gallery: [...e.website_gallery],
});

export default function WebsitePage() {
  const { events, reload } = useAdminData();
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlyPublished, setOnlyPublished] = useState(false);

  const newestFirst = useMemo(() => [...events].sort((a, b) => b.start_date.localeCompare(a.start_date)), [events]);
  const published = newestFirst.filter(e => e.website_published);
  const featureOrder = (e: ClubEvent) => e.website_feature_order;
  const spotlight = published.filter(e => e.website_featured).sort(byFeatureOrder(featureOrder));
  const featuredCount = spotlight.length;
  const { upNext, past } = splitHomeEvents(published, e => e.website_featured, undefined, featureOrder);
  const onHome = [...(upNext ? [upNext] : []), ...past];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return newestFirst.filter(e => (!onlyPublished || e.website_published) && (!q || e.title.toLowerCase().includes(q)));
  }, [newestFirst, onlyPublished, query]);

  const patch = async (e: ClubEvent, p: Partial<ClubEvent>, ok?: string) => {
    setBusy(e.id);
    try {
      await updateEvent(e.id, p);
      await reload('events');
      if (ok) toast.success(ok);
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(null); }
  };

  const togglePublished = (e: ClubEvent) =>
    e.website_published
      ? patch(e, { website_published: false, website_featured: false, website_feature_order: null }, `"${e.title}" is off the website.`)
      : patch(e, { website_published: true }, `"${e.title}" is on the website.`);

  const toggleFeatured = (e: ClubEvent) => {
    if (!e.website_featured && featuredCount >= HOME_EVENT_SLOTS) {
      toast.error(`Only ${HOME_EVENT_SLOTS} events can be featured. Unfeature one first.`);
      return;
    }
    const last = Math.max(-1, ...spotlight.map(x => x.website_feature_order ?? -1));
    patch(e, e.website_featured
      ? { website_featured: false, website_feature_order: null }
      : { website_featured: true, website_published: true, website_feature_order: last + 1 });
  };

  // Swap a spotlight event with its neighbour, then renumber the whole list 0..n-1.
  const moveSpotlight = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= spotlight.length) return;
    const list = [...spotlight];
    [list[idx], list[j]] = [list[j], list[idx]];
    setBusy(list[j].id);
    try {
      await Promise.all(list.map((e, i) => e.website_feature_order === i ? null : updateEvent(e.id, { website_feature_order: i })));
      await reload('events');
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(null); }
  };

  // ---- editor ----
  const [editing, setEditing] = useState<ClubEvent | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploaded, setUploaded] = useState<string[]>([]); // uploaded during this edit, removed again on cancel
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const openEditor = (e: ClubEvent) => { setEditing(e); setDraft(toDraft(e)); setUploaded([]); };
  const closeEditor = async (discard: boolean) => {
    if (discard) await removeSiteImages(uploaded);
    setEditing(null); setDraft(null); setUploaded([]);
  };

  const upload = async (files: FileList | null, kind: 'cover' | 'gallery') => {
    if (!files?.length || !editing || !draft) return;
    const list = kind === 'cover' ? [files[0]] : Array.from(files).slice(0, MAX_GALLERY - draft.gallery.length);
    if (!list.length) { toast.error(`A gallery holds up to ${MAX_GALLERY} photos.`); return; }
    setUploading(true);
    try {
      const paths: string[] = [];
      for (const f of list) paths.push(await uploadSiteImage(editing.id, f));
      setUploaded(u => [...u, ...paths]);
      setDraft(d => d && (kind === 'cover' ? { ...d, cover: paths[0] } : { ...d, gallery: [...d.gallery, ...paths] }));
    } catch (err) { toast.error(errMsg(err)); }
    finally { setUploading(false); }
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editing || !draft) return;
    const link = draft.link.trim();
    if (link && !/^https?:\/\//i.test(link)) { toast.error('The link should start with https://'); return; }
    setSaving(true);
    try {
      await updateEvent(editing.id, {
        website_blurb: draft.blurb.trim() || null,
        website_details: draft.details.split('\n').map(s => s.trim()).filter(Boolean),
        website_tags: draft.tags.split(',').map(s => s.trim()).filter(Boolean),
        website_link: link || null,
        website_cover: draft.cover,
        website_gallery: draft.gallery,
      });
      // Images that were on the event before and aren't any more.
      const kept = new Set([draft.cover, ...draft.gallery]);
      await removeSiteImages([editing.website_cover, ...editing.website_gallery].filter(r => r && !kept.has(r)));
      await reload('events');
      toast.success('Website details saved.');
      setEditing(null); setDraft(null); setUploaded([]);
    } catch (err) { toast.error(errMsg(err)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="top">
        <div>
          <h1>Website</h1>
          <div className="sub">
            Choose which events appear on the public site. The home page shows the next upcoming published event,
            then up to {HOME_EVENT_SLOTS} featured past events (or the latest {HOME_EVENT_SLOTS} when none are featured).
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="list-head">
          <h3 className="ph">On the home page now</h3>
          <span className="asof">{published.length} published · {featuredCount}/{HOME_EVENT_SLOTS} featured</span>
        </div>
        {onHome.length ? (
          <div className="ws-home">
            {onHome.map(e => {
              const cover = siteMediaUrl(e.website_cover);
              return (
                <button key={e.id} className="ws-card" onClick={() => openEditor(e)}>
                  <div className="ws-thumb">{cover ? <img src={cover} alt="" /> : <span className="muted">No cover</span>}</div>
                  <div className="ws-meta">
                    <b>{e.title}</b>
                    <span className="muted">
                      {e === upNext ? 'Up next · ' : ''}{fmtMed(e.start_date)}{e !== upNext && e.website_featured ? ' · Featured' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : <div className="muted">Nothing is published yet. Switch an event on below.</div>}
      </section>

      <section className="panel">
        <div className="list-head">
          <h3 className="ph">Spotlight order</h3>
          <span className="asof">Featured past events show on the home page in this order</span>
        </div>
        {spotlight.length ? (
          <ol className="ws-order">
            {spotlight.map((e, i) => (
              <li key={e.id}>
                <span className="ws-pos">{i + 1}</span>
                <div className="ws-meta"><b>{e.title}</b><span className="muted">{fmtMed(e.start_date)}</span></div>
                <div className="acts">
                  <button className="mini-btn" aria-label={`Move ${e.title} up`} disabled={!!busy || i === 0} onClick={() => moveSpotlight(i, -1)}><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button className="mini-btn" aria-label={`Move ${e.title} down`} disabled={!!busy || i === spotlight.length - 1} onClick={() => moveSpotlight(i, 1)}><ArrowDown className="w-3.5 h-3.5" /></button>
                </div>
              </li>
            ))}
          </ol>
        ) : <div className="muted">No featured events. Switch on "Featured" below to pick and order them; otherwise the latest {HOME_EVENT_SLOTS} are shown.</div>}
      </section>

      <section className="panel">
        <div className="list-head">
          <h3 className="ph">All events</h3>
          <div className="form-acts">
            <input aria-label="Search events" placeholder="Search events" value={query} onChange={e => setQuery(e.target.value)} />
            <label className="chk"><input type="checkbox" checked={onlyPublished} onChange={e => setOnlyPublished(e.target.checked)} /> Published only</label>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Event</th><th>Date</th><th>On website</th><th>Featured</th><th className="hide-sm">Details</th><th /></tr></thead>
            <tbody>
              {rows.length ? rows.map(e => {
                const missing = [!e.website_blurb && 'blurb', !e.website_cover && 'cover'].filter(Boolean);
                return (
                  <tr key={e.id}>
                    <td><b>{e.title}</b></td>
                    <td className="d">{fmtMed(e.start_date)}</td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={e.website_published} disabled={busy === e.id} onChange={() => togglePublished(e)} />
                        <span className="track"><span className="knob" /></span>
                      </label>
                    </td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={e.website_featured} disabled={busy === e.id} onChange={() => toggleFeatured(e)} />
                        <span className="track"><span className="knob" /></span>
                      </label>
                    </td>
                    <td className="hide-sm">
                      {missing.length
                        ? <span className="tag pending">No {missing.join(' or ')}</span>
                        : <span className="tag approved">Ready</span>}
                    </td>
                    <td className="acts"><button className="mini-btn" onClick={() => openEditor(e)}>Edit</button></td>
                  </tr>
                );
              }) : <tr><td colSpan={6} className="muted">No events match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editing && draft && (
        <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget && !uploading && !saving) closeEditor(true); }}>
          <form className="modal adm-form ws-modal" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="wsTitle">
            <div className="modal-head">
              <h3 id="wsTitle">{editing.title}</h3>
              <button type="button" className="x" onClick={() => closeEditor(true)} aria-label="Close">×</button>
            </div>

            <div className="frow"><label htmlFor="wsBlurb">Blurb</label>
              <textarea id="wsBlurb" className="inp" rows={3} maxLength={400} value={draft.blurb}
                placeholder="One or two sentences shown on the event card."
                onChange={e => setDraft(d => d && ({ ...d, blurb: e.target.value }))} /></div>

            <div className="frow"><label htmlFor="wsDetails">Highlights</label>
              <textarea id="wsDetails" className="inp" rows={4} value={draft.details}
                placeholder="One highlight per line. Shown when someone opens the event."
                onChange={e => setDraft(d => d && ({ ...d, details: e.target.value }))} /></div>

            <div className="frow"><label htmlFor="wsTags">Tags</label>
              <input id="wsTags" maxLength={200} value={draft.tags} placeholder="Workshop, Analog, Hands-on"
                onChange={e => setDraft(d => d && ({ ...d, tags: e.target.value }))} /></div>

            <div className="frow"><label htmlFor="wsLink">Link</label>
              <input id="wsLink" type="url" maxLength={500} value={draft.link} placeholder="https://www.linkedin.com/posts/…"
                onChange={e => setDraft(d => d && ({ ...d, link: e.target.value }))} /></div>

            <div className="frow"><label>Cover</label>
              <div className="ws-images">
                {draft.cover && (
                  <div className="ws-img">
                    <img src={siteMediaUrl(draft.cover) ?? ''} alt="Cover" />
                    <button type="button" className="ws-x" aria-label="Remove cover" onClick={() => setDraft(d => d && ({ ...d, cover: null }))}>×</button>
                  </div>
                )}
                <label className="mini-btn ws-pick">
                  {draft.cover ? 'Replace' : 'Upload cover'}
                  <input type="file" accept="image/*" hidden disabled={uploading} onChange={e => { upload(e.target.files, 'cover'); e.target.value = ''; }} />
                </label>
              </div>
            </div>

            <div className="frow"><label>Gallery</label>
              <div className="ws-images">
                {draft.gallery.map(g => (
                  <div key={g} className="ws-img">
                    <img src={siteMediaUrl(g) ?? ''} alt="" />
                    <button type="button" className="ws-x" aria-label="Remove photo" onClick={() => setDraft(d => d && ({ ...d, gallery: d.gallery.filter(x => x !== g) }))}>×</button>
                  </div>
                ))}
                {draft.gallery.length < MAX_GALLERY && (
                  <label className="mini-btn ws-pick">
                    Add photos
                    <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={e => { upload(e.target.files, 'gallery'); e.target.value = ''; }} />
                  </label>
                )}
              </div>
            </div>
            {uploading && <div className="note-sm">Uploading…</div>}

            <div className="modal-foot">
              <button type="button" className="ghost" onClick={() => closeEditor(true)} disabled={uploading || saving}>Cancel</button>
              <button type="submit" className="primary" disabled={uploading || saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
