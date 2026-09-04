import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, Loader2, Save, Lock, RefreshCw, AlertTriangle, Info, Search, ChevronDown, ArrowUpDown, Download
} from 'lucide-react';

// =====================================================================
//  MarksEntry - editable grid of students x subjects for one exam type.
//
//  Column lock rule:
//   • Super Admin (isAllAccess)  -> every subject editable
//   • Teacher                    -> only subjects where they're the
//                                   assigned teacher for this class
//  "Overall" view shows the per-subject sum across all exam types and
//  is always read-only.
//
//  Only ENTERED exam types are shown/summed here — derived exams are
//  computed elsewhere (report card / performance) and never counted in
//  Marks Entry totals, so "Overall" is an entered-only total.
//
//  MAX MARKS are now per subject. The backend sends a maxMarks map:
//    { [examTypeId]: { default: n|null, bySubject: { [subjectId]: n } } }
//  Each subject's max for the selected exam = its own override, else the
//  All-Subjects default. The header shows it and entry is capped to it.
//
//  A footer "Total" row sums each subject column across the whole class
//  plus the grand total of everything.
//
//  Marks are scoped to the active academic year by the backend. Students
//  are shown roll-wise by default, with an optional sort by total.
//
//  DOWNLOAD: the sheet on screen (for the selected exam type only) can be
//  saved as an image. It unlocks only once that exam has saved marks and
//  there is nothing left unsaved, so a download always matches the server.
// =====================================================================

// Format a numeric mark without trailing decimals: 20.00 -> 20, 19.50 -> 19.5
const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return v;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
};

