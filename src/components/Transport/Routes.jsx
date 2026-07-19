import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Route as RouteIcon, Plus, Pencil, Trash2, ChevronLeft, MapPin, Bus, User, Users, X, Save, ChevronDown, MapPinned, Eye, ExternalLink, Navigation } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import LeafletMap, { parseLatLng } from './LeafletMap';
import { Thumb, Lightbox } from './ImageBits';
import TripStatus, { TripPill, tripState } from './TripStatus';

export default function Routes({ user, canEdit, canDelete }) {
  const [mode, setMode]       = useState('list');   // 'list' | 'edit' | 'view'
  const [editingId, setEditingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);
  const [zoom, setZoom]       = useState(null);   // {src, alt}
  const [live, setLive]       = useState({});     // route_id -> track

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

  // Watch every route's trip state so the school can see which buses are out.
  useEffect(() => {
    if (mode !== 'list' || !user?.institutionId) return;
    let alive = true;
    const tick = async () => {
      try {
        const d = await fetch(`${API_BASE_URL}/transport/live/${user.institutionId}`).then(x => x.json());
        if (alive) setLive(d && typeof d === 'object' ? d : {});
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => { alive = false; clearInterval(id); };
  }, [mode, user]);

  const del = async (id) => {
    if (!window.confirm('Delete this route? Its points and student assignments will be removed.')) return;
    setBusyId(id);
    try { const res = await fetch(`${API_BASE_URL}/transport/route/${id}`, { method: 'DELETE' }); if (res.ok) await load(); }
    finally { setBusyId(null); }
  };

  if (mode === 'view') {
    return <RouteView routeId={viewingId} user={user} canEdit={canEdit} onBack={() => { setMode('list'); setViewingId(null); }}
      onEdit={canEdit ? () => { setEditingId(viewingId); setViewingId(null); setMode('edit'); } : null} />;
  }

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
          <button onClick={() => { setEditingId(null); setMode('edit'); }} className="inline-flex items-center justify-center gap-1.5 bg-primary text-white h-9 px-4 shrink-0 rounded-md text-xs font-semibold hover:bg-primary/90 shadow-sm transition-colors">
            <Plus className="size-4" /> New Route
          </button>
        )}
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['Route', 'Vehicle', 'Driver', 'Assistant', 'Points', 'Students', 'Trip', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length ? rows.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-start gap-2">
                        <RouteIcon className="size-4 text-primary mt-0.5 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-zinc-900">{r.route_name}</span>
                          {r.route_code && <span className="text-[11px] text-zinc-400">{r.route_code}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {r.vehicle_no ? (
                        <div className="flex items-center gap-2.5">
                          <Thumb endpoint={`/transport/vehicle-image/${r.vehicle_id}`} has={r.vehicle_has_image} alt={r.vehicle_no} icon={Bus}
                            className="size-10" onEnlarge={(src, alt) => setZoom({ src, alt })} />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-900 truncate">{r.vehicle_no}</p>
                            <p className="text-[10px] text-zinc-400 truncate">{r.vehicle_code ? r.vehicle_code : ''}{r.vehicle_code && r.vehicle_name ? ' - ' : ''}{r.vehicle_name || ''}</p>
                          </div>
                        </div>
                      ) : <span className="text-xs text-zinc-400">-</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-700">{r.driver_name || '-'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-700">{r.assistant_name || '-'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600 tabular-nums">{r.point_count}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600 tabular-nums">{r.student_count}</td>
                    <td className="px-5 py-3"><TripPill track={live[r.id]} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setViewingId(r.id); setMode('view'); }} className="flex items-center justify-center size-7 rounded bg-white text-zinc-600 border border-zinc-200 hover:text-primary hover:bg-zinc-50 transition-colors shadow-sm" title="View">
                          <Eye className="size-3.5" />
                        </button>
                        {canEdit && (
                          <button onClick={() => { setEditingId(r.id); setMode('edit'); }} className="flex items-center justify-center size-7 rounded bg-white text-zinc-600 border border-zinc-200 hover:text-primary hover:bg-zinc-50 transition-colors shadow-sm" title="Edit">
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => del(r.id)} disabled={busyId === r.id} className="flex items-center justify-center size-7 rounded bg-white text-zinc-600 border border-zinc-200 hover:text-red-600 hover:bg-red-50 transition-colors shadow-sm disabled:opacity-40" title="Delete">
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="8" className="px-5 py-10 text-center text-xs text-zinc-500 italic">No routes yet. Create one to add pickup &amp; drop points.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {zoom && <Lightbox src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />}
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
  const [assistants, setAssistants] = useState([]);

  const [form, setForm] = useState({ route_name: '', route_code: '', vehicle_id: '', driver_id: '', assistant_id: '', notes: '' });
  const [pickupPts, setPickupPts] = useState([]);
  const [dropPts, setDropPts]     = useState([]);
  const [pointTab, setPointTab]   = useState('pickup');
  const [resolving, setResolving] = useState(new Set());

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const [v, d, c] = await Promise.all([
          fetch(`${API_BASE_URL}/transport/vehicles/${user.institutionId}`).then(r => r.json()),
          fetch(`${API_BASE_URL}/transport/staff/${user.institutionId}?staff_role=Driver`).then(r => r.json()),
          fetch(`${API_BASE_URL}/transport/staff/${user.institutionId}?staff_role=Assistant`).then(r => r.json()),
        ]);
        setVehicles(Array.isArray(v) ? v : []);
        setDrivers(Array.isArray(d) ? d : []);
        setAssistants(Array.isArray(c) ? c : []);
      } catch { /* ignore */ }

      if (isEdit) {
        try {
          const r = await fetch(`${API_BASE_URL}/transport/route/${editingId}`).then(x => x.json());
          setForm({
            route_name: r.route_name || '', route_code: r.route_code || '',
            vehicle_id: r.vehicle_id ?? '', driver_id: r.driver_id ?? '', assistant_id: r.assistant_id ?? '', notes: r.notes || ''
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

  // Resolve one point's link (used on blur). Short goo.gl links resolve via the backend.
  const resolveLink = async (i, tabAtCall) => {
    const list = tabAtCall === 'pickup' ? pickupPts : dropPts;
    const setFn = tabAtCall === 'pickup' ? setPickupPts : setDropPts;
    const p = list[i];
    if (!p) return;
    const link = (p.location_link || '').trim();
    if (!link) return;
    const local = parseLatLng(link);
    if (local) { setFn(l => l.map((x, idx) => idx === i ? { ...x, lat: local.lat, lng: local.lng } : x)); return; }
    if (!/^https?:\/\//i.test(link)) return;
    const key = `${tabAtCall}-${i}`;
    setResolving(s => new Set(s).add(key));
    try {
      const d = await fetch(`${API_BASE_URL}/transport/resolve-link?url=${encodeURIComponent(link)}`).then(r => r.json());
      if (d.lat != null && d.lng != null) setFn(l => l.map((x, idx) => idx === i ? { ...x, lat: d.lat, lng: d.lng } : x));
    } catch { /* ignore */ }
    finally { setResolving(s => { const n = new Set(s); n.delete(key); return n; }); }
  };

  // Resolve every unpinned URL point (used on save).
  const resolveArr = async (arr) => Promise.all(arr.map(async (p) => {
    if (p.lat != null && p.lng != null) return p;
    const link = (p.location_link || '').trim();
    const local = parseLatLng(link);
    if (local) return { ...p, lat: local.lat, lng: local.lng };
    if (/^https?:\/\//i.test(link)) {
      try {
        const d = await fetch(`${API_BASE_URL}/transport/resolve-link?url=${encodeURIComponent(link)}`).then(r => r.json());
        if (d.lat != null && d.lng != null) return { ...p, lat: d.lat, lng: d.lng };
      } catch { /* ignore */ }
    }
    return p;
  }));

  const mapPoints = [
    ...pickupPts.map(p => ({ ...p, point_type: 'pickup' })),
    ...dropPts.map(p => ({ ...p, point_type: 'drop' })),
  ];

  const save = async () => {
    if (!form.route_name.trim()) return alert('Route name is required.');
    setSaving(true);
    try {
      // Resolve any pasted map links to coordinates before saving.
      const [rp, rd] = await Promise.all([resolveArr(pickupPts), resolveArr(dropPts)]);
      setPickupPts(rp); setDropPts(rd);
      const points = [
        ...rp.map(p => ({ point_type: 'pickup', ...clean(p) })),
        ...rd.map(p => ({ point_type: 'drop', ...clean(p) })),
      ].filter(p => (p.title || '').trim());
      const body = {
        institutionId: user.institutionId,
        route_name: form.route_name.trim(), route_code: form.route_code.trim(),
        vehicle_id: form.vehicle_id || null, driver_id: form.driver_id || null, assistant_id: form.assistant_id || null,
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
      <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-primary transition-colors">
        <ChevronLeft className="size-4" /> Back to routes
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* LEFT - form */}
        <div className="space-y-5">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><RouteIcon className="size-4 text-primary" /> Route Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Route Name *"><input value={form.route_name} onChange={e => set('route_name', e.target.value)} className={inputCls} placeholder="e.g. Route 1 - City Center" /></Field>
              <Field label="Route Code"><input value={form.route_code} onChange={e => set('route_code', e.target.value)} className={inputCls} placeholder="R-01" /></Field>
              <Field label="Vehicle"><Select value={form.vehicle_id} onChange={v => set('vehicle_id', v)} options={[{ v: '', l: 'Unassigned' }, ...vehicles.map(x => ({ v: x.id, l: `${x.vehicle_no}${x.vehicle_name ? ` - ${x.vehicle_name}` : ''}` }))]} icon={Bus} /></Field>
              <Field label="Driver"><Select value={form.driver_id} onChange={v => set('driver_id', v)} options={[{ v: '', l: 'Unassigned' }, ...drivers.map(x => ({ v: x.user_id, l: x.name }))]} icon={User} empty="No drivers - add them in Drivers & Assistants" /></Field>
              <Field label="Assistant"><Select value={form.assistant_id} onChange={v => set('assistant_id', v)} options={[{ v: '', l: 'Unassigned' }, ...assistants.map(x => ({ v: x.user_id, l: x.name }))]} icon={Users} empty="No assistants - add them in Drivers & Assistants" /></Field>
              <div className="sm:col-span-2"><Field label="Notes"><input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} /></Field></div>
            </div>
          </div>

          {/* Points */}
          <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
              <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
                {['pickup', 'drop'].map(t => (
                  <button key={t} onClick={() => setPointTab(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${pointTab === t ? (t === 'pickup' ? 'bg-white text-primary shadow-sm' : 'bg-white text-accent shadow-sm') : 'text-zinc-600 hover:text-zinc-900'}`}>
                    {t === 'pickup' ? 'Pickup' : 'Drop'} <span className="text-zinc-400 font-normal">({t === 'pickup' ? pickupPts.length : dropPts.length})</span>
                  </button>
                ))}
              </div>
              <button onClick={() => addPoint()} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-md">
                <Plus className="size-3.5" /> Add point
              </button>
            </div>
            <div className="p-4 space-y-3">
              {cur.length === 0 && <p className="text-xs text-zinc-400 italic text-center py-4">No {pointTab} points yet. Add a row or click the map.</p>}
              {cur.map((p, i) => {
                const pinned = p.lat != null && p.lng != null;
                const isResolving = resolving.has(`${pointTab}-${i}`);
                return (
                  <div key={i} className="ring-1 ring-zinc-200 rounded-md p-3 space-y-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className={`size-6 shrink-0 rounded-full text-white text-[10px] font-semibold flex items-center justify-center ${pointTab === 'pickup' ? 'bg-primary' : 'bg-accent'}`}>{i + 1}</span>
                      <input value={p.title} onChange={e => updatePoint(i, 'title', e.target.value)} placeholder="Point title (e.g. Main Gate)" className="flex-1 h-8 px-2 text-sm outline-none bg-transparent border-b border-transparent focus:border-primary/40" />
                      
                      {/* Semantic Status Pills */}
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${isResolving ? 'text-blue-700 bg-blue-50 ring-blue-600/20' : pinned ? 'text-emerald-700 bg-emerald-50 ring-emerald-600/20' : 'text-zinc-700 bg-zinc-50 ring-zinc-600/20'}`}>
                        {isResolving ? 'resolving...' : pinned ? 'pinned' : 'not pinned'}
                      </span>
                      
                      <button onClick={() => removePoint(i)} className="flex items-center justify-center size-7 rounded bg-white text-zinc-600 border border-zinc-200 hover:text-red-600 hover:bg-red-50 transition-colors shadow-sm ml-1">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                      <input value={p.location_link} onChange={e => updatePoint(i, 'location_link', e.target.value)} onBlur={() => resolveLink(i, pointTab)} placeholder="Paste Google Maps link or lat,lng" className={`${inputCls} h-8 text-xs`} />
                      <input value={p.arrival_time} onChange={e => updatePoint(i, 'arrival_time', e.target.value)} placeholder="08:15 AM" className={`${inputCls} h-8 text-xs w-full sm:w-28`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onBack} className="flex items-center justify-center gap-1.5 h-9 px-6 min-w-[120px] w-full sm:w-auto bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 transition-colors rounded-md text-xs font-semibold shadow-sm">
              Cancel
            </button>
            <button onClick={save} disabled={saving || !canEdit} className="inline-flex items-center justify-center gap-1.5 bg-primary text-white h-9 px-6 min-w-[120px] w-full sm:w-auto rounded-md text-xs font-semibold hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-60">
              <Save className="size-4" /> {saving ? 'Saving...' : (isEdit ? 'Update Route' : 'Save Route')}
            </button>
          </div>
        </div>

        {/* RIGHT - map (sticky) */}
        <div className="lg:sticky lg:top-4">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3 mb-2 px-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900"><MapPinned className="size-4 text-primary" /> Route Map</span>
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

const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-shadow';

// Form Fields updated strictly to use Micro-labels
function Field({ label, children }) { 
  return (
    <div className="flex flex-col">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  ); 
}

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

// =================================================================
//  Route view (read-only) - points left, road-routed map right
// =================================================================
function gmapsDir(list) {
  const pts = list.filter(p => p.lat != null && p.lng != null);
  if (!pts.length) return null;
  const origin = `${pts[0].lat},${pts[0].lng}`;
  const destination = `${pts[pts.length - 1].lat},${pts[pts.length - 1].lng}`;
  const waypoints = pts.slice(1, -1).map(p => `${p.lat},${p.lng}`).join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return url;
}

// Read-only for the school: watch any route, never drive it. Only the route's
// driver / assistant can start or complete a trip (see MyDuty).
function RouteView({ routeId, user, canEdit, onBack, onEdit }) {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/transport/route/${routeId}`).then(x => x.json());
        if (alive) setRoute(r || null);
      } catch { if (alive) setRoute(null); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [routeId]);

  // Poll this route's trip state (status + position).
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const d = await fetch(`${API_BASE_URL}/transport/track/${routeId}`).then(x => x.json());
        if (alive) setTrack(d || null);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [routeId]);

  if (loading) return <div className="h-96 flex items-center justify-center"><div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>;
  if (!route) return <div className="p-8 text-center text-sm text-zinc-400">Route not found.</div>;

  const live = tripState(track);
  const pts = (route.points || []).map(p => ({ ...p, lat: p.latitude != null ? Number(p.latitude) : null, lng: p.longitude != null ? Number(p.longitude) : null }));
  const pickups = pts.filter(p => p.point_type === 'pickup');
  const drops = pts.filter(p => p.point_type === 'drop');
  const mapPoints = pts.map(p => ({ point_type: p.point_type, title: p.title, lat: p.lat, lng: p.lng }));
  const pickupNav = gmapsDir(pickups);
  const dropNav = gmapsDir(drops);

  const PointList = ({ title, list, color }) => (
    <div>
      <p className="text-xs font-semibold text-zinc-900 mb-2 flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: color }} /> {title} <span className="text-zinc-400 font-normal">({list.length})</span></p>
      {list.length ? (
        <div className="space-y-2">
          {list.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5 ring-1 ring-zinc-200 rounded-md px-3 py-2 shadow-sm">
              <span className="size-6 shrink-0 rounded-full text-white text-[10px] font-semibold flex items-center justify-center" style={{ backgroundColor: color }}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-900 truncate">{p.title}{p.arrival_time ? <span className="text-zinc-400"> - {p.arrival_time}</span> : ''}</p>
                {p.location_link && <a href={p.location_link} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-0.5 truncate"><MapPin className="size-3" /> location</a>}
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-[11px] text-zinc-400 italic">No {title.toLowerCase()} points.</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-primary transition-colors">
        <ChevronLeft className="size-4" /> Back to routes
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Left - details + points */}
        <div className="space-y-5">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <RouteIcon className="size-4 text-primary mt-1 shrink-0" />
                <div>
                  <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                    {route.route_name}
                    <TripPill track={track} />
                  </h3>
                  {route.route_code && <p className="text-[11px] text-zinc-400 mt-0.5">{route.route_code}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onEdit && (
                  <button onClick={onEdit} className="inline-flex items-center justify-center gap-1.5 bg-white text-zinc-600 border border-zinc-200 h-9 px-4 shrink-0 rounded-md text-xs font-semibold hover:text-primary hover:bg-zinc-50 transition-colors shadow-sm">
                    <Pencil className="size-3.5" /> Edit
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
              <Meta icon={Bus} label="Vehicle" value={route.vehicle_no || '-'} />
              <Meta icon={User} label="Driver" value={route.driver_name || '-'} phone={route.driver_phone} />
              <Meta icon={Users} label="Assistant" value={route.assistant_name || '-'} phone={route.assistant_phone} />
            </div>
            <div className="mt-4"><TripStatus track={track} /></div>
          </div>

          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 space-y-5 shadow-sm">
            <PointList title="Pickup" list={pickups} color="#18469A" />
            <div className="border-t border-zinc-100" />
            <PointList title="Drop" list={drops} color="#f29132" />
          </div>
        </div>

        {/* Right - map */}
        <div className="lg:sticky lg:top-4">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2 px-1 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900"><MapPinned className="size-4 text-primary" /> Route Map</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><span className="size-2.5 rounded-full bg-primary" /> Pickup</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><span className="size-2.5 rounded-full bg-accent" /> Drop</span>
                {live.live && <span className="inline-flex items-center gap-1 text-[10px] text-green-700 font-semibold"><Bus className="size-3" /> Bus live</span>}
              </div>
              <div className="flex items-center gap-2">
                {pickupNav && <a href={pickupNav} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"><Navigation className="size-3" /> Pickup</a>}
                {dropNav && <a href={dropNav} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent hover:underline"><Navigation className="size-3" /> Drop</a>}
              </div>
            </div>
            <LeafletMap points={mapPoints} routed liveLocation={live.live ? { lat: Number(track.lat), lng: Number(track.lng) } : null} height={560} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, label, value, phone }) {
  return (
    <div className="rounded-md bg-zinc-50 ring-1 ring-zinc-100 p-2.5 shadow-sm">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Icon className="size-3.5" /> {label}</p>
      <p className="text-sm font-semibold text-zinc-900 truncate mt-1">{value}</p>
      {phone ? (
        <a href={`tel:${phone}`} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-0.5">
          {phone}
        </a>
      ) : null}
    </div>
  );
}