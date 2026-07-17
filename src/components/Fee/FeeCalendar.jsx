import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, ChevronDown, Eye, X, Download } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { downloadDataUrl, downloadReceipt } from './paymentProof';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

// IST helpers (payments stored UTC). Bare MySQL datetimes get 'Z' so they parse as UTC.
const parseDbDate = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  let s = String(v);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const istYMD = (v) => {
  const d = parseDbDate(v);
  if (!d) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); // yyyy-mm-dd
};
const istTime = (v) => {
  const d = parseDbDate(v);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(d);
};
const fmtDateTime = (v) => {
  const d = parseDbDate(v);
  if (!d) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(d);
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_STYLE = {
  paid:     'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  pending:  'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
  failed:   'bg-zinc-50 text-zinc-700 ring-1 ring-inset ring-zinc-600/20'
};

// yearId comes from FeeManagement. /fees/payments is academic-year scoped and
// falls back to the ACTIVE year when no year is sent — without passing it, a
// month outside the active year would come back empty with no explanation.
export default function FeeCalendar({ data, user, yearId, yearName }) {
  const classes = data.classes || [];
  const today = new Date();
  const [cursor, setCursor]   = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [classId, setClassId] = useState('');
  const [selected, setSelected] = useState(ymd(today));
  const [range, setRange]     = useState({ from: '', to: '' });
  const [rows, setRows]       = useState([]);
  const [rangeRows, setRangeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proof, setProof]     = useState({ open: false, row: null, loading: false, img: null });
  const [schoolName, setSchoolName] = useState('');

  const rangeMode = !!(range.from && range.to);

  // School display name for the generated online receipt (same source as Payments).
  useEffect(() => {
    if (!user?.institutionId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/fees/account/${user.institutionId}`);
        const a = await res.json();
        if (alive) setSchoolName(a?.account_name || '');
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [user]);

  // Fetch the visible month (+/- 1 day pad for tz) for calendar colouring + day list.
  const loadMonth = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const last  = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const qs = new URLSearchParams();
      qs.set('from', ymd(addDays(first, -1)));
      qs.set('to',   ymd(addDays(last, 1)));
      if (yearId) qs.set('year', yearId);
      if (classId) qs.set('class_id', classId);
      const res = await fetch(`${API_BASE_URL}/fees/payments/${user.institutionId}?${qs.toString()}`);
      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error('Calendar fetch error:', e);
      setRows([]);
    }
    setLoading(false);
  }, [user, cursor, classId, yearId]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  // Fetch custom range list.
  const loadRange = useCallback(async () => {
    if (!user?.institutionId || !rangeMode) { setRangeRows([]); return; }
    try {
      const qs = new URLSearchParams();
      qs.set('from', range.from);
      qs.set('to', range.to);
      if (yearId) qs.set('year', yearId);
      if (classId) qs.set('class_id', classId);
      const res = await fetch(`${API_BASE_URL}/fees/payments/${user.institutionId}?${qs.toString()}`);
      const json = await res.json();
      setRangeRows(Array.isArray(json) ? json : []);
    } catch (e) {
      setRangeRows([]);
    }
  }, [user, range, classId, rangeMode, yearId]);

  useEffect(() => { loadRange(); }, [loadRange]);

  // group month rows by IST date
  const byDate = useMemo(() => {
    const m = {};
    rows.forEach(r => {
      const k = istYMD(r.created_at);
      if (!k) return;
      (m[k] = m[k] || []).push(r);
    });
    return m;
  }, [rows]);

  // a day is "emerald" when money was actually collected (paid) that day
  const paidDates = useMemo(() => {
    const s = new Set();
    Object.entries(byDate).forEach(([k, list]) => { if (list.some(r => r.status === 'paid')) s.add(k); });
    return s;
  }, [byDate]);

  const classLabel = (cid) => {
    const c = classes.find(c => String(c.id) === String(cid));
    return c ? `${c.className}${c.section ? ` - ${c.section}` : ''}` : '-';
  };

  // ---- Payment proof: the uploaded slip for offline, a receipt for online ----
  const receiptFields = (r) => ({
    schoolName: schoolName || 'Payment Receipt',
    receiptNo: r.provider_payment_id || `#${r.id}`,
    datetime: fmtDateTime(r.created_at),
    student: r.student_name,
    roll: r.roll_no,
    fee: '',
    className: classLabel(r.class_id),
    method: r.method,
    ref: r.reference_no || r.provider_payment_id || '-',
    amount: inr(r.amount),
    status: r.status === 'paid' ? 'Paid' : r.status
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

  // calendar cells
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayEntries = rangeMode ? rangeRows : (byDate[selected] || []);
  const entriesTitle = rangeMode
    ? `Entries - ${range.from} -> ${range.to}`
    : `Entries for ${selected ? new Date(selected).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}`;
  const dayPaid = dayEntries.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-zinc-50/50 p-3 rounded-md ring-1 ring-black/5 shadow-sm">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"><Filter className="size-3.5" /> Filters</span>
        <Select label="Class" value={classId} onChange={setClassId}
          options={[{ v: '', l: 'All classes' }, ...classes.map(c => ({ v: String(c.id), l: `${c.className}${c.section ? ` - ${c.section}` : ''}` }))]} />
        <DateField label="Custom From" value={range.from} onChange={v => setRange(r => ({ ...r, from: v }))} />
        <DateField label="Custom To" value={range.to} onChange={v => setRange(r => ({ ...r, to: v }))} />
        {(range.from || range.to || classId) && (
          <button onClick={() => { setRange({ from: '', to: '' }); setClassId(''); }}
            className="text-[11px] font-medium text-primary hover:underline ml-auto">Reset</button>
        )}
      </div>

      {/* Two-column: calendar left, entries right */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Calendar */}
        <div className="ring-1 ring-black/5 shadow-sm rounded-lg bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="flex items-center justify-center size-8 text-zinc-500 hover:text-primary hover:bg-zinc-50 rounded-md transition-colors">
              <ChevronLeft className="size-4" />
            </button>
            <h3 className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-primary" /> {MONTHS[month]} {year}
            </h3>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="flex items-center justify-center size-8 text-zinc-500 hover:text-primary hover:bg-zinc-50 rounded-md transition-colors">
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="p-2.5">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WD.map(w => <div key={w} className="text-center text-[9px] font-semibold text-zinc-400 uppercase py-1">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (d === null) return <div key={`e${i}`} />;
                const cellYmd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isPaid = paidDates.has(cellYmd);
                const isSel = !rangeMode && selected === cellYmd;
                const isToday = ymd(today) === cellYmd;
                const count = (byDate[cellYmd] || []).length;
                return (
                  <button key={cellYmd} onClick={() => { setSelected(cellYmd); setRange({ from: '', to: '' }); }}
                    className={`relative aspect-square rounded-md text-xs flex items-center justify-center transition-colors
                      ${isSel ? 'bg-primary text-white font-semibold shadow-sm'
                        : isPaid ? 'bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 ring-1 ring-inset ring-emerald-600/20'
                        : 'text-zinc-700 hover:bg-zinc-50'}
                      ${isToday && !isSel ? 'ring-1 ring-primary/40' : ''}`}>
                    {d}
                    {count > 0 && !isSel && (
                      <span className={`absolute bottom-0.5 size-1 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5 mt-3 px-1">
              <Legend cls="bg-emerald-50 ring-emerald-600/20" label="Payment received" />
              <Legend cls="bg-white ring-zinc-200" label="No payment" />
              {loading && <span className="text-[10px] text-zinc-400">Loading...</span>}
            </div>
          </div>
        </div>

        {/* Entries */}
        <div className="ring-1 ring-black/5 shadow-sm rounded-lg bg-white overflow-hidden">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              {entriesTitle} <span className="text-zinc-500 font-normal">({dayEntries.length})</span>
              {yearName && <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 ring-1 ring-inset ring-blue-600/20 px-2 py-0.5 rounded-full uppercase tracking-wider">{yearName}</span>}
            </h3>
            <span className="text-[11px] text-zinc-500">Received: <strong className="text-emerald-700 tabular-nums">{inr(dayPaid)}</strong></span>
          </div>
          {dayEntries.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-zinc-500 italic">No payments{rangeMode ? ' in this range' : ' on this day'}.</p>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-[520px] overflow-y-auto custom-scrollbar">
              {dayEntries.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="size-6 shrink-0 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-semibold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{r.student_name || '-'}</p>
                      <p className="text-[11px] text-zinc-500">
                        {classLabel(r.class_id)} - {istTime(r.created_at)} - <span className="capitalize">{r.method}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium capitalize ${STATUS_STYLE[r.status] || STATUS_STYLE.failed}`}>{r.status}</span>
                    <span className={`text-sm font-semibold tabular-nums ${r.status === 'paid' ? 'text-emerald-700' : 'text-zinc-900'}`}>{inr(r.amount)}</span>
                    <button onClick={() => viewProof(r)} title="View proof"
                      className="flex items-center justify-center size-8 bg-white text-zinc-600 border border-zinc-200 shadow-sm rounded-md hover:text-primary hover:bg-zinc-50 transition-colors shrink-0">
                      <Eye className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Proof modal — same behaviour as the Payments tab */}
      {proof.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={closeProof}>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm max-w-lg w-full p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-zinc-900">Payment Proof</h4>
              <button onClick={closeProof} className="flex items-center justify-center size-8 rounded text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                <X className="size-5" />
              </button>
            </div>
            {proof.loading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
              </div>
            ) : proof.img ? (
              <img src={proof.img} alt="Payment slip" className="w-full rounded-md border border-zinc-200 shadow-sm" />
            ) : proof.row?.method === 'online' ? (
              <ReceiptView fields={receiptFields(proof.row)} />
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-zinc-600">No slip was uploaded for this offline payment.</p>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={downloadProof} disabled={proof.loading || (!proof.img && proof.row?.method !== 'online')}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 shrink-0 bg-primary text-white rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60">
                <Download className="size-3.5" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Professional receipt for online payments (matches the Payments tab).
function ReceiptView({ fields }) {
  const rows = [
    ['Receipt No', fields.receiptNo],
    ['Date & Time', fields.datetime],
    ['Student', fields.student + (fields.roll ? ` - Roll ${fields.roll}` : '')],
    ['Class', fields.className],
    ['Method', fields.method],
    ['Reference', fields.ref],
  ].filter(r => r[1] && r[1] !== '-');
  const initial = (fields.schoolName || 'S').trim().charAt(0).toUpperCase();
  return (
    <div className="rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden">
      <div className="bg-primary text-white px-5 py-4 flex items-center gap-3">
        {fields.logoUrl
          ? <img src={fields.logoUrl} alt="logo" className="size-10 rounded bg-white object-contain" />
          : <div className="size-10 rounded bg-white/20 flex items-center justify-center text-lg font-semibold">{initial}</div>}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{fields.schoolName}</p>
          <p className="text-[10px] font-medium opacity-85">Fee Payment Receipt</p>
        </div>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider bg-white/20 px-2 py-1 rounded">{fields.status}</span>
      </div>
      <div className="p-5 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-xs gap-4">
            <span className="text-zinc-500 shrink-0">{k}</span>
            <span className="font-medium text-zinc-900 text-right capitalize">{v}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-zinc-100">
          <span className="text-zinc-500 text-xs">Amount Paid</span>
          <span className="text-primary font-semibold text-xl tabular-nums">{fields.amount}</span>
        </div>
      </div>
      <div className="px-5 py-2.5 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
        <span className="font-medium">Computer-generated receipt</span>
        <span className="font-medium">Powered by SmartEdz</span>
      </div>
    </div>
  );
}

function Legend({ cls, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
      <span className={`size-3 rounded ring-1 ring-inset ${cls}`} /> {label}
    </span>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="h-9 appearance-none rounded border border-zinc-200 shadow-sm bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
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
        className="h-9 rounded border border-zinc-200 shadow-sm bg-white px-2 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40" />
    </div>
  );
}