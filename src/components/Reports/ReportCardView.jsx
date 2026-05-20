import React, { useMemo } from 'react';
import { GraduationCap } from 'lucide-react';

// =====================================================================
//  ReportCardView — the printable report card layout for ONE student.
//
//  Pure presentational component. Receives a `card` object shaped like
//  the backend's buildReportCard() output:
//    { student, institution, academicYear, subjects, examTypes, marks, attendance }
//
//  School logo + name + contact come from `institution` (multi-tenant —
//  no hardcoded school). Attendance is the auto-computed monthly W/P.
// =====================================================================

export default function ReportCardView({ card }) {
  const { student, institution, academicYear, subjects, examTypes, marks, attendance } = card;

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

  const grandTotal = (subjects || []).reduce((sum, s) => sum + subjectRowTotal(s.id), 0);
  const grandMax = (subjects || []).length *
    (examTypes || []).reduce((sum, t) => sum + (t.max_marks || 0), 0);

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
    <div className="report-card bg-white p-8 max-w-4xl mx-auto" id="report-card-printable">
      {/* ---- School header ---- */}
      <div className="text-center border-b-2 border-slate-200 pb-5 mb-5">
        {institution?.logo ? (
          <img src={institution.logo} alt="School logo"
            className="h-20 mx-auto object-contain mb-2" />
        ) : (
          <div className="h-20 w-20 mx-auto mb-2 bg-slate-100 rounded-2xl flex items-center justify-center">
            <GraduationCap className="text-slate-300" size={36} />
          </div>
        )}
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
          {institution?.name || 'School'}
        </h1>
        {institution?.school_email && (
          <p className="text-sm text-slate-500 mt-1">{institution.school_email}</p>
        )}
        {institution?.phone && (
          <p className="text-xs text-slate-400 mt-0.5">Phone: {institution.phone}</p>
        )}
      </div>

      {/* ---- Student info ---- */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 mb-5">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <InfoRow label="Name"  value={student.name} />
          <InfoRow label="Class" value={`${student.className || '—'}${student.section ? ' - ' + student.section : ''}`} />
          <InfoRow label="Roll No" value={student.roll_no || '—'} />
          <InfoRow label="Year" value={academicYear || '—'} />
        </div>
      </div>

      {/* ---- Progress card ---- */}
      <h2 className="text-lg font-black text-slate-800 text-center mb-3 uppercase tracking-wide">
        Progress Card
      </h2>

      {(examTypes || []).length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 italic mb-6">
          No exams configured for this class yet.
        </div>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="w-full border border-slate-300 text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 p-2.5 text-left font-black text-slate-700">Subject</th>
                {examTypes.map(t => (
                  <th key={t.id} className="border border-slate-300 p-2.5 text-center font-black text-slate-700 whitespace-pre-line">
                    {t.name}{'\n'}<span className="text-[10px] font-bold text-slate-400">({t.max_marks})</span>
                  </th>
                ))}
                <th className="border border-slate-300 p-2.5 text-center font-black text-blue-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {(subjects || []).map(s => (
                <tr key={s.id}>
                  <td className="border border-slate-300 p-2.5 font-bold text-slate-800">{s.name}</td>
                  {examTypes.map(t => {
                    const v = getMark(s.id, t.id);
                    return (
                      <td key={t.id} className="border border-slate-300 p-2.5 text-center text-slate-700">
                        {v != null ? v : '-'}
                      </td>
                    );
                  })}
                  <td className="border border-slate-300 p-2.5 text-center font-black text-blue-700">
                    {subjectRowTotal(s.id) || '-'}
                  </td>
                </tr>
              ))}
              {/* Column totals */}
              <tr className="bg-slate-100">
                <td className="border border-slate-300 p-2.5 font-black text-slate-800">Total</td>
                {examTypes.map(t => (
                  <td key={t.id} className="border border-slate-300 p-2.5 text-center font-black text-slate-800">
                    {examColumnTotal(t.id) || '-'}
                  </td>
                ))}
                <td className="border border-slate-300 p-2.5 text-center font-black text-blue-700">
                  {grandTotal || '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Grand total summary */}
      {(examTypes || []).length > 0 && (
        <div className="flex justify-end mb-6">
          <div className="bg-blue-50 rounded-xl px-5 py-2.5 text-sm">
            <span className="font-bold text-slate-600">Grand Total: </span>
            <span className="font-black text-blue-700">{grandTotal}</span>
            <span className="text-slate-400"> / {grandMax}</span>
          </div>
        </div>
      )}

      {/* ---- Attendance ---- */}
      <h2 className="text-lg font-black text-slate-800 text-center mb-3 uppercase tracking-wide">
        Attendance Particulars
      </h2>

      {(attendance || []).length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 italic">
          No active academic year — attendance unavailable.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-slate-300 text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 p-2.5 text-left font-black text-slate-700">Month</th>
                {attendance.map((m, i) => (
                  <th key={i} className="border border-slate-300 p-2.5 text-center font-black text-slate-700">
                    {m.month.slice(0, 3)}
                  </th>
                ))}
                <th className="border border-slate-300 p-2.5 text-center font-black text-blue-700">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 p-2.5 font-bold text-slate-800">Working Days</td>
                {attendance.map((m, i) => (
                  <td key={i} className="border border-slate-300 p-2.5 text-center text-slate-700">
                    {m.working_days}
                  </td>
                ))}
                <td className="border border-slate-300 p-2.5 text-center font-black text-blue-700">
                  {attTotals.working}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-300 p-2.5 font-bold text-slate-800">Present Days</td>
                {attendance.map((m, i) => (
                  <td key={i} className="border border-slate-300 p-2.5 text-center text-slate-700">
                    {m.present_days}
                  </td>
                ))}
                <td className="border border-slate-300 p-2.5 text-center font-black text-blue-700">
                  {attTotals.present}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {(attendance || []).length > 0 && (
        <div className="flex justify-end mt-3">
          <div className="bg-emerald-50 rounded-xl px-5 py-2.5 text-sm">
            <span className="font-bold text-slate-600">Attendance: </span>
            <span className="font-black text-emerald-700">{attPct}%</span>
          </div>
        </div>
      )}

      {/* Signature line */}
      <div className="flex justify-between mt-12 px-8 text-sm text-slate-500">
        <div className="text-center">
          <div className="border-t border-slate-300 w-40 pt-1">Class Teacher</div>
        </div>
        <div className="text-center">
          <div className="border-t border-slate-300 w-40 pt-1">Principal</div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex">
      <span className="font-black text-slate-500 w-24">{label}:</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}