import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ReceiptText, GraduationCap, ChevronDown, Check, X, Eye, Filter, Download } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { downloadDataUrl, downloadReceipt } from './paymentProof';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

const fmtDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  // Stored UTC, shown in IST with time.
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(d);
};

const STATUS_STYLE = {
  paid:     'bg-green-50 text-green-700 ring-green-600/20',
  pending:  'bg-amber-50 text-amber-700 ring-amber-600/20',
  rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  failed:   'bg-zinc-100 text-zinc-500 ring-zinc-300'
};

export default function Payments({ data, user, canEdit = true }) {
  const classes = data.classes || [];
  const [filters, setFilters] = useState({ status: 'pending', class_id: '', from: '', to: '' });
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);
  const [proof, setProof]     = useState({ open: false, row: null, loading: false, img: null });

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.status)   qs.set('status', filters.status);
      if (filters.class_id) qs.set('class_id', filters.class_id);
      if (filters.from)     qs.set('from', filters.from);
      if (filters.to)       qs.set('to', filters.to);
      const res = await fetch(`${API_BASE_URL}/fees/payments/${user.institutionId}?${qs.toString()}`);
      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error('Payments fetch error:', e);
      setRows([]);
    }
    setLoading(false);
  }, [user, filters]);

  useEffect(() => { load(); }, [load]);

  const classLabel = (cid) => {
    const c = classes.find(c => String(c.id) === String(cid));
    return c ? `${c.className}${c.section ? ` - ${c.section}` : ''}` : '—';
  };

  const act = async (payment_id, action) => {
    if (!canEdit) return;
    setBusyId(payment_id);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/payments/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id, action, userId: user?.id ?? null, userName: user?.name ?? null })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to update payment.'); }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const receiptFields = (r) => ({
    title: 'Payment Receipt',
    receiptNo: r.provider_payment_id || `#${r.id}`,
    datetime: fmtDateTime(r.created_at),
    student: r.student_name,
    fee: '',
    className: classLabel(r.class_id),
    method: r.method,
    ref: r.reference_no || r.provider_payment_id || '—',
    amount: inr(r.amount),
    status: r.status
  });

  const viewProof = async (r) => {
    if (r.method === 'offline' && Number(r.has_slip) === 1) {
      setProof({ open: true, row: r, loading: true, img: null });
      try {
        const res = await fetch(`${API_BASE_URL}/fees/payment-slip/${r.id}`);
        const json = await res.json();
        setProof({ open: true, row: r, loading: false, img: json?.slip_image || null });
      } catch (e) {
        setProof({ open: true, row: r, loading: false, img: null });
      }
    } else {
      setProof({ open: true, row: r, loading: false, img: null }); // online / no slip -> receipt
    }
  };

  const closeProof = () => setProof({ open: false, row: null, loading: false, img: null });

  const downloadProof = () => {
    const r = proof.row;
    if (!r) return;
    if (proof.img) downloadDataUrl(proof.img, `slip-${r.id}.png`);
    else downloadReceipt(receiptFields(r), `receipt-${r.id}.png`);
  };

  const totalPaid = useMemo(
    () => rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-zinc-50/50 p-3 rounded-md ring-1 ring-black/5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          <Filter className="size-3.5" /> Filters
        </span>
        <Select label="Status" value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v }))}
          options={[{ v: '', l: 'All' }, { v: 'pending', l: 'Pending' }, { v: 'paid', l: 'Approved' }, { v: 'rejected', l: 'Rejected' }]} />
        <Select label="Class" value={filters.class_id} onChange={v => setFilters(f => ({ ...f, class_id: v }))}
          options={[{ v: '', l: 'All classes' }, ...classes.map(c => ({ v: String(c.id), l: `${c.className}${c.section ? ` - ${c.section}` : ''}` }))]} />
        <DateField label="From" value={filters.from} onChange={v => setFilters(f => ({ ...f, from: v }))} />
        <DateField label="To" value={filters.to} onChange={v => setFilters(f => ({ ...f, to: v }))} />
        {(filters.from || filters.to || filters.class_id || filters.status !== 'pending') && (
          <button onClick={() => setFilters({ status: 'pending', class_id: '', from: '', to: '' })}
            className="text-[11px] font-medium text-primary hover:underline ml-auto">Reset</button>
        )}
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <ReceiptText className="size-4 text-primary" /> Payments <span className="text-zinc-400 font-normal">({rows.length})</span>
          </h3>
          <span className="text-[11px] text-zinc-500">Paid in view: <strong className="text-green-700 tabular-nums">{inr(totalPaid)}</strong></span>
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['Date & Time', 'Student', 'Class', 'Amount', 'Method', 'Status', 'Reference', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length > 0 ? rows.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3 text-xs text-zinc-600 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-zinc-900">{r.student_name || '—'}</div>
                      <div className="text-[10px] text-zinc-400">Roll {r.roll_no || '—'}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-700">{classLabel(r.class_id)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-zinc-900 tabular-nums">{inr(r.amount)}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600 capitalize">{r.method}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ring-1 capitalize ${STATUS_STYLE[r.status] || STATUS_STYLE.failed}`}>
                        {r.status === 'paid' ? (r.method === 'offline' ? 'Approved' : 'Paid') : r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[11px] text-zinc-500">
                      {r.provider_payment_id || r.reference_no || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => viewProof(r)} title="View proof"
                          className="p-1.5 text-zinc-400 hover:text-primary rounded transition-colors">
                          <Eye className="size-4" />
                        </button>
                        {canEdit && r.status === 'pending' && r.method === 'offline' && (
                          <>
                            <button onClick={() => act(r.id, 'verify')} disabled={busyId === r.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                              <Check className="size-3" /> Verify
                            </button>
                            <button onClick={() => act(r.id, 'reject')} disabled={busyId === r.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50">
                              <X className="size-3" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="8" className="px-5 py-8 text-center text-xs text-zinc-500 italic">No payments match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proof modal */}
      {proof.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={closeProof}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 max-w-lg w-full p-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-zinc-900">Payment Proof</h4>
              <button onClick={closeProof} className="text-zinc-400 hover:text-zinc-700"><X className="size-5" /></button>
            </div>
            {proof.loading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
              </div>
            ) : proof.img ? (
              <img src={proof.img} alt="Payment slip" className="w-full rounded-md ring-1 ring-black/5" />
            ) : proof.row ? (
              <ReceiptView fields={receiptFields(proof.row)} />
            ) : (
              <p className="text-xs text-zinc-500 text-center py-8">Proof not available.</p>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={downloadProof} disabled={proof.loading}
                className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-60">
                <Download className="size-3.5" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styled receipt for online / slip-less payments.
function ReceiptView({ fields }) {
  const rows = [
    ['Receipt No', fields.receiptNo],
    ['Date & Time', fields.datetime],
    ['Student', fields.student],
    ['Class', fields.className],
    ['Method', fields.method],
    ['Reference', fields.ref],
  ].filter(r => r[1] && r[1] !== '—');
  return (
    <div className="rounded-md ring-1 ring-black/5 overflow-hidden">
      <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{fields.title}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider">{fields.status}</span>
      </div>
      <div className="p-4 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">{k}</span>
            <span className="font-medium text-zinc-900 capitalize">{v}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-100">
          <span className="text-zinc-500 text-xs">Amount</span>
          <span className="text-primary font-bold text-lg tabular-nums">{fields.amount}</span>
        </div>
      </div>
    </div>
  );
}

// ---- filter controls ----
function Select({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="h-8 appearance-none rounded border border-zinc-200 bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
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