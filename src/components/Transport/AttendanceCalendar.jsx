import React, { useState, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateKey = (v) => (v ? String(v).slice(0, 10) : null);

// records: [{ trip_type:'pickup'|'drop', attendance_date, status:'present'|'absent' }]
export default function AttendanceCalendar({ records = [], compact = false }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  // date -> { present, absent } counts
  const byDate = useMemo(() => {
    const m = {};
    records.forEach(r => {
      const k = dateKey(r.attendance_date); if (!k) return;
      m[k] = m[k] || { present: 0, absent: 0 };
      if (r.status === 'present') m[k].present++; else m[k].absent++;
    });
    return m;
  }, [records]);

  const dayColor = (k) => {
    const d = byDate[k];
    if (!d) return null;
    if (d.present > 0 && d.absent > 0) return 'yellow';
    if (d.present > 0) return 'green';
    if (d.absent > 0) return 'red';
    return null;
  };

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const cls = {
    green:  'bg-green-100 text-green-800',
    red:    'bg-red-100 text-red-700',
    yellow: 'bg-amber-100 text-amber-800',
  };

  // month summary
  const summary = useMemo(() => {
    let g = 0, r = 0, y = 0;
    Object.keys(byDate).forEach(k => {
      if (!k.startsWith(`${year}-${pad(month + 1)}`)) return;
      const c = dayColor(k);
      if (c === 'green') g++; else if (c === 'red') r++; else if (c === 'yellow') y++;
    });
    return { g, r, y };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDate, year, month]);

  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-1.5 text-zinc-500 hover:text-primary hover:bg-zinc-50 rounded-md"><ChevronLeft className="size-4" /></button>
        <h3 className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5"><CalendarDays className="size-3.5 text-primary" /> {MONTHS[month]} {year}</h3>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-1.5 text-zinc-500 hover:text-primary hover:bg-zinc-50 rounded-md"><ChevronRight className="size-4" /></button>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WD.map(w => <div key={w} className="text-center text-[9px] font-semibold text-zinc-400 uppercase py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const k = `${year}-${pad(month + 1)}-${pad(d)}`;
            const color = dayColor(k);
            const isToday = ymd(today) === k;
            return (
              <div key={k} title={color ? `${byDate[k].present} present · ${byDate[k].absent} absent` : ''}
                className={`aspect-square rounded-md text-xs flex items-center justify-center ${color ? cls[color] + ' font-semibold' : 'text-zinc-600'} ${isToday ? 'ring-1 ring-primary/50' : ''}`}>
                {d}
              </div>
            );
          })}
        </div>
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
          <Legend cls="bg-green-100" label={`Present (${summary.g})`} />
          <Legend cls="bg-amber-100" label={`Half (${summary.y})`} />
          <Legend cls="bg-red-100" label={`Absent (${summary.r})`} />
        </div>
      </div>
    </div>
  );
}

function Legend({ cls, label }) {
  return <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500"><span className={`size-3 rounded ${cls}`} /> {label}</span>;
}