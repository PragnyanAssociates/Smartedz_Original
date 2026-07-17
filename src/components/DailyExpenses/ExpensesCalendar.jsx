import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, ChevronDown, Receipt, Eye } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { HEAD_OF_ACCOUNT, fmtAmt } from './VoucherForm';
import VoucherView from './VoucherView';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateKey = (v) => (v ? String(v).slice(0, 10) : null); // voucher_date is a plain DATE
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const prettyDate = (k) => {
  if (!k) return '-';
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};

export default function ExpensesCalendar({ user }) {
  const today = new Date();
  const [cursor, setCursor]   = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [head, setHead]       = useState('');
  const [selected, setSelected] = useState(ymd(today));
  const [range, setRange]     = useState({ from: '', to: '' });
  const [rows, setRows]       = useState([]);
  const [rangeRows, setRangeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId]   = useState(null);

  const rangeMode = !!(range.from && range.to);
  const year = cursor.getFullYear(), month = cursor.getMonth();

  const loadMonth = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const first = new Date(year, month, 1);
      const last  = new Date(year, month + 1, 0);
      const qs = new URLSearchParams();
      qs.set('from', ymd(addDays(first, -1)));
      qs.set('to',   ymd(addDays(last, 1)));
      if (head) qs.set('head', head);
      const res = await fetch(`${API_BASE_URL}/expenses/list/${user.institutionId}?${qs.toString()}`);
      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error('Expenses calendar fetch error:', e);
      setRows([]);
    }
    setLoading(false);
  }, [user, year, month, head]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const loadRange = useCallback(async () => {
    if (!user?.institutionId || !rangeMode) { setRangeRows([]); return; }
    try {
      const qs = new URLSearchParams();
      qs.set('from', range.from); qs.set('to', range.to);
      if (head) qs.set('head', head);
      const res = await fetch(`${API_BASE_URL}/expenses/list/${user.institutionId}?${qs.toString()}`);
      const json = await res.json();
      setRangeRows(Array.isArray(json) ? json : []);
    } catch { setRangeRows([]); }
  }, [user, range, head, rangeMode]);

  useEffect(() => { loadRange(); }, [loadRange]);

  const byDate = useMemo(() => {
    const m = {};
    rows.forEach(r => { const k = dateKey(r.voucher_date); if (k) (m[k] = m[k] || []).push(r); });
    return m;
  }, [rows]);

  const usedDates = useMemo(() => new Set(Object.keys(byDate)), [byDate]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayEntries = rangeMode ? rangeRows : (byDate[selected] || []);
  const entriesTitle = rangeMode ? `Entries - ${range.from} -> ${range.to}` : `Entries for ${prettyDate(selected)}`;
  const dayTotal = dayEntries.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-zinc-50/50 p-3 rounded-md ring-1 ring-black/5 shadow-sm">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider self-center"><Filter className="size-3.5" /> Filters</span>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Head</span>
          <div className="relative">
            <select value={head} onChange={e => setHead(e.target.value)}
              className="h-9 appearance-none rounded border border-zinc-200 shadow-sm bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
              <option value="">All heads</option>
              {HEAD_OF_ACCOUNT.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <DateField label="Custom From" value={range.from} onChange={v => setRange(r => ({ ...r, from: v }))} />
        <DateField label="Custom To" value={range.to} onChange={v => setRange(r => ({ ...r, to: v }))} />
        {(range.from || range.to || head) && (
          <button onClick={() => { setRange({ from: '', to: '' }); setHead(''); }}
            className="text-[11px] font-medium text-primary hover:underline ml-auto self-center">Reset</button>
        )}
      </div>

      {/* Calendar left, entries right */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        <div className="ring-1 ring-black/5 shadow-sm rounded-lg bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="flex items-center justify-center size-8 text-zinc-500 hover:text-primary hover:bg-zinc-50 rounded-md transition-colors"><ChevronLeft className="size-4" /></button>
            <h3 className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5"><CalendarDays className="size-3.5 text-primary" /> {MONTHS[month]} {year}</h3>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="flex items-center justify-center size-8 text-zinc-500 hover:text-primary hover:bg-zinc-50 rounded-md transition-colors"><ChevronRight className="size-4" /></button>
          </div>
          <div className="p-2.5">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WD.map(w => <div key={w} className="text-center text-[9px] font-semibold text-zinc-400 uppercase py-1">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (d === null) return <div key={`e${i}`} />;
                const key = `${year}-${pad(month + 1)}-${pad(d)}`;
                const used = usedDates.has(key);
                const isSel = !rangeMode && selected === key;
                const isToday = ymd(today) === key;
                const count = (byDate[key] || []).length;
                return (
                  <button key={key} onClick={() => { setSelected(key); setRange({ from: '', to: '' }); }}
                    className={`relative aspect-square rounded-md text-xs flex items-center justify-center transition-colors
                      ${isSel ? 'bg-primary text-white font-semibold shadow-sm'
                        : used ? 'bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 ring-1 ring-inset ring-emerald-600/20'
                        : 'text-zinc-700 hover:bg-zinc-50'}
                      ${isToday && !isSel ? 'ring-1 ring-primary/40' : ''}`}>
                    {d}
                    {count > 0 && !isSel && <span className="absolute bottom-0.5 size-1 rounded-full bg-emerald-500" />}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5 mt-3 px-1">
              <Legend cls="bg-emerald-50 ring-emerald-600/20" label="Voucher recorded" />
              <Legend cls="bg-white ring-zinc-200" label="No voucher" />
              {loading && <span className="text-[10px] text-zinc-400">Loading...</span>}
            </div>
          </div>
        </div>

        <div className="ring-1 ring-black/5 shadow-sm rounded-lg bg-white overflow-hidden">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-zinc-900">{entriesTitle} <span className="text-zinc-400 font-normal">({dayEntries.length})</span></h3>
            <span className="text-[11px] text-zinc-500">Spent: <strong className="text-accent tabular-nums">INR {fmtAmt(dayTotal)}</strong></span>
          </div>
          {dayEntries.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-zinc-500 italic">No vouchers{rangeMode ? ' in this range' : ' on this day'}.</p>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-[520px] overflow-y-auto custom-scrollbar">
              {dayEntries.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="size-6 shrink-0 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-semibold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        <span className="text-primary font-semibold">{r.voucher_no}</span>
                        {r.name_title ? <span className="text-zinc-600"> - {r.name_title}</span> : ''}
                      </p>
                      <p className="text-[11px] text-zinc-500">{r.head_of_account}{r.sub_head ? ` - ${r.sub_head}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-accent tabular-nums">- INR {fmtAmt(r.total_amount)}</span>
                    <button onClick={() => setViewId(r.id)} title="View proof & details"
                      className="flex items-center justify-center size-8 bg-white text-zinc-600 border border-zinc-200 shadow-sm rounded-md hover:text-primary hover:bg-zinc-50 transition-colors">
                      <Eye className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewId && <VoucherView id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function Legend({ cls, label }) {
  return <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500"><span className={`size-3 rounded ring-1 ring-inset ${cls}`} /> {label}</span>;
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