import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings2, ClipboardList, FileText, CalendarRange, AlertTriangle, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import ExamSetup from './ExamSetup';
import ClassList from './ClassList';
import StudentReportCard from './StudentReportCard';
import ReportsHelp from './ReportsHelp';

// =====================================================================
//  Reports - offline exams, marks entry & report cards
//
//  Tabs (admin / teacher):
//   • Exam Setup   - define exam types, max marks, teacher assignments
//   • Marks Entry  - pick a class -> enter marks
//   • Report Cards - pick a class -> view/print student report cards
//
//  Students get a single read-only StudentReportCard.
//
//  A read-only "Academic Year" badge shows the active year. All marks,
//  summaries and report cards are scoped to it (set under Academics).
//
//  The How-to-use guide sits in the header beside the badge and follows
//  the active tab, so it stays put across the class list and every
//  sub-view without the child screens needing to know about it.
// =====================================================================

export default function Reports() {
  const { user } = useAuth();
  const { isAllAccess, can } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const isTeacher = role.includes('teacher');
  const canManage = isAllAccess || isTeacher || can('Reports', 'edit');

  const [tab, setTab] = useState('marks');
  const [yearKnown, setYearKnown] = useState(false);   // the fetch has answered

  // Academic years: the full list drives the Report-Card history filter;
  // the active one is the default and the year Marks Entry writes to. The
  // list comes from /admin/data (every role can read it), so a year a Super
  // Admin deletes drops out of the dropdown on the next load.
  const [academicYears, setAcademicYears]   = useState([]);
  const [activeYearId, setActiveYearId]     = useState(null);
  const [activeYearName, setActiveYearName] = useState('');
  const [selectedYearId, setSelectedYearId] = useState(null);

  useEffect(() => {
    if (!user?.institutionId) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const list = Array.isArray(d.academicYears) ? d.academicYears : [];
        // Newest first; the active one is tagged "Current" in the dropdown.
        const sorted = [...list].sort((a, b) =>
          String(b.startDate || '').localeCompare(String(a.startDate || '')) || (b.id - a.id));
        setAcademicYears(sorted);
        const active = list.find(y => y.isActive) || null;
        setActiveYearName(active ? active.name : '');
        setActiveYearId(active ? active.id : null);
        // Default the filter to the active year; keep a valid prior choice,
        // and fall back to active if the chosen year was deleted.
        setSelectedYearId(prev =>
          (prev != null && sorted.some(y => String(y.id) === String(prev))) ? prev : (active ? active.id : null));
        setYearKnown(true);
      })
      .catch(() => { if (!cancelled) setYearKnown(true); });
    return () => { cancelled = true; };
  }, [user]);

  const selectedYearName = useMemo(() => {
    const y = academicYears.find(x => String(x.id) === String(selectedYearId));
    return y ? (y.name || '') : activeYearName;
  }, [academicYears, selectedYearId, activeYearName]);

  // Static badge of the ACTIVE year — shown on Exam Setup / Marks Entry,
  // which always work on the active year (never a past one).
  const ActiveYearBadge = () => {
    if (!yearKnown) return null;
    if (!activeYearName) {
      return (
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 ring-1 ring-red-500/20 rounded-md px-3 h-9 text-xs font-semibold shrink-0"
          title="Set a year active under Manage Logins → Academics Year">
          <AlertTriangle className="size-4" />
          <span>No active academic year</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 bg-primary/5 text-primary ring-1 ring-primary/20 rounded-md px-3 h-9 text-xs font-semibold shrink-0">
        <CalendarRange className="size-4" />
        <span>Academic Year: {activeYearName}</span>
      </div>
    );
  };

  if (isStudent) {
    return (
      <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-6 animate-in fade-in duration-500">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">My Report Card</h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Your academic progress</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ReportsHelp topic="student" />
            <YearFilter years={academicYears} value={selectedYearId} activeId={activeYearId}
              onChange={setSelectedYearId} yearKnown={yearKnown} />
          </div>
        </header>
        <StudentReportCard academicYearId={selectedYearId} />
      </div>
    );
  }

  // Setup tab is admin-only. Teachers can do marks entry + report cards.
  const tabs = [
    ...(isAllAccess || can('Reports', 'edit')
      ? [{ id: 'setup', label: 'Exam Setup', icon: Settings2 }]
      : []),
    { id: 'marks',   label: 'Marks Entry',  icon: ClipboardList },
    { id: 'cards',   label: 'Report Cards', icon: FileText }
  ];

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-6 animate-in fade-in duration-500">

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Reports</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Offline exams, marks entry and report cards
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ReportsHelp topic={tab} />
          {/* Report Cards is a read-only view, so it gets the year filter.
              Exam Setup and Marks Entry act on the active year, so they show
              the active-year badge instead. */}
          {tab === 'cards'
            ? <YearFilter years={academicYears} value={selectedYearId} activeId={activeYearId}
                onChange={setSelectedYearId} yearKnown={yearKnown} />
            : <ActiveYearBadge />}
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="flex justify-start">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar w-full sm:w-auto pb-2 sm:pb-0">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-primary text-white shadow-sm ring-1 ring-primary/20'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
                }`}>
                <Icon className="size-3.5 shrink-0" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {tab === 'setup' && <ExamSetup />}
        {tab === 'marks' && <ClassList mode="marks" canManage={canManage} />}
        {tab === 'cards' && <ClassList mode="cards" canManage={canManage} academicYearId={selectedYearId} />}
      </div>

    </div>
  );
}

// =====================================================================
//  YearFilter — academic-year dropdown for Report Cards (and the student's
//  own card). Defaults to the active year (tagged "Current") and lists
//  every year the institution has. Shown to every role, so anyone can view
//  their report card for a past year. A deleted year is simply absent.
// =====================================================================
function YearFilter({ years = [], value, activeId, onChange, yearKnown = true }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!yearKnown) return null;
  if (years.length === 0) {
    return (
      <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 ring-1 ring-red-500/20 rounded-md px-3 h-9 text-xs font-semibold shrink-0"
        title="Create an academic year under Manage Logins → Academics Year">
        <AlertTriangle className="size-4" /> <span>No academic years</span>
      </div>
    );
  }

  const selected = years.find(y => String(y.id) === String(value))
    || years.find(y => String(y.id) === String(activeId))
    || years[0];

  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 h-9 pl-3 pr-2.5 rounded-md bg-primary/5 ring-1 ring-primary/20 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors whitespace-nowrap">
        <CalendarRange className="size-4 shrink-0" />
        Academic Year: {selected ? selected.name : '—'}
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 z-30 w-56 max-h-72 overflow-y-auto custom-scrollbar bg-white rounded-md ring-1 ring-black/5 shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {years.map(y => {
            const isSel = String(y.id) === String(selected?.id);
            return (
              <button key={y.id} onClick={() => { onChange(y.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-zinc-50 transition-colors ${isSel ? 'text-primary font-semibold' : 'text-zinc-700'}`}>
                <span className="truncate">{y.name}</span>
                {String(y.id) === String(activeId) && (
                  <span className="text-[9px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/20 px-1.5 py-0.5 rounded shrink-0">Current</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}