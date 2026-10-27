import { useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { useAdminData } from './AdminData';
import { importBookings, saveSetting } from './api';
import { availabilityVenues, buildPrompt, parseImport } from './calendarLogic';
import { useIsSuperAdmin } from './SuperAdminOnly';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';

/** The AI prompt and the bulk paste import for VTOP bookings. Used on Venues and on the external users' import page. */
export default function BookingImport() {
  const { venues, settings, ourNames, reload } = useAdminData();
  // Only super admins may change the "our names" setting; external users see it but can't edit it.
  const canEditNames = useIsSuperAdmin();
  const activeVenues = availabilityVenues(venues);

  const [namesInput, setNamesInput] = useState(typeof settings.our_names === 'string' ? settings.our_names : '');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const prompt = buildPrompt(venues, ourNames);
  const saveNames = async () => {
    try { await saveSetting('our_names', namesInput.trim()); await reload('settings'); }
    catch (err) { toast.error(errMsg(err)); }
  };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopyMsg('Copied ✓'); }
    catch { setShowPrompt(true); setCopyMsg('Copy blocked — select the prompt below and copy it'); }
    setTimeout(() => setCopyMsg(''), 3000);
  };

  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const runImport = async () => {
    const { good, bad, notes } = parseImport(importText, venues, ourNames);
    if (bad.length) { setImportResult({ ok: false, lines: [`Nothing imported — fix these ${bad.length} line(s) first:`, ...bad] }); return; }
    if (!good.length) {
      setImportResult({ ok: false, lines: notes.length ? ['No importable rows. Unclear rows flagged:', ...notes] : ['No rows found.'] });
      return;
    }
    setImporting(true);
    try {
      const r = await importBookings(good);
      await reload('bookings', 'settings');
      setImportResult({
        ok: true,
        lines: [
          `Imported ${r.imported} booking(s) across ${r.venue_days} venue-day(s); replaced ${r.replaced} older booking(s) on those days.`,
          ...(notes.length ? [`Not imported — the AI flagged ${notes.length} unclear row(s). Check these on VTOP and add them by hand:`, ...notes] : []),
        ],
      });
      setImportText('');
    } catch (err) { setImportResult({ ok: false, lines: [errMsg(err)] }); }
    finally { setImporting(false); }
  };

  return (
    <div className="subcard">
      <div className="sec-lbl">From screenshots</div>
      <div className="prompt-box adm-form">
        <div className="note-sm">Copy this prompt, paste it into Claude or ChatGPT with your VTOP screenshots attached, then paste the rows it returns below.</div>
        {canEditNames ? (
          <div className="fld" style={{ marginBottom: 12 }}>
            <label htmlFor="ourNames">Names that mean our club booked it (comma-separated)</label>
            <input id="ourNames" value={namesInput} placeholder="Faculty coordinator's name as it appears on VTOP"
              onChange={e => setNamesInput(e.target.value)} onBlur={() => { if (namesInput.trim() !== (settings.our_names ?? '')) saveNames(); }} />
          </div>
        ) : ourNames.length > 0 && (
          <div className="note-sm">Bookings by {ourNames.join(', ')} are marked as booked by AI Club.</div>
        )}
        <div className="form-acts">
          <button type="button" className="primary" onClick={copyPrompt}>Copy AI prompt</button>
          <button type="button" className="ghost" onClick={() => setShowPrompt(s => !s)}>{showPrompt ? 'Hide prompt' : 'Show prompt'}</button>
          <span className="asof">{copyMsg}</span>
        </div>
        {showPrompt && <pre className="fmt prompt-pre">{prompt}</pre>}
      </div>
      <div className="sec-lbl">Bulk import (paste rows)</div>
      <div className="fmt">{`venue, date, from, to, event, booked by, phone, ours
MG, 2027-02-20, 09:00, 17:00, Robotics Expo, R KUMAR, 9876543210
Nethaji, 21.02.2027, 2:00 PM, 6:00 PM, Women Speaker Session, S DEVI, 9123456780, yes`}</div>
      <div className="note-sm">
        Venue: {activeVenues.map(v => v.short_name).join(', ')}. Last column <b>ours</b>: write <i>yes</i> if our club made the booking.
        For every venue + date in the paste, existing bookings on that day are <b>replaced</b>, so a fresh snapshot also clears cancellations.
      </div>
      <textarea className="inp mono-area" value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste rows here…" aria-label="Rows to import" />
      <div className="form-acts" style={{ marginTop: 10 }}>
        <button type="button" className="primary" onClick={runImport} disabled={importing || !importText.trim()}>{importing ? 'Importing…' : 'Import'}</button>
        <button type="button" className="ghost" onClick={() => { setImportText(''); setImportResult(null); }}>Clear</button>
      </div>
      {importResult && (
        <div className={`imp-result ${importResult.ok ? 'ok' : 'bad'}`}>
          {importResult.lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
