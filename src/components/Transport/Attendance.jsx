import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardCheck, Route as RouteIcon, ChevronDown, Check, X, Save, CalendarDays, CheckCheck, Ban } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import AttendanceCalendar from './AttendanceCalendar';
import { fmtISTDateTime } from './TripStatus';

const todayISO = () => new Date().toISOString().slice(0, 10);

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
    if (!routeId) { setStudents([]); setStatus({}); return; }
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
  }, [routeId, trip, date]);

  useEffect(() => { load(); }, [load]);

  const setAll = (v) => setStatus(prev => { const n = {}; students.forEach(s => { n[s.student_id] = v; }); return n; });
  const toggle = (id) => setStatus(p => ({ ...p, [id]: p[id] === 'present' ? 'absent' : 'present' }));

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
      {/* controls */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700"><RouteIcon className="size-4 text-primary" /> Route</span>
          {lockedRouteId ? (
            <span className="text-sm font-semibold text-zinc-900">{route?.route_name || '—'}{route?.route_code ? ` (${route.route_code})` : ''}</span>
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
            <button key={t} onClick={() => setTrip(t)} className={`px-3.5 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${trip === t ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Date</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputCls} w-auto`} />
        </div>
        <span className="text-[11px] text-zinc-500 ml-auto">Present <strong className="text-green-700">{counts.p}</strong> · Absent <strong className="text-red-600">{counts.a}</strong></span>
      </div>

      {!routeId ? (
        <Empty text="No routes yet. Create a route and assign students first." />
      ) : loading ? (
        <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><ClipboardCheck className="size-4 text-primary" /> {trip === 'pickup' ? 'Pickup' : 'Drop'} Attendance <span className="text-zinc-400 font-normal">({students.length})</span></h3>
            {canMark && (
              <div className="flex items-center gap-2">
                <button onClick={() => setAll('present')} className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 ring-1 ring-green-600/20 bg-green-50 px-2.5 py-1 rounded-md hover:bg-green-100"><CheckCheck className="size-3.5" /> All present</button>
                <button onClick={() => setAll('absent')} className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 ring-1 ring-red-200 bg-red-50 px-2.5 py-1 rounded-md hover:bg-red-100"><Ban className="size-3.5" /> All absent</button>
              </div>
            )}
          </div>
          {students.length ? (
            <div className="divide-y divide-zinc-100">
              {students.map(s => {
                const on = status[s.student_id] === 'present';
                const m = marks[s.student_id];
                return (
                  <div key={s.student_id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-[11px] font-semibold text-zinc-400 w-8 tabular-nums">{s.roll_no || '—'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-900 truncate">{s.name}</p>
                      {m?.marked_at
                        ? <p className="text-[10px] text-zinc-400 truncate">Marked by <span className="text-zinc-500 font-medium">{m.marked_by_name || 'Unknown'}</span> · {fmtISTDateTime(m.marked_at)}</p>
                        : <p className="text-[10px] text-amber-600">Not marked yet</p>}
                    </div>
                    <button onClick={() => setCalFor(s)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 shrink-0"><CalendarDays className="size-3.5" /> calendar</button>
                    {canMark ? (
                      <div className="inline-flex items-center rounded-md ring-1 ring-zinc-200 overflow-hidden">
                        <button onClick={() => setStatus(p => ({ ...p, [s.student_id]: 'present' }))} className={`px-2.5 py-1 text-[11px] font-semibold ${on ? 'bg-green-600 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}>Present</button>
                        <button onClick={() => setStatus(p => ({ ...p, [s.student_id]: 'absent' }))} className={`px-2.5 py-1 text-[11px] font-semibold ${!on ? 'bg-red-600 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}>Absent</button>
                      </div>
                    ) : (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${on ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{on ? 'Present' : 'Absent'}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <p className="px-5 py-10 text-center text-xs text-zinc-500 italic">No students assigned to this route.</p>}

          {canMark && students.length > 0 && (
            <div className="p-4 border-t border-zinc-100 flex justify-end">
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-primary text-white px-5 py-2 rounded-md text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"><Save className="size-4" /> {saving ? 'Saving…' : `Save ${trip} attendance`}</button>
            </div>
          )}
        </div>
      )}

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
          <h4 className="text-sm font-semibold text-zinc-900">{student.name} · Attendance</h4>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="size-5" /></button>
        </div>
        <div className="p-4">
          {loading ? <div className="h-40 flex items-center justify-center"><div className="size-6 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
            : <AttendanceCalendar records={records} />}
        </div>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white p-10 text-center">
      <ClipboardCheck className="size-6 text-zinc-300 mx-auto mb-3" />
      <p className="text-sm font-medium text-zinc-700">{text}</p>
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';