import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, Loader2, Eye, Printer, Search, FileText, X
} from 'lucide-react';
import ReportCardView, { LastPrintedStamp } from './ReportCardView';

// =====================================================================
//  ReportCards - for one class, list students and open their report
//  card. Two print paths:
//   • per-student  - open a card, Print (browser dialog, one page).
//   • Print All    - fetches every student's card, stacks them one page
//     each, and prints the whole class in a single job (24 students =
//     24 pages). Each print is logged on the server (who + when).
//  Students are listed roll-wise (numeric) by default.
// =====================================================================

const rollNum = (s) => {
  const n = parseInt(s.roll_no, 10);
  return isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

export default function ReportCards({ classInfo, onBack }) {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);   // [{id, name, roll_no}]
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');

  const [card, setCard]         = useState(null);  // selected student's report card
  const [cardLoading, setCardLoading] = useState(false);

  // Print All state
  const [batch, setBatch] = useState(null);        // { cards: [...] } ready to print
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

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
    base.sort((a, b) => {
      const r = rollNum(a) - rollNum(b);
      if (r !== 0) return r;
      return (a.name || '').localeCompare(b.name || '');
    });
    return base;
  }, [students, query]);

  // -----------------------------------------------------------------
  //  PRINT ALL — fetch every student's card, then print one page each.
  // -----------------------------------------------------------------
  const printAll = async () => {
    if (batchBusy || students.length === 0) return;
    const roster = [...students].sort((a, b) => {
      const r = rollNum(a) - rollNum(b);
      return r !== 0 ? r : (a.name || '').localeCompare(b.name || '');
    });
    setBatchBusy(true);
    setBatchProgress({ done: 0, total: roster.length });
    const cards = [];
    for (let i = 0; i < roster.length; i++) {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/reports/student/${roster[i].id}`);
        const d = await res.json();
        if (res.ok) cards.push(d);
      } catch { /* skip a failed one */ }
      setBatchProgress({ done: i + 1, total: roster.length });
    }
    setBatchBusy(false);
    if (cards.length === 0) { alert('Could not load any report cards.'); return; }
    setBatch({ cards });
  };

  // Once the batch is mounted, print, then log all prints, then clean up.
  useEffect(() => {
    if (!batch) return;
    const ids = batch.cards.map(c => c.student?.id).filter(Boolean);
    const t = setTimeout(() => {
      window.print();
      fetch(`${API_BASE_URL}/admin/report-card-prints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_ids: ids, printed_by: user?.name })
      }).catch(() => {});
      setBatch(null);
    }, 350); // let the DOM paint all cards first
    return () => clearTimeout(t);
  }, [batch, user]);

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
          <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
            <LastPrintedStamp studentId={card.student?.id} />
            <button onClick={handlePrint}
              className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0">
              <Printer className="size-4" /> Print
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden print:ring-0 print:shadow-none print:rounded-none">
          <ReportCardView card={card} />
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // List view
  // -----------------------------------------------------------------
  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors w-fit">
          <ArrowLeft className="size-4" /> Back to classes
        </button>
        <button onClick={printAll} disabled={batchBusy || students.length === 0}
          className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0 w-full sm:w-auto">
          {batchBusy
            ? <><Loader2 className="size-4 animate-spin" /> Preparing {batchProgress.done}/{batchProgress.total}...</>
            : <><Printer className="size-4" /> Print All</>}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
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
        <div className="flex justify-center py-4 print:hidden">
          <Loader2 className="animate-spin size-6 text-primary" />
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center print:hidden">
          <Loader2 className="animate-spin size-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center print:hidden">
          <FileText className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">
            {students.length === 0 ? 'No students in this class.' : 'No students match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar print:hidden">
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

      {/* Busy overlay while fetching all cards */}
      {batchBusy && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-xl px-6 py-5 flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" />
            <div className="text-sm text-zinc-700">
              Preparing report cards… <span className="font-semibold">{batchProgress.done}/{batchProgress.total}</span>
            </div>
          </div>
        </div>
      )}

      {/* Batch print container: hidden on screen, one card per page in print. */}
      {batch && (
        <>
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 8mm 6mm; }
              html, body { height:auto !important; min-height:0 !important; overflow:visible !important; background:#fff !important; }
              body * { visibility: hidden !important; }
              #rc-print-all, #rc-print-all * { visibility: visible !important; }
              #rc-print-all { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }

              #rc-print-all .rc-print-page { page-break-after: always; break-after: page; }
              #rc-print-all .rc-print-page:last-child { page-break-after: auto; break-after: auto; }

              /* obtained marks only, compact, so every column + row fits one page */
              #rc-print-all .rc-max { display: none !important; }
              #rc-print-all .rc-logo { height: 96px !important; }
              #rc-print-all .report-card { max-width: none !important; width: 100% !important; padding: 6px 6px !important; margin: 0 !important; }
              #rc-print-all .overflow-x-auto { overflow: visible !important; }
              #rc-print-all table { width: 100% !important; min-width: 0 !important; border-collapse: collapse !important; font-size: 10px !important; }
              #rc-print-all th, #rc-print-all td { padding: 3px 3px !important; }
              #rc-print-all thead { display: table-header-group; }

              #rc-print-all .mb-8 { margin-bottom: 8px !important; }
              #rc-print-all .mb-6 { margin-bottom: 6px !important; }
              #rc-print-all .mb-4 { margin-bottom: 6px !important; }
              #rc-print-all .mb-12 { margin-bottom: 6px !important; }
              #rc-print-all .mt-16 { margin-top: 14px !important; }
              #rc-print-all .pb-5 { padding-bottom: 6px !important; }

              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            @media screen { #rc-print-all { display: none; } }
          `}</style>
          <div id="rc-print-all">
            {batch.cards.map((c, i) => (
              <div className="rc-print-page" key={c.student?.id || i}>
                <ReportCardView card={c} batch />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}