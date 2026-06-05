// =====================================================================
//  Performance — shared helpers
//  Pure functions used by every Performance component. No hardcoded
//  subjects / exams / max marks — everything is driven by the dataset
//  the backend sends (Section 18).
// =====================================================================

// Custom rounding: > .5 rounds up, <= .5 floors (matches old project).
export function roundPct(value) {
  const v = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(v)) return 0;
  const frac = v - Math.floor(v);
  return frac > 0.5 ? Math.ceil(v) : Math.floor(v);
}

// Performance band → tailwind classes.
//   100–80%  → green   (Excellent)
//    80–50%  → blue    (Average)
//    50–0%   → red      (Needs Work)
export function band(pct) {
  const v = roundPct(pct);
  if (v >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', hex: '#10b981', label: 'Excellent' };
  if (v >= 50) return { bar: 'bg-blue-500',    text: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    hex: '#3b82f6', label: 'Average' };
  return          { bar: 'bg-red-500',     text: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     hex: '#ef4444', label: 'Needs Work' };
}

const classGroupOf = (c) =>
  c ? `${c.className}${c.section ? ' - ' + c.section : ''}` : '';

// Numeric roll for ordering (non-numeric rolls sort last)
export function rollNum(s) {
  const n = parseInt(s?.roll_no, 10);
  return isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

// Sort a list of ranked rows by mode: 'roll' | 'high' | 'low'
export function sortRows(rows, mode) {
  const list = [...(rows || [])];
  if (mode === 'high') list.sort((a, b) => b.obtained - a.obtained);
  else if (mode === 'low') list.sort((a, b) => a.obtained - b.obtained);
  else list.sort((a, b) => {
    const r = rollNum(a) - rollNum(b);
    if (r !== 0) return r;
    return (a.name || '').localeCompare(b.name || '');
  });
  return list;
}

// ---------------------------------------------------------------------
//  Build per-student totals from a class dataset.
//
//  dataset = { students[], subjects[], examTypes[], marks[] }
//    - each examType has .max_marks (for THIS class)
//    - marks rows: { student_id, subject_id, exam_type_id, marks_obtained }
//
//  opts:
//    examTypeId  — 'overall' | a specific exam_type id
//    subjectId   — 'all'     | a specific subject id
//
//  Returns ranked array:
//    [{ id, name, roll_no, obtained, possible, percentage, rank }]
//  Only students who have at least one mark in the selection appear.
// ---------------------------------------------------------------------
export function buildStudentTotals(dataset, { examTypeId = 'overall', subjectId = 'all' } = {}) {
  if (!dataset || !dataset.students) return [];

  const { students, subjects, examTypes, marks } = dataset;

  const maxByExam = {};
  examTypes.forEach(t => { maxByExam[t.id] = parseFloat(t.max_marks) || 0; });

  const subjectIds = subjectId === 'all'
    ? subjects.map(s => s.id)
    : [parseInt(subjectId, 10)];

  const examIds = examTypeId === 'overall'
    ? examTypes.map(t => t.id)
    : [parseInt(examTypeId, 10)];

  const markIndex = {};
  marks.forEach(m => {
    markIndex[`${m.student_id}:${m.subject_id}:${m.exam_type_id}`] = m.marks_obtained;
  });

  const rows = students.map(stu => {
    let obtained = 0, possible = 0, hasAny = false;

    subjectIds.forEach(sid => {
      examIds.forEach(eid => {
        const raw = markIndex[`${stu.id}:${sid}:${eid}`];
        const val = parseFloat(raw);
        if (raw === undefined || raw === null || raw === '' || isNaN(val)) return;
        obtained += val;
        possible += maxByExam[eid] || 0;
        hasAny = true;
      });
    });

    const percentage = possible > 0 ? roundPct((obtained / possible) * 100) : 0;
    return {
      id: stu.id,
      name: stu.name,
      roll_no: stu.roll_no,
      obtained,
      possible,
      percentage,
      hasAny
    };
  }).filter(r => r.hasAny && r.possible > 0);

  rows.sort((a, b) => b.obtained - a.obtained);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// ---------------------------------------------------------------------
//  Per-exam breakdown for ONE student across all subjects.
// ---------------------------------------------------------------------
export function studentExamBreakdown(dataset, studentId) {
  if (!dataset || !dataset.examTypes) return [];
  const { subjects, examTypes, marks } = dataset;

  const markIndex = {};
  marks.forEach(m => {
    markIndex[`${m.student_id}:${m.subject_id}:${m.exam_type_id}`] = m.marks_obtained;
  });

  const out = [];
  examTypes.forEach(t => {
    let obtained = 0, possible = 0, hasAny = false;
    subjects.forEach(s => {
      const raw = markIndex[`${studentId}:${s.id}:${t.id}`];
      const val = parseFloat(raw);
      if (raw === undefined || raw === null || raw === '' || isNaN(val)) return;
      obtained += val;
      possible += parseFloat(t.max_marks) || 0;
      hasAny = true;
    });
    if (hasAny && possible > 0) {
      out.push({
        exam_type_id: t.id,
        name: t.name,
        obtained,
        possible,
        percentage: roundPct((obtained / possible) * 100)
      });
    }
  });
  return out;
}

// ---------------------------------------------------------------------
//  Class-wide total for a subject (used for the "teacher details"
//  banner in the student analysis modal).
//  Returns { obtained, possible, percentage }.
// ---------------------------------------------------------------------
export function subjectClassTotal(dataset, { examTypeId = 'overall', subjectId } = {}) {
  if (!dataset || subjectId === undefined || subjectId === 'all') return null;
  const ranked = buildStudentTotals(dataset, { examTypeId, subjectId });
  const obtained = ranked.reduce((s, r) => s + r.obtained, 0);
  const possible = ranked.reduce((s, r) => s + r.possible, 0);
  return {
    obtained,
    possible,
    percentage: possible > 0 ? roundPct((obtained / possible) * 100) : 0
  };
}

export { classGroupOf };