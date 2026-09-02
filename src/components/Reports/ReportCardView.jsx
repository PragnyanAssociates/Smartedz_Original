import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';

// =====================================================================
//  ReportCardView - the printable report card layout for ONE student.
//
//  PRINTING (single mode) now goes through a <body>-level portal in normal
//  flow — the SAME technique as "Print All" — instead of position:fixed.
//  That prints identically on laptop AND phone (centered, full width), and
//  shows obtained marks only (the /max is hidden to save space). Text,
//  borders and the GRADE print dark + bright.
//
//   • single (default) - on-screen card + a print-only body portal.
//   • batch  (prop `batch`) - just the card body; the Print-All parent
//     supplies its own portal + print CSS.
// =====================================================================

const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return v;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
};

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

const asUtcIso = (v) => {
  if (!v) return null;
  const s = String(v).replace(' ', 'T');
  return /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z';
};

export function LastPrintedStamp({ studentId, className = '' }) {
  const { user } = useAuth();
  const [info, setInfo] = useState(null);

  const fetchInfo = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/report-card-print/${studentId}`);
      const d = await res.json();
      if (res.ok && d && d.printed_at) setInfo(d);
    } catch { /* ignore */ }
  }, [studentId]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  useEffect(() => {
    if (!studentId) return;
    const onAfterPrint = async () => {
      try {
        await fetch(`${API_BASE_URL}/admin/report-card-prints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_ids: [studentId], printed_by: user?.name })
        });
      } catch { /* ignore */ }
      fetchInfo();
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [studentId, user, fetchInfo]);

  const when = fmtDateTime(asUtcIso(info?.printed_at));

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 whitespace-nowrap ${className}`}>
      <Printer className="size-3.5 shrink-0" />
      {info && when
        ? <>Last printed by <span className="text-zinc-600 font-semibold">{info.printed_by || 'Someone'}</span> on <span className="text-zinc-500 font-semibold">{when}</span></>
        : <span className="italic">Not printed yet</span>}
    </span>
  );
}

// Shared print CSS for the single-card body portal — mirrors Print All so
// laptop and phone produce the exact same page. Obtained marks only.
const SINGLE_PRINT_CSS = `
  @media screen { #rc-single-portal { display: none !important; } }
  @media print {
    @page { size: A4 portrait; margin: 6mm 5mm; }
    html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; margin: 0 !important; background: #fff !important; }

    /* show ONLY the portal (display:none, not visibility, => centered, no blank) */
    body > * { display: none !important; }
    #rc-single-portal { display: block !important; }

    #rc-single-portal .rc-max { display: none !important; }            /* obtained marks only */

    /* LOCK the print to a fixed A4 layout so a phone prints EXACTLY like a
       laptop — a fixed mm width + fixed font sizes ignore the device's own
       print viewport, so nothing re-sizes on mobile. */
    #rc-single-portal .report-card { width: 190mm !important; max-width: 190mm !important; margin: 0 auto !important; padding: 0 !important; color: #000 !important; font-size: 12px !important; }
    #rc-single-portal .text-sm { font-size: 12px !important; }
    #rc-single-portal .text-xs { font-size: 10.5px !important; }
    #rc-single-portal .signatures > div > div { width: 150px !important; }
    #rc-single-portal .overflow-x-auto { overflow: visible !important; }

    /* columns size to content, single line, fits every device the same */
    #rc-single-portal table { width: 100% !important; min-width: 0 !important; border-collapse: collapse !important; }
    #rc-single-portal th, #rc-single-portal td {
      border: 1px solid #111827 !important; padding: 4px 5px !important;
      font-size: 10px !important; line-height: 1.2 !important;
      font-weight: 600 !important; color: #111827 !important;
      white-space: nowrap !important;
    }
    #rc-single-portal thead th { font-weight: 800 !important; background: #e5e7eb !important; color: #000 !important; }
    #rc-single-portal thead { display: table-header-group; }
    #rc-single-portal .font-bold { font-weight: 800 !important; color: #000 !important; }

    /* GRADE dark & bright */
    #rc-single-portal .rc-grade, #rc-single-portal .text-primary { color: #1d4ed8 !important; font-weight: 800 !important; }
    #rc-single-portal .text-emerald-700 { color: #047857 !important; font-weight: 800 !important; }

    /* darken muted greys */
    #rc-single-portal .text-zinc-400 { color: #374151 !important; }
    #rc-single-portal .text-zinc-500 { color: #1f2937 !important; }
    #rc-single-portal .text-zinc-700, #rc-single-portal .text-zinc-800, #rc-single-portal .text-zinc-900 { color: #000 !important; }

    #rc-single-portal h1 { font-size: 22px !important; font-weight: 800 !important; color: #000 !important; }
    #rc-single-portal h2 { font-size: 13px !important; font-weight: 800 !important; color: #000 !important; letter-spacing: .05em; }
    #rc-single-portal .rc-logo { height: 100px !important; width: auto !important; margin-bottom: -14px !important; }
    #rc-single-portal .rc-header { padding-bottom: 8px !important; margin-bottom: 10px !important; }

    /* student info: always 2 columns (2 rows × 2), label + value INLINE on one line */
    #rc-single-portal .rc-info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; column-gap: 2rem !important; row-gap: .5rem !important; }
    #rc-single-portal .rc-info-row { display: flex !important; flex-direction: row !important; align-items: baseline !important; gap: .5rem !important; }
    #rc-single-portal .rc-info-label { width: auto !important; flex: 0 0 auto !important; white-space: nowrap !important; }
    #rc-single-portal .rc-info-value { flex: 1 1 auto !important; min-width: 0 !important; white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }

    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;

export default function ReportCardView({ card, batch = false }) {
  const { student, institution, academicYear, subjects, examTypes, marks, attendance } = card;
  const maxMarks = card.maxMarks || {};

  const markMap = useMemo(() => {
    const m = {};
    (marks || []).forEach(r => { m[`${r.subject_id}:${r.exam_type_id}`] = r.marks_obtained; });
    return m;
  }, [marks]);

  const attemptedExamIds = useMemo(() => {
    const s = new Set();
    (marks || []).forEach(r => {
      if (r.marks_obtained !== null && r.marks_obtained !== undefined) s.add(Number(r.exam_type_id));
    });
    return s;
  }, [marks]);

  const isAttempted = (etId) => attemptedExamIds.has(Number(etId));
  const getMark = (subjectId, etId) => {
    const v = markMap[`${subjectId}:${etId}`];
    return v != null ? v : null;
  };

  const maxFor = (t, subjectId) => {
    const m = maxMarks[t.id];
    if (m) {
      const sp = m.bySubject ? m.bySubject[subjectId] : undefined;
      if (sp !== undefined && sp !== null) return Number(sp);
      if (m.default !== undefined && m.default !== null) return Number(m.default);
    }
    return Number(t.max_marks || 0);
  };

  const gradeFor = (total, bands) => {
    if (total == null || isNaN(total) || !Array.isArray(bands) || bands.length === 0) return null;
    let best = null;
    bands.forEach(b => {
      const from = Number(b.min_pct);
      const to = (b.max_pct === null || b.max_pct === undefined || b.max_pct === '') ? Infinity : Number(b.max_pct);
      if (!isNaN(from) && total >= from && total <= to + 1e-9 && (best === null || from > Number(best.min_pct))) best = b;
    });
    return best ? best.label : null;
  };

  const examColumnTotal = (etId) =>
    (subjects || []).reduce((sum, s) => {
      const v = getMark(s.id, etId);
      return sum + (v != null ? Number(v) : 0);
    }, 0);

  const examColumnMax = (t) =>
    (subjects || []).reduce((sum, s) => sum + (getMark(s.id, t.id) != null ? maxFor(t, s.id) : 0), 0);

  const examColumnGrade = (t) => {
    if (examColumnMax(t) <= 0) return null;
    return gradeFor(examColumnTotal(t.id), t.grade_bands);
  };

  const anyGrades = (examTypes || []).some(t => Array.isArray(t.grade_bands) && t.grade_bands.length > 0);

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

  const body = (
    <>
      {/* ---- School header ---- */}
      <div className="rc-header text-center border-b-2 border-zinc-300 pb-5 mb-6">
        {institution?.logo ? (
          <img src={institution.logo} alt="School logo"
            className="rc-logo h-36 sm:h-44 mx-auto object-contain mb-1" />
        ) : (
          <div className="rc-logo size-36 sm:size-44 mx-auto mb-1 bg-zinc-100 rounded-lg flex items-center justify-center ring-1 ring-black/5">
            <GraduationCap className="text-zinc-300 size-20" />
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight uppercase">
          {institution?.name || 'School'}
        </h1>
        {institution?.school_email && (<p className="text-sm text-zinc-500 mt-1">{institution.school_email}</p>)}
        {institution?.phone && (<p className="text-xs text-zinc-400 mt-0.5">Phone: {institution.phone}</p>)}
      </div>

      {/* ---- Student info ---- */}
      <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-4 sm:p-5 mb-8">
        <div className="rc-info-grid grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
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
                      className={`border border-zinc-300 px-3 py-2.5 text-center font-semibold whitespace-nowrap ${counted ? 'text-zinc-700' : 'text-zinc-400'}`}
                      title={counted ? undefined : 'Not conducted yet — excluded from Total & grade'}>
                      {t.name}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(subjects || []).map(s => (
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
                        {counted && mx > 0 && (<span className="rc-max text-zinc-400 text-[11px]">/{fmtNum(mx)}</span>)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-zinc-50/80">
                <td className="border border-zinc-300 px-3 py-2.5 font-bold text-zinc-800">Total</td>
                {examTypes.map(t => (
                  <td key={t.id} className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-zinc-800 tabular-nums whitespace-nowrap">
                    {fmtNum(examColumnTotal(t.id)) || '–'}
                  </td>
                ))}
              </tr>
              {anyGrades && (
                <tr className="bg-zinc-50/40">
                  <td className="border border-zinc-300 px-3 py-2.5 font-bold text-zinc-700">Grade</td>
                  {examTypes.map(t => {
                    const g = examColumnGrade(t);
                    return (
                      <td key={t.id} className="border border-zinc-300 px-3 py-2.5 text-center font-bold tabular-nums whitespace-nowrap">
                        {g ? <span className="rc-grade text-primary">{g}</span> : <span className="text-zinc-300">–</span>}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
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
                  <th key={i} className="border border-zinc-300 px-3 py-2.5 text-center font-semibold text-zinc-700">{m.month.slice(0, 3)}</th>
                ))}
                <th className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-primary">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-zinc-50/50 transition-colors">
                <td className="border border-zinc-300 px-3 py-2.5 font-semibold text-zinc-800">Working Days</td>
                {attendance.map((m, i) => (
                  <td key={i} className="border border-zinc-300 px-3 py-2.5 text-center text-zinc-700 tabular-nums">{m.working_days}</td>
                ))}
                <td className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-primary tabular-nums">{attTotals.working}</td>
              </tr>
              <tr className="hover:bg-zinc-50/50 transition-colors">
                <td className="border border-zinc-300 px-3 py-2.5 font-semibold text-zinc-800">Present Days</td>
                {attendance.map((m, i) => (
                  <td key={i} className="border border-zinc-300 px-3 py-2.5 text-center text-zinc-700 tabular-nums">{m.present_days}</td>
                ))}
                <td className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-primary tabular-nums">{attTotals.present}</td>
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

      {/* Signature line */}
      <div className="signatures flex justify-between items-end gap-4 mt-16 px-2 sm:px-8 text-sm font-medium text-zinc-500 pb-4">
        <div className="text-center"><div className="border-t border-zinc-400 w-24 sm:w-40 pt-2">Parent</div></div>
        <div className="text-center"><div className="border-t border-zinc-400 w-24 sm:w-40 pt-2">Class Teacher</div></div>
        <div className="text-center"><div className="border-t border-zinc-400 w-24 sm:w-40 pt-2">Principal</div></div>
      </div>
    </>
  );

  // --- Batch mode: just the body (Print-All parent handles the portal) ---
  if (batch) {
    return (
      <div className="report-card bg-white p-6 sm:p-8 max-w-4xl mx-auto">
        {body}
      </div>
    );
  }

  // --- Single mode: on-screen card + a body-level PRINT portal ----------
  //  The portal prints identically on laptop and phone (normal flow, not
  //  fixed) and is obtained-marks-only. On screen the portal is hidden.
  return (
    <>
      <div className="report-card bg-white p-6 sm:p-8 max-w-4xl mx-auto">
        {body}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <>
          <style>{SINGLE_PRINT_CSS}</style>
          <div id="rc-single-portal">
            <div className="report-card bg-white">
              {body}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rc-info-row flex sm:grid sm:grid-cols-3 gap-2">
      <span className="rc-info-label font-semibold text-zinc-500 w-20 sm:w-auto shrink-0 sm:col-span-1">{label}:</span>
      <span className="rc-info-value text-zinc-900 font-medium sm:col-span-2 truncate">{value}</span>
    </div>
  );
}