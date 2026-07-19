import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Wrench, Plus, Pencil, Trash2, Eye, X, Save, ChevronDown, Bus, Filter, Upload, Receipt } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { RangePresets, DateField, DownloadXlsx, useAcademicYears, todayISO } from './TransportRange';

const TYPES = ['Service', 'Repair', 'Insurance', 'Tyres', 'Fitness / Permit', 'Other'];
const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtDate = (v) => { if (!v) return '-'; const s = String(v).slice(0, 10); const [y, m, d] = s.split('-'); return d ? `${d}/${m}/${y}` : s; };

// Service records are dated, never academic: an insurance renewal or a tyre
// change doesn't care when term starts. The academic-year chips only fill
// From/To, so "what did we spend on the buses this year?" stays one click.
export default function ServiceRepair({ user, canEdit, canDelete, lockedVehicleId = null }) {
  const [vehicles, setVehicles] = useState([]);
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicleId, setVehicleId] = useState(lockedVehicleId ? String(lockedVehicleId) : '');
  const [range, setRange]   = useState({ from: '', to: '' });
  const [modal, setModal]   = useState(null);
  const [viewId, setViewId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const years = useAcademicYears(user?.institutionId);

  useEffect(() => {
    if (!user?.institutionId) return;
    (async () => {
      try {
        const v = await fetch(`${API_BASE_URL}/transport/vehicles/${user.institutionId}`).then(x => x.json());
        const list = Array.isArray(v) ? v : [];
        setVehicles(lockedVehicleId ? list.filter(x => String(x.id) === String(lockedVehicleId)) : list);
      } catch { setVehicles([]); }
    })();
  }, [user, lockedVehicleId]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (vehicleId) p.set('vehicle_id', vehicleId);
    if (range.from) p.set('from', range.from);
    if (range.to) p.set('to', range.to);
    return p.toString();
  }, [vehicleId, range]);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/transport/service/${user.institutionId}?${qs}`);
      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
    } catch { setRows([]); }
    setLoading(false);
  }, [user, qs]);

  useEffect(() => { load(); }, [load]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.cost || 0), 0), [rows]);

  const del = async (id) => {
    if (!window.confirm('Delete this service record?')) return;
    setBusyId(id);
    try { const res = await fetch(`${API_BASE_URL}/transport/service/${id}`, { method: 'DELETE' }); if (res.ok) await load(); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-100 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider self-center"><Filter className="size-3.5" /> Filters</span>
            {!lockedVehicleId && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Vehicle</span>
              <div className="relative">
                <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                  className="h-9 appearance-none rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer shadow-sm">
                  <option value="">All vehicles</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}{v.vehicle_code ? ` - ${v.vehicle_code}` : ''}</option>)}
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            )}
            <DateField label="From" value={range.from} onChange={v => setRange(r => ({ ...r, from: v }))} />
            <DateField label="To" value={range.to} onChange={v => setRange(r => ({ ...r, to: v }))} />
            {(vehicleId || range.from || range.to) && <button onClick={() => { setVehicleId(lockedVehicleId ? String(lockedVehicleId) : ''); setRange({ from: '', to: '' }); }} className="text-[11px] font-semibold text-primary hover:underline self-center pb-2.5 transition-colors">Reset</button>}
            
            <div className="ml-auto flex items-center gap-4 self-end">
              <span className="text-[11px] text-zinc-500 pb-2.5">Total spent: <strong className="text-accent tabular-nums text-sm">{inr(total)}</strong></span>
              <DownloadXlsx url={`${API_BASE_URL}/transport/service-export/${user?.institutionId}?${qs}`} disabled={!rows.length} title="Download these records as Excel" />
              {canEdit && (
                <button onClick={() => setModal({ vehicle_id: lockedVehicleId || vehicles[0]?.id || '', service_date: todayISO(), service_type: 'Service', cost: '', odometer_km: '', garage: '', details: '', attachment: '' })}
                  className="inline-flex items-center justify-center gap-1.5 bg-primary text-white h-9 px-4 shrink-0 rounded-md text-xs font-semibold hover:bg-primary/90 shadow-sm transition-colors">
                  <Plus className="size-4" /> Add Record
                </button>
              )}
            </div>
          </div>
          <RangePresets years={years} value={range} onPick={(from, to) => setRange({ from, to })} />
        </div>
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
          <Wrench className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-900">Service & Repair <span className="text-zinc-400 font-normal">({rows.length})</span></h3>
        </div>
        {loading ? (
          <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['Vehicle', 'Model', 'Code', 'Date', 'Type', 'Cost', 'Details', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length ? rows.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900 flex items-center gap-2"><Bus className="size-4 text-primary" /> {r.vehicle_no}</td>
                    <td className="px-4 py-3 text-xs text-zinc-700">{r.vehicle_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{r.vehicle_code || '-'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">{fmtDate(r.service_date)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-zinc-50 text-zinc-700 ring-1 ring-inset ring-zinc-600/20">
                        {r.service_type || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900 tabular-nums whitespace-nowrap">{inr(r.cost)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600 max-w-[240px] truncate">{r.details || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewId(r.id)} className="flex items-center justify-center size-7 rounded bg-white text-zinc-600 border border-zinc-200 hover:text-primary hover:bg-zinc-50 transition-colors shadow-sm" title="View">
                          <Eye className="size-3.5" />
                        </button>
                        {canEdit && (
                          <button onClick={async () => {
                            const d = await fetch(`${API_BASE_URL}/transport/service-details/${r.id}`).then(x => x.json());
                            setModal({ id: d.id, vehicle_id: d.vehicle_id, service_date: String(d.service_date).slice(0, 10), service_type: d.service_type || 'Service', cost: d.cost ?? '', odometer_km: d.odometer_km ?? '', garage: d.garage || '', details: d.details || '', attachment: '', hadAttachment: !!d.attachment });
                          }} className="flex items-center justify-center size-7 rounded bg-white text-zinc-600 border border-zinc-200 hover:text-primary hover:bg-zinc-50 transition-colors shadow-sm" title="Edit">
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
                )) : <tr><td colSpan="8" className="px-4 py-10 text-center text-xs text-zinc-500 italic">No service or repair records for these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <ServiceModal user={user} vehicles={vehicles} value={modal} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await load(); }} />}
      {viewId && <ServiceView id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function ServiceModal({ user, vehicles, value, onClose, onSaved }) {
  const [f, setF] = useState(value);
  const [removeAtt, setRemoveAtt] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return alert('Image must be under 3 MB.');
    const reader = new FileReader();
    reader.onloadend = () => { set('attachment', reader.result); setRemoveAtt(false); };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!f.vehicle_id) return alert('Select a vehicle.');
    if (!f.service_date) return alert('Pick the service date.');
    setSaving(true);
    try {
      const body = { ...f, institutionId: user.institutionId, userId: user?.id ?? null, userName: user?.name ?? null };
      if (f.id && removeAtt && !f.attachment) body.removeAttachment = true;
      const url = f.id ? `${API_BASE_URL}/transport/service/${f.id}` : `${API_BASE_URL}/transport/service`;
      const res = await fetch(url, { method: f.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not save.'); }
      else onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-semibold text-zinc-900">{f.id ? 'Edit Service / Repair' : 'Add Service / Repair'}</h4>
          <button onClick={onClose} className="flex items-center justify-center size-8 rounded-md bg-white text-zinc-600 border border-zinc-200 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Vehicle *">
              <div className="relative">
                <select value={f.vehicle_id} onChange={e => set('vehicle_id', e.target.value)} className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                  <option value="">Select vehicle...</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}{v.vehicle_code ? ` - ${v.vehicle_code}` : ''}{v.vehicle_name ? ` - ${v.vehicle_name}` : ''}</option>)}
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Field>
          </div>
          <Field label="Service date *"><input type="date" value={f.service_date} onChange={e => set('service_date', e.target.value)} className={inputCls} /></Field>
          <Field label="Type">
            <div className="relative">
              <select value={f.service_type} onChange={e => set('service_type', e.target.value)} className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </Field>
          <Field label="Cost (INR) *"><input value={f.cost} onChange={e => set('cost', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="e.g. 4500" className={inputCls} /></Field>
          <Field label="Odometer (km)"><input value={f.odometer_km} onChange={e => set('odometer_km', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Optional" className={inputCls} /></Field>
          <div className="col-span-2"><Field label="Garage / Workshop"><input value={f.garage} onChange={e => set('garage', e.target.value)} placeholder="Optional" className={inputCls} /></Field></div>
          <div className="col-span-2">
            <Field label="Service details">
              <textarea value={f.details} onChange={e => set('details', e.target.value)} rows={4} placeholder="Explain the work done - parts replaced, issue found, etc."
                className={`${inputCls} h-auto py-2.5 resize-none`} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Bill / Invoice">
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 h-9 px-4 shrink-0 rounded-md text-xs font-semibold transition-colors shadow-sm">
                  <Upload className="size-3.5" /> {f.attachment || (f.hadAttachment && !removeAtt) ? 'Change image' : 'Upload image'}
                  <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                </label>
                {(f.attachment || (f.hadAttachment && !removeAtt)) && (
                  <button onClick={() => { set('attachment', ''); setRemoveAtt(true); }} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600 hover:underline transition-colors">
                    <X className="size-3.5" /> Remove
                  </button>
                )}
              </div>
              {f.attachment && <img src={f.attachment} alt="bill" className="mt-3 max-h-40 rounded-md ring-1 ring-black/5 shadow-sm" />}
            </Field>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-5 border-t border-zinc-100">
          <button onClick={onClose} className="flex items-center justify-center gap-1.5 h-9 px-6 min-w-[120px] w-full sm:w-auto bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 transition-colors rounded-md text-xs font-semibold shadow-sm">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-1.5 bg-primary text-white h-9 px-6 min-w-[120px] w-full sm:w-auto rounded-md text-xs font-semibold hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-60">
            <Save className="size-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ServiceView({ id, onClose }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const j = await fetch(`${API_BASE_URL}/transport/service-details/${id}`).then(x => x.json()); if (alive) setD(j); }
      catch { if (alive) setD(null); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-white border-b border-zinc-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <span className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><Wrench className="size-4 text-primary" /> {d?.vehicle_no || 'Record'}</span>
          <button onClick={onClose} className="flex items-center justify-center size-8 rounded-md bg-white text-zinc-600 border border-zinc-200 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm">
            <X className="size-4" />
          </button>
        </div>
        {loading || !d ? (
          <div className="h-40 flex items-center justify-center"><div className="size-6 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-4 text-sm">
            <Row label="Model" value={d.vehicle_name || '-'} />
            <Row label="Code" value={d.vehicle_code || '-'} />
            <Row label="Service date" value={fmtDate(d.service_date)} />
            <Row label="Type" value={d.service_type || '-'} />
            <Row label="Cost" value={inr(d.cost)} />
            {d.odometer_km != null && <Row label="Odometer" value={`${d.odometer_km} km`} />}
            {d.garage && <Row label="Garage" value={d.garage} />}
            {d.details && (
              <div className="pt-2">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Service details</p>
                <p className="text-sm text-zinc-800 whitespace-pre-wrap rounded-md bg-zinc-50 ring-1 ring-zinc-200 p-3 shadow-sm">{d.details}</p>
              </div>
            )}
            {d.attachment && (
              <div className="pt-2">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Receipt className="size-3.5" /> Bill / Invoice</p>
                <img src={d.attachment} alt="bill" className="w-full rounded-md ring-1 ring-black/5 shadow-sm" />
              </div>
            )}
            {d.created_by_name && <p className="text-[10px] text-zinc-400 pt-3 border-t border-zinc-100">Added by {d.created_by_name}{d.updated_by_name ? ` - edited by ${d.updated_by_name}` : ''}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-0.5 shrink-0">{label}</span>
      <span className="font-semibold text-zinc-900 text-right">{value}</span>
    </div>
  );
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