// Numeric roll for ordering (non-numeric rolls sort last)
const rollNum = (s) => {
  const n = parseInt(s.roll_no, 10);
  return isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

// =====================================================================
//  Marks sheet -> PNG
//  Paints the same grid the screen shows (heading block, column headers
//  with teacher + max, one row per student, class total row) onto a
//  canvas and downloads it.
// =====================================================================
const SHEET_PAD   = 28;
const SHEET_ROW_H = 34;
const SHEET_HEAD_H = 64;
const SHEET_SCALE = 2;

const SC = {
  primary: '#18469A',
  primarySoft: '#F1F5FB',
  t900: '#18181B',
  t700: '#3F3F46',
  t500: '#71717A',
  t400: '#A1A1AA',
  border: '#E4E4E7',
  line: '#F4F4F5',
  head: '#FAFAFA'
};

const SF = (weight, size) =>
  `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

function ellipsize(ctx, text, font, maxW) {
  ctx.font = font;
  const s = String(text ?? '');
  if (!s) return '';
  if (ctx.measureText(s).width <= maxW) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(`${out}...`).width > maxW) out = out.slice(0, -1);
  return `${out}...`;
}

// columns: [{ label, sub, sub2, align, min, max, tint }]
// rows:    [[cell, cell, ...], ...]
function renderMarksSheet({ title, meta, columns, rows, footerRow, note }) {
  const scratch = document.createElement('canvas').getContext('2d');

  // ---- column widths ------------------------------------------------
  const widths = columns.map((c, ci) => {
    let w = 0;
    scratch.font = SF(700, 12); w = Math.max(w, scratch.measureText(c.label || '').width);
    scratch.font = SF(500, 9);  w = Math.max(w, scratch.measureText(c.sub || '').width);
    scratch.font = SF(600, 9);  w = Math.max(w, scratch.measureText(c.sub2 || '').width);
    scratch.font = SF(600, 13);
    rows.forEach(r => { w = Math.max(w, scratch.measureText(String(r[ci] ?? '')).width); });
    if (footerRow) w = Math.max(w, scratch.measureText(String(footerRow[ci] ?? '')).width);
    return Math.min(Math.max(Math.ceil(w) + 26, c.min || 84), c.max || 280);
  });
  const tableW = widths.reduce((a, b) => a + b, 0);
  const W = tableW + SHEET_PAD * 2;

  // ---- height -------------------------------------------------------
  let y = SHEET_PAD;
  const titleTop = y;
  y += 30;
  const metaTop = y;
  y += meta.length * 16 + 14;
  const tableTop = y;
  y += SHEET_HEAD_H + rows.length * SHEET_ROW_H + (footerRow ? 40 : 0);
  const tableBottom = y;
  y += note ? 26 : 8;
  const H = y + SHEET_PAD;

  // ---- paint --------------------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * SHEET_SCALE);
  canvas.height = Math.round(H * SHEET_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(SHEET_SCALE, SHEET_SCALE);
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // heading
  ctx.textAlign = 'left';
  ctx.fillStyle = SC.t900;
  ctx.font = SF(700, 20);
  ctx.fillText(title, SHEET_PAD, titleTop);
  ctx.font = SF(500, 11);
  ctx.fillStyle = SC.t500;
  meta.forEach((line, i) => ctx.fillText(line, SHEET_PAD, metaTop + i * 16));

  // column headers
  const x0 = SHEET_PAD;
  ctx.fillStyle = SC.head;
  ctx.fillRect(x0, tableTop, tableW, SHEET_HEAD_H);
  let cx = x0;
  columns.forEach((c, ci) => {
    const w = widths[ci];
    if (c.tint) { ctx.fillStyle = SC.primarySoft; ctx.fillRect(cx, tableTop, w, SHEET_HEAD_H); }
    const center = c.align === 'center';
    const tx = center ? cx + w / 2 : cx + 12;
    ctx.textAlign = center ? 'center' : 'left';
    const inner = w - 20;
    const hasSub = !!(c.sub || c.sub2);
    ctx.fillStyle = c.tint ? SC.primary : SC.t700;
    ctx.font = SF(700, 12);
    ctx.fillText(ellipsize(ctx, c.label, SF(700, 12), inner), tx, tableTop + (hasSub ? 14 : SHEET_HEAD_H / 2 - 7));
    if (c.sub) {
      ctx.fillStyle = SC.t400;
      ctx.font = SF(500, 9);
      ctx.fillText(ellipsize(ctx, c.sub, SF(500, 9), inner), tx, tableTop + 31);
    }
    if (c.sub2) {
      ctx.fillStyle = SC.primary;
      ctx.font = SF(600, 9);
      ctx.fillText(ellipsize(ctx, c.sub2, SF(600, 9), inner), tx, tableTop + 45);
    }
    cx += w;
  });
  ctx.strokeStyle = SC.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, tableTop + SHEET_HEAD_H - 0.5);
  ctx.lineTo(x0 + tableW, tableTop + SHEET_HEAD_H - 0.5);
  ctx.stroke();

  // body rows
  let ry = tableTop + SHEET_HEAD_H;
  rows.forEach((row, ri) => {
    let bx = x0;
    columns.forEach((c, ci) => {
      const w = widths[ci];
      if (c.tint) { ctx.fillStyle = SC.primarySoft; ctx.fillRect(bx, ry, w, SHEET_ROW_H); }
      const center = c.align === 'center';
      const tx = center ? bx + w / 2 : bx + 12;
      ctx.textAlign = center ? 'center' : 'left';
      ctx.fillStyle = c.tint ? SC.primary : (ci <= 1 ? SC.t900 : SC.t700);
      const font = SF(c.tint || ci <= 1 ? 700 : 500, 13);
      ctx.font = font;
      ctx.fillText(ellipsize(ctx, row[ci] ?? '', font, w - 20), tx, ry + 10);
      bx += w;
    });
    if (ri < rows.length - 1) {
      ctx.strokeStyle = SC.line;
      ctx.beginPath();
      ctx.moveTo(x0, ry + SHEET_ROW_H - 0.5);
      ctx.lineTo(x0 + tableW, ry + SHEET_ROW_H - 0.5);
      ctx.stroke();
    }
    ry += SHEET_ROW_H;
  });

  // class total row
  if (footerRow) {
    ctx.fillStyle = SC.head;
    ctx.fillRect(x0, ry, tableW, 40);
    let fx = x0;
    columns.forEach((c, ci) => {
      const w = widths[ci];
      if (c.tint) { ctx.fillStyle = '#E7EDF7'; ctx.fillRect(fx, ry, w, 40); }
      const center = c.align === 'center';
      const tx = center ? fx + w / 2 : fx + 12;
      ctx.textAlign = center ? 'center' : 'left';
      ctx.fillStyle = c.tint ? SC.primary : SC.t900;
      const font = SF(700, 13);
      ctx.font = font;
      ctx.fillText(ellipsize(ctx, footerRow[ci] ?? '', font, w - 20), tx, ry + 13);
      fx += w;
    });
    ctx.strokeStyle = SC.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, ry + 1);
    ctx.lineTo(x0 + tableW, ry + 1);
    ctx.stroke();
    ry += 40;
  }

  // column separators + outline
  ctx.strokeStyle = SC.border;
  ctx.lineWidth = 1;
  let sx = x0;
  columns.forEach((c, ci) => {
    sx += widths[ci];
    if (ci < columns.length - 1) {
      ctx.beginPath();
      ctx.moveTo(sx - 0.5, tableTop);
      ctx.lineTo(sx - 0.5, tableBottom);
      ctx.stroke();
    }
  });
  ctx.strokeRect(x0 + 0.5, tableTop + 0.5, tableW - 1, tableBottom - tableTop - 1);

  // note
  if (note) {
    ctx.textAlign = 'left';
    ctx.font = SF(500, 10);
    ctx.fillStyle = SC.t400;
    ctx.fillText(note, SHEET_PAD, tableBottom + 10);
    ctx.textAlign = 'right';
    ctx.fillText('Powered by SmartEdz', W - SHEET_PAD, tableBottom + 10);
    ctx.textAlign = 'left';
  }

  return canvas;
}

function saveCanvas(canvas, filename) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('export failed'));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      }, 'image/png');
    } catch (e) { reject(e); }
  });
}

export default function MarksEntry({ classInfo, canManage, onBack }) {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();

  const [data, setData]       = useState(null);   // {class, students, subjects, examTypes, maxMarks, marks}
  const [marks, setMarks]     = useState({});     // `${studentId}:${subjectId}:${examTypeId}` -> value
  const [original, setOriginal] = useState({});
  const [examTypeId, setExamTypeId] = useState('overall');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [query, setQuery]     = useState('');
  const [sortMode, setSortMode] = useState('roll');   // 'roll' | 'high' | 'low'

  // -----------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports/class-data/${classInfo.class_id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setData(d);

      // Seed marks map (strip trailing decimals so 19.00 shows as 19)
      const m = {};
      (d.marks || []).forEach(row => {
        m[`${row.student_id}:${row.subject_id}:${row.exam_type_id}`] =
          row.marks_obtained != null ? fmtNum(row.marks_obtained) : '';
      });
      setMarks(m);
      setOriginal(JSON.parse(JSON.stringify(m)));

      // Default to first real exam type
      if (d.examTypes && d.examTypes.length > 0) {
        setExamTypeId(String(d.examTypes[0].id));
      } else {
        setExamTypeId('overall');
      }
    } catch (e) { alert(e.message); }
    setLoading(false);
  }, [classInfo]);

  useEffect(() => { load(); }, [load]);

  // Entered-only exam types. The backend already sends entered exams here,
  // but we filter defensively so a derived exam can never inflate a total.
  const enteredTypes = useMemo(
    () => (data?.examTypes || []).filter(t => t.kind !== 'derived'),
    [data]
  );

  // -----------------------------------------------------------------
  const canEditSubject = useCallback((subject) => {
    if (!canManage) return false;
    if (isAllAccess) return true;
    return subject.teacher_id === user.id;
  }, [canManage, isAllAccess, user]);

  const isOverall = examTypeId === 'overall';
  const activeExamType = data?.examTypes?.find(t => String(t.id) === examTypeId);
  const examLabel = isOverall ? 'Overall' : (activeExamType?.name || 'this exam');

  // -----------------------------------------------------------------
  // Per-subject max for an exam type: subject override, else the
  // All-Subjects default. Returns undefined when no max is configured.
  // -----------------------------------------------------------------
  const maxFor = useCallback((etId, subjectId) => {
    const m = data?.maxMarks?.[etId];
    if (!m) return undefined;
    const sp = m.bySubject ? m.bySubject[subjectId] : undefined;
    if (sp !== undefined && sp !== null) return Number(sp);
    if (m.default !== undefined && m.default !== null) return Number(m.default);
    return undefined;
  }, [data]);

  // Max shown in a subject's column header. For a specific exam that's
  // the per-subject max; for Overall it's the sum of the subject's max
  // across all ENTERED exams (its grand max).
  const subjectHeaderMax = (subjectId) => {
    if (!data) return undefined;
    if (isOverall) {
      let sum = 0, any = false;
      enteredTypes.forEach(t => {
        const mx = maxFor(t.id, subjectId);
        if (mx !== undefined) { sum += mx; any = true; }
      });
      return any ? sum : undefined;
    }
    return maxFor(examTypeId, subjectId);
  };

  // -----------------------------------------------------------------
  // Mark editing
  // -----------------------------------------------------------------
  const setMark = (studentId, subjectId, value) => {
    if (!/^\d*\.?\d*$/.test(value)) return;
    const cap = maxFor(examTypeId, subjectId);
    if (cap !== undefined && value !== '') {
      const num = parseFloat(value);
      if (!isNaN(num) && num > cap) return;
    }
    setMarks(prev => ({
      ...prev,
      [`${studentId}:${subjectId}:${examTypeId}`]: value
    }));
  };

  const getMark = (studentId, subjectId, etId) =>
    marks[`${studentId}:${subjectId}:${etId}`] ?? '';

  // Per-subject sum across all ENTERED exam types (Overall view)
  const subjectOverall = (studentId, subjectId) => {
    if (!data) return 0;
    return enteredTypes.reduce((sum, t) => {
      const v = parseFloat(getMark(studentId, subjectId, t.id));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  };

  const studentGrandTotal = (studentId) => {
    if (!data) return 0;
    return data.subjects.reduce((sum, s) => sum + subjectOverall(studentId, s.id), 0);
  };

  // Row total for the currently-selected exam type
  const studentExamTotal = (studentId) => {
    if (!data) return 0;
    if (isOverall) return studentGrandTotal(studentId);
    return data.subjects.reduce((sum, s) => {
      const v = parseFloat(getMark(studentId, s.id, examTypeId));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  };

  // -----------------------------------------------------------------
  // Column totals (whole class) for the footer row
  // -----------------------------------------------------------------
  const subjectColumnTotal = (subjectId) => {
    if (!data) return 0;
    return data.students.reduce((sum, stu) => {
      if (isOverall) return sum + subjectOverall(stu.id, subjectId);
      const v = parseFloat(getMark(stu.id, subjectId, examTypeId));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  };

  const grandColumnTotal = () => {
    if (!data) return 0;
    return data.subjects.reduce((sum, s) => sum + subjectColumnTotal(s.id), 0);
  };

  // -----------------------------------------------------------------
  // Save - only changed cells (backend stamps the active academic year)
  // -----------------------------------------------------------------
  const handleSave = async () => {
    const entries = [];
    Object.keys(marks).forEach(key => {
      if (marks[key] !== original[key]) {
        const [studentId, subjectId, etId] = key.split(':');
        entries.push({
          student_id: parseInt(studentId, 10),
          subject_id: parseInt(subjectId, 10),
          exam_type_id: parseInt(etId, 10),
          marks_obtained: marks[key]
        });
      }
    });
    if (entries.length === 0) {
      alert('No changes to save.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports/marks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          class_id: classInfo.class_id,
          actor_id: user.id,
          entries
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setOriginal(JSON.parse(JSON.stringify(marks)));
      alert(`Saved ${entries.length} mark(s).`);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  // -----------------------------------------------------------------
  // Search filter, then sort (roll-wise default / by total)
  // -----------------------------------------------------------------
  const filteredStudents = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data.students;
    const q = query.toLowerCase();
    return data.students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      String(s.roll_no || '').toLowerCase().includes(q)
    );
  }, [data, query]);

  const sortedStudents = useMemo(() => {
    const list = [...filteredStudents];
    if (sortMode === 'high' || sortMode === 'low') {
      list.sort((a, b) => {
        const diff = studentExamTotal(a.id) - studentExamTotal(b.id);
        return sortMode === 'high' ? -diff : diff;
      });
    } else {
      // roll-wise (default)
      list.sort((a, b) => {
        const r = rollNum(a) - rollNum(b);
        if (r !== 0) return r;
        return (a.name || '').localeCompare(b.name || '');
      });
    }
    return list;
    // recompute when marks or selected exam change so totals stay correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStudents, sortMode, marks, examTypeId, data]);

  // -----------------------------------------------------------------
  // Download gate: the sheet can only be taken once this exam actually
  // has SAVED marks and nothing is left unsaved on screen.
  // -----------------------------------------------------------------
  const isDirty = useMemo(() => {
    const keys = new Set([...Object.keys(marks), ...Object.keys(original)]);
    for (const k of keys) {
      if ((marks[k] ?? '') !== (original[k] ?? '')) return true;
    }
    return false;
  }, [marks, original]);

  const savedCountForView = useMemo(() => {
    if (!data) return 0;
    const ids = isOverall ? enteredTypes.map(t => String(t.id)) : [String(examTypeId)];
    let n = 0;
    Object.keys(original).forEach(k => {
      const et = k.split(':')[2];
      if (ids.includes(String(et)) && String(original[k]).trim() !== '') n += 1;
    });
    return n;
  }, [data, original, examTypeId, isOverall, enteredTypes]);

  const canDownload = !!data && sortedStudents.length > 0 && savedCountForView > 0 && !isDirty && !downloading;

  const downloadHint = !data || sortedStudents.length === 0
    ? 'No students to download.'
    : isDirty
      ? 'You have unsaved marks. Save them first, then download.'
      : savedCountForView === 0
        ? `Enter and save marks for ${examLabel} to enable the download.`
        : `If you download now, the ${examLabel} marks list will be downloaded.`;

  const handleDownload = async () => {
    if (!canDownload) return;
    setDownloading(true);
    try {
      const columns = [
        { label: 'Roll', align: 'left', min: 64, max: 90 },
        { label: 'Name', align: 'left', min: 170, max: 280 },
        ...data.subjects.map(s => {
          const mx = subjectHeaderMax(s.id);
          return {
            label: s.name,
            sub: s.teacher_name || '',
            sub2: mx !== undefined ? `max ${fmtNum(mx)}` : '',
            align: 'center', min: 96, max: 170
          };
        }),
        { label: isOverall ? 'Grand Total' : 'Total', align: 'center', min: 104, max: 150, tint: true }
      ];

      const rows = sortedStudents.map(stu => ([
        stu.roll_no || '-',
        stu.name || '',
        ...data.subjects.map(s => (
          isOverall
            ? (fmtNum(subjectOverall(stu.id, s.id)) || '-')
            : (fmtNum(getMark(stu.id, s.id, examTypeId)) || '-')
        )),
        fmtNum(studentExamTotal(stu.id)) || '-'
      ]));

      const footerRow = [
        '', 'Total',
        ...data.subjects.map(s => fmtNum(subjectColumnTotal(s.id)) || '-'),
        fmtNum(grandColumnTotal()) || '-'
      ];

      const generated = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      }).format(new Date());

      const meta = [
        `Exam Type: ${isOverall ? 'Overall (total of all entered exams)' : (activeExamType?.name || '-')}`,
        `Students: ${sortedStudents.length}${sortedStudents.length !== (data.students?.length || 0) ? ` of ${data.students.length} (filtered by "${query.trim()}")` : ''}`,
        `Sorted: ${sortMode === 'roll' ? 'Roll wise' : sortMode === 'high' ? 'Highest to lowest total' : 'Lowest to highest total'}`,
        `Generated: ${generated}`
      ];

      const safe = (s) => String(s || '').replace(/[^\w-]+/g, '_');
      const filename = `${safe(classInfo.class_group)}_${safe(isOverall ? 'Overall' : activeExamType?.name)}_Marks.png`;

      const canvas = renderMarksSheet({
        title: `${classInfo.class_group} - Marks Entry`,
        meta,
        columns,
        rows,
        footerRow,
        note: 'Computer-generated marks sheet'
      });
      await saveCanvas(canvas, filename);
    } catch (e) {
      console.error('Marks download error:', e);
      alert('Could not download the marks list. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }
  if (!data) return null;

  const noExamTypes = data.examTypes.length === 0;

  const sortOptions = [
    { id: 'roll', label: 'Roll wise' },
    { id: 'high', label: 'High \u2192 Low' },
    { id: 'low',  label: 'Low \u2192 High' }
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ArrowLeft className="size-4" /> Back to classes
      </button>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">{classInfo.class_group}</h2>
          <p className="text-xs font-medium text-zinc-500 mt-1 uppercase tracking-wider">Marks Entry</p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search students..."
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <select value={examTypeId} onChange={e => setExamTypeId(e.target.value)}
                className="h-9 w-full sm:w-52 bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors shadow-sm">
                <option value="overall">Overall (read-only)</option>
                {data.examTypes.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.max_marks != null ? ` (default max ${fmtNum(t.max_marks)})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button onClick={load}
              className="size-9 bg-white border border-zinc-200 rounded-md text-zinc-500 hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center shadow-sm shrink-0" title="Refresh">
              <RefreshCw className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sort control + download */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <ArrowUpDown className="size-3.5" /> Sort
          </span>
          <div className="inline-flex items-center bg-white border border-zinc-200 rounded-md p-0.5 shadow-sm">
            {sortOptions.map(o => {
              const active = sortMode === o.id;
              return (
                <button key={o.id} onClick={() => setSortMode(o.id)}
                  className={`px-3 h-7 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                    active ? 'bg-primary text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'
                  }`}>
                  {o.label}
                </button>
              );
            })}
          </div>
          {sortMode !== 'roll' && (
            <span className="text-[11px] text-zinc-400 font-medium">
              by {isOverall ? 'grand total' : (activeExamType ? activeExamType.name + ' total' : 'total')}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:items-end gap-1 shrink-0">
          <button onClick={handleDownload} disabled={!canDownload}
            title={downloadHint}
            className="h-9 w-full sm:w-auto px-4 rounded-md bg-primary text-white text-xs font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:hover:bg-zinc-200 disabled:cursor-not-allowed">
            {downloading ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Download className="size-4 shrink-0" />}
            {downloading ? 'Preparing...' : 'Download'}
          </button>
          <p className={`text-[10px] font-medium leading-snug sm:text-right max-w-[280px] ${canDownload ? 'text-zinc-400' : 'text-amber-600'}`}>
            {downloadHint}
          </p>
        </div>
      </div>

      {noExamTypes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            No exam types are configured for this class. Go to <strong className="font-semibold">Exam Setup - Max Marks</strong>,
            pick this class and set max marks first.
          </div>
        </div>
      )}

      {!isOverall && activeExamType && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-md p-3 flex items-center gap-2 text-xs font-medium text-blue-700 leading-relaxed">
          <Info className="size-4 shrink-0" />
          <span>
            Editing <strong className="font-semibold text-blue-900">{activeExamType.name}</strong>. Each subject's max marks are shown in its column header.
            {!isAllAccess && ' Locked columns belong to other teachers.'}
          </span>
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-zinc-50/80">
              <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider sticky left-0 bg-zinc-50/95 backdrop-blur z-10 border-b border-zinc-100 w-16">Roll</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider sticky left-16 bg-zinc-50/95 backdrop-blur z-10 border-b border-r border-zinc-100 min-w-[160px]">Name</th>
              {data.subjects.map(s => {
                const editable = canEditSubject(s);
                const mx = subjectHeaderMax(s.id);
                return (
                  <th key={s.id} className="p-3 text-center whitespace-nowrap border-b border-r border-zinc-100 last:border-r-0 min-w-[100px]">
                    <div className="flex items-center justify-center gap-1.5 text-zinc-700">
                      {!editable && !isOverall && <Lock className="size-3 text-zinc-400" />}
                      <span className="text-xs font-semibold">{s.name}</span>
                    </div>
                    {s.teacher_name && (
                      <div className="text-[9px] font-medium text-zinc-400 mt-1 truncate max-w-[120px] mx-auto">
                        {s.teacher_name}
                      </div>
                    )}
                    {mx !== undefined && (
                      <div className="text-[9px] font-semibold text-primary/70 mt-0.5">max {fmtNum(mx)}</div>
                    )}
                  </th>
                );
              })}
              <th className="p-3 text-center bg-primary/5 border-b border-zinc-100 min-w-[100px]">
                <span className="text-[10px] font-semibold uppercase text-primary tracking-wider">
                  {isOverall ? 'Grand Total' : 'Total'}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedStudents.length === 0 ? (
              <tr>
                <td colSpan={data.subjects.length + 3} className="px-5 py-8 text-center text-zinc-400 text-sm italic">
                  No students found.
                </td>
              </tr>
            ) : sortedStudents.map(stu => (
              <tr key={stu.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-4 py-3 sticky left-0 bg-white z-10 font-semibold text-zinc-600 text-sm">{stu.roll_no || '-'}</td>
                <td className="px-4 py-3 sticky left-16 bg-white z-10 font-semibold text-zinc-900 text-sm border-r border-zinc-100 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] truncate max-w-[200px]">{stu.name}</td>
                {data.subjects.map(s => {
                  const editable = canEditSubject(s);
                  if (isOverall) {
                    return (
                      <td key={s.id} className="p-2 border-r border-zinc-100 last:border-r-0 text-center">
                        <span className="text-sm font-semibold text-zinc-600">
                          {fmtNum(subjectOverall(stu.id, s.id)) || '-'}
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={s.id} className="p-2 border-r border-zinc-100 last:border-r-0">
                      <input
                        value={getMark(stu.id, s.id, examTypeId)}
                        onChange={e => setMark(stu.id, s.id, e.target.value)}
                        disabled={!editable}
                        placeholder={editable ? '-' : ''}
                        className={`h-8 w-16 mx-auto block rounded-md px-2 text-sm text-center font-semibold tabular-nums outline-none transition-colors ${
                          editable
                            ? 'bg-white border border-zinc-200 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-zinc-900'
                            : 'bg-zinc-50/50 border border-transparent text-zinc-400 cursor-not-allowed'
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="p-2 text-center bg-primary/5 font-semibold text-primary text-sm">
                  {fmtNum(studentExamTotal(stu.id)) || '-'}
                </td>
              </tr>
            ))}
          </tbody>
          {sortedStudents.length > 0 && (
            <tfoot>
              <tr className="bg-zinc-50 border-t-2 border-zinc-200">
                <td className="px-4 py-3 sticky left-0 bg-zinc-50 z-10"></td>
                <td className="px-4 py-3 sticky left-16 bg-zinc-50 z-10 border-r border-zinc-100 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-[11px] font-semibold uppercase tracking-wider text-zinc-700">
                  Total
                </td>
                {data.subjects.map(s => (
                  <td key={s.id} className="p-2 text-center border-r border-zinc-100 last:border-r-0 text-sm font-bold text-zinc-800 tabular-nums">
                    {fmtNum(subjectColumnTotal(s.id)) || '-'}
                  </td>
                ))}
                <td className="p-2 text-center bg-primary/10 font-bold text-primary text-sm tabular-nums">
                  {fmtNum(grandColumnTotal()) || '-'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!isOverall && !noExamTypes && (
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="h-10 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:text-zinc-500 text-white px-6 rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors">
            {saving ? <Loader2 className="size-4 animate-spin shrink-0" /> : <Save className="size-4 shrink-0" />}
            {saving ? 'Saving...' : 'Save Marks'}
          </button>
        </div>
      )}
    </div>
  );
}