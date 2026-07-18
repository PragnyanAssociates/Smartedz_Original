import React, { useMemo, useState, useEffect } from 'react';
import { GraduationCap, Printer } from 'lucide-react';

// =====================================================================
//  ReportCardView - the printable report card layout for ONE student.
//
//  Receives a `card` shaped like buildReportCard():
//    { student, institution, academicYear, subjects, examTypes, maxMarks, marks, attendance }
//
//  CONDUCTED-ONLY DENOMINATOR: exam types are shared config, so a class
//  may have ten configured while only a few were held. Max and % count
//  ONLY exams this student has marks for (a 0 counts). Never-conducted
//  exams are excluded and their "/max" hint hidden.
//
//  ONE-PAGE PRINT (robust):
//  We do NOT rely on @page orientation or per-class CSS compression —
//  browsers honour those inconsistently, which was clipping the bottom
//  of the card. Instead, on `beforeprint` we measure the card's real
//  height/width and apply an INLINE `zoom` so the entire card (marks +
//  attendance + signatures) scales down to fit a single sheet, in
//  whatever orientation the browser uses. Inline zoom wins over every
//  stylesheet, so nothing can override it. It's reset on `afterprint`.
//
//  LAST-PRINTED lives in the exported <LastPrintedStamp/>, placed by the
//  parents BESIDE their Print button.
// =====================================================================

// Format a numeric mark without trailing decimals: 20.00 -> 20, 19.50 -> 19.5
const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return v;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
};

// Human IST date-time for the "last printed" stamp.
const fmtDateTime = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch { return null; }
};

