import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardCheck, Route as RouteIcon, ChevronDown, Check, X, Save, CalendarDays, CheckCheck, Ban, BarChart3, PenLine, Users } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import AttendanceCalendar from './AttendanceCalendar';
import { fmtISTDateTime } from './TripStatus';
import { RangePresets, DateField, DownloadXlsx, useAcademicYears, firstOfMonth, todayISO } from './TransportRange';

// =====================================================================
//  Attendance
//   - Mark    - one route, one trip, one day. What the assistant uses.
//   - Summary - any date range (an academic year is one click via the
//     presets), per student, with an Excel download. This is the "how did
//     the year go?" view. There is no academic-year column on transport
//     attendance: the records are dated, and a range says it better.
// =====================================================================

export default function Attendance({ user, canEdit, lockedRouteId = null, routesOverride = null }) {
  const [routes, setRoutes]   = useState([]);
  const [routeId, setRouteId] = useState('');
  const [trip, setTrip]       = useState('pickup');
  const [date, setDate]       = useState(todayISO());
  const [students, setStudents] = useState([]);
  const [status, setStatus]   = useState({});     // student_id -> 'present'|'absent'
  const [marks, setMarks]     = useState({});     // student_id -> { marked_by_name, marked_at }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [calFor, setCalFor]   = useState(null);    // student for calendar modal
  const [mode, setMode]       = useState('mark');  // 'mark' | 'summary'

  useEffect(() => {
    // Crew screens pass their own routes; admins load every route.
    if (routesOverride) {
      setRoutes(routesOverride);
      setRouteId(String(lockedRouteId || routesOverride[0]?.id || ''));
      return;
    }
    if (!user?.institutionId) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/transport/routes/${user.institutionId}`).then(x => x.json());
        const list = Array.isArray(r) ? r : [];
        setRoutes(list);
        if (list.length) setRouteId(String(lockedRouteId || list[0].id));
      } catch { /* ignore */ }
    })();
  }, [user, routesOverride, lockedRouteId]);

  const route = routes.find(r => String(r.id) === String(routeId));
  // The route's assistant marks attendance; the driver may also mark it (useful
  // when no assistant is assigned). Admins with edit rights can always mark.
  const isRouteCrew = route && (String(user?.id) === String(route.assistant_id) || String(user?.id) === String(route.driver_id));
  const canMark = canEdit || isRouteCrew;

  const load = useCallback(async () => {
    if (!routeId || mode !== 'mark') { return; }
    setLoading(true);
    try {
      const [studs, att] = await Promise.all([
        fetch(`${API_BASE_URL}/transport/route-students/${routeId}`).then(x => x.json()),
        fetch(`${API_BASE_URL}/transport/attendance/${routeId}?trip_type=${trip}&date=${date}`).then(x => x.json()),
      ]);
      const s = Array.isArray(studs) ? studs : [];
      setStudents(s);
      const marked = {}, meta = {};
      (Array.isArray(att) ? att : []).forEach(a => {
        marked[a.student_id] = a.status;
        meta[a.student_id] = { marked_by_name: a.marked_by_name, marked_at: a.marked_at };
      });
      // default unmarked -> present
      const map = {};
      s.forEach(x => { map[x.student_id] = marked[x.student_id] || 'present'; });
      setStatus(map);
      setMarks(meta);
    } catch { setStudents([]); setStatus({}); setMarks({}); }
    setLoading(false);
  }, [routeId, trip, date, mode]);

  useEffect(() => { load(); }, [load]);

  const setAll = (v) => setStatus(prev => { const n = {}; students.forEach(s => { n[s.student_id] = v; }); return n; });

  const counts = useMemo(() => {
    let p = 0, a = 0;
    students.forEach(s => { status[s.student_id] === 'present' ? p++ : a++; });
    return { p, a };
  }, [students, status]);

  const save = async () => {
    if (!canMark) return alert('Only the route assistant or an admin can mark attendance.');
    setSaving(true);
    try {
      const records = students.map(s => ({ student_id: s.student_id, status: status[s.student_id] || 'present' }));
      const res = await fetch(`${API_BASE_URL}/transport/attendance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, route_id: routeId, trip_type: trip, attendance_date: date, records, userId: user?.id ?? null, userName: user?.name ?? null })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not save.'); }
      else { await load(); alert('Attendance saved.'); }
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Mark vs Summary */}
      <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
        <button onClick={() => setMode('mark')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${mode === 'mark' ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          <PenLine className="size-3.5" /> Mark a day
        </button>
        <button onClick={() => setMode('summary')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${mode === 'summary' ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          <BarChart3 className="size-3.5" /> Summary & report
        </button>
      </div>

      {mode === 'summary' ? (
        <Summary user={user} routes={routes} lockedRouteId={lockedRouteId} initialRouteId={routeId} />
      ) : (
        <>
          {/* controls */}
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-4 flex flex-wrap items-center gap-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"><RouteIcon className="size-4 text-primary" /> Route</span>
              {lockedRouteId ? (
                <span className="text-sm font-semibold text-zinc-900">{route?.route_name || '-'}{route?.route_code ? ` (${route.route_code})` : ''}</span>
              ) : (
                <div className="relative">
                  <select value={routeId} onChange={e => setRouteId(e.target.value)} className={`${inputCls} appearance-none pr-8 cursor-pointer min-w-[200px]`}>
                    {!routes.length && <option value="">No routes</option>}
                    {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}{r.route_code ? ` (${r.route_code})` : ''}</option>)}
                  </select>
                  <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
            </div>
            <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
              {['pickup', 'drop'].map(t => (
                <button key={t} onClick={() => setTrip(t)} className={`px-3.5 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${trip === t ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>{t}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Date</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputCls} w-auto`} />
              {date !== todayISO() && (
                <button onClick={() => setDate(todayISO())} className="text-[11px] font-semibold text-primary hover:underline transition-colors">Today</button>
              )}
            </div>
            <span className="text-[11px] text-zinc-500 ml-auto">Present <strong className="text-emerald-700">{counts.p}</strong> - Absent <strong className="text-red-600">{counts.a}</strong></span>
          </div>

          {!routeId ? (
            <Empty text="No routes yet. Create a route and assign students first." />
          ) : loading ? (
            <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
          ) : (
            <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden shadow-sm">
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><ClipboardCheck className="size-4 text-primary" /> {trip === 'pickup' ? 'Pickup' : 'Drop'} Attendance <span className="text-zinc-400 font-normal">({students.length})</span></h3>
                {canMark && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAll('present')} className="flex items-center justify-center gap-1.5 h-8 px-3 bg-white text-zinc-600 border border-zinc-200 hover:text-emerald-700 hover:bg-emerald-50 transition-colors rounded-md text-[11px] font-semibold shadow-sm">
                      <CheckCheck className="size-3.5" /> All present
                    </button>
                    <button onClick={() => setAll('absent')} className="flex items-center justify-center gap-1.5 h-8 px-3 bg-white text-zinc-600 border border-zinc-200 hover:text-red-700 hover:bg-red-50 transition-colors rounded-md text-[11px] font-semibold shadow-sm">
                      <Ban className="size-3.5" /> All absent
                    </button>
                  </div>
                )}
              </div>
              {students.length ? (
                <div className="divide-y divide-zinc-100">
                  {students.map(s => {
                    const on = status[s.student_id] === 'present';
                    const m = marks[s.student_id];
                    return (
                      <div key={s.student_id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50/50 transition-colors">
                        <span className="text-[11px] font-semibold text-zinc-400 w-8 tabular-nums">{s.roll_no || '-'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-900 truncate font-semibold">{s.name}</p>
                          {m?.marked_at
                            ? <p className="text-[10px] text-zinc-400 truncate">Marked by <span className="text-zinc-600 font-semibold">{m.marked_by_name || 'Unknown'}</span> - {fmtISTDateTime(m.marked_at)}</p>
                            : <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20 px-2 py-0.5 rounded-full">Not marked yet</span>}
                        </div>
                        <button onClick={() => setCalFor(s)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 shrink-0"><CalendarDays className="size-3.5" /> calendar</button>
                        {canMark ? (
                          <div className="inline-flex items-center rounded-md border border-zinc-200 overflow-hidden shadow-sm">
                            <button onClick={() => setStatus(p => ({ ...p, [s.student_id]: 'present' }))} className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${on ? 'bg-emerald-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}>Present</button>
                            <button onClick={() => setStatus(p => ({ ...p, [s.student_id]: 'absent' }))} className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${!on ? 'bg-red-600 text-white border-l border-red-600' : 'bg-white text-zinc-600 hover:bg-zinc-50 border-l border-zinc-200'}`}>Absent</button>
                          </div>
                        ) : (
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ring-1 ring-inset ${on ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-red-50 text-red-700 ring-red-600/20'}`}>{on ? 'Present' : 'Absent'}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : <p className="px-5 py-10 text-center text-xs text-zinc-500 italic">No students assigned to this route.</p>}

              {canMark && students.length > 0 && (
                <div className="p-4 border-t border-zinc-100 flex justify-end">
                  <button onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-1.5 bg-primary text-white h-9 px-6 min-w-[120px] rounded-md text-xs font-semibold hover:bg-primary/90 shadow-sm disabled:opacity-60 transition-colors">
                    <Save className="size-4" /> {saving ? 'Saving...' : `Save ${trip} attendance`}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {calFor && <CalendarModal student={calFor} onClose={() => setCalFor(null)} />}
    </div>
  );
}

// =====================================================================
//  Summary - any range, per student. The academic-year chips just fill
//  From/To, so a full year is one click without a second filter that
//  could disagree with the dates.
// =====================================================================
function Summary({ user, routes, lockedRouteId, initialRouteId }) {
  const years = useAcademicYears(user?.institutionId);
  const [routeId, setRouteId] = useState(lockedRouteId ? String(lockedRouteId) : (initialRouteId || ''));
  const [trip, setTrip]   = useState('');   // '' = pickup + drop
  const [range, setRange] = useState({ from: firstOfMonth(), to: todayISO() });
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [calFor, setCalFor] = useState(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (routeId) p.set('route_id', routeId);
    if (range.from) p.set('from', range.from);
    if (range.to) p.set('to', range.to);
    if (trip) p.set('trip_type', trip);
    return p.toString();
  }, [routeId, range, trip]);

  useEffect(() => {
    if (!user?.institutionId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await fetch(`${API_BASE_URL}/transport/attendance-summary/${user.institutionId}?${qs}`).then(x => x.json());
        if (alive) setData(d || null);
      } catch { if (alive) setData(null); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, qs]);

  const rows = data?.students || [];
  const totals = useMemo(() => rows.reduce((a, s) => ({
    present: a.present + s.present, absent: a.absent + s.absent, marked: a.marked + s.marked
  }), { present: 0, absent: 0, marked: 0 }), [rows]);
  const overall = totals.marked > 0 ? Math.round((totals.present / totals.marked) * 1000) / 10 : null;

  return (
    <div className="space-y-5">
      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-100 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {!lockedRouteId && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Route</span>
                <div className="relative">
                  <select value={routeId} onChange={e => setRouteId(e.target.value)}
                    className="h-9 appearance-none rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer min-w-[180px] shadow-sm">
                    <option value="">All routes</option>
                    {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}{r.route_code ? ` (${r.route_code})` : ''}</option>)}
                  </select>
                  <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Trip</span>
              <div className="relative">
                <select value={trip} onChange={e => setTrip(e.target.value)}
                  className="h-9 appearance-none rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer shadow-sm">
                  <option value="">Pickup + Drop</option>
                  <option value="pickup">Pickup only</option>
                  <option value="drop">Drop only</option>
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <DateField label="From" value={range.from} onChange={v => setRange(r => ({ ...r, from: v }))} />
            <DateField label="To" value={range.to} onChange={v => setRange(r => ({ ...r, to: v }))} />
            <div className="ml-auto self-end">
              <DownloadXlsx url={`${API_BASE_URL}/transport/attendance-export/${user?.institutionId}?${qs}`}
                disabled={!rows.length} title="Download this summary as Excel" />
            </div>
          </div>
          <RangePresets years={years} value={range} onPick={(from, to) => setRange({ from, to })} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
          <Kpi icon={Users} label="Students" value={rows.length} tone="primary" />
          <Kpi icon={CalendarDays} label="Days recorded" value={data?.days_recorded ?? 0} tone="zinc" />
          <Kpi icon={CheckCheck} label="Present marks" value={totals.present} tone="emerald" />
          <Kpi icon={BarChart3} label="Overall attendance" value={overall == null ? '-' : `${overall}%`} tone="accent" />
        </div>
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
          <ClipboardCheck className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-900">Per student <span className="text-zinc-400 font-normal">({rows.length})</span></h3>
        </div>
        {loading ? (
          <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[880px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['Roll', 'Student', 'Class', 'Route', 'Pickup P / A', 'Drop P / A', 'Days', 'Attendance %', ''].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length ? rows.map(s => (
                  <tr key={s.student_id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-semibold text-zinc-400 tabular-nums">{s.roll_no || '-'}</td>
                    <td className="px-4 py-2.5 text-sm text-zinc-900 font-semibold">{s.name}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-600">{s.className || '-'}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-600">{s.route_name || '-'}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums"><span className="text-emerald-700 font-semibold">{s.pickup_present}</span> <span className="text-zinc-300">/</span> <span className="text-red-600 font-semibold">{s.pickup_absent}</span></td>
                    <td className="px-4 py-2.5 text-xs tabular-nums"><span className="text-emerald-700 font-semibold">{s.drop_present}</span> <span className="text-zinc-300">/</span> <span className="text-red-600 font-semibold">{s.drop_absent}</span></td>
                    <td className="px-4 py-2.5 text-xs text-zinc-600 tabular-nums">{s.days}</td>
                    <td className="px-4 py-2.5">
                      {s.pct == null ? <span className="text-xs text-zinc-400">-</span> : (
                        <span className={`text-xs font-semibold tabular-nums ${s.pct >= 80 ? 'text-emerald-700' : s.pct >= 50 ? 'text-primary' : 'text-red-600'}`}>{s.pct}%</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setCalFor({ student_id: s.student_id, name: s.name })}
                        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 transition-colors"><CalendarDays className="size-3.5" /> calendar</button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="9" className="px-4 py-10 text-center text-xs text-zinc-500 italic">No attendance recorded in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-500">
        Transport records are kept by date, not by academic year - the year chips above simply fill the From / To dates
        from your Academics Year module, so a full year is one click and a range can still span years.
      </p>

      {calFor && <CalendarModal student={calFor} onClose={() => setCalFor(null)} />}
    </div>
  );
}

function CalendarModal({ student, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const d = await fetch(`${API_BASE_URL}/transport/attendance/student/${student.student_id}`).then(x => x.json()); if (alive) setRecords(Array.isArray(d) ? d : []); }
      catch { if (alive) setRecords([]); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [student]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
          <h4 className="text-sm font-semibold text-zinc-900">{student.name} - Attendance</h4>
          <button onClick={onClose} className="flex items-center justify-center size-8 rounded-md bg-white text-zinc-600 border border-zinc-200 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4">
          {loading ? <div className="h-40 flex items-center justify-center"><div className="size-6 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
            : <AttendanceCalendar records={records} />}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }) {
  const tones = { zinc: 'bg-zinc-100 text-zinc-600', emerald: 'bg-emerald-50 text-emerald-600', accent: 'bg-accent/10 text-accent', primary: 'bg-primary/10 text-primary' };
  return (
    <div className="border border-zinc-200 rounded-lg bg-white p-4 shadow-sm">
      <span className={`size-8 rounded-lg flex items-center justify-center mb-2.5 ${tones[tone] || tones.zinc}`}><Icon className="size-4" /></span>
      <p className="text-lg font-semibold text-zinc-900 tabular-nums leading-tight">{value}</p>
      <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white p-10 text-center shadow-sm">
      <ClipboardCheck className="size-10 text-zinc-300 mx-auto mb-3" />
      <p className="text-sm text-zinc-900">{text}</p>
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-shadow';