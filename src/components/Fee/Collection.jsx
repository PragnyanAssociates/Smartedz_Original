import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Wallet, CheckCircle2, AlertCircle, GraduationCap, ChevronDown, Tag, Download } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

export default function Collection({ data, user }) {
  const classes = data.classes || [];
  const [view, setView]       = useState('unpaid'); // 'paid' | 'unpaid'
  const [classId, setClassId] = useState('');
  const [feeType, setFeeType] = useState('');       // a specific fee title
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/collection/${user.institutionId}`);
      const json = await res.json();
      setRows(Array.isArray(json?.students) ? json.students : []);
    } catch (e) {
      console.error('Collection fetch error:', e);
      setRows([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const classLabel = (cid) => {
    const c = classes.find(c => String(c.id) === String(cid));
    return c ? `${c.className}${c.section ? ` - ${c.section}` : ''}` : '—';
  };

  // Fee-type options from the plans we already have (Academic first).
  const feeTypes = useMemo(() => {
    const set = new Set();
    (data.plans || []).forEach(p => { if (p.title) set.add(p.title); });
    return [...set].sort((a, b) => (a === 'Academic Fee' ? -1 : b === 'Academic Fee' ? 1 : a.localeCompare(b)));
  }, [data.plans]);

  // Default to a specific fee + class (no "All" options).
  useEffect(() => {
    if (feeTypes.length && !feeTypes.includes(feeType)) setFeeType(feeTypes[0]);
  }, [feeTypes, feeType]);
  useEffect(() => {
    if (classes.length && !classes.some(c => String(c.id) === String(classId))) setClassId(String(classes[0].id));
  }, [classes, classId]);

  // Resolve each student to a single {net, paid, balance, status} for the chosen fee.
  const scoped = useMemo(() => {
    const list = [];
    rows.forEach(s => {
      const f = (s.fees || []).find(f => f.title === feeType);
      if (!f || f.status === 'nofee') return; // this class doesn't have this fee
      list.push({ ...s, net: f.net, paid: f.paid, balance: f.balance, status: f.status });
    });
    return list;
  }, [rows, feeType]);

  const inScope = useMemo(
    () => (classId ? scoped.filter(r => String(r.class_id) === String(classId)) : scoped),
    [scoped, classId]
  );

  const filtered = useMemo(() => {
    const rollVal = (u) => { const n = parseInt(u.roll_no, 10); return isNaN(n) ? Infinity : n; };
    return inScope.filter(r => r.status === view)
      .sort((a, b) => (String(a.class_id).localeCompare(String(b.class_id))) || (rollVal(a) - rollVal(b)) || (a.name || '').localeCompare(b.name || ''));
  }, [inScope, view]);

  const counts = useMemo(() => ({
    paid: inScope.filter(r => r.status === 'paid').length,
    unpaid: inScope.filter(r => r.status === 'unpaid').length
  }), [inScope]);

  const totalUnpaidBalance = useMemo(() => filtered.reduce((s, r) => s + Number(r.balance || 0), 0), [filtered]);
  const totalPaidCollected = useMemo(() => filtered.reduce((s, r) => s + Number(r.paid || 0), 0), [filtered]);

  const downloadList = () => {
    const rollVal = (u) => { const n = parseInt(u.roll_no, 10); return isNaN(n) ? Infinity : n; };
    const rows = [...inScope].sort((a, b) => (rollVal(a) - rollVal(b)) || (a.name || '').localeCompare(b.name || ''));
    const header = ['Roll', 'Student', 'Class', 'Fee', 'Net Payable', 'Paid', 'Balance', 'Status'];
    const lines = [header, ...rows.map(r => [
      r.roll_no || '', r.name || '', classLabel(r.class_id), feeType,
      Number(r.net || 0), Number(r.paid || 0), Number(r.balance || 0),
      r.status === 'paid' ? 'Paid' : 'Unpaid'
    ])];
    const csv = lines.map(row => row.map(cell => {
      const s = String(cell ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${feeType || 'fee'}_${classLabel(classId)}_collection.csv`.replace(/\s+/g, '-');
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
          <button onClick={() => setView('paid')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'paid' ? 'bg-white text-green-700 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
            <CheckCircle2 className="size-3.5" /> Paid <span className="text-zinc-400">({counts.paid})</span>
          </button>
          <button onClick={() => setView('unpaid')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'unpaid' ? 'bg-white text-accent shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
            <AlertCircle className="size-3.5" /> Unpaid <span className="text-zinc-400">({counts.unpaid})</span>
          </button>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <LabeledSelect icon={Tag} label="Fee" value={feeType} onChange={setFeeType}
            options={feeTypes.map(t => ({ v: t, l: t }))} />
          <LabeledSelect icon={GraduationCap} label="Class" value={classId} onChange={setClassId}
            options={classes.map(c => ({ v: String(c.id), l: `${c.className}${c.section ? ` - ${c.section}` : ''}` }))} />
          <button onClick={downloadList} disabled={inScope.length === 0}
            className="inline-flex items-center gap-1.5 bg-white text-zinc-700 ring-1 ring-zinc-200 px-3 h-8 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50">
            <Download className="size-3.5" /> Download
          </button>
        </div>
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Wallet className="size-4 text-primary" /> {view === 'paid' ? 'Fully Paid' : 'Outstanding'}
            <span className="text-zinc-400 font-normal">· {feeType || '—'} ({filtered.length})</span>
          </h3>
          {view === 'unpaid'
            ? <span className="text-[11px] text-zinc-500">Total due: <strong className="text-accent tabular-nums">{inr(totalUnpaidBalance)}</strong></span>
            : <span className="text-[11px] text-zinc-500">Total collected: <strong className="text-green-700 tabular-nums">{inr(totalPaidCollected)}</strong></span>}
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['Roll', 'Student', 'Class', 'Net Payable', 'Paid', 'Balance', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.length > 0 ? filtered.map(r => (
                  <tr key={r.student_id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3 text-xs font-semibold text-zinc-400 tabular-nums">{r.roll_no || '—'}</td>
                    <td className="px-5 py-3 text-sm font-medium text-zinc-900">{r.name}</td>
                    <td className="px-5 py-3 text-xs text-zinc-700">{classLabel(r.class_id)}</td>
                    <td className="px-5 py-3 text-xs text-zinc-700 tabular-nums">{inr(r.net)}</td>
                    <td className="px-5 py-3 text-xs text-green-700 tabular-nums">{inr(r.paid)}</td>
                    <td className="px-5 py-3 text-xs font-semibold tabular-nums">
                      {r.balance > 0 ? <span className="text-accent">{inr(r.balance)}</span> : <span className="text-green-700">{inr(0)}</span>}
                    </td>
                    <td className="px-5 py-3">
                      {r.status === 'paid'
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 bg-green-50 text-green-700 ring-green-600/20"><CheckCircle2 className="size-3" /> Paid</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 bg-amber-50 text-amber-700 ring-amber-600/20"><AlertCircle className="size-3" /> Unpaid</span>}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="px-5 py-8 text-center text-xs text-zinc-500 italic">No {view} students for {feeType === 'all' ? 'this scope' : feeType}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-400">
        Showing who has and hasn't paid the selected fee for the selected class. Students whose class doesn't have this fee aren't listed.
      </p>
    </div>
  );
}

function LabeledSelect({ icon: Icon, label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
        {Icon && <Icon className="size-3.5" />} {label}
      </span>
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