// ---------------------------------------------------------------------
//  LastPrintedStamp — screen-only, rendered by the parent next to Print.
//  Records the moment per student in localStorage on any print (button
//  or Ctrl/Cmd+P) and shows it back.
// ---------------------------------------------------------------------
export function LastPrintedStamp({ studentId, className = '' }) {
  const storeKey = studentId ? `sedz:rc:lastprint:${studentId}` : null;
  const [lastPrinted, setLastPrinted] = useState(null);

  useEffect(() => {
    if (!storeKey) return;
    try {
      const v = localStorage.getItem(storeKey);
      if (v) setLastPrinted(v);
    } catch { /* storage unavailable (private mode) */ }

    const onAfterPrint = () => {
      const now = new Date().toISOString();
      try { localStorage.setItem(storeKey, now); } catch { /* ignore */ }
      setLastPrinted(now);
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [storeKey]);

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 whitespace-nowrap ${className}`}>
      <Printer className="size-3.5 shrink-0" />
      {lastPrinted
        ? <>Last printed: <span className="text-zinc-500 font-semibold">{fmtDateTime(lastPrinted)}</span></>
        : <span className="italic">Not printed yet</span>}
    </span>
  );
}

export default function ReportCardView({ card }) {
  const { student, institution, academicYear, subjects, examTypes, marks, attendance } = card;
  const maxMarks = card.maxMarks || {};

  // -----------------------------------------------------------------
  //  Fit-to-one-page on print: measure and apply an inline zoom.
  // -----------------------------------------------------------------
  useEffect(() => {
    const DESIGN_W = 896;               // card's max width (max-w-4xl)
    const PAGE_W = 712, PAGE_H = 1035;  // A4 PORTRAIT usable px @96dpi (~10mm margins)

    const fitToPage = () => {
      const el = document.getElementById('report-card-printable');
      if (!el) return;
      // Measure the card's height at its fixed design width, so the print
      // result never depends on the browser window size. We scale to FILL
      // the page width (attractive, like the on-screen card) and only
      // shrink further if the height would overflow the page.
      el.style.transform = '';
      const prevInlineW = el.style.width;
      el.style.width = DESIGN_W + 'px';
      const H = el.scrollHeight || el.offsetHeight;
      el.style.width = prevInlineW;
      if (!H) return;
      const scale = Math.min(PAGE_W / DESIGN_W, PAGE_H / H);
      // transform (not zoom) so it can scale from top-CENTER and stay
      // centered on the sheet.
      el.style.transform = 'scale(' + Math.max(0.3, Math.min(scale, 1)) + ')';
    };
    const reset = () => {
      const el = document.getElementById('report-card-printable');
      if (el) el.style.transform = '';
    };
    window.addEventListener('beforeprint', fitToPage);
    window.addEventListener('afterprint', reset);
    return () => {
      window.removeEventListener('beforeprint', fitToPage);
      window.removeEventListener('afterprint', reset);
    };
  }, []);

  // Index marks by `${subjectId}:${examTypeId}` for O(1) lookup
  const markMap = useMemo(() => {
    const m = {};
    (marks || []).forEach(r => {
      m[`${r.subject_id}:${r.exam_type_id}`] = r.marks_obtained;
    });
    return m;
  }, [marks]);

  // Exam types this student actually sat (0 counts; only null/missing excluded).
  const attemptedExamIds = useMemo(() => {
    const s = new Set();
    (marks || []).forEach(r => {
      if (r.marks_obtained !== null && r.marks_obtained !== undefined) {
        s.add(Number(r.exam_type_id));
      }
    });
    return s;
  }, [marks]);

  const isAttempted = (etId) => attemptedExamIds.has(Number(etId));

  const getMark = (subjectId, etId) => {
    const v = markMap[`${subjectId}:${etId}`];
    return v != null ? v : null;
  };

  // Per-subject max for an exam: subject override -> All-Subjects default
  // -> the exam's default field (so old data without maxMarks still works).
  const maxFor = (t, subjectId) => {
    const m = maxMarks[t.id];
    if (m) {
      const sp = m.bySubject ? m.bySubject[subjectId] : undefined;
      if (sp !== undefined && sp !== null) return Number(sp);
      if (m.default !== undefined && m.default !== null) return Number(m.default);
    }
    return Number(t.max_marks || 0);
  };

  const examColumnTotal = (etId) =>
    (subjects || []).reduce((sum, s) => {
      const v = getMark(s.id, etId);
      return sum + (v != null ? Number(v) : 0);
    }, 0);

  const subjectRowTotal = (subjectId) =>
    (examTypes || []).reduce((sum, t) => {
      const v = getMark(subjectId, t.id);
      return sum + (v != null ? Number(v) : 0);
    }, 0);

  // Row max — ONLY over exams actually sat, so the denominator is honest.
  const subjectRowMax = (subjectId) =>
    (examTypes || []).reduce(
      (sum, t) => (isAttempted(t.id) ? sum + maxFor(t, subjectId) : sum),
      0
    );

  const grandTotal = (subjects || []).reduce((sum, s) => sum + subjectRowTotal(s.id), 0);
  const grandMax = (subjects || []).reduce((sum, s) => sum + subjectRowMax(s.id), 0);
  const grandPct = grandMax > 0 ? ((grandTotal / grandMax) * 100).toFixed(1) : '0.0';

  const conductedCount = attemptedExamIds.size;
  const configuredCount = (examTypes || []).length;
  const someExcluded = conductedCount > 0 && conductedCount < configuredCount;

  const attTotals = (attendance || []).reduce(
    (acc, m) => ({
      working: acc.working + (m.working_days || 0),
      present: acc.present + (m.present_days || 0)
    }),
    { working: 0, present: 0 }
  );
  const attPct = attTotals.working > 0
    ? ((attTotals.present / attTotals.working) * 100).toFixed(1)
    : '0.0';

  return (
    <>
      {/* Minimal print rules — reveal ONLY the card and let the wide table
          fit the page. The one-page fit itself is done by the inline zoom
          set in the effect above (unbypassable, orientation-independent). */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }

          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }

          body * { visibility: hidden !important; }
          #report-card-printable,
          #report-card-printable * { visibility: visible !important; }

          /* fixed = anchored to the PAGE, not the sidebar-offset content
             area (that offset was the big left gap). Placed at page-centre
             and scaled from top-centre (see effect) so the card stays
             centred on the sheet at any scale. */
          #report-card-printable {
            position: fixed !important;
            left: 50% !important;
            top: 0 !important;
            width: 896px !important;
            margin: 0 !important;
            margin-left: -448px !important;
            max-width: none !important;
            box-shadow: none !important;
            transform-origin: top center;
          }

          #report-card-printable .overflow-x-auto { overflow: visible !important; }
          #report-card-printable table {
            width: 100% !important;
            min-width: 0 !important;
            border-collapse: collapse !important;
          }
          #report-card-printable thead { display: table-header-group; }

          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div className="report-card bg-white p-6 sm:p-8 max-w-4xl mx-auto" id="report-card-printable">

        {/* ---- School header ---- */}
        <div className="text-center border-b-2 border-zinc-200 pb-5 mb-6">
          {institution?.logo ? (
            <img src={institution.logo} alt="School logo"
              className="h-24 sm:h-28 mx-auto object-contain mb-3" />
          ) : (
            <div className="size-24 sm:size-28 mx-auto mb-3 bg-zinc-100 rounded-lg flex items-center justify-center ring-1 ring-black/5">
              <GraduationCap className="text-zinc-300 size-12 sm:size-14" />
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight uppercase">
            {institution?.name || 'School'}
          </h1>
          {institution?.school_email && (
            <p className="text-sm text-zinc-500 mt-1">{institution.school_email}</p>
          )}
          {institution?.phone && (
            <p className="text-xs text-zinc-400 mt-0.5">Phone: {institution.phone}</p>
          )}
        </div>

        {/* ---- Student info ---- */}
        <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-4 sm:p-5 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <InfoRow label="Name"  value={student.name} />
            <InfoRow label="Class" value={`${student.className || '-'}${student.section ? ' - ' + student.section : ''}`} />
            <InfoRow label="Roll No" value={student.roll_no || '-'} />
            <InfoRow label="Year" value={academicYear || '-'} />
          </div>
        </div>

        {/* ---- Progress card ---- */}
        <h2 className="text-sm sm:text-base font-semibold text-zinc-800 text-center mb-4 uppercase tracking-wider">
          Progress Card
        </h2>

        {(examTypes || []).length === 0 ? (
          <div className="border border-dashed border-zinc-300 rounded-lg p-6 text-center text-zinc-400 text-sm italic mb-8">
            No exams configured for this class yet.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar mb-8">
            <table className="w-full border-collapse border border-zinc-300 text-sm min-w-[500px]">
              <thead className="bg-zinc-100/80">
                <tr>
                  <th className="border border-zinc-300 px-3 py-2.5 text-left font-semibold text-zinc-700">Subject</th>
                  {examTypes.map(t => {
                    const counted = isAttempted(t.id);
                    return (
                      <th key={t.id}
                        className={`border border-zinc-300 px-3 py-2.5 text-center font-semibold whitespace-nowrap ${
                          counted ? 'text-zinc-700' : 'text-zinc-400'
                        }`}
                        title={counted ? undefined : 'Not conducted yet — excluded from Total & %'}>
                        {t.name}
                      </th>
                    );
                  })}
                  <th className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-primary whitespace-nowrap">Total / Max</th>
                </tr>
              </thead>
              <tbody>
                {(subjects || []).map(s => {
                  const rowMax = subjectRowMax(s.id);
                  return (
                    <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="border border-zinc-300 px-3 py-2.5 font-semibold text-zinc-800">{s.name}</td>
                      {examTypes.map(t => {
                        const v = getMark(s.id, t.id);
                        const mx = maxFor(t, s.id);
                        const counted = isAttempted(t.id);
                        return (
                          <td key={t.id} className="border border-zinc-300 px-3 py-2.5 text-center tabular-nums whitespace-nowrap">
                            <span className={v != null ? 'font-semibold text-zinc-800' : 'text-zinc-300'}>
                              {v != null ? fmtNum(v) : '–'}
                            </span>
                            {counted && mx > 0 && (
                              <span className="text-zinc-400 text-[11px]">/{fmtNum(mx)}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-primary tabular-nums whitespace-nowrap">
                        {fmtNum(subjectRowTotal(s.id)) || '0'}
                        {rowMax > 0 && <span className="text-[11px] font-semibold text-zinc-400"> / {fmtNum(rowMax)}</span>}
                      </td>
                    </tr>
                  );
                })}
                {/* Column totals */}
                <tr className="bg-zinc-50/80">
                  <td className="border border-zinc-300 px-3 py-2.5 font-bold text-zinc-800">Total</td>
                  {examTypes.map(t => (
                    <td key={t.id} className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-zinc-800 tabular-nums whitespace-nowrap">
                      {fmtNum(examColumnTotal(t.id)) || '–'}
                    </td>
                  ))}
                  <td className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-primary tabular-nums whitespace-nowrap">
                    {fmtNum(grandTotal) || '0'}
                    {grandMax > 0 && <span className="text-[11px] font-semibold text-zinc-400"> / {fmtNum(grandMax)}</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Grand total + percentage summary */}
        {(examTypes || []).length > 0 && (
          <div className="mb-10">
            <div className="flex flex-wrap justify-end gap-2">
              <div className="bg-primary/5 rounded-md px-4 py-2.5 text-sm ring-1 ring-primary/20 flex items-center gap-1.5">
                <span className="font-semibold text-zinc-700">Grand Total: </span>
                <span className="font-bold text-primary tabular-nums">{fmtNum(grandTotal)}</span>
                <span className="text-zinc-500 tabular-nums">/ {fmtNum(grandMax)}</span>
              </div>
              <div className="bg-emerald-50 rounded-md px-4 py-2.5 text-sm ring-1 ring-emerald-600/20 flex items-center gap-1.5">
                <span className="font-semibold text-zinc-700">Percentage: </span>
                <span className="font-bold text-emerald-700 tabular-nums">{grandPct}%</span>
              </div>
            </div>
            {someExcluded && (
              <p className="text-[11px] text-zinc-400 text-right mt-2 leading-relaxed print:hidden">
                Total &amp; percentage count only the {conductedCount} of {configuredCount} exams marked so far.
                Not-yet-conducted exams are excluded.
              </p>
            )}
          </div>
        )}

        {/* ---- Attendance ---- */}
        <h2 className="text-sm sm:text-base font-semibold text-zinc-800 text-center mb-4 uppercase tracking-wider">
          Attendance Particulars
        </h2>

        {(attendance || []).length === 0 ? (
          <div className="border border-dashed border-zinc-300 rounded-lg p-6 text-center text-zinc-400 text-sm italic">
            No active academic year - attendance unavailable.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar mb-4">
            <table className="w-full border-collapse border border-zinc-300 text-sm min-w-[500px]">
              <thead className="bg-zinc-100/80">
                <tr>
                  <th className="border border-zinc-300 px-3 py-2.5 text-left font-semibold text-zinc-700">Month</th>
                  {attendance.map((m, i) => (
                    <th key={i} className="border border-zinc-300 px-3 py-2.5 text-center font-semibold text-zinc-700">
                      {m.month.slice(0, 3)}
                    </th>
                  ))}
                  <th className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-primary">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-zinc-50/50 transition-colors">
                  <td className="border border-zinc-300 px-3 py-2.5 font-semibold text-zinc-800">Working Days</td>
                  {attendance.map((m, i) => (
                    <td key={i} className="border border-zinc-300 px-3 py-2.5 text-center text-zinc-700 tabular-nums">
                      {m.working_days}
                    </td>
                  ))}
                  <td className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-primary tabular-nums">
                    {attTotals.working}
                  </td>
                </tr>
                <tr className="hover:bg-zinc-50/50 transition-colors">
                  <td className="border border-zinc-300 px-3 py-2.5 font-semibold text-zinc-800">Present Days</td>
                  {attendance.map((m, i) => (
                    <td key={i} className="border border-zinc-300 px-3 py-2.5 text-center text-zinc-700 tabular-nums">
                      {m.present_days}
                    </td>
                  ))}
                  <td className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-primary tabular-nums">
                    {attTotals.present}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {(attendance || []).length > 0 && (
          <div className="flex justify-end mt-4 mb-12">
            <div className="bg-emerald-50 rounded-md px-4 py-2.5 text-sm ring-1 ring-emerald-600/20 flex items-center gap-1.5">
              <span className="font-semibold text-zinc-700">Attendance: </span>
              <span className="font-bold text-emerald-700 tabular-nums">{attPct}%</span>
            </div>
          </div>
        )}

        {/* Signature line — Parent (left) · Class Teacher (centre) · Principal (right) */}
        <div className="signatures flex justify-between items-end gap-4 mt-16 px-2 sm:px-8 text-sm font-medium text-zinc-500 pb-4">
          <div className="text-center">
            <div className="border-t border-zinc-300 w-24 sm:w-40 pt-2">Parent</div>
          </div>
          <div className="text-center">
            <div className="border-t border-zinc-300 w-24 sm:w-40 pt-2">Class Teacher</div>
          </div>
          <div className="text-center">
            <div className="border-t border-zinc-300 w-24 sm:w-40 pt-2">Principal</div>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex sm:grid sm:grid-cols-3 gap-2">
      <span className="font-semibold text-zinc-500 w-20 sm:w-auto shrink-0 sm:col-span-1">{label}:</span>
      <span className="text-zinc-900 font-medium sm:col-span-2 truncate">{value}</span>
    </div>
  );
}