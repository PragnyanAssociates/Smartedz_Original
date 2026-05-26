import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import { Clock, Loader2, ArrowLeft, Save, Check } from 'lucide-react';

// =====================================================================
//  Lesson Periods — image 1.
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
    <div className="space-y-5">
      {/* Header */}
      <div className="relative flex flex-col items-center text-center">
        <button onClick={onBackToIndex}
          className="sm:absolute sm:left-0 sm:top-0 inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600 mb-3 sm:mb-0">
          <ArrowLeft size={15} /> Back to Subject Index
        </button>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Lesson Periods</h2>
        {activeYear && (
          <span className="mt-1 inline-block bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1 rounded-lg">
            {activeYear.year_name || activeYear.name || ''}
          </span>
        )}
        <p className="text-slate-500 font-medium mt-1">
          Manage time allocation and schedules for syllabus lessons
        </p>
        <p className="text-sm font-bold text-slate-400 mt-1">
          {syllabus.class_group} · {syllabus.subject_name}
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No lessons yet for this syllabus.</p>
          <p className="text-slate-400 text-sm mt-1">
            Add chapters in the Subject Index first.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-5 text-center w-20">S.No</th>
                <th className="p-5">Lessons</th>
                <th className="p-5 text-center w-40">Periods</th>
                <th className="p-5 text-center">Start Date - End Date</th>
                {canEdit && <th className="p-5 text-right w-24">Save</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, idx) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 text-center font-black text-blue-600">{idx + 1}</td>
                  <td className="p-5 font-bold text-slate-700">{r.title}</td>
                  <td className="p-5 text-center">
                    {canEdit ? (
                      <input type="number" min={0} value={r.periods}
                        onChange={e => setField(r.id, 'periods', e.target.value)}
                        className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-blue-500/10" />
                    ) : (
                      <span className="font-black text-slate-700">{r.periods}</span>
                    )}
                  </td>
                  <td className="p-5">
                    <div className="flex items-center justify-center gap-2">
                      {canEdit ? (
                        <>
                          <input type="date" value={r.start_date}
                            onChange={e => setField(r.id, 'start_date', e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
                          <span className="text-slate-300 font-bold">–</span>
                          <input type="date" value={r.end_date}
                            onChange={e => setField(r.id, 'end_date', e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
                        </>
                      ) : (
                        <span className="text-sm font-medium text-slate-500">
                          {r.start_date || '—'} <span className="text-slate-300">–</span> {r.end_date || '—'}
                        </span>
                      )}
                    </div>
                  </td>
                  {canEdit && (
                    <td className="p-5 text-right">
                      <button onClick={() => saveRow(r)} disabled={savingId === r.id}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          savedId === r.id
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                        }`}>
                        {savingId === r.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : savedId === r.id ? <Check size={13} /> : <Save size={13} />}
                        {savedId === r.id ? 'Saved' : 'Save'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-black text-slate-700">
                <td className="p-5" colSpan={2}>Total</td>
                <td className="p-5 text-center text-blue-600">{totalPeriods} periods</td>
                <td className="p-5" colSpan={canEdit ? 2 : 1}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}