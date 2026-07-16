import React from 'react';
import { CalendarRange, ChevronDown, Lock } from 'lucide-react';

// =====================================================================
//  FeeYear — the Academic Year picker shared by every Fee Management tab.
//
//  The year is owned by FeeManagement (the parent) because Fee Assign,
//  Concessions, Paid/Unpaid and Alerts all read the same /fees/data
//  payload. Each tab just renders this control in its own filter row, so
//  changing the year on one tab carries to all of them.
//
//  There is deliberately no "All Years" option. Expected is computed from
//  a year's plans against each student's CURRENT class — a student in
//  Class 10 today was in Class 9 last year — so summing years would
//  report an Expected (and a Collection Rate) that means nothing.
//  One year at a time is the only honest view.
// =====================================================================

export function FeeYearSelect({ years = [], value, onChange, disabled = false }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
        <CalendarRange className="size-3.5" /> Academic Year
      </span>
      <div className="relative">
        <select value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={disabled || !years.length}
          className="h-8 appearance-none rounded border border-zinc-200 bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer disabled:bg-zinc-50 disabled:text-zinc-400">
          {years.length === 0 && <option value="">—</option>}
          {years.map(y => (
            <option key={y.id} value={String(y.id)}>{y.name}{y.isActive ? ' (current)' : ''}</option>
          ))}
        </select>
        <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

// Shown wherever an action is locked because a closed year is selected.
export function ClosedYearBadge({ yearName }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-600/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
      <Lock className="size-3" /> {yearName ? `${yearName} · ` : ''}Read only
    </span>
  );
}

// Full-width note explaining the lock, for the top of an editing screen.
export function ClosedYearNote({ yearName }) {
  return (
    <div className="rounded-md bg-amber-50/70 ring-1 ring-amber-600/15 px-4 py-3 flex gap-2.5">
      <Lock className="size-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-800 leading-relaxed">
        You're looking at <strong>{yearName || 'a closed academic year'}</strong>, which is not the active year.
        Everything is visible but nothing can be changed — editing a finished year would rewrite figures you have
        already collected and reported on. To make changes, set that year active in
        <strong> Manage Logins → Academics Year</strong>.
      </p>
    </div>
  );
}