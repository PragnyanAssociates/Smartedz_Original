import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  BarChart3, CalendarCheck, CalendarX, Clock,
  CheckCircle2, XCircle, Loader2, Calendar as CalIcon, LineChart
} from 'lucide-react';
import AttendanceChart from './AttendanceChart';

// =====================================================================
//  AttendanceHistory
//  Shows: summary cards + an optional bar graph + a list of daily
//  entries with marker/editor info.
//  Filters: Daily | Monthly | Yearly | Custom range.
// =====================================================================

// Date-only formatter — parsed without timezone so it never drifts a day.
const fmtDate = (s) => {
  if (!s) return '—';
  const str = String(s).slice(0, 10);
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

// Datetime formatter — the backend (Railway) stores UTC as a naive string,
// so tag it as UTC and let the browser localise it.
const fmtDateTime = (s) => {
  if (!s) return '';
  let v = String(s);
  const hasTz = /[zZ]$/.test(v) || /[+-]\d\d:?\d\d$/.test(v);
  if (!hasTz) v = v.replace(' ', 'T') + 'Z';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const STATUS_META = {
  P: { label: 'Present', text: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-600/20', icon: CheckCircle2 },
  A: { label: 'Absent',  text: 'text-red-600',     bg: 'bg-red-50',     ring: 'ring-red-600/20',     icon: XCircle },
  L: { label: 'Late',    text: 'text-amber-600',   bg: 'bg-amber-50',   ring: 'ring-amber-600/20',   icon: Clock }
};

export default function AttendanceHistory({ userId, userName, selfOnly = false, yearName = '' }) {
  const { user: me } = useAuth();
  const [mode, setMode] = useState('monthly');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [from, setFrom]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));

  const [rows, setRows]       = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(true);

  // -----------------------------------------------------------------
  // Resolve range based on mode. "Yearly" returns no date bound — the
  // backend scopes to the whole active academic year.
  // -----------------------------------------------------------------
  const resolveRange = () => {
    if (mode === 'daily') return { from: day, to: day };
    if (mode === 'monthly') {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
    }
    if (mode === 'yearly') return { from: null, to: null };
    return { from, to };
  };

  // -----------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const r = resolveRange();
      let url = `${API_BASE_URL}/admin/attendance/history/${userId}?`;
      if (r.from && r.to) url += `from=${r.from}&to=${r.to}`;
      const res = await fetch(url);
      const data = await res.json();
      setRows(data.rows || []);
      setSummary(data.summary || null);
    } catch (e) { console.error(e); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode, day, month, from, to]);

  useEffect(() => { load(); }, [load]);

  // Build a per-day series (oldest → newest) for the graph from the rows.
  const series = useMemo(() => {
    const asc = [...rows].sort((a, b) =>
      String(a.attendance_date).localeCompare(String(b.attendance_date)));
    return asc.map(r => ({
      date: String(r.attendance_date).slice(0, 10),
      present: r.status === 'P' ? 1 : 0,
      late:    r.status === 'L' ? 1 : 0,
      absent:  r.status === 'A' ? 1 : 0,
      total: 1
    }));
  }, [rows]);

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Info */}
      {(selfOnly || userName) && (
        <div className="text-center sm:text-left flex flex-col mb-2">
          <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">
            {selfOnly ? (userName || me?.name) : userName}
          </h2>
          {selfOnly && <p className="text-[11px] text-zinc-500 mt-0.5">Your personal attendance record.</p>}
        </div>
      )}

      {/* Controls Container: Tabs and Date Pickers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Mode tabs */}
        <div className="inline-flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar shrink-0 max-w-full">
          {['daily', 'monthly', 'yearly', 'custom'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                mode === m 
                  ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' 
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              {m}
            </button>
          ))}
        </div>

        {/* Range pickers */}
        <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <CalIcon className="size-4 text-zinc-400 shrink-0 hidden sm:block" />
          
          {mode === 'daily' && (
            <input type="date" value={day} onChange={e => setDay(e.target.value)}
              className="h-9 w-full sm:w-auto rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
          )}
          {mode === 'monthly' && (
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="h-9 w-full sm:w-auto rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
          )}
          {mode === 'yearly' && (
            <span className="h-9 inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-600 whitespace-nowrap">
              {yearName || 'Active academic year'}
            </span>
          )}
          {mode === 'custom' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">From</span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="h-9 w-full sm:w-auto rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">To</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="h-9 w-full sm:w-auto rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <SumCard icon={BarChart3}     label="Attendance %"  value={`${summary.percentage}%`} color="blue" />
          <SumCard icon={CalendarCheck} label="Present"       value={summary.present} color="emerald" />
          <SumCard icon={CalendarX}     label="Absent"        value={summary.absent}  color="red" />
          <SumCard icon={Clock}         label="Late"          value={summary.late}    color="amber" />
        </div>
      )}

      {/* Working-days vs present-days line for this person */}
      {summary && summary.total > 0 && (
        <div className="text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-700">{summary.total}</span> working day{summary.total !== 1 ? 's' : ''} in this period ·
          {' '}<span className="font-medium text-emerald-700">{summary.present + summary.late}</span> present
          {' '}(<span className="font-medium text-red-600">{summary.absent}</span> absent)
        </div>
      )}

      {/* Graph (for ranges, not the single-day view) */}
      {mode !== 'daily' && !loading && series.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
              <LineChart className="size-3.5 text-primary" /> Attendance Graph
            </h3>
            <button onClick={() => setShowChart(v => !v)}
              className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
              {showChart ? 'Hide' : 'Show'}
            </button>
          </div>
          {showChart && <AttendanceChart series={series} />}
        </div>
      )}

      {/* Daily mode → single big card */}
      {mode === 'daily' && !loading && (
        <DailyBigCard row={rows[0]} date={day} />
      )}

      {/* List */}
      {mode !== 'daily' && (
        loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="animate-spin size-6 text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center">
            <p className="text-zinc-500 text-sm font-medium">No attendance records in this range.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-black/5 overflow-hidden divide-y divide-zinc-100">
            {rows.map(r => <HistoryRow key={r.id} row={r} />)}
          </div>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------
//  Subcomponents
// ---------------------------------------------------------------

function SumCard({ icon: Icon, label, value, color }) {
  const map = {
    blue:    'bg-primary/10 text-primary ring-primary/20',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-600/20',
    red:     'bg-red-50 text-red-600 ring-red-600/20',
    amber:   'bg-amber-50 text-amber-600 ring-amber-600/20'
  };
  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 p-4 sm:p-5 flex flex-col">
      <div className={`size-8 sm:size-10 rounded-md ${map[color]} ring-1 flex items-center justify-center mb-3 sm:mb-4`}>
        <Icon className="size-4 sm:size-5" />
      </div>
      <div className="text-xl sm:text-2xl font-semibold text-zinc-900 leading-none tabular-nums">{value}</div>
      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5 truncate">{label}</div>
    </div>
  );
}

function HistoryRow({ row }) {
  const meta = STATUS_META[row.status] || { label: 'Unknown', text: 'text-zinc-500', bg: 'bg-zinc-50', ring: 'ring-black/5', icon: Clock };
  const Icon = meta.icon;
  
  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`${meta.bg} ${meta.text} ${meta.ring} ring-1 size-9 rounded-md flex items-center justify-center shrink-0`}>
          <Icon className="size-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="font-semibold text-zinc-900 text-sm whitespace-nowrap">{fmtDate(row.attendance_date)}</div>
          <div className={`text-[10px] font-semibold uppercase tracking-wider ${meta.text}`}>{meta.label}</div>
        </div>
      </div>
      
      <div className="text-[11px] text-zinc-500 flex flex-col text-left sm:text-right pl-12 sm:pl-0">
        {row.marked_by_name && (
          <div className="truncate">
            <span className="text-zinc-400">Marked by</span>{' '}
            <span className="font-medium text-zinc-700">{row.marked_by_name}</span>{' '}
            <span className="text-zinc-400 whitespace-nowrap">({row.marked_by_role}) · {fmtDateTime(row.marked_at)}</span>
          </div>
        )}
        {row.updated_by_name && (
          <div className="text-amber-600 truncate mt-0.5">
            <span className="opacity-80">Updated by</span>{' '}
            <span className="font-medium">{row.updated_by_name}</span>{' '}
            <span className="opacity-80 whitespace-nowrap">({row.updated_by_role}) · {fmtDateTime(row.updated_at)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DailyBigCard({ row, date }) {
  if (!row) {
    return (
      <div className="bg-white border border-dashed border-zinc-200 rounded-lg p-10 text-center max-w-sm mx-auto">
        <Clock className="size-8 text-zinc-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-zinc-500">No record for {fmtDate(date)}</p>
      </div>
    );
  }
  
  const meta = STATUS_META[row.status];
  const Icon = meta.icon;
  
  return (
    <div className={`rounded-lg p-8 text-center max-w-sm mx-auto shadow-sm ring-1 flex flex-col items-center ${meta.bg} ${meta.ring}`}>
      <div className={`size-14 rounded-full bg-white flex items-center justify-center ${meta.text} shadow-sm mb-4`}>
        <Icon className="size-7" />
      </div>
      <div className={`text-xl font-bold uppercase tracking-widest ${meta.text}`}>{meta.label}</div>
      <div className={`text-xs font-medium mt-1 ${meta.text} opacity-80`}>{fmtDate(row.attendance_date)}</div>
      
      <div className="w-full h-px bg-black/5 my-4" />
      
      <div className="flex flex-col gap-1.5 text-[11px] text-zinc-700 w-full">
        <div className="bg-white/60 rounded px-3 py-2 text-center ring-1 ring-black/5">
          <span className="text-zinc-500">Marked by</span> <span className="font-semibold">{row.marked_by_name}</span> ({row.marked_by_role})
        </div>
        {row.updated_by_name && (
          <div className="bg-white/60 rounded px-3 py-2 text-center ring-1 ring-black/5 text-amber-700">
            <span className="opacity-80">Updated by</span> <span className="font-semibold">{row.updated_by_name}</span>
            <div className="opacity-70 mt-0.5">{fmtDateTime(row.updated_at)}</div>
          </div>
        )}
      </div>
    </div>
  );
}