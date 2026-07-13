import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserCheck, Users, Route as RouteIcon, ChevronDown, Search, Check, Trash2, Plus, MapPin, GraduationCap } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

export default function AssignStudents({ user, canEdit, canDelete }) {
  const [routes, setRoutes]   = useState([]);
  const [routeId, setRouteId] = useState('');
  const [route, setRoute]     = useState(null);      // details (points)
  const [assigned, setAssigned] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // add-panel state
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [picked, setPicked]   = useState(new Set());
  const [search, setSearch]   = useState('');
  const [pickupPt, setPickupPt] = useState('');
  const [dropPt, setDropPt]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [busyId, setBusyId]   = useState(null);

  useEffect(() => {
    if (!user?.institutionId) return;
    (async () => {
      try {
        const [r, c] = await Promise.all([
          fetch(`${API_BASE_URL}/transport/routes/${user.institutionId}`).then(x => x.json()),
          fetch(`${API_BASE_URL}/transport/classes/${user.institutionId}`).then(x => x.json()),
        ]);
        setRoutes(Array.isArray(r) ? r : []);
        setClasses(Array.isArray(c) ? c : []);
      } catch { /* ignore */ }
    })();
  }, [user]);

  const loadRoute = useCallback(async () => {
    if (!routeId) { setRoute(null); setAssigned([]); return; }
    setLoadingRoute(true);
    try {
      const [d, a] = await Promise.all([
        fetch(`${API_BASE_URL}/transport/route/${routeId}`).then(x => x.json()),
        fetch(`${API_BASE_URL}/transport/route-students/${routeId}`).then(x => x.json()),
      ]);
      setRoute(d || null);
      setAssigned(Array.isArray(a) ? a : []);
    } catch { setRoute(null); setAssigned([]); }
    setLoadingRoute(false);
  }, [routeId]);

  useEffect(() => { loadRoute(); }, [loadRoute]);

  // students of selected class
  useEffect(() => {
    if (!classId) { setStudents([]); setPicked(new Set()); return; }
    let alive = true;
    (async () => {
      setLoadingStudents(true);
      try {
        const res = await fetch(`${API_BASE_URL}/transport/class-students/${user.institutionId}?class_id=${classId}`);
        const json = await res.json();
        if (alive) { setStudents(json?.students || []); setPicked(new Set()); }
      } catch { if (alive) setStudents([]); }
      if (alive) setLoadingStudents(false);
    })();
    return () => { alive = false; };
  }, [classId, user]);

  const assignedIds = useMemo(() => new Set(assigned.map(a => a.student_id)), [assigned]);
  const points = route?.points || [];
  const pickupOpts = points.filter(p => p.point_type === 'pickup');
  const dropOpts   = points.filter(p => p.point_type === 'drop');
  const pointTitle = (id) => points.find(p => String(p.id) === String(id))?.title || '—';
  const classLabel = (cid) => { const c = classes.find(c => String(c.id) === String(cid)); return c ? `${c.className}${c.section ? ` - ${c.section}` : ''}` : '—'; };

  const toggle = (id) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filteredStudents = students.filter(s => !search.trim() || (s.name || '').toLowerCase().includes(search.trim().toLowerCase()) || String(s.roll_no || '').includes(search.trim()));
  const selectableAll = () => setPicked(new Set(filteredStudents.filter(s => !assignedIds.has(s.id)).map(s => s.id)));

  const assign = async () => {
    if (!picked.size) return alert('Select at least one student.');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/transport/route-students`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId, route_id: routeId, student_ids: [...picked],
          pickup_point_id: pickupPt || null, drop_point_id: dropPt || null,
          userId: user?.id ?? null, userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not assign.'); }
      else { setPicked(new Set()); await loadRoute(); }
    } finally { setSaving(false); }
  };

  const unassign = async (id) => {
    setBusyId(id);
    try { const res = await fetch(`${API_BASE_URL}/transport/route-student/${id}`, { method: 'DELETE' }); if (res.ok) await loadRoute(); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      {/* Route picker */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white p-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700"><RouteIcon className="size-4 text-primary" /> Route</span>
        <div className="relative">
          <select value={routeId} onChange={e => setRouteId(e.target.value)} className={`${inputCls} appearance-none pr-8 cursor-pointer min-w-[240px]`}>
            <option value="">Select a route…</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}{r.route_code ? ` (${r.route_code})` : ''}</option>)}
          </select>
          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {route && <span className="text-[11px] text-zinc-500">{assigned.length} student{assigned.length === 1 ? '' : 's'} assigned</span>}
      </div>

      {!routeId ? (
        <div className="ring-1 ring-black/5 rounded-lg bg-white p-10 text-center">
          <UserCheck className="size-6 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-700">Pick a route to assign students.</p>
          <p className="text-xs text-zinc-500 mt-1">Create routes in the Routes tab first.</p>
        </div>
      ) : loadingRoute ? (
        <div className="h-48 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Add panel */}
          {canEdit && (
            <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
              <div className="p-4 border-b border-zinc-100 flex items-center gap-2"><Plus className="size-4 text-primary" /><h3 className="text-sm font-semibold text-zinc-900">Add Students</h3></div>
              <div className="p-4 space-y-3">
                <Field label="1 · Select class">
                  <div className="relative">
                    <select value={classId} onChange={e => setClassId(e.target.value)} className={`${inputCls} appearance-none pl-8 pr-8 cursor-pointer`}>
                      <option value="">Choose class…</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{classLabel(c.id)}</option>)}
                    </select>
                    <GraduationCap className="size-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </Field>

                {classId && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-zinc-600">2 · Select students ({picked.size} chosen)</label>
                      <button onClick={selectableAll} className="text-[11px] text-primary hover:underline">Select all</button>
                    </div>
                    <div className="relative mb-2">
                      <Search className="size-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or roll…" className={`${inputCls} pl-8`} />
                    </div>
                    <div className="ring-1 ring-zinc-200 rounded-md max-h-64 overflow-y-auto divide-y divide-zinc-100">
                      {loadingStudents ? (
                        <div className="h-24 flex items-center justify-center"><div className="size-6 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
                      ) : filteredStudents.length ? filteredStudents.map(s => {
                        const already = assignedIds.has(s.id);
                        const on = picked.has(s.id);
                        return (
                          <button key={s.id} onClick={() => !already && toggle(s.id)} disabled={already}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${already ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50'}`}>
                            <span className={`size-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary' : 'border-zinc-300'}`}>{on && <Check className="size-3 text-white" />}</span>
                            <span className="text-[11px] font-semibold text-zinc-400 w-8 tabular-nums">{s.roll_no || '—'}</span>
                            <span className="text-sm text-zinc-800 flex-1">{s.name}</span>
                            {already && <span className="text-[10px] text-zinc-400">assigned</span>}
                          </button>
                        );
                      }) : <p className="px-3 py-6 text-center text-xs text-zinc-400 italic">No students in this class.</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Field label="Pickup point (optional)">
                        <div className="relative">
                          <select value={pickupPt} onChange={e => setPickupPt(e.target.value)} className={`${inputCls} appearance-none pr-8 cursor-pointer text-xs`}>
                            <option value="">—</option>
                            {pickupOpts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                          </select>
                          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </Field>
                      <Field label="Drop point (optional)">
                        <div className="relative">
                          <select value={dropPt} onChange={e => setDropPt(e.target.value)} className={`${inputCls} appearance-none pr-8 cursor-pointer text-xs`}>
                            <option value="">—</option>
                            {dropOpts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                          </select>
                          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </Field>
                    </div>

                    <button onClick={assign} disabled={saving || !picked.size} className="w-full mt-3 inline-flex items-center justify-center gap-1.5 bg-primary text-white px-4 py-2.5 rounded-md text-xs font-semibold hover:bg-primary/90 disabled:opacity-60">
                      <Plus className="size-4" /> {saving ? 'Assigning…' : `Assign ${picked.size || ''} to route`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assigned list */}
          <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex items-center gap-2"><Users className="size-4 text-primary" /><h3 className="text-sm font-semibold text-zinc-900">Assigned Students <span className="text-zinc-400 font-normal">({assigned.length})</span></h3></div>
            {assigned.length ? (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[520px]">
                  <thead>
                    <tr className="bg-zinc-50/50">
                      {['Roll', 'Student', 'Class', 'Pickup', 'Drop', ''].map((h, i) => (
                        <th key={i} className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {assigned.map(a => (
                      <tr key={a.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="px-4 py-2.5 text-[11px] font-semibold text-zinc-400 tabular-nums">{a.roll_no || '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-zinc-900">{a.name}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-600">{classLabel(a.class_id)}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-600">{a.pickup_point_id ? pointTitle(a.pickup_point_id) : '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-600">{a.drop_point_id ? pointTitle(a.drop_point_id) : '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end">
                            {canDelete && <button onClick={() => unassign(a.id)} disabled={busyId === a.id} className="p-1.5 text-zinc-400 hover:text-accent rounded disabled:opacity-40" title="Remove"><Trash2 className="size-4" /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="px-5 py-10 text-center text-xs text-zinc-500 italic">No students assigned to this route yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';
function Field({ label, children }) { return <div className="flex flex-col"><label className="text-xs font-medium text-zinc-600 mb-1.5">{label}</label>{children}</div>; }