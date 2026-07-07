import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Save, GraduationCap, ChevronDown, Info, IndianRupee } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

export default function FeeAssign({ data, fetchData, user, canEdit = true }) {
  const classes = data.classes || [];
  const [activeClass, setActiveClass] = useState('');
  const [feeForm, setFeeForm]         = useState({ full_fee: '', full_due_date: '', installments: [] });
  const [savingPlan, setSavingPlan]   = useState(false);
  const [savingId, setSavingId]       = useState(null); // student id (or 'all') currently saving

  useEffect(() => {
    if (classes.length === 0) return;
    const stillValid = classes.some(c => String(c.id) === String(activeClass));
    if (!stillValid) setActiveClass(String(classes[0].id));
  }, [classes, activeClass]);

  const selectedClass = useMemo(
    () => classes.find(c => String(c.id) === String(activeClass)) || null,
    [classes, activeClass]
  );

  const plan = useMemo(
    () => (data.plans || []).find(p => String(p.class_id) === String(activeClass)) || null,
    [data.plans, activeClass]
  );

  const planInstallments = useMemo(
    () => (data.installments || [])
            .filter(i => plan && i.plan_id === plan.id)
            .sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id)),
    [data.installments, plan]
  );

  useEffect(() => {
    setFeeForm({
      full_fee: plan ? String(plan.full_fee ?? '') : '',
      full_due_date: plan && plan.due_date ? String(plan.due_date).slice(0, 10) : '',
      installments: planInstallments.map(i => ({
        label: i.label || '',
        amount: i.amount ?? '',
        due_date: i.due_date ? String(i.due_date).slice(0, 10) : ''
      }))
    });
  }, [plan, planInstallments, activeClass]);

  const students = useMemo(() => {
    const list = (data.students || []).filter(s => String(s.class_id) === String(activeClass));
    const rollVal = (u) => { const n = parseInt(u.roll_no, 10); return isNaN(n) ? Infinity : n; };
    return [...list].sort((a, b) => (rollVal(a) - rollVal(b)) || (a.name || '').localeCompare(b.name || ''));
  }, [data.students, activeClass]);

  const assignmentOf = (sid) =>
    (data.assignments || []).find(a => String(a.student_id) === String(sid)) || null;

  const fullFeeNum   = Number(feeForm.full_fee) || (plan ? Number(plan.full_fee) : 0);
  const installTotal = feeForm.installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const addInstallment = () => {
    if (!canEdit) return;
    setFeeForm(f => ({
      ...f,
      installments: [...f.installments, { label: `Installment ${f.installments.length + 1}`, amount: '', due_date: '' }]
    }));
  };
  const updateInstallment = (idx, key, val) =>
    setFeeForm(f => ({ ...f, installments: f.installments.map((it, i) => (i === idx ? { ...it, [key]: val } : it)) }));
  const removeInstallment = (idx) =>
    setFeeForm(f => ({ ...f, installments: f.installments.filter((_, i) => i !== idx) }));

  const savePlan = async () => {
    if (!canEdit || !selectedClass) return;
    setSavingPlan(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/class-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          academic_year_id: data.academic_year_id ?? null,
          class_id: selectedClass.id,
          full_fee: Number(feeForm.full_fee) || 0,
          due_date: feeForm.full_due_date || null,
          installments: feeForm.installments
            .filter(i => i.label || i.amount)
            .map((i, idx) => ({
              label: i.label || `Installment ${idx + 1}`,
              amount: Number(i.amount) || 0,
              due_date: i.due_date || null
            })),
          userId: user?.id ?? null,
          userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to save fee structure.'); }
      await fetchData();
    } finally {
      setSavingPlan(false);
    }
  };

  const setMode = async (student, mode) => {
    if (!canEdit) return;
    setSavingId(student.id);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          academic_year_id: data.academic_year_id ?? null,
          student_id: student.id,
          class_id: student.class_id,
          plan_id: plan ? plan.id : null,
          payment_mode: mode,
          userId: user?.id ?? null,
          userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to assign.'); }
      await fetchData();
    } finally {
      setSavingId(null);
    }
  };

  const assignWholeClass = async (mode) => {
    if (!canEdit || !selectedClass || students.length === 0) return;
    if (!plan) return alert('Save the fee structure for this class first.');
    setSavingId('all');
    try {
      const res = await fetch(`${API_BASE_URL}/fees/assign-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          academic_year_id: data.academic_year_id ?? null,
          class_id: selectedClass.id,
          plan_id: plan.id,
          payment_mode: mode,
          student_ids: students.map(s => s.id),
          userId: user?.id ?? null,
          userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to assign class.'); }
      await fetchData();
    } finally {
      setSavingId(null);
    }
  };

  const useDropdown = classes.length > 6;
  const classLabel  = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50/60 border border-blue-100 rounded-md p-4 flex gap-3 text-[11px] text-blue-800 leading-relaxed">
        <Info className="size-4 shrink-0 text-blue-500 mt-0.5" />
        <p>
          Set the <strong className="font-semibold text-blue-900">Full Fee</strong> and its due date, then optionally break it
          into <strong>Installments</strong> (each with its own due date). Once saved, give each student a payment mode —
          <strong> Full Fee</strong> or <strong>Installment</strong>. Per-student discounts live in the <strong>Concession</strong> tab.
        </p>
      </div>

      {classes.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-zinc-50/50 p-2.5 rounded-md ring-1 ring-black/5">
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
        </div>
      )}

      {selectedClass ? (
        <>
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <IndianRupee className="size-4 text-primary" /> Fee Structure — {classLabel(selectedClass)}
              </h3>
              <button onClick={savePlan} disabled={savingPlan || !canEdit}
                className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <Save className="size-3.5" /> {savingPlan ? 'Saving…' : 'Save Structure'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-600 mb-1.5">Full Fee (Annual)</label>
                <input type="number" min="0" value={feeForm.full_fee} disabled={!canEdit}
                  onChange={e => setFeeForm(f => ({ ...f, full_fee: e.target.value }))}
                  placeholder="e.g. 45000"
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
                <p className="text-[10px] text-zinc-400 mt-1">The complete yearly fee if paid in a single payment.</p>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-600 mb-1.5">Full Payment Due Date</label>
                <input type="date" value={feeForm.full_due_date} disabled={!canEdit}
                  onChange={e => setFeeForm(f => ({ ...f, full_due_date: e.target.value }))}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
                <p className="text-[10px] text-zinc-400 mt-1">Shown to students; turns red once overdue.</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-600">Installments (optional)</p>
                {canEdit && (
                  <button onClick={addInstallment}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                    <Plus className="size-3.5" /> Add installment
                  </button>
                )}
              </div>

              {feeForm.installments.length === 0 ? (
                <p className="text-[11px] text-zinc-400 italic">
                  No installments. Add terms like “Term 1”, “Term 2”… to let students pay in parts.
                </p>
              ) : (
                <div className="space-y-2">
                  {feeForm.installments.map((it, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input value={it.label} disabled={!canEdit} onChange={e => updateInstallment(idx, 'label', e.target.value)}
                        placeholder={`Installment ${idx + 1}`}
                        className="flex-1 rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
                      <input type="number" min="0" value={it.amount} disabled={!canEdit} onChange={e => updateInstallment(idx, 'amount', e.target.value)}
                        placeholder="Amount"
                        className="w-full sm:w-36 rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
                      <input type="date" value={it.due_date} disabled={!canEdit} onChange={e => updateInstallment(idx, 'due_date', e.target.value)}
                        className="w-full sm:w-44 rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
                      {canEdit && (
                        <button onClick={() => removeInstallment(idx)}
                          className="p-1.5 text-zinc-400 hover:text-accent rounded transition-colors self-end sm:self-auto">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className={`text-[11px] mt-1 ${installTotal === (Number(feeForm.full_fee) || 0) ? 'text-green-600' : 'text-accent'}`}>
                    Installments total: {inr(installTotal)}
                    {Number(feeForm.full_fee) > 0 && installTotal !== Number(feeForm.full_fee) &&
                      ` — does not match full fee ${inr(feeForm.full_fee)}`}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">
                Assign to Students <span className="text-zinc-400 font-normal">({students.length})</span>
              </h3>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Assign all as</span>
                  <button onClick={() => assignWholeClass('full')} disabled={savingId === 'all' || !plan}
                    className="px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50">Full</button>
                  <button onClick={() => assignWholeClass('installment')} disabled={savingId === 'all' || !plan}
                    className="px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50">Installment</button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-zinc-50/50">
                    <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Roll</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Student</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Payment Mode</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Full Fee</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Concession</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Net Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {students.length > 0 ? students.map(s => {
                    const a = assignmentOf(s.id);
                    const concession = a ? Number(a.concession_amount) || 0 : 0;
                    const net = Math.max(0, fullFeeNum - concession);
                    const mode = a ? a.payment_mode : '';
                    return (
                      <tr key={s.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="px-5 py-3 text-xs font-semibold text-zinc-400 tabular-nums">{s.roll_no || '—'}</td>
                        <td className="px-5 py-3 text-sm font-medium text-zinc-900">{s.name}</td>
                        <td className="px-5 py-3">
                          <div className="relative w-36">
                            <select value={mode} disabled={savingId === s.id || !plan || !canEdit}
                              onChange={e => setMode(s, e.target.value)}
                              className="h-8 w-full appearance-none rounded border border-zinc-200 bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer disabled:bg-zinc-50 disabled:text-zinc-400">
                              <option value="">— not set —</option>
                              <option value="full">Full Fee</option>
                              <option value="installment">Installment</option>
                            </select>
                            <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-zinc-700 tabular-nums">{inr(fullFeeNum)}</td>
                        <td className="px-5 py-3 text-xs tabular-nums">
                          {concession > 0
                            ? <span className="text-accent">− {inr(concession)}</span>
                            : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-xs font-semibold text-zinc-900 tabular-nums">{inr(net)}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="6" className="px-5 py-8 text-center text-xs text-zinc-500 italic">No active students in this class.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {!plan && students.length > 0 && (
              <p className="px-5 py-3 text-[11px] text-accent bg-accent/5 border-t border-accent/10">
                Save the fee structure above before assigning a payment mode.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="h-40 flex items-center justify-center text-sm text-zinc-400">
          No classes found. Add classes in System Configuration first.
        </div>
      )}
    </div>
  );
}