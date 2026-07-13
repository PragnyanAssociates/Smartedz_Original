import React, { useState, useEffect, useCallback } from 'react';
import { Bus, Plus, Pencil, Trash2, X, Save, ChevronDown } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

const TYPES = ['Bus', 'Van', 'Auto', 'Car', 'Other'];
const EMPTY = { vehicle_no: '', vehicle_name: '', vehicle_type: 'Bus', capacity: '', notes: '', is_active: true };

export default function Vehicles({ user, canEdit, canDelete }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);   // {id?, ...form}
  const [saving, setSaving]   = useState(false);
  const [busyId, setBusyId]   = useState(null);

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

  const openNew = () => setModal({ ...EMPTY });
  const openEdit = (v) => setModal({
    id: v.id, vehicle_no: v.vehicle_no || '', vehicle_name: v.vehicle_name || '',
    vehicle_type: v.vehicle_type || 'Bus', capacity: v.capacity ?? '', notes: v.notes || '', is_active: !!v.is_active
  });

  const save = async () => {
    if (!modal.vehicle_no.trim()) return alert('Vehicle number is required.');
    setSaving(true);
    try {
      const body = {
        institutionId: user.institutionId,
        vehicle_no: modal.vehicle_no.trim(), vehicle_name: modal.vehicle_name.trim(),
        vehicle_type: modal.vehicle_type, capacity: modal.capacity === '' ? null : Number(modal.capacity),
        notes: modal.notes, is_active: modal.is_active, userId: user?.id ?? null, userName: user?.name ?? null
      };
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
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['Vehicle No', 'Name / Model', 'Type', 'Capacity', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length ? rows.map(v => (
                  <tr key={v.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-zinc-900 flex items-center gap-2"><Bus className="size-4 text-primary" /> {v.vehicle_no}</td>
                    <td className="px-5 py-3 text-sm text-zinc-700">{v.vehicle_name || '—'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600">{v.vehicle_type || '—'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600 tabular-nums">{v.capacity ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${v.is_active ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-zinc-100 text-zinc-500 ring-zinc-300'}`}>
                        {v.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && <button onClick={() => openEdit(v)} className="p-1.5 text-zinc-400 hover:text-primary rounded" title="Edit"><Pencil className="size-4" /></button>}
                        {canDelete && <button onClick={() => del(v.id)} disabled={busyId === v.id} className="p-1.5 text-zinc-400 hover:text-accent rounded disabled:opacity-40" title="Delete"><Trash2 className="size-4" /></button>}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className="px-5 py-10 text-center text-xs text-zinc-500 italic">No vehicles yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-zinc-900">{modal.id ? 'Edit Vehicle' : 'Add Vehicle'}</h4>
              <button onClick={() => setModal(null)} className="text-zinc-400 hover:text-zinc-700"><X className="size-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Vehicle No *"><input value={modal.vehicle_no} onChange={e => setModal(m => ({ ...m, vehicle_no: e.target.value }))} className={inputCls} placeholder="TS09 AB 1234" /></Field>
              <Field label="Name / Model"><input value={modal.vehicle_name} onChange={e => setModal(m => ({ ...m, vehicle_name: e.target.value }))} className={inputCls} /></Field>
              <Field label="Type">
                <div className="relative">
                  <select value={modal.vehicle_type} onChange={e => setModal(m => ({ ...m, vehicle_type: e.target.value }))} className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </Field>
              <Field label="Capacity"><input value={modal.capacity} onChange={e => setModal(m => ({ ...m, capacity: e.target.value.replace(/\D/g, '') }))} className={inputCls} inputMode="numeric" placeholder="e.g. 40" /></Field>
              <div className="sm:col-span-2">
                <Field label="Notes"><input value={modal.notes} onChange={e => setModal(m => ({ ...m, notes: e.target.value }))} className={inputCls} /></Field>
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
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';
function Field({ label, children }) {
  return <div className="flex flex-col"><label className="text-xs font-medium text-zinc-600 mb-1.5">{label}</label>{children}</div>;
}