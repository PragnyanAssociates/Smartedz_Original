import React, { useState, useEffect, useCallback } from 'react';
import { Bus, Plus, Pencil, Trash2, X, Save, ChevronDown, Eye, Upload, ImageIcon } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

const TYPES = ['Bus', 'Van', 'Auto', 'Car', 'Other'];
const EMPTY = { vehicle_no: '', vehicle_code: '', vehicle_name: '', vehicle_type: 'Bus', registration_date: '', capacity: '', notes: '', vehicle_image: '', is_active: true };
const fmtDate = (v) => { if (!v) return '—'; const s = String(v).slice(0, 10); const [y, m, d] = s.split('-'); return d ? `${d}/${m}/${y}` : s; };

export default function Vehicles({ user, canEdit, canDelete }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [viewId, setViewId]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [busyId, setBusyId]   = useState(null);
  const [removeImg, setRemoveImg] = useState(false);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/transport/vehicles/${user.institutionId}`);
      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
    } catch (e) { console.error('Vehicles fetch error:', e); setRows([]); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setRemoveImg(false); setModal({ ...EMPTY }); };
  const openEdit = async (v) => {
    setRemoveImg(false);
    try {
      const d = await fetch(`${API_BASE_URL}/transport/vehicle/${v.id}`).then(x => x.json());
      setModal({
        id: d.id, vehicle_no: d.vehicle_no || '', vehicle_code: d.vehicle_code || '', vehicle_name: d.vehicle_name || '',
        vehicle_type: d.vehicle_type || 'Bus', registration_date: d.registration_date ? String(d.registration_date).slice(0, 10) : '',
        capacity: d.capacity ?? '', notes: d.notes || '', vehicle_image: '', existingImage: d.vehicle_image || '', is_active: !!d.is_active
      });
    } catch { alert('Could not load the vehicle.'); }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return alert('Image must be under 3 MB.');
    const reader = new FileReader();
    reader.onloadend = () => { setModal(m => ({ ...m, vehicle_image: reader.result })); setRemoveImg(false); };
    reader.readAsDataURL(f);
  };

  const save = async () => {
    if (!modal.vehicle_no.trim()) return alert('Vehicle number is required.');
    setSaving(true);
    try {
      const body = {
        institutionId: user.institutionId,
        vehicle_no: modal.vehicle_no.trim(), vehicle_code: modal.vehicle_code.trim(), vehicle_name: modal.vehicle_name.trim(),
        vehicle_type: modal.vehicle_type, registration_date: modal.registration_date || null,
        capacity: modal.capacity === '' ? null : Number(modal.capacity),
        notes: modal.notes, is_active: modal.is_active,
        userId: user?.id ?? null, userName: user?.name ?? null
      };
      if (modal.vehicle_image) body.vehicle_image = modal.vehicle_image;
      else if (modal.id && removeImg) body.removeImage = true;
      const url = modal.id ? `${API_BASE_URL}/transport/vehicle/${modal.id}` : `${API_BASE_URL}/transport/vehicle`;
      const res = await fetch(url, { method: modal.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not save.'); }
      else { setModal(null); await load(); }
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this vehicle?')) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/transport/vehicle/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not delete.'); }
      else await load();
    } finally { setBusyId(null); }
  };

  const shownImage = modal?.vehicle_image || (!removeImg ? modal?.existingImage : '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-400">{rows.length} vehicle{rows.length === 1 ? '' : 's'}</p>
        {canEdit && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 h-9 rounded-md text-xs font-semibold hover:bg-primary/90 shadow-sm">
            <Plus className="size-4" /> Add Vehicle
          </button>
        )}
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        {loading ? (
          <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['Vehicle No', 'Code', 'Name / Model', 'Type', 'Reg. Date', 'Capacity', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length ? rows.map(v => (
                  <tr key={v.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-zinc-900 flex items-center gap-2"><Bus className="size-4 text-primary" /> {v.vehicle_no}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600">{v.vehicle_code || '—'}</td>
                    <td className="px-5 py-3 text-sm text-zinc-700">{v.vehicle_name || '—'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600">{v.vehicle_type || '—'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600 whitespace-nowrap">{fmtDate(v.registration_date)}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600 tabular-nums">{v.capacity ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${v.is_active ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-zinc-100 text-zinc-500 ring-zinc-300'}`}>
                        {v.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewId(v.id)} className="p-1.5 text-zinc-400 hover:text-primary rounded" title="View"><Eye className="size-4" /></button>
                        {canEdit && <button onClick={() => openEdit(v)} className="p-1.5 text-zinc-400 hover:text-primary rounded" title="Edit"><Pencil className="size-4" /></button>}
                        {canDelete && <button onClick={() => del(v.id)} disabled={busyId === v.id} className="p-1.5 text-zinc-400 hover:text-accent rounded disabled:opacity-40" title="Delete"><Trash2 className="size-4" /></button>}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="8" className="px-5 py-10 text-center text-xs text-zinc-500 italic">No vehicles yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-zinc-900">{modal.id ? 'Edit Vehicle' : 'Add Vehicle'}</h4>
              <button onClick={() => setModal(null)} className="text-zinc-400 hover:text-zinc-700"><X className="size-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Vehicle No *"><input value={modal.vehicle_no} onChange={e => setModal(m => ({ ...m, vehicle_no: e.target.value }))} className={inputCls} placeholder="TS09 AB 1234" /></Field>
              <Field label="Code"><input value={modal.vehicle_code} onChange={e => setModal(m => ({ ...m, vehicle_code: e.target.value }))} className={inputCls} placeholder="e.g. VPSB1" /></Field>
              <Field label="Name / Model"><input value={modal.vehicle_name} onChange={e => setModal(m => ({ ...m, vehicle_name: e.target.value }))} className={inputCls} placeholder="e.g. TATA" /></Field>
              <Field label="Type">
                <div className="relative">
                  <select value={modal.vehicle_type} onChange={e => setModal(m => ({ ...m, vehicle_type: e.target.value }))} className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </Field>
              <Field label="Registration Date"><input type="date" value={modal.registration_date} onChange={e => setModal(m => ({ ...m, registration_date: e.target.value }))} className={inputCls} /></Field>
              <Field label="Capacity"><input value={modal.capacity} onChange={e => setModal(m => ({ ...m, capacity: e.target.value.replace(/\D/g, '') }))} className={inputCls} inputMode="numeric" placeholder="e.g. 40" /></Field>
              <div className="sm:col-span-2"><Field label="Notes"><input value={modal.notes} onChange={e => setModal(m => ({ ...m, notes: e.target.value }))} className={inputCls} /></Field></div>
              <div className="sm:col-span-2">
                <Field label="Vehicle Image">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 text-primary ring-1 ring-primary/30 px-3 py-2 rounded-md text-xs font-medium hover:bg-primary/5">
                      <Upload className="size-3.5" /> {shownImage ? 'Change image' : 'Upload image'}
                      <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                    </label>
                    {shownImage && (
                      <button onClick={() => { setModal(m => ({ ...m, vehicle_image: '' })); setRemoveImg(true); }} className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"><X className="size-3.5" /> Remove</button>
                    )}
                  </div>
                  {shownImage && <img src={shownImage} alt="vehicle" className="mt-2 max-h-40 rounded-md ring-1 ring-black/5" />}
                </Field>
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                <input type="checkbox" checked={modal.is_active} onChange={e => setModal(m => ({ ...m, is_active: e.target.checked }))} className="accent-primary" /> Active
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-md text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-md text-xs font-semibold hover:bg-primary/90 disabled:opacity-60">
                <Save className="size-3.5" /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewId && <VehicleView id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function VehicleView({ id, onClose }) {
  const [v, setV] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const d = await fetch(`${API_BASE_URL}/transport/vehicle/${id}`).then(x => x.json()); if (alive) setV(d); }
      catch { if (alive) setV(null); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <span className="text-sm font-bold flex items-center gap-2"><Bus className="size-4" /> {v?.vehicle_no || 'Vehicle'}</span>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="size-5" /></button>
        </div>
        {loading || !v ? (
          <div className="h-40 flex items-center justify-center"><div className="size-6 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-2.5 text-sm">
            {v.vehicle_image
              ? <img src={v.vehicle_image} alt="vehicle" className="w-full rounded-md ring-1 ring-black/5 mb-3" />
              : <div className="w-full h-32 rounded-md bg-zinc-50 ring-1 ring-zinc-100 flex flex-col items-center justify-center text-zinc-300 mb-3"><ImageIcon className="size-6" /><span className="text-[10px] mt-1">No image</span></div>}
            <ViewRow label="Code" value={v.vehicle_code || '—'} />
            <ViewRow label="Name / Model" value={v.vehicle_name || '—'} />
            <ViewRow label="Type" value={v.vehicle_type || '—'} />
            <ViewRow label="Registration Date" value={fmtDate(v.registration_date)} />
            <ViewRow label="Capacity" value={v.capacity ?? '—'} />
            <ViewRow label="Status" value={v.is_active ? 'Active' : 'Inactive'} />
            {v.notes && <ViewRow label="Notes" value={v.notes} />}
            {v.created_by_name && <p className="text-[11px] text-zinc-400 pt-2 border-t border-zinc-100">Added by {v.created_by_name}{v.updated_by_name ? ` · edited by ${v.updated_by_name}` : ''}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function ViewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-500 text-xs shrink-0">{label}</span>
      <span className="font-medium text-zinc-900 text-right">{value}</span>
    </div>
  );
}
const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';
function Field({ label, children }) {
  return <div className="flex flex-col"><label className="text-xs font-medium text-zinc-600 mb-1.5">{label}</label>{children}</div>;
}