import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, X, BookOpen, Loader2, Check, CalendarDays, FileText, Info } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

// =====================================================================
//  SubjectsTab — create subjects, assign them to classes, and choose
//  WHERE each subject applies:
//    • Timetable      -> offered as a period option (e.g. Computer).
//    • Report Card    -> counted in Marks Entry / Report Cards / Performance.
//  A subject can be one, the other, or both. Existing subjects default to
//  BOTH, so nothing you already set up disappears — edit to change scope.
// =====================================================================

export default function SubjectsTab({ data, fetchData, user }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [name, setName]           = useState('');
  const [classIds, setClassIds]   = useState([]);   // array of class id strings
  const [inTimetable, setInTimetable] = useState(true);
  const [inReport, setInReport]       = useState(true);
  const [saving, setSaving]       = useState(false);

  // Per subject-class scope, fetched from the backend:
  //   scope[subjectId] = [{ class_id, in_timetable, in_report }]
  const [scope, setScope] = useState({});

  const subjectClasses = data.subjectClasses || {};

  const fetchScope = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subject-classes/${user.institutionId}`);
      const rows = await res.json();
      const map = {};
      (Array.isArray(rows) ? rows : []).forEach(r => {
        (map[r.subject_id] = map[r.subject_id] || []).push({
          class_id: r.class_id,
          in_timetable: Number(r.in_timetable),
          in_report: Number(r.in_report)
        });
      });
      setScope(map);
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => { fetchScope(); }, [fetchScope]);

  // Subject-level scope for display: shown in timetable / report if ANY of
  // its class links say so (uniform in practice). No links => both (all classes).
  const subjectScope = (subjectId) => {
    const rows = scope[subjectId];
    if (!rows || rows.length === 0) return { timetable: true, report: true };
    return {
      timetable: rows.some(r => r.in_timetable === 1),
      report: rows.some(r => r.in_report === 1)
    };
  };

  const openAdd = () => {
    setEditing(null);
    setName('');
    setClassIds([]);
    setInTimetable(true);
    setInReport(true);
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setName(s.name);
    const linked = (subjectClasses[s.id] || []).map(String);
    setClassIds(linked);
    const sc = subjectScope(s.id);
    setInTimetable(sc.timetable);
    setInReport(sc.report);
    setShowModal(true);
  };

  const toggleClass = (cid) => {
    const id = String(cid);
    setClassIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return alert('Subject name is required.');
    if (!inTimetable && !inReport) return alert('Pick at least one: Timetable or Report Card.');
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        institutionId: user.institutionId,
        class_ids: classIds.map(x => parseInt(x, 10)),
        in_timetable: inTimetable ? 1 : 0,
        in_report: inReport ? 1 : 0
      };
      const url = editing
        ? `${API_BASE_URL}/admin/subjects/${editing.id}`
        : `${API_BASE_URL}/admin/subjects`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setShowModal(false);
      fetchData();
      fetchScope();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.name}"? It will be removed from all classes, timetables and marks.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subjects/${s.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      fetchData();
      fetchScope();
    } catch (e) { alert(e.message); }
  };

  const classLabel = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;
  const subjectClassNames = (subjectId) => {
    const ids = subjectClasses[subjectId] || [];
    if (ids.length === 0) return null;   // -> "All classes"
    return ids
      .map(cid => {
        const c = data.classes.find(x => x.id === cid);
        return c ? classLabel(c) : null;
      })
      .filter(Boolean);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-start mb-2">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Subjects</h3>
          <p className="text-[11px] text-zinc-500 max-w-2xl mt-1">
            Create subjects and assign them to classes. Each subject can appear in the Timetable, the Report Card, or both.
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0 w-fit self-start sm:self-auto">
          <Plus className="size-3.5 shrink-0" /> Add Subject
        </button>
      </div>

      {/* How to use */}
      <div className="rounded-md bg-blue-50/60 ring-1 ring-inset ring-blue-500/15 px-4 py-3 flex items-start gap-2.5">
        <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-800 leading-relaxed">
          <span className="font-semibold">Where does a subject apply?</span> Tick <strong>Timetable</strong> for subjects that
          are only a period (e.g. Computer) — they show up when building the timetable but never on report cards. Tick
          <strong> Report Card</strong> for subjects that carry marks — they appear in Marks Entry, Report Cards and Performance.
          Tick <strong>both</strong> for the usual subjects. Everything you already created is set to <strong>both</strong> — use
          the edit button to change any subject.
        </p>
      </div>

      {(data.subjects || []).length === 0 ? (
        <div className="bg-white p-8 rounded-lg ring-1 ring-black/5 border-dashed text-center">
          <BookOpen className="mx-auto text-zinc-300 mb-3 size-8" />
          <p className="text-xs text-zinc-500 italic">No subjects yet. Add one to begin.</p>
        </div>
      ) : (
        <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Subject Name</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Used In</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Assigned Classes</th>
                <th className="px-5 py-3 border-b border-zinc-100"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.subjects.map(s => {
                const names = subjectClassNames(s.id);
                const sc = subjectScope(s.id);
                return (
                  <tr key={s.id} className="hover:bg-zinc-50/60 transition-colors group">
                    <td className="px-5 py-4 text-sm font-medium text-zinc-900 whitespace-nowrap">{s.name}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {sc.timetable && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/20 whitespace-nowrap">
                            <CalendarDays className="size-3" /> Timetable
                          </span>
                        )}
                        {sc.report && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 whitespace-nowrap">
                            <FileText className="size-3" /> Report Card
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {names === null ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 whitespace-nowrap">
                          All classes
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {names.map((n, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary ring-1 ring-primary/20 whitespace-nowrap">
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(s)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded transition-colors" title="Edit">
                          <Edit className="size-4 shrink-0" />
                        </button>
                        <button onClick={() => handleDelete(s)}
                          className="p-1.5 text-zinc-400 hover:text-accent rounded transition-colors" title="Delete">
                          <Trash2 className="size-4 shrink-0" />
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg p-6 shadow-xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors">
              <X className="size-5 shrink-0" />
            </button>

            <div className="mb-5">
              <h2 className="text-lg font-semibold text-zinc-900 mb-1">
                {editing ? 'Edit Subject' : 'Add Subject'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                Pick where it applies, then every class that studies it.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1.5 block">
                  Subject Name <span className="text-accent">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Mathematics"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                />
              </div>

              {/* Scope: where does this subject apply? */}
              <div>
                <span className="text-xs font-medium text-zinc-600 mb-2 block">Show this subject in</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button type="button" onClick={() => setInTimetable(v => !v)}
                    className={`flex items-center gap-2.5 p-3 rounded-md ring-1 transition-colors text-left ${
                      inTimetable ? 'bg-indigo-50 ring-indigo-500/30' : 'bg-white ring-zinc-200 hover:bg-zinc-50'
                    }`}>
                    <span className={`size-4 rounded flex items-center justify-center shrink-0 ${inTimetable ? 'bg-indigo-600 text-white' : 'ring-1 ring-zinc-300'}`}>
                      {inTimetable && <Check className="size-3" />}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1"><CalendarDays className="size-3.5 text-indigo-500" /> Timetable</span>
                      <span className="text-[10px] text-zinc-500">A period, e.g. Computer, Games</span>
                    </span>
                  </button>

                  <button type="button" onClick={() => setInReport(v => !v)}
                    className={`flex items-center gap-2.5 p-3 rounded-md ring-1 transition-colors text-left ${
                      inReport ? 'bg-emerald-50 ring-emerald-500/30' : 'bg-white ring-zinc-200 hover:bg-zinc-50'
                    }`}>
                    <span className={`size-4 rounded flex items-center justify-center shrink-0 ${inReport ? 'bg-emerald-600 text-white' : 'ring-1 ring-zinc-300'}`}>
                      {inReport && <Check className="size-3" />}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1"><FileText className="size-3.5 text-emerald-500" /> Report Card</span>
                      <span className="text-[10px] text-zinc-500">Carries marks (Marks Entry too)</span>
                    </span>
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 mt-2">Tick both for a normal subject. This applies to every class you select below.</p>
              </div>

              <div className="ring-1 ring-black/5 rounded-md p-5 bg-zinc-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="size-3.5 text-zinc-500" />
                    <span className="text-xs font-semibold text-zinc-700">Assign to Classes</span>
                  </div>
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full tabular-nums">
                    {classIds.length} selected
                  </span>
                </div>

                {(data.classes || []).length === 0 ? (
                  <p className="text-[11px] text-zinc-500 italic bg-white p-3 rounded ring-1 ring-black/5">
                    No classes created yet. Add classes in the Classes tab first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.classes.map(c => {
                      const id = String(c.id);
                      const selected = classIds.includes(id);
                      return (
                        <button type="button" key={c.id} onClick={() => toggleClass(c.id)}
                          className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold tracking-wide transition-colors flex items-center gap-1.5 ${
                            selected
                              ? 'bg-primary text-white ring-1 ring-primary'
                              : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
                          }`}>
                          {selected && <Check className="size-3" />}
                          {classLabel(c)}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-zinc-400 mt-3 pt-3 border-t border-zinc-200/60">
                  Leave all unticked to make this subject available to <strong>every</strong> class.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)}
                  className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2">
                  {saving && <Loader2 className="size-3.5 animate-spin" />}
                  {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Subject')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}