import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, GraduationCap, ChevronDown, Info, IndianRupee, Tag, FolderPlus } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

const ANNUAL_TITLE = 'Annual Fee';

export default function FeeAssign({ data, fetchData, user, canEdit = true }) {
  const classes = data.classes || [];
  const [activeClass, setActiveClass] = useState('');
  const [sub, setSub]                 = useState('annual');   // 'annual' | 'other'
  const [otherId, setOtherId]         = useState(null);       // selected other-fee plan id, or 'new'

  useEffect(() => {
    if (classes.length === 0) return;
    const stillValid = classes.some(c => String(c.id) === String(activeClass));
    if (!stillValid) setActiveClass(String(classes[0].id));
  }, [classes, activeClass]);

  useEffect(() => { setOtherId(null); }, [activeClass, sub]);

  const selectedClass = useMemo(
    () => classes.find(c => String(c.id) === String(activeClass)) || null,
    [classes, activeClass]
  );

  const classPlans = useMemo(
    () => (data.plans || []).filter(p => String(p.class_id) === String(activeClass)),
    [data.plans, activeClass]
  );
  const annualPlan = useMemo(
    () => classPlans.find(p => (p.fee_category || 'annual') === 'annual') || null,
    [classPlans]
  );
  const otherPlans = useMemo(
    () => classPlans.filter(p => p.fee_category === 'other').sort((a, b) => a.id - b.id),
    [classPlans]
  );

  const currentPlan = sub === 'annual'
    ? annualPlan
    : (otherId && otherId !== 'new' ? otherPlans.find(p => String(p.id) === String(otherId)) || null : null);

  const students = useMemo(() => {
    const list = (data.students || []).filter(s => String(s.class_id) === String(activeClass));
    const rollVal = (u) => { const n = parseInt(u.roll_no, 10); return isNaN(n) ? Infinity : n; };
    return [...list].sort((a, b) => (rollVal(a) - rollVal(b)) || (a.name || '').localeCompare(b.name || ''));
  }, [data.students, activeClass]);

  const useDropdown = classes.length > 6;
  const classLabel  = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50/60 border border-blue-100 rounded-md p-4 flex gap-3 text-[11px] text-blue-800 leading-relaxed">
        <Info className="size-4 shrink-0 text-blue-500 mt-0.5" />
        <p>
          <strong className="text-blue-900">Annual Fee</strong> is the main yearly fee (one per class).
          <strong className="text-blue-900"> Other Fee</strong> is for extras like Books, Library, Transport — add as many as you need,
          each with its own title, amount, due date and installments. Per-student discounts live in the <strong>Concession</strong> tab.
        </p>
      </div>

      {/* Class filter */}
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

      {/* Sub-tabs */}
      <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
        <button onClick={() => setSub('annual')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${sub === 'annual' ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          <IndianRupee className="size-3.5" /> Annual Fee
        </button>
        <button onClick={() => setSub('other')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${sub === 'other' ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          <Tag className="size-3.5" /> Other Fee
        </button>
      </div>

      {!selectedClass ? (
        <div className="h-40 flex items-center justify-center text-sm text-zinc-400">
          No classes found. Add classes in System Configuration first.
        </div>
      ) : sub === 'other' && !currentPlan ? (
        <OtherFeePicker otherPlans={otherPlans} activeId={otherId} onSelect={setOtherId} canEdit={canEdit} />
      ) : (
        <>
          {sub === 'other' && (
            <OtherFeePicker otherPlans={otherPlans} activeId={otherId} onSelect={setOtherId} canEdit={canEdit} compact />
          )}

          <PlanEditor
            key={`${sub}-${currentPlan?.id || 'new'}-${activeClass}`}
            category={sub}
            plan={currentPlan}
            planInstallments={(data.installments || []).filter(i => currentPlan && i.plan_id === currentPlan.id)}
            selectedClass={selectedClass}
            classLabel={classLabel}
            data={data}
            user={user}
            canEdit={canEdit}
            fetchData={fetchData}
            onSaved={(newId) => { if (sub === 'other' && newId) setOtherId(String(newId)); }}
            onDeleted={() => setOtherId(null)}
          />

          <AssignTable
            plan={currentPlan}
            students={students}
            data={data}
            user={user}
            canEdit={canEdit}
            fetchData={fetchData}
            selectedClass={selectedClass}
          />
        </>
      )}
    </div>
  );
}

// ---- Other-fee picker (chips + add) ----
function OtherFeePicker({ otherPlans, activeId, onSelect, canEdit, compact }) {
  return (
    <div className="bg-white ring-1 ring-black/5 rounded-lg p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-1">Other Fees</span>
        {otherPlans.map(p => (
          <button key={p.id} onClick={() => onSelect(String(p.id))}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              String(activeId) === String(p.id) ? 'bg-primary text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
            }`}>
            {p.title} <span className="opacity-70">· {inr(p.full_fee)}</span>
          </button>
        ))}
        {canEdit && (
          <button onClick={() => onSelect('new')}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeId === 'new' ? 'bg-primary text-white' : 'text-primary ring-1 ring-primary/30 hover:bg-primary/5'
            }`}>
            <FolderPlus className="size-3.5" /> Add fee
          </button>
        )}
      </div>
      {!compact && otherPlans.length === 0 && (
        <p className="text-[11px] text-zinc-400 italic mt-3">No other fees yet. Click “Add fee” to create one (e.g. Books Fee).</p>
      )}
    </div>
  );
}

// ---- Plan editor (title + full fee + due date + installments) ----
function PlanEditor({ category, plan, planInstallments, selectedClass, classLabel, data, user, canEdit, fetchData, onSaved, onDeleted }) {
  const isOther = category === 'other';
  const [form, setForm] = useState({ title: '', full_fee: '', full_due_date: '', installments: [] });
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setForm({
      title: plan ? (plan.title || (isOther ? '' : ANNUAL_TITLE)) : (isOther ? '' : ANNUAL_TITLE),
      full_fee: plan ? String(plan.full_fee ?? '') : '',
      full_due_date: plan && plan.due_date ? String(plan.due_date).slice(0, 10) : '',
      installments: (planInstallments || [])
        .slice()
        .sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id))
        .map(i => ({ label: i.label || '', amount: i.amount ?? '', due_date: i.due_date ? String(i.due_date).slice(0, 10) : '' }))
    });
  }, [plan, planInstallments, isOther]);

  const installTotal = form.installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const fullFeeNum = Number(form.full_fee) || 0;

  const addInstallment = () => canEdit && setForm(f => ({ ...f, installments: [...f.installments, { label: `Installment ${f.installments.length + 1}`, amount: '', due_date: '' }] }));
  const updateInstallment = (idx, key, val) => setForm(f => ({ ...f, installments: f.installments.map((it, i) => i === idx ? { ...it, [key]: val } : it) }));
  const removeInstallment = (idx) => setForm(f => ({ ...f, installments: f.installments.filter((_, i) => i !== idx) }));

  const save = async () => {
    if (!canEdit || !selectedClass) return;
    if (isOther && !form.title.trim()) return alert('Please enter a title for this fee (e.g. Books Fee).');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/class-plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan?.id ?? null,
          institutionId: user.institutionId,
          academic_year_id: data.academic_year_id ?? null,
          class_id: selectedClass.id,
          title: isOther ? form.title.trim() : ANNUAL_TITLE,
          fee_category: category,
          full_fee: Number(form.full_fee) || 0,
          due_date: form.full_due_date || null,
          installments: form.installments
            .filter(i => i.label || i.amount)
            .map((i, idx) => ({ label: i.label || `Installment ${idx + 1}`, amount: Number(i.amount) || 0, due_date: i.due_date || null })),
          userId: user?.id ?? null, userName: user?.name ?? null
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { alert(json.error || 'Failed to save fee structure.'); }
      else { await fetchData(); if (onSaved) onSaved(json.plan_id); }
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!canEdit || !plan) return;
    if (!window.confirm(`Delete “${plan.title}”? This removes its structure and assignments.`)) return;
    setDeleting(true);
    try {
      await fetch(`${API_BASE_URL}/fees/class-plan/${plan.id}`, { method: 'DELETE' });
      await fetchData();
      if (onDeleted) onDeleted();
    } finally { setDeleting(false); }
  };

  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6 space-y-5">
      {/* Title above the fee structure */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex-1 max-w-md">
          <label className="text-xs font-medium text-zinc-600 mb-1.5 flex items-center gap-1.5"><Tag className="size-3.5 text-primary" /> Title</label>
          <input value={form.title} disabled={!canEdit || !isOther}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder={isOther ? 'e.g. Books Fee, Library Fee' : ANNUAL_TITLE}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-500" />
          {!isOther && <p className="text-[10px] text-zinc-400 mt-1">The annual fee title is fixed.</p>}
        </div>
        <div className="flex items-center gap-2">
          {isOther && plan && canEdit && (
            <button onClick={remove} disabled={deleting}
              className="inline-flex items-center gap-1.5 text-red-600 ring-1 ring-red-200 px-3 py-2 rounded-md text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
              <Trash2 className="size-3.5" /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button onClick={save} disabled={saving || !canEdit}
            className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="size-3.5" /> {saving ? 'Saving…' : 'Save Structure'}
          </button>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-5">
        <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-4">
          <IndianRupee className="size-4 text-primary" /> {form.title || (isOther ? 'New Fee' : ANNUAL_TITLE)} — {classLabel(selectedClass)}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-zinc-600 mb-1.5">{isOther ? 'Fee Amount' : 'Full Fee (Annual)'}</label>
            <input type="number" min="0" value={form.full_fee} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, full_fee: e.target.value }))} placeholder="e.g. 45000"
              className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
            <p className="text-[10px] text-zinc-400 mt-1">The total if paid in a single payment.</p>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-zinc-600 mb-1.5">Full Payment Due Date</label>
            <input type="date" value={form.full_due_date} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, full_due_date: e.target.value }))}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
            <p className="text-[10px] text-zinc-400 mt-1">Shown to students; turns red once overdue.</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-zinc-600">Installments (optional)</p>
            {canEdit && (
              <button onClick={addInstallment} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                <Plus className="size-3.5" /> Add installment
              </button>
            )}
          </div>
          {form.installments.length === 0 ? (
            <p className="text-[11px] text-zinc-400 italic">No installments. Add terms like “Term 1”, “Term 2”… to let students pay in parts.</p>
          ) : (
            <div className="space-y-2">
              {form.installments.map((it, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input value={it.label} disabled={!canEdit} onChange={e => updateInstallment(idx, 'label', e.target.value)} placeholder={`Installment ${idx + 1}`}
                    className="flex-1 rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
                  <input type="number" min="0" value={it.amount} disabled={!canEdit} onChange={e => updateInstallment(idx, 'amount', e.target.value)} placeholder="Amount"
                    className="w-full sm:w-36 rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
                  <input type="date" value={it.due_date} disabled={!canEdit} onChange={e => updateInstallment(idx, 'due_date', e.target.value)}
                    className="w-full sm:w-44 rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
                  {canEdit && (
                    <button onClick={() => removeInstallment(idx)} className="p-1.5 text-zinc-400 hover:text-accent rounded transition-colors self-end sm:self-auto">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              <div className={`text-[11px] mt-1 ${installTotal === fullFeeNum ? 'text-green-600' : 'text-accent'}`}>
                Installments total: {inr(installTotal)}
                {fullFeeNum > 0 && installTotal !== fullFeeNum && ` — does not match ${inr(fullFeeNum)}`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Assign to students (per plan) ----
function AssignTable({ plan, students, data, user, canEdit, fetchData, selectedClass }) {
  const [savingId, setSavingId] = useState(null);
  const fullFeeNum = plan ? Number(plan.full_fee) || 0 : 0;

  const assignmentOf = useCallback(
    (sid) => (data.assignments || []).find(a => String(a.student_id) === String(sid) && String(a.plan_id) === String(plan?.id)) || null,
    [data.assignments, plan]
  );

  const setMode = async (student, mode) => {
    if (!canEdit || !plan) return;
    setSavingId(student.id);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId, academic_year_id: data.academic_year_id ?? null,
          student_id: student.id, class_id: student.class_id, plan_id: plan.id,
          payment_mode: mode, userId: user?.id ?? null, userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to assign.'); }
      await fetchData();
    } finally { setSavingId(null); }
  };

  const assignWholeClass = async (mode) => {
    if (!canEdit || !plan || students.length === 0) return;
    setSavingId('all');
    try {
      const res = await fetch(`${API_BASE_URL}/fees/assign-class`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId, academic_year_id: data.academic_year_id ?? null,
          class_id: selectedClass.id, plan_id: plan.id, payment_mode: mode,
          student_ids: students.map(s => s.id), userId: user?.id ?? null, userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to assign class.'); }
      await fetchData();
    } finally { setSavingId(null); }
  };

  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-900">
          Assign to Students <span className="text-zinc-400 font-normal">({students.length})</span>
        </h3>
        {canEdit && plan && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Assign all as</span>
            <button onClick={() => assignWholeClass('full')} disabled={savingId === 'all'}
              className="px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50">Full</button>
            <button onClick={() => assignWholeClass('installment')} disabled={savingId === 'all'}
              className="px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50">Installment</button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-zinc-50/50">
              {['Roll', 'Student', 'Payment Mode', 'Fee', 'Concession', 'Net Payable'].map(h => (
                <th key={h} className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
              ))}
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
                      <select value={mode} disabled={savingId === s.id || !plan || !canEdit} onChange={e => setMode(s, e.target.value)}
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
                    {concession > 0 ? <span className="text-accent">− {inr(concession)}</span> : <span className="text-zinc-300">—</span>}
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
  );
}