import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ChevronDown, Eye, Pencil, Trash2, Download, Plus, ListChecks, Filter } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { HEAD_OF_ACCOUNT, fmtAmt } from './VoucherForm';
import VoucherView, { fmtISTDateTime, fmtVoucherDate } from './VoucherView';

export default function Register({ user, canEdit = true, refreshKey = 0, onEdit, onNew }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [head, setHead]       = useState('');
  const [range, setRange]     = useState({ from: '', to: '' });
  const [viewId, setViewId]   = useState(null);
  const [busyId, setBusyId]   = useState(null);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (head) qs.set('head', head);
      if (range.from) qs.set('from', range.from);
      if (range.to) qs.set('to', range.to);
      const res = await fetch(`${API_BASE_URL}/expenses/list/${user.institutionId}?${qs.toString()}`);
      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error('Register fetch error:', e);
      setRows([]);
    }
    setLoading(false);
  }, [user, head, range]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.voucher_no || '').toLowerCase().includes(q) ||
      (r.name_title || '').toLowerCase().includes(q) ||
      (r.head_of_account || '').toLowerCase().includes(q) ||
      (r.sub_head || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const total = useMemo(() => filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0), [filtered]);

  const del = async (id) => {
    if (!window.confirm('Delete this voucher? This cannot be undone.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/expenses/voucher/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not delete.'); }
      else await load();
    } finally { setBusyId(null); }
  };

  const downloadCsv = () => {
    const header = ['#', 'Voucher No', 'Date', 'Head of A/C', 'Sub Head', 'Name/Title', 'Transfer through', 'Amount'];
    const lines = [header, ...filtered.map((r, i) => [
      i + 1, r.voucher_no, fmtVoucherDate(r.voucher_date), r.head_of_account, r.sub_head || '',
      r.name_title || '', r.account_type || '', Number(r.total_amount || 0)
    ])];
    const csv = lines.map(row => row.map(c => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `daily-expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-zinc-50/50 p-3 rounded-md ring-1 ring-black/5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider self-center"><Filter className="size-3.5" /> Filters</span>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Head</span>
          <div className="relative">
            <select value={head} onChange={e => setHead(e.target.value)}
              className="h-8 appearance-none rounded border border-zinc-200 bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
              <option value="">All heads</option>
              {HEAD_OF_ACCOUNT.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <DateField label="From" value={range.from} onChange={v => setRange(r => ({ ...r, from: v }))} />
        <DateField label="To" value={range.to} onChange={v => setRange(r => ({ ...r, to: v }))} />
        <div className="flex flex-col gap-1 ml-auto">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Search</span>
          <div className="relative">
            <Search className="size-3.5 text-zinc-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Voucher, name, head…"
              className="h-8 w-52 rounded border border-zinc-200 bg-white pl-7 pr-2 text-xs text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40" />
          </div>
        </div>
        <button onClick={downloadCsv} disabled={!filtered.length}
          className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 h-8 rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50">
          <Download className="size-3.5" /> Download
        </button>
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <ListChecks className="size-4 text-primary" /> Voucher Register <span className="text-zinc-400 font-normal">({filtered.length})</span>
          </h3>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-zinc-500">Total: <strong className="text-zinc-900 tabular-nums">₹{fmtAmt(total)}</strong></span>
            {canEdit && (
              <button onClick={onNew} className="inline-flex items-center gap-1.5 bg-white text-primary ring-1 ring-primary/30 px-3 h-8 rounded-md text-xs font-medium hover:bg-primary/5">
                <Plus className="size-3.5" /> New Voucher
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['#', 'Voucher No', 'Date', 'Head of A/C', 'Name / Title', 'Through', 'Amount', 'Recorded By', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.length ? filtered.map((r, i) => (
                  <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-primary">{r.voucher_no}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">{fmtVoucherDate(r.voucher_date)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-700">{r.head_of_account}{r.sub_head ? <span className="text-zinc-400"> · {r.sub_head}</span> : ''}</td>
                    <td className="px-4 py-3 text-sm text-zinc-900">{r.name_title || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{r.account_type || '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900 tabular-nums whitespace-nowrap">₹{fmtAmt(r.total_amount)}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-zinc-700">{r.created_by_name || '—'}</div>
                      <div className="text-[10px] text-zinc-400 whitespace-nowrap">{fmtISTDateTime(r.created_at)}</div>
                      {r.updated_at && <div className="text-[10px] text-amber-600 whitespace-nowrap">edited · {r.updated_by_name || '—'}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewId(r.id)} title="View" className="p-1.5 text-zinc-400 hover:text-primary rounded"><Eye className="size-4" /></button>
                        {canEdit && <button onClick={() => onEdit(r.id)} title="Edit" className="p-1.5 text-zinc-400 hover:text-primary rounded"><Pencil className="size-4" /></button>}
                        {canEdit && <button onClick={() => del(r.id)} disabled={busyId === r.id} title="Delete" className="p-1.5 text-zinc-400 hover:text-accent rounded disabled:opacity-40"><Trash2 className="size-4" /></button>}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="9" className="px-4 py-10 text-center text-xs text-zinc-500 italic">No vouchers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewId && <VoucherView id={viewId} onClose={() => setViewId(null)} onEdit={canEdit ? (id) => { setViewId(null); onEdit(id); } : null} />}
    </div>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="h-8 rounded border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40" />
    </div>
  );
}