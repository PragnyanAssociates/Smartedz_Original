import React, { useState, useMemo, useEffect } from 'react';
import { Percent, GraduationCap, ChevronDown, Info, Save } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { FeeYearSelect, ClosedYearNote } from './FeeYear';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

// canEdit arrives from FeeManagement with the closed-year lock already
// folded in — a previous year's concessions are visible but never writable.
export default function Concession({ data, fetchData, user, canEdit = true, years = [], yearId, setYearId, yearName, isActiveYear = true }) {
  const classes = data.classes || [];
  const [activeClass, setActiveClass] = useState('');
  const [edits, setEdits]             = useState({}); // { [studentId]: { amount, reason } }
  const [savingId, setSavingId]       = useState(null);

  useEffect(() => {
    if (classes.length === 0) return;
    const stillValid = classes.some(c => String(c.id) === String(activeClass));
    if (!stillValid) setActiveClass(String(classes[0].id));
  }, [classes, activeClass]);

  // Concessions apply to the Annual fee.
  const plan = useMemo(
    () => (data.plans || []).find(p => String(p.class_id) === String(activeClass) && (p.fee_category || 'annual') === 'annual') || null,
    [data.plans, activeClass]
  );
  const fullFeeNum = plan ? Number(plan.full_fee) || 0 : 0;

  const students = useMemo(() => {
    const list = (data.students || []).filter(s => String(s.class_id) === String(activeClass));
    const rollVal = (u) => { const n = parseInt(u.roll_no, 10); return isNaN(n) ? Infinity : n; };
    return [...list].sort((a, b) => (rollVal(a) - rollVal(b)) || (a.name || '').localeCompare(b.name || ''));
  }, [data.students, activeClass]);

  const assignmentOf = (sid) =>
    (data.assignments || []).find(a => String(a.student_id) === String(sid) && String(a.plan_id) === String(plan?.id)) || null;

  // Reset local edits when the class — or the year — changes.
  useEffect(() => { setEdits({}); }, [activeClass, yearId]);

  const valueFor = (s, key) => {
    if (edits[s.id] && edits[s.id][key] !== undefined) return edits[s.id][key];
    const a = assignmentOf(s.id);
    if (key === 'amount') return a && a.concession_amount != null ? String(a.concession_amount) : '';
    return a && a.concession_reason ? a.concession_reason : '';
  };

  const setEdit = (sid, key, val) =>
    setEdits(e => ({ ...e, [sid]: { ...e[sid], [key]: val } }));

  const saveConcession = async (s) => {
    if (!canEdit) return;
    setSavingId(s.id);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/concession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          academic_year_id: data.academic_year_id ?? null,
          student_id: s.id,
          class_id: s.class_id,
          plan_id: plan ? plan.id : null,
          concession_amount: Number(valueFor(s, 'amount')) || 0,
          concession_reason: valueFor(s, 'reason') || null,
          userId: user?.id ?? null,
          userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to save concession.'); }
      await fetchData();
      setEdits(e => { const n = { ...e }; delete n[s.id]; return n; });
    } finally {
      setSavingId(null);
    }
  };

  const useDropdown = classes.length > 6;
  const classLabel  = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;

  return (
    <div className="space-y-6">
      {/* Info note */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-md p-4 flex gap-3 text-[11px] text-blue-800 leading-relaxed">
        <Info className="size-4 shrink-0 text-blue-500 mt-0.5" />
        <p>
          Give a per-student discount here. The student's net fee is shown as
          <strong> Full Fee − Concession</strong>. Set the amount to <strong>0</strong> to remove a concession.
          A concession applies to the <strong>selected academic year only</strong> — next year the student starts on
          the full fee again unless you grant it afresh.
        </p>
      </div>

      {!isActiveYear && <ClosedYearNote yearName={yearName} />}

      {/* Year + Class filter */}
      <div className="flex items-center gap-3 flex-wrap bg-zinc-50/50 p-2.5 rounded-md ring-1 ring-black/5">
        <FeeYearSelect years={years} value={yearId} onChange={setYearId} />
        {classes.length > 0 && (
          <>
            <span className="w-px h-5 bg-zinc-200 mx-1 hidden sm:block" />
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">
              <GraduationCap className="size-3.5 shrink-0" /> Class
            </span>
            {useDropdown ? (
              <div className="relative w-full sm:w-auto">
                <select value={activeClass} onChange={e => setActiveClass(e.target.value)}
                  className="h-8 w-full sm:w-auto appearance-none rounded border border-zinc-200 bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
                  {classes.map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                </select>
                <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {classes.map(c => (
                  <button key={c.id} onClick={() => setActiveClass(String(c.id))}
                    className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                      String(activeClass) === String(c.id)
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                        : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
                    }`}>
                    {classLabel(c)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
          <Percent className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-900">
            Concessions <span className="text-zinc-400 font-normal">({students.length})</span>
          </h3>
          {yearName && <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">{yearName}</span>}
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Roll</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Student</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Full Fee</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Concession</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Reason</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Net Payable</th>
                <th className="px-5 py-3 border-b border-zinc-100"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {students.length > 0 ? students.map(s => {
                const amount = Number(valueFor(s, 'amount')) || 0;
                const net = Math.max(0, fullFeeNum - amount);
                const dirty = !!edits[s.id];
                return (
                  <tr key={s.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3 text-xs font-semibold text-zinc-400 tabular-nums">{s.roll_no || '—'}</td>
                    <td className="px-5 py-3 text-sm font-medium text-zinc-900">{s.name}</td>
                    <td className="px-5 py-3 text-xs text-zinc-700 tabular-nums">{inr(fullFeeNum)}</td>
                    <td className="px-5 py-3">
                      <input type="number" min="0" value={valueFor(s, 'amount')} disabled={!canEdit}
                        onChange={e => setEdit(s.id, 'amount', e.target.value)}
                        placeholder="0"
                        className="w-28 rounded-md border border-zinc-200 bg-white px-2 h-8 text-xs text-zinc-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
                    </td>
                    <td className="px-5 py-3">
                      <input value={valueFor(s, 'reason')} disabled={!canEdit}
                        onChange={e => setEdit(s.id, 'reason', e.target.value)}
                        placeholder="e.g. Staff ward, Sibling"
                        className="w-44 rounded-md border border-zinc-200 bg-white px-2 h-8 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold tabular-nums">
                      {amount > 0
                        ? <span className="text-zinc-900">{inr(fullFeeNum)} <span className="text-accent">− {inr(amount)}</span> = <span className="text-primary">{inr(net)}</span></span>
                        : <span className="text-zinc-900">{inr(net)}</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canEdit && (
                        <button onClick={() => saveConcession(s)} disabled={savingId === s.id || !dirty}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed">
                          <Save className="size-3.5" /> {savingId === s.id ? 'Saving…' : 'Save'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="7" className="px-5 py-8 text-center text-xs text-zinc-500 italic">No active students in this class.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {!plan && students.length > 0 && (
          <p className="px-5 py-3 text-[11px] text-accent bg-accent/5 border-t border-accent/10">
            No fee structure set for this class in {yearName || 'this year'} — set the full fee in the Fee Assign tab to see net payable.
          </p>
        )}
      </div>
    </div>
  );
}