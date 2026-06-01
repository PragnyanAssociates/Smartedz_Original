import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import { Clock, Loader2, ArrowLeft, Save, Check, BookOpen } from 'lucide-react';

// =====================================================================
//  Lesson Periods
//  A table of the syllabus's chapters/lessons:
//    S.NO | LESSONS | PERIODS | START DATE - END DATE
//  Each row: a period-count input + a start-date / end-date pair.
//  Rows auto-save on change (debounced via an explicit Save per row).
//
//  Top-left: "Back to Subject Index".
// =====================================================================

export default function Periods({ syllabus, canEdit, activeYear, onBackToIndex }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/${syllabus.id}/chapters`);
      const d = await res.json();
      setRows((Array.isArray(d) ? d : []).map(c => ({
        ...c,
        periods: c.periods || 0,
        start_date: c.start_date || '',
        end_date: c.end_date || ''
      })));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [syllabus]);

  useEffect(() => { load(); }, [load]);

  const setField = (id, key, value) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [key]: value } : r));
  };

  const saveRow = async (row) => {
    setSavingId(row.id);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/chapter/${row.id}/periods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periods: Math.max(0, parseInt(row.periods, 10) || 0),
          start_date: row.start_date || null,
          end_date: row.end_date || null
        })
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedId(row.id);
      setTimeout(() => setSavedId(s => (s === row.id ? null : s)), 1500);
    } catch (e) { alert(e.message); }
    setSavingId(null);
  };

  const totalPeriods = rows.reduce((s, r) => s + (parseInt(r.periods, 10) || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      {/* Back Button (Top Edge) */}
      <div className="flex items-center">
        <button onClick={onBackToIndex}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors w-fit">
          <ArrowLeft className="size-4" /> Back to Subject Index
        </button>
      </div>

      {/* Header */}
      <header className="flex flex-col mb-2 sm:mb-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <BookOpen className="text-primary size-5" />
            Lesson Periods
          </h1>
          {activeYear && (
            <span className="bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ring-1 ring-inset ring-primary/20">
              {activeYear.year_name || activeYear.name || ''}
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
          Manage time allocation and schedules for syllabus lessons.
        </p>
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mt-1.5">
          {syllabus.class_group} - {syllabus.subject_name}
        </p>
      </header>

      <div className="flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <Clock className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No lessons yet for this syllabus.</p>
            <p className="text-zinc-400 text-xs mt-1.5">Add chapters in the Subject Index first.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-16 text-center">S.No</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Lessons</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-center w-32">Periods</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-center">Start Date - End Date</th>
                  {canEdit && <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right w-28">Save</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors group">
                    <td className="px-5 py-3 text-center font-semibold text-primary tabular-nums">{idx + 1}</td>
                    <td className="px-5 py-3 font-semibold text-sm text-zinc-900">{r.title}</td>
                    <td className="px-5 py-3 text-center">
                      {canEdit ? (
                        <input type="number" min={0} value={r.periods}
                          onChange={e => setField(r.id, 'periods', e.target.value)}
                          className="h-8 w-16 bg-white border border-zinc-200 rounded-md px-2 text-sm text-center font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors mx-auto" />
                      ) : (
                        <span className="font-semibold text-zinc-900 tabular-nums">{r.periods}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit ? (
                          <>
                            <input type="date" value={r.start_date}
                              onChange={e => setField(r.id, 'start_date', e.target.value)}
                              className="h-8 bg-white border border-zinc-200 rounded-md px-2 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors w-32" />
                            <span className="text-zinc-300 font-medium">-</span>
                            <input type="date" value={r.end_date}
                              onChange={e => setField(r.id, 'end_date', e.target.value)}
                              className="h-8 bg-white border border-zinc-200 rounded-md px-2 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors w-32" />
                          </>
                        ) : (
                          <span className="text-sm font-medium text-zinc-600">
                            {r.start_date || '-'} <span className="text-zinc-300 mx-1">-</span> {r.end_date || '-'}
                          </span>
                        )}
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button onClick={() => saveRow(r)} disabled={savingId === r.id}
                          className={`h-8 px-3 rounded-md text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 shadow-sm ${
                            savedId === r.id
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-white border border-zinc-200 text-zinc-700 hover:text-primary hover:border-primary/30 hover:bg-primary/5'
                          }`}>
                          {savingId === r.id
                            ? <Loader2 className="size-3.5 animate-spin shrink-0" />
                            : savedId === r.id ? <Check className="size-3.5 shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                          {savedId === r.id ? 'Saved' : 'Save'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50/80 border-t border-zinc-200/60">
                  <td className="px-5 py-4 font-semibold text-sm text-zinc-700" colSpan={2}>Total Allocated Periods</td>
                  <td className="px-5 py-4 text-center font-semibold text-primary text-sm tabular-nums">{totalPeriods}</td>
                  <td className="px-5 py-4" colSpan={canEdit ? 2 : 1}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}