import React, { useMemo } from 'react';

// =====================================================================
//  AttendanceChart — lightweight, dependency-free stacked bar chart.
//  Each bar is one day; height is proportional to that day's total
//  marks, split into Present (green) / Absent (red).
//  Works for a whole category (many marks per day) or a single person
//  (one mark per day). No charting library required.
//  (Late was removed — only Present / Absent now.)
// =====================================================================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const labelFor = (s) => {
  const str = String(s || '').slice(0, 10);
  const [y, m, d] = str.split('-').map(Number);
  if (!d || !m) return str;
  return `${d} ${MONTHS[m - 1] || ''}`;
};

export default function AttendanceChart({ series = [], height = 200, title }) {
  const maxTotal = useMemo(
    () => Math.max(1, ...series.map(s => Number(s.total) || 0)),
    [series]
  );

  if (!series || series.length === 0) {
    return (
      <div className="bg-white rounded-lg ring-1 ring-black/5 border-dashed h-48 flex items-center justify-center">
        <p className="text-zinc-400 text-sm font-medium">No data to chart for this range.</p>
      </div>
    );
  }

  // When there are very many bars, thin them and drop most labels.
  const many = series.length > 18;
  const barWidth = many ? 14 : 26;
  const labelEvery = many ? Math.ceil(series.length / 12) : 1;

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-4 text-[10px] font-medium text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" /> Present</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-red-500" /> Absent</span>
        </div>
        {title && <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{title}</span>}
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <div className="flex items-end gap-1.5 sm:gap-2" style={{ height, minWidth: '100%' }}>
          {series.map((s, i) => {
            const total = Number(s.total) || 0;
            const present = Number(s.present) || 0;
            const absent = Number(s.absent) || 0;

            const barH = total > 0 ? (total / maxTotal) * 100 : 0;
            const pPct = total > 0 ? (present / total) * 100 : 0;
            const aPct = total > 0 ? (absent / total) * 100 : 0;

            return (
              <div key={i} className="flex flex-col items-center justify-end shrink-0" style={{ width: barWidth }}>
                <div
                  className="w-full rounded-t flex flex-col-reverse overflow-hidden bg-zinc-100"
                  style={{ height: `${barH}%`, minHeight: total > 0 ? 6 : 2 }}
                  title={`${labelFor(s.date)} — Present ${present} · Absent ${absent} (Total ${total})`}>
                  <div className="bg-emerald-500 w-full" style={{ height: `${pPct}%` }} />
                  <div className="bg-red-500 w-full" style={{ height: `${aPct}%` }} />
                </div>
                <span className="text-[8px] text-zinc-400 mt-1.5 whitespace-nowrap tabular-nums h-3">
                  {i % labelEvery === 0 ? labelFor(s.date) : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}