import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Loader2, Save, GripVertical,
  ListChecks, Grid3x3, UserCog, Check, ChevronDown, BookOpen, Layers,
  AlertTriangle, ShieldAlert, CalendarRange, ListOrdered, ArrowUp, ArrowDown,
  Award, ClipboardList, Calculator
} from 'lucide-react';

// =====================================================================
//  ExamSetup - sub-sections, switched by inner tabs:
//    1. Exam Types     - create/rename/reorder/delete exam types, assign
//                        a grade scale to each
//    2. Max Marks      - per class: an "All Subjects" default OR
//                        per-subject values (mutually exclusive), per exam
//    3. Teacher Assign - per class, map each subject to a teacher
//    4. Subject Order  - per class, order how subjects appear in Marks
//                        Entry and on the Report Card
//    5. Grade Scales   - reusable %-band grade tables (A1/A2..., A/B/C...)
//
//  NOTE ON ACADEMIC YEARS: everything here is SHARED CONFIG, reused by
//  every academic year — unlike marks, which are stamped with the active
//  year. That makes deletion here cross-year: removing an exam type takes
//  its marks from EVERY year with it, not just the active one. Hence the
//  guarded delete flow below, which shows the real damage per year first.
// =====================================================================

export default function ExamSetup() {
  const [section, setSection] = useState('types');

  const sections = [
    { id: 'types',   label: 'Exam Types',        icon: ListChecks },
    { id: 'marks',   label: 'Max Marks',         icon: Grid3x3 },
    { id: 'assign',  label: 'Teacher Assignment', icon: UserCog },
    { id: 'order',   label: 'Subject Order',     icon: ListOrdered },
    { id: 'grades',  label: 'Grading',      icon: Award }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-start">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar w-full sm:w-auto pb-2 sm:pb-0">
          {sections.map(s => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  active 
                    ? 'bg-primary text-white shadow-sm ring-1 ring-primary/20' 
                    : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
                }`}>
                <Icon className="size-3.5 shrink-0" /> {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {section === 'types'  && <ExamTypesPanel />}
        {section === 'marks'  && <MaxMarksPanel />}
        {section === 'assign' && <TeacherAssignPanel />}
        {section === 'order'  && <SubjectOrderPanel />}
        {section === 'grades' && <GradingPanel />}
      </div>
    </div>
  );
}

// =====================================================================
//  1. Exam Types — create, reorder (up/down), assign a grade scale.
//
//  Order is set here by moving rows and pressing Save Order (writes
//  exam_types.exam_order, same idea as Subject Order). A grade scale is
//  optional per exam and drives the grade shown on the report card.
// =====================================================================
function ExamTypesPanel() {
  const { user } = useAuth();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', exam_order: 0,
    kind: 'entered', show_on_report: true, parts: []
  });
  const [saving, setSaving] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [deletingType, setDeletingType] = useState(null);   // exam type pending deletion
  const [dirty, setDirty] = useState(false);                // unsaved reorder
  const [savingOrder, setSavingOrder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tRes = await fetch(`${API_BASE_URL}/admin/exam-types/${user.institutionId}`);
      const tData = await tRes.json();
      setTypes(Array.isArray(tData) ? tData : []);
      setDirty(false);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', exam_order: types.length, kind: 'entered', show_on_report: true, parts: [] });
    setShowModal(true);
  };

  const openEdit = async (t) => {
    setEditing(t);
    setForm({
      name: t.name,
      exam_order: t.exam_order,
      kind: t.kind === 'derived' ? 'derived' : 'entered',
      show_on_report: t.show_on_report === 0 || t.show_on_report === false ? false : true,
      parts: []
    });
    setShowModal(true);
    if (t.kind === 'derived') {
      setLoadingRules(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/exam-rules/${t.id}`);
        const d = await res.json();
        const parts = (d.parts || []).map(p => {
          const hasPct = p.percent != null && Number(p.percent) !== 100;
          const hasDiv = p.divisor != null && Number(p.divisor) !== 1;
          return {
            sources: (p.sources || []).map(Number),
            percent: hasPct ? String(p.percent) : '',
            divisor: hasDiv ? String(p.divisor) : '',
            adv: hasPct || hasDiv
          };
        });
        setForm(f => ({ ...f, parts }));
      } catch (e) { console.error(e); }
      setLoadingRules(false);
    }
  };

  // Source options = every OTHER exam type (an exam can't feed itself).
  const sourceOptions = types.filter(t => !editing || t.id !== editing.id);
  const nameOf = (id) => { const t = types.find(x => x.id === id); return t ? t.name : `#${id}`; };

  const addPart = () => setForm(f => ({ ...f, parts: [...f.parts, { sources: [], percent: '', divisor: '', adv: false }] }));
  const removePart = (i) => setForm(f => ({ ...f, parts: f.parts.filter((_, idx) => idx !== i) }));
  const setPart = (i, key, val) => setForm(f => ({ ...f, parts: f.parts.map((p, idx) => idx === i ? { ...p, [key]: val } : p) }));
  // Toggle the optional percentage/division controls; clearing resets them.
  const setAdv = (i, on) => setForm(f => ({ ...f, parts: f.parts.map((p, idx) => idx === i ? { ...p, adv: on, percent: on ? p.percent : '', divisor: on ? p.divisor : '' } : p) }));
  const addSource = (i, sid) => setForm(f => ({
    ...f,
    parts: f.parts.map((p, idx) => (idx === i && !p.sources.includes(sid)) ? { ...p, sources: [...p.sources, sid] } : p)
  }));
  const removeSource = (i, sid) => setForm(f => ({
    ...f,
    parts: f.parts.map((p, idx) => idx === i ? { ...p, sources: p.sources.filter(x => x !== sid) } : p)
  }));

  const handleSave = async () => {
    if (!form.name.trim()) return alert('Name is required.');
    const isDerived = form.kind === 'derived';
    let cleanParts = [];
    if (isDerived) {
      cleanParts = form.parts
        .map(p => ({
          sources: [...new Set(p.sources.map(Number))],
          percent: (p.adv && p.percent !== '') ? (parseFloat(p.percent) || 0) : 100,
          divisor: (p.adv && p.divisor !== '') ? (parseFloat(p.divisor) || 0) : 1
        }))
        .filter(p => p.sources.length > 0);
      if (cleanParts.length === 0) return alert('A derived exam needs at least one part with a source exam.');
      if (cleanParts.some(p => p.percent <= 0)) return alert('A percentage must be greater than 0.');
      if (cleanParts.some(p => p.divisor <= 0)) return alert('A divide-by must be greater than 0.');
    }

    setSaving(true);
    try {
      const body = {
        institutionId: user.institutionId,
        name: form.name.trim(),
        exam_order: parseInt(form.exam_order, 10) || 0,
        kind: isDerived ? 'derived' : 'entered',
        show_on_report: form.show_on_report ? 1 : 0
      };
      const url = editing
        ? `${API_BASE_URL}/admin/exam-types/${editing.id}`
        : `${API_BASE_URL}/admin/exam-types`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      const examId = editing ? editing.id : data.id;
      if (isDerived && examId) {
        const rRes = await fetch(`${API_BASE_URL}/admin/exam-rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exam_type_id: examId, parts: cleanParts })
        });
        if (!rRes.ok) {
          const rd = await rRes.json().catch(() => ({}));
          throw new Error(rd.error || 'The exam was saved but its formula was rejected.');
        }
      }
      setShowModal(false);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const move = (i, dir) => {
    setTypes(prev => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
      return next;
    });
    setDirty(true);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exam-types/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: types.map(t => t.id) })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Save failed'); }
      setDirty(false);
      load();
    } catch (e) { alert(e.message); }
    setSavingOrder(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-900 text-sm">Exam Types</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Define the exams your school conducts and the order they appear in. Assign a grade scale to show a grade on the report card.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {dirty && (
            <button onClick={saveOrder} disabled={savingOrder}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:text-zinc-500 text-white px-4 rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
              {savingOrder ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
              Save Order
            </button>
          )}
          <button onClick={openAdd}
            className="h-9 w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-4 rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
            <Plus className="size-3.5" /> Add Exam Type
          </button>
        </div>
      </div>

      {/* Exam types are shared across years — worth saying once, up front. */}
      <div className="rounded-md bg-blue-50/60 ring-1 ring-inset ring-blue-500/15 px-4 py-3 flex items-start gap-2.5">
        <CalendarRange className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-800 leading-relaxed">
          <span className="font-semibold">These carry across every academic year.</span> Unlike marks, exam types aren't tied to
          a year — the same list is reused each year, which is why you never have to rebuild it. The trade-off: deleting one
          removes its marks from <strong>every year</strong>, not just the active one. You'll see exactly what's at stake before it happens.
        </p>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
      ) : types.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <ListChecks className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No exam types yet. Add one to begin.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-28">Order</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Exam Type</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Type</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {types.map((t, i) => {
                const derived = t.kind === 'derived';
                return (
                  <tr key={t.id} className="hover:bg-zinc-50/60 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="size-6 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center tabular-nums shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => move(i, -1)} disabled={i === 0}
                            className="size-6 rounded bg-white ring-1 ring-inset ring-zinc-200 text-zinc-500 hover:text-primary hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors" title="Move up">
                            <ArrowUp className="size-3" />
                          </button>
                          <button onClick={() => move(i, 1)} disabled={i === types.length - 1}
                            className="size-6 rounded bg-white ring-1 ring-inset ring-zinc-200 text-zinc-500 hover:text-primary hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors" title="Move down">
                            <ArrowDown className="size-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-zinc-900 text-sm">
                      <span className="flex items-center gap-2">
                        {t.name}
                        {t.show_on_report === 0 && (
                          <span className="text-[9px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200 px-1.5 py-0.5 rounded" title="Hidden on the report card">
                            Hidden
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {derived ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary ring-1 ring-primary/20 whitespace-nowrap">
                          <Calculator className="size-3" /> Derived
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 whitespace-nowrap">
                          <ClipboardList className="size-3" /> Entered
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(t)}
                          className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors" title="Edit">
                          <Edit className="size-4" />
                        </button>
                        <button onClick={() => setDeletingType(t)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dirty && (
        <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" /> You have an unsaved order. Press <strong>Save Order</strong> to keep it.
        </p>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-sm font-semibold text-zinc-900">
                {editing ? 'Edit Exam Type' : 'Add Exam Type'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                <X className="size-4 shrink-0" />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar">
              <FormField label="Name" required>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Unit Test 1, FA1, SA1" className={inputCls} />
              </FormField>

              {/* Entered vs Derived */}
              <FormField label="Type">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm({ ...form, kind: 'entered' })}
                    className={`rounded-md ring-1 p-3 text-left transition-colors ${form.kind === 'entered' ? 'ring-primary bg-primary/5' : 'ring-zinc-200 bg-white hover:bg-zinc-50'}`}>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
                      <ClipboardList className="size-3.5 text-primary" /> Entered
                    </span>
                    <span className="block text-[10px] text-zinc-500 mt-1 leading-snug">Teachers type the marks.</span>
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, kind: 'derived' })}
                    className={`rounded-md ring-1 p-3 text-left transition-colors ${form.kind === 'derived' ? 'ring-primary bg-primary/5' : 'ring-zinc-200 bg-white hover:bg-zinc-50'}`}>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
                      <Calculator className="size-3.5 text-primary" /> Derived
                    </span>
                    <span className="block text-[10px] text-zinc-500 mt-1 leading-snug">Computed from other exams.</span>
                  </button>
                </div>
              </FormField>

              {/* Derived formula builder */}
              {form.kind === 'derived' && (
                <div className="rounded-md ring-1 ring-zinc-200 p-4 space-y-3 bg-zinc-50/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Formula</span>
                    <button type="button" onClick={addPart}
                      className="text-[11px] font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors">
                      <Plus className="size-3.5" /> Add part
                    </button>
                  </div>

                  {loadingRules ? (
                    <div className="h-16 flex items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>
                  ) : form.parts.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 italic py-2">
                      No parts yet. Add a part, pick the exams to combine, then set a percentage and (if needed) a divide-by.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {form.parts.map((p, i) => {
                        const remaining = sourceOptions.filter(o => !p.sources.includes(o.id));
                        const pct = (p.adv && p.percent !== '') ? parseFloat(p.percent) : 100;
                        const div = (p.adv && p.divisor !== '') ? parseFloat(p.divisor) : 1;
                        const sumLabel = p.sources.length ? p.sources.map(nameOf).join(' + ') : 'exams';
                        let formula = `(${sumLabel})`;
                        if (!isNaN(pct) && pct !== 100) formula += ` \u00d7 ${p.percent || 0}%`;
                        if (!isNaN(div) && div !== 1) formula += ` \u00f7 ${p.divisor || 1}`;
                        return (
                          <div key={i} className="rounded-md ring-1 ring-zinc-200 bg-white p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Part {i + 1}</span>
                              <button type="button" onClick={() => removePart(i)}
                                className="size-6 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors" title="Remove part">
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>

                            {/* sources: chips + add-dropdown */}
                            <div>
                              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Exams to combine</span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {p.sources.map(sid => (
                                  <span key={sid} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded text-[11px] font-semibold bg-primary text-white">
                                    {nameOf(sid)}
                                    <button type="button" onClick={() => removeSource(i, sid)}
                                      className="size-4 rounded hover:bg-white/20 flex items-center justify-center" title="Remove">
                                      <X className="size-3" />
                                    </button>
                                  </span>
                                ))}
                                {remaining.length > 0 ? (
                                  <div className="relative">
                                    <select value="" onChange={e => { if (e.target.value) addSource(i, Number(e.target.value)); }}
                                      className="h-8 rounded-md border border-dashed border-zinc-300 bg-white pl-2.5 pr-7 text-[11px] font-semibold text-zinc-600 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20">
                                      <option value="">+ Add exam</option>
                                      {remaining.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                    </select>
                                    <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  </div>
                                ) : p.sources.length === 0 ? (
                                  <span className="text-[11px] text-zinc-400 italic">Create other exam types first.</span>
                                ) : null}
                              </div>
                            </div>

                            {/* optional: percentage / division */}
                            {!p.adv ? (
                              <button type="button" onClick={() => setAdv(i, true)}
                                className="text-[11px] font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors">
                                <Plus className="size-3.5" /> Take a percentage or divide (optional)
                              </button>
                            ) : (
                              <div className="rounded-md bg-zinc-50 ring-1 ring-inset ring-zinc-200 p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Adjust (optional)</span>
                                  <button type="button" onClick={() => setAdv(i, false)}
                                    className="text-[10px] font-semibold text-zinc-400 hover:text-red-600 transition-colors">
                                    Remove
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-zinc-500 font-medium">Take</span>
                                    <input value={p.percent} inputMode="decimal"
                                      onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setPart(i, 'percent', e.target.value); }}
                                      placeholder="100"
                                      className="h-8 w-16 rounded-md border border-zinc-200 bg-white px-2 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm" />
                                    <span className="text-[11px] text-zinc-500 font-medium">%</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-zinc-500 font-medium">Divide by</span>
                                    <input value={p.divisor} inputMode="decimal"
                                      onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setPart(i, 'divisor', e.target.value); }}
                                      placeholder="1"
                                      className="h-8 w-16 rounded-md border border-zinc-200 bg-white px-2 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm" />
                                  </div>
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-snug">
                                  Leave blank for none. Percentage takes a share of the marks (e.g. 20%); divide-by splits them (e.g. by 2 for an average).
                                </p>
                              </div>
                            )}

                            <p className="text-[11px] text-zinc-500 leading-snug">
                              This part = <span className="font-semibold text-zinc-700">{formula}</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-md bg-blue-50/60 ring-1 ring-inset ring-blue-500/15 px-3 py-2.5 flex items-start gap-2">
                    <Calculator className="size-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      The exam's total is the sum of its parts, computed per student and per subject. Example &mdash; SA1: Part 1 = (SA1-W)
                      at 100%, Part 2 = (FA1 + FA2) at 20%. Average &mdash; Final: one part (SA1 + SA2) divided by 2. A missing source
                      shows as pending until it's entered; derived exams are read-only in Marks Entry.
                    </p>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2 rounded-md ring-1 ring-zinc-200 p-3 cursor-pointer">
                <input type="checkbox" checked={form.show_on_report}
                  onChange={e => setForm({ ...form, show_on_report: e.target.checked })}
                  className="mt-0.5 size-4 rounded border-zinc-300 text-primary focus:ring-2 focus:ring-primary/30" />
                <span className="text-[11px] text-zinc-600 leading-relaxed">
                  <span className="font-semibold text-zinc-800">Show on report card.</span> Turn off to hide a feeder exam
                  (e.g. a written paper that only exists inside a derived exam) so the card shows just the results.
                </span>
              </label>
            </div>
            <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || loadingRules}
                className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors min-w-[100px]">
                {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                {editing ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guarded, year-aware delete */}
      {deletingType && (
        <DeleteExamTypeModal
          examType={deletingType}
          onClose={() => setDeletingType(null)}
          onDeleted={() => { setDeletingType(null); load(); }}
        />
      )}
    </div>
  );
}

// =====================================================================
//  DeleteExamTypeModal — deletion with the real damage on screen.
//
//  Exam types are shared config but student_marks carry BOTH
//  exam_type_id and academic_year_id, so deleting one reaches into
//  EVERY year. A window.confirm saying "marks will be removed" hides
//  that: it reads like "this year's marks". So we ask the backend what
//  would actually go (/impact), list it per year, and only arm the
//  delete once the Super Admin has acknowledged closed-year losses.
// =====================================================================
function DeleteExamTypeModal({ examType, onClose, onDeleted }) {
  const [impact, setImpact]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAck] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/exam-types/${examType.id}/impact`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Could not check what this would delete.');
        if (!cancel) setImpact(d);
      } catch (e) {
        if (!cancel) setError(e.message);
      }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [examType.id]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exam-types/${examType.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Delete failed');
      }
      onDeleted();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  };

  const totalMarks  = impact?.total_marks ?? 0;
  const otherYears  = impact?.other_year_marks ?? 0;
  const needsAck    = totalMarks > 0;
  const canDelete   = !loading && !deleting && !error && (!needsAck || acknowledged);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-md bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Trash2 className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Delete &ldquo;{examType.name}&rdquo;</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">Checking what this would remove&hellip;</p>
            </div>
          </div>
          <button onClick={onClose} disabled={deleting} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1 disabled:opacity-50">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="animate-spin size-7 text-primary" />
            </div>
          ) : error && !impact ? (
            <div className="rounded-md bg-red-50 ring-1 ring-inset ring-red-500/20 px-4 py-3 text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-px" /> {error}
            </div>
          ) : totalMarks === 0 ? (
            <>
              <div className="rounded-md bg-emerald-50 ring-1 ring-inset ring-emerald-600/20 px-4 py-3 flex items-start gap-2.5">
                <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 leading-relaxed">
                  <strong>No marks have been entered against this exam type</strong> in any academic year. Nothing will be lost.
                  {impact?.max_marks_rows > 0 && (
                    <> Its max-marks settings ({impact.max_marks_rows} {impact.max_marks_rows === 1 ? 'row' : 'rows'}) will be removed with it.</>
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* The headline: what actually happens */}
              <div className="rounded-md bg-red-50 ring-1 ring-inset ring-red-500/20 px-4 py-3 flex items-start gap-2.5">
                <ShieldAlert className="size-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-700 leading-relaxed">
                  Deleting <strong>{examType.name}</strong> permanently removes <strong>{totalMarks}</strong> entered
                  {totalMarks === 1 ? ' mark' : ' marks'}
                  {otherYears > 0 && (
                    <> — <strong>including {otherYears} from academic {otherYears === 1 ? 'year' : 'years'} you are no longer working in</strong></>
                  )}.
                  Report cards for those years will change. <strong>This cannot be undone.</strong>
                </div>
              </div>

              {/* Per-year breakdown */}
              <div className="rounded-md ring-1 ring-black/5 overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Marks that would be deleted</p>
                </div>
                <div className="divide-y divide-zinc-100">
                  {(impact?.years || []).map((y, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-zinc-800 flex items-center gap-2 min-w-0">
                        <span className="truncate">{y.name}</span>
                        {y.is_active_year ? (
                          <span className="text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary ring-1 ring-primary/20 px-1.5 py-0.5 rounded shrink-0">
                            Active year
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold uppercase tracking-wider bg-red-50 text-red-700 ring-1 ring-red-600/20 px-1.5 py-0.5 rounded shrink-0">
                            Closed year
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-bold text-zinc-900 tabular-nums shrink-0">
                        {y.marks} {y.marks === 1 ? 'mark' : 'marks'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {otherYears > 0 && (
                <div className="rounded-md bg-amber-50 ring-1 ring-inset ring-amber-500/20 px-4 py-3 flex items-start gap-2.5">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    <strong>Back up the closed years first.</strong> Download their archives from
                    <strong> Manage Logins &rarr; Academics Year</strong> (or the <strong>Downloads</strong> tab) before you delete —
                    once these marks are gone they cannot be recovered from the app, and a past year's report cards will no longer match
                    what you already issued.
                  </p>
                </div>
              )}

              {/* Acknowledgement */}
              <label className="flex items-start gap-2 rounded-md ring-1 ring-black/5 p-4 cursor-pointer">
                <input type="checkbox" checked={acknowledged} onChange={e => setAck(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-zinc-300 text-primary focus:ring-2 focus:ring-primary/30" />
                <span className="text-[11px] text-zinc-600 leading-relaxed">
                  I understand this permanently deletes <strong>{totalMarks}</strong> {totalMarks === 1 ? 'mark' : 'marks'}
                  {otherYears > 0 && <> across <strong>{(impact?.years || []).length}</strong> academic years, including closed ones</>},
                  that affected report cards will change, and that it cannot be recovered from the app.
                </span>
              </label>

              {error && (
                <div className="rounded-md bg-red-50 ring-1 ring-inset ring-red-500/20 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-px" /> {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-zinc-100">
          <button onClick={onClose} disabled={deleting}
            className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={!canDelete}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md text-xs font-semibold inline-flex items-center gap-2 transition-colors disabled:cursor-not-allowed">
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {deleting ? 'Deleting…' : 'Delete Exam Type'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
//  2. Max Marks — per class, per exam, with subjects.
//
//  TWO MUTUALLY-EXCLUSIVE MODES per exam column:
//    • All-Subjects mode  — type a value in the "All Subjects" row. The
//      per-subject cells below lock (they all inherit that one value).
//    • Per-subject mode    — type a value in any subject row. The
//      "All Subjects" cell for that exam clears and locks.
//  Entering on one side automatically empties + disables the other side
//  (and vice-versa). Each exam column is independent.
//
//  Subjects shown for a class come from the same subject→class links used
//  everywhere else (a subject with no links applies to all classes).
// =====================================================================
function MaxMarksPanel() {
  const { user } = useAuth();
  const [types, setTypes]                 = useState([]);
  const [classes, setClasses]             = useState([]);
  const [subjects, setSubjects]           = useState([]);
  const [subjectClasses, setSubjectClasses] = useState({}); // { subject_id: [class_ids] }
  const [grid, setGrid]                   = useState({});    // `${typeId}:${classId}:${subjectId}` -> max string
  const [pickedClass, setPickedClass]     = useState('');
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, aggRes, mRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/exam-types/${user.institutionId}`),
        fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`),
        fetch(`${API_BASE_URL}/admin/exam-max-marks/${user.institutionId}`)
      ]);
      const tData = await tRes.json();
      const aggData = await aggRes.json();
      const mData = await mRes.json();

      const cls = aggData.classes || [];
      setTypes(Array.isArray(tData) ? tData : []);
      setClasses(cls);
      setSubjects(aggData.subjects || []);
      setSubjectClasses(aggData.subjectClasses || {});

      const g = {};
      (Array.isArray(mData) ? mData : []).forEach(r => {
        const sid = (r.subject_id === undefined || r.subject_id === null) ? 0 : r.subject_id;
        g[`${r.exam_type_id}:${r.class_id}:${sid}`] = String(r.max_marks);
      });
      setGrid(g);
      setPickedClass(prev => (prev ? prev : (cls[0] ? String(cls[0].id) : '')));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Subjects that belong to a class (no links = available to all classes).
  const subjectsForClass = useCallback((classId) => {
    const cid = parseInt(classId, 10);
    return subjects.filter(s => {
      const links = subjectClasses[s.id];
      if (!links || links.length === 0) return true;
      return links.map(Number).includes(cid);
    });
  }, [subjects, subjectClasses]);

  const classSubjects = useMemo(
    () => (pickedClass ? subjectsForClass(pickedClass) : []),
    [pickedClass, subjectsForClass]
  );

  // Per exam column: which side is locked for the picked class.
  //   perSubjectLocked -> All-Subjects has a value (subjects inherit it)
  //   allLocked        -> a subject has a value (one-value mode is off)
  const colMode = useMemo(() => {
    const map = {};
    if (!pickedClass) return map;
    types.forEach(t => {
      const allVal = grid[`${t.id}:${pickedClass}:0`] ?? '';
      const subjVal = classSubjects.some(s => (grid[`${t.id}:${pickedClass}:${s.id}`] ?? '') !== '');
      map[t.id] = {
        perSubjectLocked: allVal !== '',
        allLocked: allVal === '' && subjVal
      };
    });
    return map;
  }, [types, pickedClass, grid, classSubjects]);

  // Editing one side clears + disables the other (mutual exclusion).
  const setCell = (typeId, classId, subjectId, value) => {
    if (!/^\d*$/.test(value)) return;
    setGrid(prev => {
      const next = { ...prev, [`${typeId}:${classId}:${subjectId}`]: value };
      if (value !== '') {
        if (Number(subjectId) === 0) {
          // All-Subjects entered -> clear every per-subject override here
          subjectsForClass(classId).forEach(s => {
            next[`${typeId}:${classId}:${s.id}`] = '';
          });
        } else {
          // A per-subject value entered -> clear the All-Subjects default
          next[`${typeId}:${classId}:0`] = '';
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist every class fully. For each exam+class we send EITHER the
      // All-Subjects default (subject 0) with per-subject rows blanked, OR
      // the per-subject rows with the default blanked — never both. Blank
      // => the backend deletes that row, so the modes stay exclusive.
      const entries = [];
      classes.forEach(c => {
        const subs = subjectsForClass(c.id);
        types.forEach(t => {
          const allVal = grid[`${t.id}:${c.id}:0`] ?? '';
          if (allVal !== '') {
            entries.push({ exam_type_id: t.id, class_id: c.id, subject_id: 0, max_marks: allVal });
            subs.forEach(s => entries.push({ exam_type_id: t.id, class_id: c.id, subject_id: s.id, max_marks: '' }));
          } else {
            entries.push({ exam_type_id: t.id, class_id: c.id, subject_id: 0, max_marks: '' });
            subs.forEach(s => entries.push({
              exam_type_id: t.id, class_id: c.id, subject_id: s.id,
              max_marks: grid[`${t.id}:${c.id}:${s.id}`] ?? ''
            }));
          }
        });
      });

      const res = await fetch(`${API_BASE_URL}/admin/exam-max-marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      alert('Max marks saved.');
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  if (types.length === 0 || classes.length === 0) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
        <Grid3x3 className="size-10 text-zinc-300 mb-3" />
        <p className="text-zinc-500 text-sm font-medium">
          {types.length === 0 ? 'Add exam types first.' : 'Add classes first (Manage Logins).'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-900 text-sm">Max Marks per Class</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5 max-w-2xl">
            Pick a class, then for each exam set the max marks <strong>one of two ways</strong>: type a value in the
            <strong> All Subjects</strong> row to use it for every subject (the subject rows lock), or type values in the
            <strong> individual subject</strong> rows to set them separately (the All-Subjects cell clears and locks).
            Each exam column is independent. Leave an exam fully blank if the class doesn't take it.
          </p>
        </div>

        {/* Class picker */}
        <div className="relative w-full sm:w-64 shrink-0">
          <select value={pickedClass} onChange={e => setPickedClass(e.target.value)}
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
            <option value="">Select a class...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.className}{c.section ? ` - ${c.section}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Max marks are shared config too — changing one re-bases history. */}
      <div className="rounded-md bg-amber-50/70 ring-1 ring-inset ring-amber-500/20 px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-800 leading-relaxed">
          <span className="font-semibold">Max marks apply to every academic year, not just the active one.</span> Changing a value
          re-calculates the percentage on report cards that are already issued — past years included. Set these at the start and
          leave them; if a paper's total genuinely changes, add a new exam type instead of editing an old one.
        </p>
      </div>

      {!pickedClass ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <Grid3x3 className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">Pick a class to set its max marks.</p>
        </div>
      ) : classSubjects.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <BookOpen className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No subjects assigned to this class yet.</p>
          <p className="text-zinc-400 text-xs mt-1">Add subjects (and link them to this class) in the Subjects tab.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider sticky left-0 bg-zinc-50/95 backdrop-blur z-10 border-b border-zinc-100 w-48">Subject</th>
                {types.map(t => (
                  <th key={t.id} className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-center whitespace-nowrap">{t.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {/* All Subjects (default) row */}
              <tr className="bg-primary/5">
                <td className="px-5 py-3 sticky left-0 bg-primary/5 z-10 border-r border-zinc-100 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-primary text-sm">
                    <Layers className="size-3.5" /> All Subjects
                  </span>
                  <span className="block text-[10px] font-medium text-primary/70 mt-0.5">One value for every subject</span>
                </td>
                {types.map(t => {
                  const locked = colMode[t.id]?.allLocked;
                  return (
                    <td key={t.id} className="p-2 border-r border-zinc-100 last:border-r-0">
                      <input
                        value={locked ? '' : (grid[`${t.id}:${pickedClass}:0`] ?? '')}
                        onChange={e => setCell(t.id, pickedClass, 0, e.target.value)}
                        disabled={locked}
                        inputMode="numeric"
                        placeholder={locked ? 'per-subj' : '-'}
                        title={locked
                          ? 'Per-subject marks are set for this exam. Clear them to use one value for all subjects.'
                          : 'Applies to every subject for this exam'}
                        className={`h-8 w-16 mx-auto block rounded-md px-2 text-sm text-center font-semibold tabular-nums outline-none transition-colors shadow-sm ${
                          locked
                            ? 'bg-zinc-100 border border-zinc-200 text-zinc-300 placeholder:text-zinc-300 cursor-not-allowed'
                            : 'bg-white border border-primary/30 focus:ring-2 focus:ring-primary/20 focus:border-primary/40'
                        }`} />
                    </td>
                  );
                })}
              </tr>

              {/* Per-subject override rows */}
              {classSubjects.map(s => (
                <tr key={s.id} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="px-5 py-3 font-semibold text-zinc-900 text-sm sticky left-0 bg-white whitespace-nowrap border-r border-zinc-100 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                    {s.name}
                  </td>
                  {types.map(t => {
                    const locked = colMode[t.id]?.perSubjectLocked;
                    const inherit = grid[`${t.id}:${pickedClass}:0`];
                    return (
                      <td key={t.id} className="p-2 border-r border-zinc-100 last:border-r-0">
                        <input
                          value={locked ? '' : (grid[`${t.id}:${pickedClass}:${s.id}`] ?? '')}
                          onChange={e => setCell(t.id, pickedClass, s.id, e.target.value)}
                          disabled={locked}
                          inputMode="numeric"
                          placeholder={locked ? (inherit ? String(inherit) : '-') : '-'}
                          title={locked
                            ? `Locked — inherits ${inherit || 'the'} from All Subjects. Clear All Subjects to set this subject separately.`
                            : 'Overrides the All-Subjects value for this subject'}
                          className={`h-8 w-16 mx-auto block rounded-md px-2 text-sm text-center font-semibold tabular-nums outline-none transition-colors shadow-sm ${
                            locked
                              ? 'bg-zinc-50 border border-dashed border-zinc-200 text-zinc-400 placeholder:text-zinc-400 cursor-not-allowed'
                              : 'bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-300 focus:ring-2 focus:ring-primary/20 focus:border-primary/40'
                          }`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="h-9 w-full sm:w-auto bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white px-6 rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors">
          {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
          {saving ? 'Saving...' : 'Save Max Marks'}
        </button>
      </div>
    </div>
  );
}

// =====================================================================
//  3. Teacher Assignment
// =====================================================================
function TeacherAssignPanel() {
  const { user } = useAuth();
  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [pickedClass, setPickedClass] = useState('');
  const [assignments, setAssignments] = useState({});  // subject_id -> {id, teacher_id, teacher_name}
  const [draft, setDraft] = useState({});              // subject_id -> teacher_id being picked
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  // Bootstrap classes/subjects/teachers, then default to the first class
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
        const agg = await res.json();
        const cls = agg.classes || [];
        setClasses(cls);
        setSubjects(agg.subjects || []);
        setTeachers((agg.users || []).filter(u =>
          (u.role || '').toLowerCase().includes('teacher')
        ));
        // Default-select the first class so subjects show immediately
        if (cls.length > 0) {
          setPickedClass(prev => (prev ? prev : String(cls[0].id)));
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user]);

  // Load assignments when class picked
  const loadAssignments = useCallback(async (classId) => {
    if (!classId) { setAssignments({}); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subject-teachers/${classId}`);
      const data = await res.json();
      const map = {};
      (Array.isArray(data) ? data : []).forEach(a => { map[a.subject_id] = a; });
      setAssignments(map);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadAssignments(pickedClass); }, [pickedClass, loadAssignments]);

  const handleAssign = async (subjectId) => {
    const teacherId = draft[subjectId];
    if (!teacherId) return alert('Pick a teacher first.');
    setSavingId(subjectId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subject-teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          class_id: parseInt(pickedClass, 10),
          subject_id: subjectId,
          teacher_id: parseInt(teacherId, 10)
        })
      });
      if (!res.ok) throw new Error('Assign failed');
      loadAssignments(pickedClass);
    } catch (e) { alert(e.message); }
    setSavingId(null);
  };

  const handleRemove = async (assignmentId, subjectId) => {
    if (!window.confirm('Remove this teacher assignment?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subject-teachers/${assignmentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      setDraft(prev => ({ ...prev, [subjectId]: '' }));
      loadAssignments(pickedClass);
    } catch (e) { alert(e.message); }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-zinc-900 text-sm">Teacher Assignment</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          Assign one teacher per subject for a class. That teacher can enter marks only for their subject.
        </p>
      </div>

      <div className="relative w-full sm:w-72">
        <select value={pickedClass} onChange={e => setPickedClass(e.target.value)}
          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
          <option value="">Select a class...</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>
              {c.className}{c.section ? ` - ${c.section}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {!pickedClass ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <UserCog className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">Pick a class to assign teachers.</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <p className="text-zinc-500 text-sm font-medium">No subjects in this school yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm divide-y divide-zinc-100">
          {subjects.map(sub => {
            const current = assignments[sub.id];
            return (
              <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="font-semibold text-zinc-900 sm:w-48 text-sm">{sub.name}</div>
                {current ? (
                  <div className="flex-1 flex items-center justify-between gap-3 bg-emerald-50 ring-1 ring-emerald-600/20 rounded-md px-4 py-2">
                    <span className="text-sm text-emerald-800 flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">Assigned</span>
                      <span className="font-semibold">{current.teacher_name}</span>
                    </span>
                    <button onClick={() => handleRemove(current.id, sub.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors">
                      <X className="size-3.5 shrink-0" /> <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <select value={draft[sub.id] || ''}
                        onChange={e => setDraft(prev => ({ ...prev, [sub.id]: e.target.value }))}
                        className="h-9 w-full bg-zinc-50/50 border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors">
                        <option value="">Select teacher...</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <button onClick={() => handleAssign(sub.id)} disabled={savingId === sub.id}
                      className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0">
                      {savingId === sub.id ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Check className="size-3.5 shrink-0" />}
                      Assign
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================================================
//  4. Subject Order — per class, control the order subjects appear in
//     Marks Entry and on the Report Card.
//
//  Order is stored per class (class_subject_order) and applied by the
//  backend, so Marks Entry / Report Card / export just render whatever
//  order the API returns. A subject with no saved position (e.g. added
//  later) falls to the bottom in A-Z order until the admin reorders.
// =====================================================================
function SubjectOrderPanel() {
  const { user } = useAuth();
  const [classes, setClasses]     = useState([]);
  const [pickedClass, setPickedClass] = useState('');
  const [list, setList]           = useState([]);   // ordered [{id, name, sort_order}]
  const [loading, setLoading]     = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState(false);

  // Bootstrap classes, default to the first
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
        const agg = await res.json();
        const cls = agg.classes || [];
        setClasses(cls);
        if (cls.length > 0) setPickedClass(prev => (prev ? prev : String(cls[0].id)));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user]);

  const loadOrder = useCallback(async (classId) => {
    if (!classId) { setList([]); return; }
    setListLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subject-order/${classId}`);
      const d = await res.json();
      setList(Array.isArray(d) ? d : []);
      setDirty(false);
    } catch (e) { console.error(e); }
    setListLoading(false);
  }, []);

  useEffect(() => { loadOrder(pickedClass); }, [pickedClass, loadOrder]);

  const move = (i, dir) => {
    setList(prev => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
      return next;
    });
    setDirty(true);
  };

  const sortAZ = () => {
    setList(prev => [...prev].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subject-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: parseInt(pickedClass, 10), subject_ids: list.map(s => s.id) })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Save failed'); }
      setDirty(false);
      loadOrder(pickedClass);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  if (classes.length === 0) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
        <ListOrdered className="size-10 text-zinc-300 mb-3" />
        <p className="text-zinc-500 text-sm font-medium">Add classes first (Manage Logins).</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-900 text-sm">Subject Order per Class</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5 max-w-2xl">
            Choose the order subjects appear for a class. This is the order used in <strong>Marks Entry</strong> and on the
            <strong> Report Card</strong>. Each class has its own order — set it however you like and change it anytime.
          </p>
        </div>

        {/* Class picker */}
        <div className="relative w-full sm:w-64 shrink-0">
          <select value={pickedClass} onChange={e => setPickedClass(e.target.value)}
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
            <option value="">Select a class...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.className}{c.section ? ` - ${c.section}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <div className="rounded-md bg-blue-50/60 ring-1 ring-inset ring-blue-500/15 px-4 py-3 flex items-start gap-2.5">
        <ListOrdered className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-800 leading-relaxed">
          Move subjects up or down, then <span className="font-semibold">Save Order</span>. Any subject without a saved
          position (for example one added later) falls to the bottom in A-Z order until you reorder.
        </p>
      </div>

      {listLoading ? (
        <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin size-7 text-primary" /></div>
      ) : !pickedClass ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <ListOrdered className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">Pick a class to order its subjects.</p>
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <BookOpen className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No subjects assigned to this class yet.</p>
          <p className="text-zinc-400 text-xs mt-1">Add subjects (and link them to this class) in the Subjects tab.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {list.length} subject{list.length !== 1 ? 's' : ''}
            </span>
            <button onClick={sortAZ}
              className="text-[11px] font-semibold text-zinc-500 hover:text-primary transition-colors">
              Sort A-Z
            </button>
          </div>

          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm divide-y divide-zinc-100">
            {list.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="size-7 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center tabular-nums shrink-0">
                  {i + 1}
                </span>
                <GripVertical className="size-4 text-zinc-300 shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-semibold text-zinc-900 truncate">{s.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    className="size-7 rounded-md bg-white ring-1 ring-inset ring-zinc-200 text-zinc-500 hover:text-primary hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors" title="Move up">
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === list.length - 1}
                    className="size-7 rounded-md bg-white ring-1 ring-inset ring-zinc-200 text-zinc-500 hover:text-primary hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors" title="Move down">
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleSave} disabled={saving || !dirty}
              className="h-9 w-full sm:w-auto bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white px-6 rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors">
              {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
              {saving ? 'Saving...' : (dirty ? 'Save Order' : 'Saved')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================================
//  5. Grade Scales — reusable %-band grade tables.
//
//  A scale is a name plus a list of bands; each band is a minimum % and a
//  label. A mark's grade is the band with the HIGHEST min% it reaches.
//  Because matching is on percentage (achieved / max), one scale works no
//  matter what an exam is out of. Scales are assigned to exam types in the
//  Exam Types tab and shown on the report card (report-card rendering
//  arrives with the computation engine).
// =====================================================================
// =====================================================================
//  Grading — per class + per exam type.
//
//  Pick a class, then an exam type; set the %-bands for that pair. A mark's
//  grade is the band with the highest minimum % it reaches (matched on
//  percentage, so it works whatever the exam is out of). Each class/exam
//  keeps its own ranges. The report card grades every exam from these.
// =====================================================================
function GradingPanel() {
  const { user } = useAuth();
  const [classes, setClasses]   = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [pickedClass, setPickedClass] = useState('');
  const [pickedExam, setPickedExam]   = useState('');
  const [bands, setBands]       = useState([{ min_pct: '', label: '' }]);
  const [loading, setLoading]   = useState(true);
  const [bandsLoading, setBandsLoading] = useState(false);
  const [saving, setSaving]     = useState(false);

  // Bootstrap classes + exam types.
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [aRes, tRes] = await Promise.all([
          fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`),
          fetch(`${API_BASE_URL}/admin/exam-types/${user.institutionId}`)
        ]);
        const agg = await aRes.json();
        const t = await tRes.json();
        const cls = agg.classes || [];
        setClasses(cls);
        setExamTypes(Array.isArray(t) ? t : []);
        if (cls.length > 0) setPickedClass(prev => (prev ? prev : String(cls[0].id)));
        if (Array.isArray(t) && t.length > 0) setPickedExam(prev => (prev ? prev : String(t[0].id)));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user]);

  // Load bands whenever class or exam changes.
  const loadBands = useCallback(async (classId, examId) => {
    if (!classId || !examId) { setBands([{ min_pct: '', label: '' }]); return; }
    setBandsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exam-grades/${classId}/${examId}`);
      const d = await res.json();
      const b = (Array.isArray(d) ? d : []).map(x => ({ min_pct: String(x.min_pct), label: x.label }));
      setBands(b.length ? b : [{ min_pct: '', label: '' }]);
    } catch (e) { console.error(e); }
    setBandsLoading(false);
  }, []);

  useEffect(() => { loadBands(pickedClass, pickedExam); }, [pickedClass, pickedExam, loadBands]);

  const setBand = (i, key, val) => setBands(prev => prev.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
  const addBand = () => setBands(prev => [...prev, { min_pct: '', label: '' }]);
  const removeBand = (i) => setBands(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const handleSave = async () => {
    if (!pickedClass || !pickedExam) return alert('Pick a class and an exam type first.');
    const clean = bands
      .map(b => ({ min_pct: b.min_pct === '' ? null : parseFloat(b.min_pct), label: (b.label || '').trim() }))
      .filter(b => b.label && b.min_pct !== null && !isNaN(b.min_pct));
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exam-grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: parseInt(pickedClass, 10), exam_type_id: parseInt(pickedExam, 10), bands: clean })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Save failed'); }
      alert('Grading saved.');
      loadBands(pickedClass, pickedExam);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  if (classes.length === 0 || examTypes.length === 0) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
        <Award className="size-10 text-zinc-300 mb-3" />
        <p className="text-zinc-500 text-sm font-medium">
          {classes.length === 0 ? 'Add classes first (Manage Logins).' : 'Add exam types first.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-zinc-900 text-sm">Grading</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5 max-w-2xl">
          Set grade ranges per class and per exam type. Pick a class, then an exam, then add the bands. Each class can grade the
          same exam differently. The report card shows the grade for each exam from these ranges.
        </p>
      </div>

      {/* Class + Exam pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Class</label>
          <div className="relative mt-1.5">
            <select value={pickedClass} onChange={e => setPickedClass(e.target.value)}
              className={`${inputCls} pr-8 appearance-none cursor-pointer`}>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.className}{c.section ? ` - ${c.section}` : ''}</option>
              ))}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Exam Type</label>
          <div className="relative mt-1.5">
            <select value={pickedExam} onChange={e => setPickedExam(e.target.value)}
              className={`${inputCls} pr-8 appearance-none cursor-pointer`}>
              {examTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Bands editor */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-4 sm:p-5">
        {bandsLoading ? (
          <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin size-7 text-primary" /></div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Bands</label>
              <button onClick={addBand}
                className="text-[11px] font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors">
                <Plus className="size-3.5" /> Add band
              </button>
            </div>

            <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center mb-1.5 px-1">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Min %</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Grade Label</span>
              <span></span>
            </div>

            <div className="space-y-2">
              {bands.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
                  <input value={b.min_pct} inputMode="decimal"
                    onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setBand(i, 'min_pct', e.target.value); }}
                    placeholder="91"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 text-center tabular-nums placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
                  <input value={b.label}
                    onChange={e => setBand(i, 'label', e.target.value)}
                    placeholder="A1"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
                  <button onClick={() => removeBand(i)} disabled={bands.length <= 1}
                    className="size-9 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors" title="Remove band">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-md bg-blue-50/60 ring-1 ring-inset ring-blue-500/15 px-3 py-2.5 mt-3 flex items-start gap-2">
              <Award className="size-3.5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-800 leading-relaxed">
                A mark's grade is the band with the highest minimum % it reaches (e.g. 91+ = A1, 81+ = A2). You don't set a
                maximum &mdash; each band runs up to the next one. Leave the bands empty to show no grade for this class/exam.
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <button onClick={handleSave} disabled={saving}
                className="h-9 w-full sm:w-auto bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white px-6 rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors">
                {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                {saving ? 'Saving...' : 'Save Grading'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
const inputCls = 'h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm';

// Trim trailing decimals: 91.00 -> 91, 90.50 -> 90.5
const fmtPct = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
};

function FormField({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {label}{required && <span className="text-accent">*</span>}
      </label>
      {children}
    </div>
  );
}