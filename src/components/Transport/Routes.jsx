import React, { useState, useEffect, useCallback } from 'react';
import { Route as RouteIcon, Plus, Pencil, Trash2, ChevronLeft, MapPin, Bus, User, Users, X, Save, ChevronDown, MapPinned } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import LeafletMap, { parseLatLng } from './LeafletMap';

export default function Routes({ user, canEdit, canDelete }) {
  const [mode, setMode]       = useState('list');   // 'list' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/transport/routes/${user.institutionId}`);
      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
    } catch (e) { console.error('Routes fetch error:', e); setRows([]); }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (mode === 'list') load(); }, [load, mode]);

  const del = async (id) => {
    if (!window.confirm('Delete this route? Its points and student assignments will be removed.')) return;
    setBusyId(id);
    try { const res = await fetch(`${API_BASE_URL}/transport/route/${id}`, { method: 'DELETE' }); if (res.ok) await load(); }
    finally { setBusyId(null); }
  };

  if (mode === 'edit') {
    return <RouteEditor user={user} canEdit={canEdit} editingId={editingId}
      onBack={() => { setMode('list'); setEditingId(null); }}
      onSaved={() => { setMode('list'); setEditingId(null); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-400">{rows.length} route{rows.length === 1 ? '' : 's'}</p>
        {canEdit && (
          <button onClick={() => { setEditingId(null); setMode('edit'); }} className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 h-9 rounded-md text-xs font-semibold hover:bg-primary/90 shadow-sm">
            <Plus className="size-4" /> New Route
          </button>
        )}
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        {loading ? (
          <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['Route', 'Vehicle', 'Driver', 'Conductor', 'Points', 'Students', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length ? rows.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><RouteIcon className="size-4 text-primary" /> {r.route_name}</div>
                      {r.route_code && <div className="text-[11px] text-zinc-400 ml-6">{r.route_code}</div>}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-700">{r.vehicle_no || '—'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-700">{r.driver_name || '—'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-700">{r.conductor_name || '—'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600 tabular-nums">{r.point_count}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600 tabular-nums">{r.student_count}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && <button onClick={() => { setEditingId(r.id); setMode('edit'); }} className="p-1.5 text-zinc-400 hover:text-primary rounded" title="Edit"><Pencil className="size-4" /></button>}
                        {canDelete && <button onClick={() => del(r.id)} disabled={busyId === r.id} className="p-1.5 text-zinc-400 hover:text-accent rounded disabled:opacity-40" title="Delete"><Trash2 className="size-4" /></button>}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="px-5 py-10 text-center text-xs text-zinc-500 italic">No routes yet. Create one to add pickup &amp; drop points.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
//  Route editor
// =================================================================
function RouteEditor({ user, canEdit, editingId, onBack, onSaved }) {
  const isEdit = !!editingId;
  const [loading, setLoading]   = useState(isEdit);
  const [saving, setSaving]     = useState(false);

  const [vehicles, setVehicles]     = useState([]);
  const [drivers, setDrivers]       = useState([]);
  const [conductors, setConductors] = useState([]);

  const [form, setForm] = useState({ route_name: '', route_code: '', vehicle_id: '', driver_id: '', conductor_id: '', notes: '' });
  const [pickupPts, setPickupPts] = useState([]);
  const [dropPts, setDropPts]     = useState([]);
  const [pointTab, setPointTab]   = useState('pickup');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const [v, d, c] = await Promise.all([
          fetch(`${API_BASE_URL}/transport/vehicles/${user.institutionId}`).then(r => r.json()),
          fetch(`${API_BASE_URL}/transport/staff/${user.institutionId}?staff_role=Driver`).then(r => r.json()),
          fetch(`${API_BASE_URL}/transport/staff/${user.institutionId}?staff_role=Conductor`).then(r => r.json()),
        ]);
        setVehicles(Array.isArray(v) ? v : []);
        setDrivers(Array.isArray(d) ? d : []);
        setConductors(Array.isArray(c) ? c : []);
      } catch { /* ignore */ }

      if (isEdit) {
        try {
          const r = await fetch(`${API_BASE_URL}/transport/route/${editingId}`).then(x => x.json());
          setForm({
            route_name: r.route_name || '', route_code: r.route_code || '',
            vehicle_id: r.vehicle_id ?? '', driver_id: r.driver_id ?? '', conductor_id: r.conductor_id ?? '', notes: r.notes || ''
          });
          const pts = r.points || [];
          setPickupPts(pts.filter(p => p.point_type === 'pickup').map(mapPt));
          setDropPts(pts.filter(p => p.point_type === 'drop').map(mapPt));
        } catch { /* ignore */ }
      }
      setLoading(false);
    })();
  }, [isEdit, editingId, user]);

  const cur = pointTab === 'pickup' ? pickupPts : dropPts;
  const setCur = pointTab === 'pickup' ? setPickupPts : setDropPts;

  const addPoint = (lat, lng) => setCur(list => [...list, {
    title: '', location_link: (lat != null && lng != null) ? `${lat.toFixed(6)},${lng.toFixed(6)}` : '',
    lat: lat ?? null, lng: lng ?? null, arrival_time: ''
  }]);

  const updatePoint = (i, field, val) => setCur(list => list.map((p, idx) => {
    if (idx !== i) return p;
    const next = { ...p, [field]: val };
    if (field === 'location_link') { const ll = parseLatLng(val); if (ll) { next.lat = ll.lat; next.lng = ll.lng; } }
    return next;
  }));
  const removePoint = (i) => setCur(list => list.filter((_, idx) => idx !== i));

  const mapPoints = [
    ...pickupPts.map(p => ({ ...p, point_type: 'pickup' })),
    ...dropPts.map(p => ({ ...p, point_type: 'drop' })),
  ];

  const save = async () => {
    if (!form.route_name.trim()) return alert('Route name is required.');
    setSaving(true);
    try {
      const points = [
        ...pickupPts.map(p => ({ point_type: 'pickup', ...clean(p) })),
        ...dropPts.map(p => ({ point_type: 'drop', ...clean(p) })),
      ].filter(p => (p.title || '').trim());
      const body = {
        institutionId: user.institutionId,
        route_name: form.route_name.trim(), route_code: form.route_code.trim(),
        vehicle_id: form.vehicle_id || null, driver_id: form.driver_id || null, conductor_id: form.conductor_id || null,
        notes: form.notes, points, userId: user?.id ?? null, userName: user?.name ?? null
      };
      const url = isEdit ? `${API_BASE_URL}/transport/route/${editingId}` : `${API_BASE_URL}/transport/route`;
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not save the route.'); }
      else onSaved();
    } finally { setSaving(false); }
  };

  if (loading) return <div className="h-96 flex items-center justify-center"><div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-primary">
        <ChevronLeft className="size-4" /> Back to routes
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* LEFT — form */}
        <div className="space-y-5">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><RouteIcon className="size-4 text-primary" /> Route Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Route Name *"><input value={form.route_name} onChange={e => set('route_name', e.target.value)} className={inputCls} placeholder="e.g. Route 1 — City Center" /></Field>
              <Field label="Route Code"><input value={form.route_code} onChange={e => set('route_code', e.target.value)} className={inputCls} placeholder="R-01" /></Field>
              <Field label="Vehicle"><Select value={form.vehicle_id} onChange={v => set('vehicle_id', v)} options={[{ v: '', l: 'Unassigned' }, ...vehicles.map(x => ({ v: x.id, l: `${x.vehicle_no}${x.vehicle_name ? ` · ${x.vehicle_name}` : ''}` }))]} icon={Bus} /></Field>
              <Field label="Driver"><Select value={form.driver_id} onChange={v => set('driver_id', v)} options={[{ v: '', l: 'Unassigned' }, ...drivers.map(x => ({ v: x.user_id, l: x.name }))]} icon={User} empty="No drivers — add them in Drivers & Conductors" /></Field>
              <Field label="Conductor"><Select value={form.conductor_id} onChange={v => set('conductor_id', v)} options={[{ v: '', l: 'Unassigned' }, ...conductors.map(x => ({ v: x.user_id, l: x.name }))]} icon={Users} empty="No conductors — add them in Drivers & Conductors" /></Field>
              <div className="sm:col-span-2"><Field label="Notes"><input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} /></Field></div>
            </div>
          </div>

          {/* Points */}
          <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
              <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
                {['pickup', 'drop'].map(t => (
                  <button key={t} onClick={() => setPointTab(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${pointTab === t ? (t === 'pickup' ? 'bg-white text-primary shadow-sm' : 'bg-white text-accent shadow-sm') : 'text-zinc-600 hover:text-zinc-900'}`}>
                    {t === 'pickup' ? 'Pickup' : 'Drop'} <span className="text-zinc-400">({t === 'pickup' ? pickupPts.length : dropPts.length})</span>
                  </button>
                ))}
              </div>
              <button onClick={() => addPoint()} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"><Plus className="size-3.5" /> Add point</button>
            </div>
            <div className="p-4 space-y-3">
              {cur.length === 0 && <p className="text-xs text-zinc-400 italic text-center py-4">No {pointTab} points yet. Add a row or click the map.</p>}
              {cur.map((p, i) => {
                const pinned = p.lat != null && p.lng != null;
                return (
                  <div key={i} className="ring-1 ring-zinc-200 rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`size-6 shrink-0 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${pointTab === 'pickup' ? 'bg-primary' : 'bg-accent'}`}>{i + 1}</span>
                      <input value={p.title} onChange={e => updatePoint(i, 'title', e.target.value)} placeholder="Point title (e.g. Main Gate)" className="flex-1 h-8 px-2 text-sm outline-none bg-transparent border-b border-transparent focus:border-primary/40" />
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${pinned ? 'text-green-700 bg-green-50' : 'text-zinc-400 bg-zinc-100'}`}>{pinned ? 'pinned' : 'not pinned'}</span>
                      <button onClick={() => removePoint(i)} className="text-zinc-300 hover:text-accent"><Trash2 className="size-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                      <input value={p.location_link} onChange={e => updatePoint(i, 'location_link', e.target.value)} placeholder="Paste Google Maps link or lat,lng" className={`${inputCls} h-8 text-xs`} />
                      <input value={p.arrival_time} onChange={e => updatePoint(i, 'arrival_time', e.target.value)} placeholder="08:15 AM" className={`${inputCls} h-8 text-xs w-full sm:w-28`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onBack} className="px-4 py-2 rounded-md text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">Cancel</button>
            <button onClick={save} disabled={saving || !canEdit} className="inline-flex items-center gap-1.5 bg-primary text-white px-5 py-2 rounded-md text-xs font-semibold hover:bg-primary/90 shadow-sm disabled:opacity-60">
              <Save className="size-4" /> {saving ? 'Saving…' : (isEdit ? 'Update Route' : 'Save Route')}
            </button>
          </div>
        </div>

        {/* RIGHT — map (sticky) */}
        <div className="lg:sticky lg:top-4">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-3">
            <div className="flex items-center gap-3 mb-2 px-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700"><MapPinned className="size-4 text-primary" /> Route Map</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><span className="size-2.5 rounded-full bg-primary" /> Pickup</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><span className="size-2.5 rounded-full bg-accent" /> Drop</span>
            </div>
            <LeafletMap points={mapPoints} onMapClick={(lat, lng) => addPoint(lat, lng)} height={540} />
          </div>
        </div>
      </div>
    </div>
  );
}

function mapPt(p) {
  return {
    title: p.title || '', location_link: p.location_link || '',
    lat: p.latitude != null ? Number(p.latitude) : null,
    lng: p.longitude != null ? Number(p.longitude) : null,
    arrival_time: p.arrival_time || ''
  };
}
function clean(p) {
  return { title: p.title, location_link: p.location_link || null, latitude: p.lat ?? null, longitude: p.lng ?? null, arrival_time: p.arrival_time || null };
}

const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';
function Field({ label, children }) { return <div className="flex flex-col"><label className="text-xs font-medium text-zinc-600 mb-1.5">{label}</label>{children}</div>; }
function Select({ value, onChange, options, icon: Icon, empty }) {
  const only = options.length <= 1;
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} appearance-none ${Icon ? 'pl-8' : ''} pr-8 cursor-pointer`}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      {Icon && <Icon className="size-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />}
      <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      {only && empty && <p className="text-[10px] text-amber-600 mt-1">{empty}</p>}
    </div>
  );
}