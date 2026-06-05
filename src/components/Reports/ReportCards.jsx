import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, Loader2, Eye, Printer, Search, FileText
} from 'lucide-react';
import ReportCardView from './ReportCardView';

// =====================================================================
//  ReportCards - for one class, list students and open their report
//  card. Printing uses the browser's print dialog scoped to the card.
//  Students are listed roll-wise (numeric) by default.
// =====================================================================

const rollNum = (s) => {
  const n = parseInt(s.roll_no, 10);
  return isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

export default function ReportCards({ classInfo, onBack }) {
  const [students, setStudents] = useState([]);   // [{id, name, roll_no}]
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');

  const [card, setCard]         = useState(null);  // selected student's report card
  const [cardLoading, setCardLoading] = useState(false);

  // -----------------------------------------------------------------
  // Load class roster (reuse class-data endpoint - it returns students)
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
    const base = query.trim()
      ? students.filter(s =>
          (s.name || '').toLowerCase().includes(query.toLowerCase()) ||
          String(s.roll_no || '').toLowerCase().includes(query.toLowerCase()))
      : [...students];
    // Roll-wise (numeric) default ordering
    base.sort((a, b) => {
      const r = rollNum(a) - rollNum(b);
      if (r !== 0) return r;
      return (a.name || '').localeCompare(b.name || '');
    });
    return base;
  }, [students, query]);

  // -----------------------------------------------------------------
  // Detail (single report card) view
  // -----------------------------------------------------------------
  if (card) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <button onClick={() => setCard(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors w-fit">
            <ArrowLeft className="size-4" /> Back to students
          </button>
          <button onClick={handlePrint}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto shrink-0">
            <Printer className="size-4" /> Print
          </button>
        </div>

        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden print:ring-0 print:shadow-none print:rounded-none">
          <ReportCardView card={card} />
        </div>

        {/* Print CSS - only the report card shows on paper */}
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
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ArrowLeft className="size-4" /> Back to classes
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">{classInfo.class_group}</h2>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-1">Report Cards</p>
        </div>
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search students..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm"
          />
        </div>
      </div>

      {cardLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="animate-spin size-6 text-primary" />
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="animate-spin size-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <FileText className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">
            {students.length === 0 ? 'No students in this class.' : 'No students match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-24">Roll No</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Student Name</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-zinc-50/60 transition-colors group">
                  <td className="px-5 py-4 font-semibold text-zinc-600 text-sm whitespace-nowrap">
                    {s.roll_no || '-'}
                  </td>
                  <td className="px-5 py-4 font-semibold text-zinc-900 text-sm">
                    {s.name}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <button onClick={() => openCard(s.id)}
                      className="h-8 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto">
                      <Eye className="size-3.5" /> View Report
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