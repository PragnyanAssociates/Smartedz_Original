import React, { useMemo } from 'react';
import { GraduationCap } from 'lucide-react';

// =====================================================================
//  ReportCardView - the printable report card layout for ONE student.
//
//  Pure presentational component. Receives a `card` object shaped like
//  the backend's buildReportCard() output:
//    { student, institution, academicYear, subjects, examTypes, maxMarks, marks, attendance }
//
//  School logo + name + contact come from `institution` (multi-tenant -
//  no hardcoded school). Attendance is the auto-computed monthly W/P,
//  pulled from the Attendance module.
//
//  Max marks are per subject: a subject's max for an exam is its own
//  override, else the All-Subjects default (maxMarks), else the exam's
//  default field (backward compatible). Each subject row shows its
//  obtained / max, and the grand total shows the overall % computed
//  against the summed max.
// =====================================================================

// Format a numeric mark without trailing decimals: 20.00 -> 20, 19.50 -> 19.5
const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return v;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
};

export default function ReportCardView({ card }) {
  const { student, institution, academicYear, subjects, examTypes, marks, attendance } = card;
  const maxMarks = card.maxMarks || {};

  // Index marks by `${subjectId}:${examTypeId}` for O(1) lookup
  const markMap = useMemo(() => {
    const m = {};
    (marks || []).forEach(r => {
      m[`${r.subject_id}:${r.exam_type_id}`] = r.marks_obtained;
    });
    return m;
  }, [marks]);

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

  // Column total for an exam type (sum across subjects)
  const examColumnTotal = (etId) =>
    (subjects || []).reduce((sum, s) => {
      const v = getMark(s.id, etId);
      return sum + (v != null ? Number(v) : 0);
    }, 0);

  // Row total for a subject (sum across exam types)
  const subjectRowTotal = (subjectId) =>
    (examTypes || []).reduce((sum, t) => {
      const v = getMark(subjectId, t.id);
      return sum + (v != null ? Number(v) : 0);
    }, 0);

  // Row max for a subject (sum of its max across exam types)
  const subjectRowMax = (subjectId) =>
    (examTypes || []).reduce((sum, t) => sum + maxFor(t, subjectId), 0);

  const grandTotal = (subjects || []).reduce((sum, s) => sum + subjectRowTotal(s.id), 0);
  // Grand max = sum over every subject of the sum of that subject's max
  // across all exams (so per-subject overrides are reflected accurately).
  const grandMax = (subjects || []).reduce((sum, s) => sum + subjectRowMax(s.id), 0);
  const grandPct = grandMax > 0 ? ((grandTotal / grandMax) * 100).toFixed(1) : '0.0';

  // Attendance roll-up
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
    <div className="report-card bg-white p-6 sm:p-8 max-w-4xl mx-auto" id="report-card-printable">

      {/* ---- School header ---- */}
      <div className="text-center border-b-2 border-zinc-200 pb-5 mb-6">
        {institution?.logo ? (
          <img src={institution.logo} alt="School logo"
            className="h-16 sm:h-20 mx-auto object-contain mb-3" />
        ) : (
          <div className="size-16 sm:size-20 mx-auto mb-3 bg-zinc-100 rounded-lg flex items-center justify-center ring-1 ring-black/5">
            <GraduationCap className="text-zinc-300 size-8 sm:size-10" />
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
                {examTypes.map(t => (
                  <th key={t.id} className="border border-zinc-300 px-3 py-2.5 text-center font-semibold text-zinc-700 whitespace-nowrap">
                    {t.name}
                  </th>
                ))}
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
                      return (
                        <td key={t.id} className="border border-zinc-300 px-3 py-2.5 text-center text-zinc-700 tabular-nums">
                          {v != null ? fmtNum(v) : '-'}
                          {mx > 0 && <span className="text-[10px] text-zinc-400"> / {fmtNum(mx)}</span>}
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
                  <td key={t.id} className="border border-zinc-300 px-3 py-2.5 text-center font-bold text-zinc-800 tabular-nums">
                    {fmtNum(examColumnTotal(t.id)) || '-'}
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
        <div className="flex flex-wrap justify-end gap-2 mb-10">
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

      {/* Signature line */}
      <div className="flex justify-between mt-16 px-4 sm:px-8 text-sm font-medium text-zinc-500 pb-4">
        <div className="text-center">
          <div className="border-t border-zinc-300 w-32 sm:w-40 pt-2">Class Teacher</div>
        </div>
        <div className="text-center">
          <div className="border-t border-zinc-300 w-32 sm:w-40 pt-2">Principal</div>
        </div>
      </div>
    </div>
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