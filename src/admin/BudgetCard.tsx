import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Paperclip, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import type { BudgetItem, BudgetKind, BudgetStatus, ClubEvent, DriveFile } from '@/types/admin';
import {
  addBudgetItem, deleteBudgetItem, driveDownloadUrl, fetchBudgetItems, fetchEventDriveFiles, updateBudgetItem, uploadDriveFile,
} from './api';

const errMsg = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';
const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

const EXPENSE_CATEGORIES = ['Venue', 'Food & refreshments', 'Prizes', 'Printing & banners', 'Components & equipment',
  'Speaker / guest', 'Travel', 'Certificates & mementos', 'Marketing', 'Miscellaneous'];
const INCOME_CATEGORIES = ['IEEE / SSCS funding', 'College funding', 'Sponsorship', 'Registration fees', 'Other income'];
const STATUSES: Record<BudgetKind, { v: BudgetStatus; label: string }[]> = {
  expense: [{ v: 'planned', label: 'Planned' }, { v: 'paid', label: 'Paid' }, { v: 'reimbursed', label: 'Reimbursed' }],
  income: [{ v: 'planned', label: 'Expected' }, { v: 'received', label: 'Received' }],
};

type Props = { ev: ClubEvent; onTotals: () => void };

/** An itemised budget: expense and income lines, totals by category, receipts, CSV export. */
export default function BudgetCard({ ev, onTotals }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<BudgetItem[] | null>(null);
  const [files, setFiles] = useState<Map<string, DriveFile>>(new Map());
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rows, fs] = await Promise.all([fetchBudgetItems(ev.id), fetchEventDriveFiles(ev.id).catch((): DriveFile[] => [])]);
      setItems(rows); setFiles(new Map(fs.map(f => [f.id, f]))); setMissing(false);
    } catch { setMissing(true); setItems([]); }
  }, [ev.id]);
  useEffect(() => { load(); }, [load]);

  const expenses = (items ?? []).filter(i => i.kind === 'expense');
  const income = (items ?? []).filter(i => i.kind === 'income');
  const plannedSpend = expenses.reduce((n, i) => n + i.quantity * i.unit_cost, 0);
  const actualSpend = expenses.reduce((n, i) => n + (i.actual ?? 0), 0);
  const anyActual = expenses.some(i => i.actual !== null);
  const expectedIn = income.reduce((n, i) => n + i.quantity * i.unit_cost, 0);
  const receivedIn = income.reduce((n, i) => n + (i.actual ?? 0), 0);
  const balance = (receivedIn || expectedIn) - (anyActual ? actualSpend : plannedSpend);
  // Paid by a person (not the club) and not yet reimbursed.
  const unpaid = expenses.filter(i => i.status === 'paid' && i.paid_by && !/club|sscs|ieee/i.test(i.paid_by)).length;

  const byCategory = useMemo(() => {
    const m = new Map<string, { planned: number; actual: number }>();
    for (const i of expenses) {
      const c = m.get(i.category) ?? { planned: 0, actual: 0 };
      c.planned += i.quantity * i.unit_cost; c.actual += i.actual ?? 0;
      m.set(i.category, c);
    }
    return [...m.entries()].sort((a, b) => b[1].planned - a[1].planned);
  }, [expenses]);
  const maxCat = Math.max(1, ...byCategory.map(([, v]) => Math.max(v.planned, v.actual)));

  const add = async (kind: BudgetKind) => {
    try {
      const row = await addBudgetItem({
        event_id: ev.id, kind, category: kind === 'expense' ? 'Miscellaneous' : 'IEEE / SSCS funding',
        sort_order: (kind === 'expense' ? expenses : income).length, created_by: user?.email ?? null,
      });
      setItems(xs => [...(xs ?? []), row]);
      onTotals();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const save = async (id: string, p: Partial<BudgetItem>) => {
    try {
      const row = await updateBudgetItem(id, p);
      setItems(xs => (xs ?? []).map(x => (x.id === id ? row : x)));
      if ('quantity' in p || 'unit_cost' in p || 'actual' in p || 'kind' in p) onTotals();
    } catch (err) { toast.error(errMsg(err)); load(); }
  };

  const remove = async (i: BudgetItem) => {
    if (!window.confirm(`Remove "${i.item || i.category}" from the budget?`)) return;
    try { await deleteBudgetItem(i.id); setItems(xs => (xs ?? []).filter(x => x.id !== i.id)); onTotals(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const attach = async (i: BudgetItem, file: File | undefined) => {
    if (!file || !user) return;
    try {
      const f = await uploadDriveFile(file, { folder_id: null, event_id: ev.id }, user.email);
      setFiles(m => new Map(m).set(f.id, f));
      await save(i.id, { receipt_file_id: f.id });
      toast.success('Receipt attached (also in the event\'s files).');
    } catch (err) { toast.error(errMsg(err)); }
  };

  const openReceipt = async (id: string) => {
    const f = files.get(id);
    if (!f) { toast.error('That receipt is no longer in the drive.'); return; }
    try { const a = document.createElement('a'); a.href = await driveDownloadUrl(f); a.click(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Type', 'Category', 'Item', 'Quantity', 'Unit cost (INR)', 'Planned (INR)', 'Actual (INR)', 'Status', 'Paid by / from', 'Notes'];
    const rows = (items ?? []).map(i => [i.kind, i.category, i.item, i.quantity, i.unit_cost, (i.quantity * i.unit_cost).toFixed(2),
      i.actual ?? '', i.status, i.paid_by ?? '', i.notes ?? '']);
    rows.push([], ['', '', 'Total planned spend', '', '', plannedSpend.toFixed(2)], ['', '', 'Total actual spend', '', '', '', actualSpend.toFixed(2)],
      ['', '', 'Income (expected / received)', '', '', expectedIn.toFixed(2), receivedIn.toFixed(2)], ['', '', 'Balance', '', '', '', balance.toFixed(2)]);
    const csv = [head, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${ev.title.replace(/[^\w-]+/g, '_')}_budget.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (missing) return <p className="note-sm">Itemised budgets need the latest database migration (budgets, activity and completion).</p>;
  if (items === null) return <div className="muted">Loading budget…</div>;

  const legacy = !items.length && (ev.budget_planned !== null || ev.budget_actual !== null);

  return (
    <div className="bdg">
      <div className="bdg-tiles">
        <div><span>Planned spend</span><b>{inr(plannedSpend)}</b></div>
        <div className={anyActual && actualSpend > plannedSpend ? 'over' : ''}>
          <span>Actual spend</span><b>{anyActual ? inr(actualSpend) : '—'}</b>
          {anyActual && plannedSpend > 0 && <small>{Math.round((actualSpend / plannedSpend) * 100)}% of plan</small>}
        </div>
        <div><span>Income</span><b>{inr(receivedIn || expectedIn)}</b><small>{receivedIn ? 'received' : expectedIn ? 'expected' : 'none yet'}</small></div>
        <div className={balance < 0 ? 'over' : 'ok'}><span>Balance</span><b>{balance < 0 ? '−' : ''}{inr(Math.abs(balance))}</b>
          <small>{balance < 0 ? 'needs funding' : 'covered'}</small></div>
      </div>

      {legacy && (
        <p className="note-sm">
          Earlier totals: {ev.budget_planned !== null ? inr(Number(ev.budget_planned)) : '—'} planned, {ev.budget_actual !== null ? inr(Number(ev.budget_actual)) : '—'} spent.
          Adding lines below replaces them with the itemised totals.
        </p>
      )}
      {unpaid > 0 && <div className="warn">{unpaid} expense{unpaid === 1 ? '' : 's'} paid by someone personally and not yet marked reimbursed.</div>}

      {byCategory.length > 0 && (
        <div className="bdg-cats">
          {byCategory.map(([cat, v]) => (
            <div key={cat} className="bdg-cat">
              <span className="n">{cat}</span>
              <span className="bars">
                <i className="p" style={{ width: `${(v.planned / maxCat) * 100}%` }} />
                <i className={`a${v.actual > v.planned ? ' over' : ''}`} style={{ width: `${(v.actual / maxCat) * 100}%` }} />
              </span>
              <span className="v">{inr(v.planned)}{v.actual ? ` · ${inr(v.actual)}` : ''}</span>
            </div>
          ))}
          <div className="bdg-legend"><span><i className="p" /> Planned</span><span><i className="a" /> Actual</span></div>
        </div>
      )}

      <Lines title="Expenses" kind="expense" rows={expenses} files={files} onSave={save} onRemove={remove} onAttach={attach} onOpen={openReceipt} />
      <Lines title="Income" kind="income" rows={income} files={files} onSave={save} onRemove={remove} onAttach={attach} onOpen={openReceipt} />

      <div className="bdg-acts">
        <button className="mini-btn" onClick={() => add('expense')}><Plus size={13} /> Add expense</button>
        <button className="mini-btn" onClick={() => add('income')}><Plus size={13} /> Add income</button>
        {items.length > 0 && <button className="mini-btn" onClick={exportCsv}><Download size={13} /> Export CSV</button>}
      </div>
    </div>
  );
}

type LinesProps = {
  title: string;
  kind: BudgetKind;
  rows: BudgetItem[];
  files: Map<string, DriveFile>;
  onSave: (id: string, p: Partial<BudgetItem>) => void;
  onRemove: (i: BudgetItem) => void;
  onAttach: (i: BudgetItem, f: File | undefined) => void;
  onOpen: (fileId: string) => void;
};

function Lines({ title, kind, rows, files, onSave, onRemove, onAttach, onOpen }: LinesProps) {
  if (!rows.length) return null;
  const listId = `bdg-cat-${kind}`;
  return (
    <div className="bdg-lines">
      <h5>{title}</h5>
      <datalist id={listId}>{(kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(c => <option key={c} value={c} />)}</datalist>
      <div className="tbl-wrap">
        <table className="bdg-tbl adm-form">
          <thead>
            <tr>
              <th>Category</th><th>Item</th><th className="num">Qty</th><th className="num">Unit ₹</th>
              <th className="num">{kind === 'expense' ? 'Planned' : 'Expected'}</th>
              <th className="num">{kind === 'expense' ? 'Actual ₹' : 'Received ₹'}</th>
              <th>Status</th><th>{kind === 'expense' ? 'Paid by' : 'From'}</th><th>Receipt</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map(i => <Line key={i.id} i={i} listId={listId} file={i.receipt_file_id ? files.get(i.receipt_file_id) : undefined}
              onSave={onSave} onRemove={onRemove} onAttach={onAttach} onOpen={onOpen} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** One editable line; saves a field when you leave it, if it changed. */
function Line({ i, listId, file, onSave, onRemove, onAttach, onOpen }: {
  i: BudgetItem; listId: string; file?: DriveFile;
  onSave: LinesProps['onSave']; onRemove: LinesProps['onRemove']; onAttach: LinesProps['onAttach']; onOpen: LinesProps['onOpen'];
}) {
  const [d, setD] = useState({
    category: i.category, item: i.item, quantity: String(i.quantity), unit_cost: String(i.unit_cost),
    actual: i.actual === null ? '' : String(i.actual), paid_by: i.paid_by ?? '',
  });
  const pick = useRef<HTMLInputElement>(null);

  const commit = (field: keyof typeof d) => {
    const v = d[field].trim();
    if (field === 'quantity' || field === 'unit_cost' || field === 'actual') {
      const n = v === '' ? null : Number(v);
      if (n !== null && (!Number.isFinite(n) || n < 0 || (field === 'quantity' && n === 0))) {
        toast.error('Enter a positive number.'); setD(x => ({ ...x, [field]: String(i[field] ?? '') })); return;
      }
      if (field !== 'actual' && n === null) { setD(x => ({ ...x, [field]: String(i[field]) })); return; }
      if (n === (i[field] ?? null)) return;
      onSave(i.id, { [field]: n });
    } else {
      if (field === 'category' && !v) { setD(x => ({ ...x, category: i.category })); return; }
      const next = field === 'paid_by' ? (v || null) : v;
      if (next === (i[field] ?? (field === 'paid_by' ? null : ''))) return;
      onSave(i.id, { [field]: next });
    }
  };
  const bind = (field: keyof typeof d) => ({
    value: d[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setD(x => ({ ...x, [field]: e.target.value })),
    onBlur: () => commit(field),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); },
  });
  const planned = (Number(d.quantity) || 0) * (Number(d.unit_cost) || 0);

  return (
    <tr>
      <td><input list={listId} aria-label="Category" maxLength={60} {...bind('category')} /></td>
      <td><input aria-label="Item" maxLength={160} placeholder="What exactly" {...bind('item')} /></td>
      <td className="num"><input aria-label="Quantity" inputMode="decimal" className="n" {...bind('quantity')} /></td>
      <td className="num"><input aria-label="Unit cost" inputMode="decimal" className="n" {...bind('unit_cost')} /></td>
      <td className="num tnum">{inr(planned)}</td>
      <td className="num"><input aria-label="Actual amount" inputMode="decimal" className="n" placeholder="—" {...bind('actual')} /></td>
      <td>
        <select aria-label="Status" value={i.status} onChange={e => onSave(i.id, { status: e.target.value as BudgetStatus })}>
          {STATUSES[i.kind].map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
      </td>
      <td><input aria-label={i.kind === 'expense' ? 'Paid by' : 'From'} maxLength={80} placeholder={i.kind === 'expense' ? 'Club / name' : 'Source'} {...bind('paid_by')} /></td>
      <td>
        {i.receipt_file_id ? (
          <span className="bdg-rc">
            <button type="button" className="linkbtn" onClick={() => onOpen(i.receipt_file_id!)} title={file?.name}>
              <Paperclip size={12} /> {file ? 'View' : 'Missing'}
            </button>
            <button type="button" className="circ" aria-label="Detach receipt" onClick={() => onSave(i.id, { receipt_file_id: null })}><X size={12} /></button>
          </span>
        ) : (
          <>
            <button type="button" className="mini-btn" onClick={() => pick.current?.click()}><Paperclip size={12} /> Attach</button>
            <input ref={pick} type="file" hidden accept=".pdf,image/*" onChange={e => { onAttach(i, e.target.files?.[0]); e.target.value = ''; }} />
          </>
        )}
      </td>
      <td><button type="button" className="circ" aria-label="Remove line" onClick={() => onRemove(i)}><Trash2 size={13} /></button></td>
    </tr>
  );
}
