import React, { useState, useEffect } from 'react';
import { CalendarRange, Download, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

// =====================================================================
//  TransportRange — the shared "which dates am I looking at?" controls.
//
//  Transport deliberately has NO academic-year column. Attendance and the
//  log book are dated records: roads, stops and buses don't reset in June,
//  and a bus's fuel or insurance has nothing to do with a school term.
//  Adding a year alongside From/To would give two controls that can
//  contradict each other (year 2026-27, dates in 2025 -> empty screen).
//
//  Instead the academic year is a PRESET: picking 2026-2027 simply fills
//  From/To from that year's start and end dates, which still come from the
//  Academics Year module. One source of truth, no new column, and a range
//  can still span years when a vehicle needs it to.
// =====================================================================

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => ymd(new Date());
export const firstOfMonth = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
const dOnly = (v) => (v ? String(v).slice(0, 10) : '');

/** The school's academic years — used only to fill date ranges. */
export function useAcademicYears(institutionId) {
  const [years, setYears] = useState([]);
  useEffect(() => {
    if (!institutionId) return;
    let alive = true;
    (async () => {
      try {
        const d = await fetch(`${API_BASE_URL}/transport/years/${institutionId}`).then(x => x.json());
        if (alive) setYears(Array.isArray(d) ? d : []);
      } catch { if (alive) setYears([]); }
    })();
    return () => { alive = false; };
  }, [institutionId]);
  return years;
}

/**
 * Quick range chips. Academic years appear first (that's the yearly view
 * people actually want), then the calendar shortcuts.
 */
export function RangePresets({ years = [], value, onPick }) {
  const today = new Date();
  const isOn = (from, to) => value?.from === from && value?.to === to;

  const Chip = ({ on, onClick, children, title }) => (
    <button type="button" onClick={onClick} title={title}
      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
        on ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
           : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
      }`}>{children}</button>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
        <CalendarRange className="size-3.5" /> Quick
      </span>
      {years.map(y => {
        const from = dOnly(y.startDate), to = dOnly(y.endDate);
        if (!from || !to) return null;
        return (
          <Chip key={y.id} on={isOn(from, to)} onClick={() => onPick(from, to)}
            title={`${y.name}: ${from} to ${to}`}>
            {y.name}{y.isActive ? ' ·' : ''}
          </Chip>
        );
      })}
      <Chip on={isOn(firstOfMonth(today), todayISO())} onClick={() => onPick(firstOfMonth(today), todayISO())}>This month</Chip>
      <Chip on={isOn(`${today.getFullYear()}-01-01`, todayISO())} onClick={() => onPick(`${today.getFullYear()}-01-01`, todayISO())}>{today.getFullYear()}</Chip>
      <Chip on={isOn('', '')} onClick={() => onPick('', '')}>All time</Chip>
    </div>
  );
}

export function DateField({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
      <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
        className="h-8 rounded border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40" />
    </div>
  );
}

/**
 * Download button that pulls an .xlsx from the server and saves it.
 * The server builds the file so column widths, IST timestamps and headings
 * survive into Excel — a CSV can't set any of that (dates land as ######).
 */
export function DownloadXlsx({ url, disabled, label = 'Download', title }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Download failed.');
      }
      const blob = await res.blob();
      let filename = `transport_${todayISO()}.xlsx`;
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      if (m) filename = m[1];
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      alert(e.message || 'Could not download.');
    } finally { setBusy(false); }
  };
  return (
    <button onClick={go} disabled={disabled || busy} title={title || 'Download as Excel'}
      className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 h-8 rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50">
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {busy ? 'Preparing…' : label}
    </button>
  );
}