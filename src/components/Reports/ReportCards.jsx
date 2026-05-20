import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, Loader2, Eye, Printer, Search, FileText
} from 'lucide-react';
import ReportCardView from './ReportCardView';

// =====================================================================
//  ReportCards — for one class, list students and open their report
//  card. Printing uses the browser's print dialog scoped to the card.
// =====================================================================

export default function ReportCards({ classInfo, onBack }) {
  const [students, setStudents] = useState([]);   // [{id, name, roll_no}]
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');

  const [card, setCard]         = useState(null);  // selected student's report card
  const [cardLoading, setCardLoading] = useState(false);

  // -----------------------------------------------------------------
  // Load class roster (reuse class-data endpoint — it returns students)
  // -----------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports/class-data/${classInfo.class_id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setStudents(d.students || []);
    } catch (e) { alert(e.message); }
    setLoading(false);
  }, [classInfo]);

  useEffect(() => { load(); }, [load]);

  // -----------------------------------------------------------------
  const openCard = async (studentId) => {
    setCardLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports/student/${studentId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load report card');
      setCard(d);
    } catch (e) { alert(e.message); }
    setCardLoading(false);
  };

  const handlePrint = () => window.print();

  const filtered = useMemo(() => {
    if (!query.trim()) return students;
    const q = query.toLowerCase();
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      String(s.roll_no || '').toLowerCase().includes(q)
    );
  }, [students, query]);

  // -----------------------------------------------------------------
  // Detail (single report card) view
  // -----------------------------------------------------------------
  if (card) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <button onClick={() => setCard(null)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
            <ArrowLeft size={14} /> Back to students
          </button>
          <button onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-100">
            <Printer size={15} /> Print
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden print:border-0 print:shadow-none print:rounded-none">
          <ReportCardView card={card} />
        </div>

        {/* Print CSS — only the report card shows on paper */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #report-card-printable, #report-card-printable * { visibility: visible; }
            #report-card-printable {
              position: absolute; left: 0; top: 0; width: 100%;
            }
          }
        `}</style>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // List view
  // -----------------------------------------------------------------
  return (
    <div className="space-y-4">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
        <ArrowLeft size={14} /> Back to classes
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800">{classInfo.class_group}</h2>
          <p className="text-xs text-slate-400 font-medium">Report Cards</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search students…"
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 shadow-sm" />
        </div>
      </div>

      {cardLoading && (
        <div className="text-center py-4">
          <Loader2 className="animate-spin w-6 h-6 text-blue-600 mx-auto" />
        </div>
      )}

      {loading ? (
        <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">
            {students.length === 0 ? 'No students in this class.' : 'No students match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-4 w-20">Roll No</th>
                <th className="p-4">Student Name</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-bold text-slate-500 text-sm">{s.roll_no || '—'}</td>
                  <td className="p-4 font-bold text-slate-700 text-sm">{s.name}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => openCard(s.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5">
                      <Eye size={13} /> View Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}