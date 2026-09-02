import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { GraduationCap, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';

// =====================================================================
//  ReportCardView - the printable report card layout for ONE student.
//
//  Print is pure CSS (no JS scaling) so it prints identically on desktop,
//  laptop and phone: anchored to the page top (leftover space falls to the
//  bottom for remarks), columns size to content and never wrap, and text /
//  borders / the GRADE are dark + bright, not faint.
//
//  Two modes:
//   • single (default) - standalone card with its own one-page print CSS.
//   • batch  (prop `batch`) - just the card body; the parent (Print All)
//     supplies the batch print CSS.
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

  // Grade for an exam's TOTAL marks (the Total row) against its bands.
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
      <div className="text-center border-b-2 border-zinc-300 pb-5 mb-6">
        {institution?.logo ? (
          <img src={institution.logo} alt="School logo"
            className="rc-logo h-36 sm:h-44 mx-auto object-contain mb-3" />
        ) : (
          <div className="rc-logo size-36 sm:size-44 mx-auto mb-3 bg-zinc-100 rounded-lg flex items-center justify-center ring-1 ring-black/5">
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
              {/* Column totals (each exam counted once, on its column) */}
              <tr className="bg-zinc-50/80">
                <td className="border border-zinc-300 px-3 py-2.5 font-bold text-zinc-800">Total</td>
                {examTypes.map(t => (
                  <td key={t.id} className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-zinc-800 tabular-nums whitespace-nowrap">
                    {fmtNum(examColumnTotal(t.id)) || '–'}
                  </td>
                ))}
              </tr>
              {/* Grade row — per exam, from that class+exam's ranges */}
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

  if (batch) {
    return (
      <div className="report-card bg-white p-6 sm:p-8 max-w-4xl mx-auto">
        {body}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 6mm 5mm; }

          html, body {
            height: auto !important; min-height: 0 !important;
            overflow: visible !important; background: #fff !important;
          }

          body * { visibility: hidden !important; }
          #report-card-printable,
          #report-card-printable * { visibility: visible !important; }

          /* Anchor to the PAGE top; leftover space falls to the bottom. */
          #report-card-printable {
            position: fixed !important;
            left: 0 !important; top: 0 !important; right: 0 !important;
            width: 100% !important; margin: 0 !important;
            padding: 0 2mm !important; box-shadow: none !important;
            background: #fff !important; color: #000 !important;
          }

          /* Columns size to content, single line — no wrap, no clip. */
          #report-card-printable table {
            width: 100% !important; min-width: 0 !important; border-collapse: collapse !important;
          }
          #report-card-printable th,
          #report-card-printable td {
            border: 1px solid #111827 !important;
            padding: 4px 5px !important;
            font-size: 10px !important; line-height: 1.2 !important;
            font-weight: 600 !important; color: #111827 !important;
            white-space: nowrap !important;
          }
          #report-card-printable thead th { font-weight: 800 !important; background: #e5e7eb !important; color: #000 !important; }
          #report-card-printable .font-bold { font-weight: 800 !important; color: #000 !important; }
          #report-card-printable .rc-max { color: #4b5563 !important; font-weight: 500 !important; }

          /* GRADE — dark & bright so it clearly stands out. */
          #report-card-printable .rc-grade,
          #report-card-printable .text-primary { color: #1d4ed8 !important; font-weight: 800 !important; }
          #report-card-printable .text-emerald-700 { color: #047857 !important; font-weight: 800 !important; }

          /* Darken muted greys so nothing prints faint. */
          #report-card-printable .text-zinc-400 { color: #374151 !important; }
          #report-card-printable .text-zinc-500 { color: #1f2937 !important; }
          #report-card-printable .text-zinc-700,
          #report-card-printable .text-zinc-800,
          #report-card-printable .text-zinc-900 { color: #000 !important; }

          #report-card-printable h1 { font-size: 22px !important; font-weight: 800 !important; color: #000 !important; }
          #report-card-printable h2 { font-size: 13px !important; font-weight: 800 !important; color: #000 !important; letter-spacing: .05em; }
          #report-card-printable .rc-logo { height: 130px !important; width: auto !important; }

          #report-card-printable .overflow-x-auto { overflow: visible !important; }
          #report-card-printable thead { display: table-header-group; }

          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div className="report-card bg-white p-6 sm:p-8 max-w-4xl mx-auto" id="report-card-printable">
        {body}
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