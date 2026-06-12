import React, { useMemo } from 'react';

// =====================================================================
//  AttendanceCalendar — month grid for a single person.
//  Each day block is coloured by that day's attendance:
//    Present → green · Absent → red · not marked → grey.
//  Renders one month (monthly view) or several months (yearly / custom).
//  Dependency-free. (Late was removed — only Present / Absent now.)
// =====================================================================

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const CELL = {
  P:      'bg-emerald-500 text-white ring-1 ring-emerald-600/30',
  A:      'bg-red-500 text-white ring-1 ring-red-600/30',
  none:   'bg-zinc-50 text-zinc-400 ring-1 ring-zinc-200',
  future: 'bg-white text-zinc-300 ring-1 ring-zinc-100'
};
const STATUS_LABEL = { P: 'Present', A: 'Absent' };

function MonthGrid({ ym, statusByDate, todayStr }) {
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay(); // 0 = Sunday

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Per-month tally
  let present = 0, absent = 0;
  Object.keys(statusByDate).forEach(k => {
    if (k.slice(0, 7) === ym) {
      const s = statusByDate[k];
      if (s === 'P') present++; else if (s === 'A') absent++;
    }
  });

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-zinc-900">{MONTHS_FULL[m - 1]} {y}</h4>
        <span className="text-[10px] font-medium text-zinc-400 tabular-nums">
          {present}/{present + absent} present
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
        {DOW.map((d, i) => (
          <div key={i} className="text-[9px] sm:text-[10px] font-semibold text-zinc-400 uppercase text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${ym}-${String(d).padStart(2, '0')}`;
          const status = statusByDate[dateStr];
          const isFuture = dateStr > todayStr;
          const cls = status ? CELL[status] : (isFuture ? CELL.future : CELL.none);
          const title = status
            ? `${dateStr} — ${STATUS_LABEL[status] || status}`
            : (isFuture ? dateStr : `${dateStr} — Not marked`);
          return (
            <div key={i} title={title}
              className={`aspect-square rounded-md flex items-center justify-center text-[11px] sm:text-xs font-semibold tabular-nums ${cls}`}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AttendanceCalendar({ rows = [], months = [] }) {
  const statusByDate = useMemo(() => {
    const map = {};
    rows.forEach(r => { map[String(r.attendance_date).slice(0, 10)] = r.status; });
    return map;
  }, [rows]);

  const todayStr = new Date().toISOString().slice(0, 10);

  if (!months || months.length === 0) {
    return (
      <div className="bg-white rounded-lg ring-1 ring-black/5 border-dashed h-40 flex items-center justify-center">
        <p className="text-zinc-400 text-sm font-medium">No dates to show for this range.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] font-medium text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-emerald-500" /> Present</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-red-500" /> Absent</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-zinc-100 ring-1 ring-zinc-200" /> Not marked</span>
      </div>

      <div className={months.length > 1 ? 'grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'max-w-md'}>
        {months.map(ym => (
          <MonthGrid key={ym} ym={ym} statusByDate={statusByDate} todayStr={todayStr} />
        ))}
      </div>
    </div>
  );
}