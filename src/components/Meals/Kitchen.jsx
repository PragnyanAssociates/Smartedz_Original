import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  ChefHat, Plus, Trash2, Loader2, X, Save, Camera, Calendar,
  Package, Utensils, ChevronRight, ScanBarcode
} from 'lucide-react';

const UNITS = ['g', 'kg', 'l', 'ml', 'pcs', 'pkt'];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDay = (d) => {
  const x = new Date(d + 'T00:00:00');
  if (isNaN(x.getTime())) return d;
  return x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

// =====================================================================
//  Kitchen — daily provisions + usage. Edit permission manages it;
//  this tab isn't shown to read-only users at all.
// =====================================================================
export default function Kitchen({ user, canEdit, canDelete }) {
  const [provisions, setProvisions] = useState([]);
  const [usage, setUsage]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [date, setDate]             = useState(todayStr());

  const [addOpen, setAddOpen]   = useState(false);
  const [logItem, setLogItem]   = useState(null); // provision being logged

  const fetchAll = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const [pRes, uRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/kitchen/${user.institutionId}/inventory`),
        fetch(`${API_BASE_URL}/admin/kitchen/${user.institutionId}/usage?date=${date}`)
      ]);
      const p = await pRes.json();
      const u = await uRes.json();
      setProvisions(Array.isArray(p) ? p : []);
      setUsage(Array.isArray(u) ? u : []);
    } catch (e) { console.error('Kitchen fetch error:', e); }
    setLoading(false);
  }, [user, date]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.item_name}" from provisions?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/kitchen/inventory/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      fetchAll();
    } catch (e) { alert(e.message); }
  };

  const num = (v) => {
    const n = Number(v);
    return Number.isInteger(n) ? n : n.toFixed(2).replace(/\.00$/, '');
  };

  return (
    <div className="space-y-5">
      {/* top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} max={todayStr()}
              className="h-9 pl-8 pr-3 bg-white border border-zinc-200 rounded-md text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm" />
          </div>
          <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">usage date</span>
        </div>
        {canEdit && (
          <button onClick={() => setAddOpen(true)}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors">
            <Plus className="size-3.5" /> Add Provision
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="size-8 text-primary animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Remaining provisions */}
          <section className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
              <Package className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-zinc-800">Remaining Provisions</h3>
              <span className="ml-auto text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{provisions.length}</span>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {provisions.length === 0 ? (
                <div className="p-10 text-center text-zinc-400 text-sm font-medium">No provisions yet.</div>
              ) : provisions.map(p => (
                <div key={p.id} className="p-3 flex items-center gap-3 hover:bg-zinc-50/60 transition-colors">
                  <div className="size-11 rounded-md bg-zinc-100 ring-1 ring-black/5 overflow-hidden flex items-center justify-center shrink-0">
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Utensils className="size-4 text-zinc-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{p.item_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-600/15 px-1.5 py-0.5 rounded">
                        Left: {num(p.quantity_remaining)} {p.unit}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">of {num(p.total_quantity)} {p.unit}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={() => setLogItem(p)} title="Log usage"
                      className="h-8 px-3 rounded-md text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 flex items-center gap-1 transition-colors shrink-0">
                      Use <ChevronRight className="size-3.5" />
                    </button>
                  )}
                  {(canDelete || canEdit) && (
                    <button onClick={() => handleDelete(p)} title="Delete"
                      className="size-8 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Usage for the day */}
          <section className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
              <ScanBarcode className="size-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-zinc-800">Usage</h3>
              <span className="text-[11px] text-zinc-400 font-medium truncate">· {fmtDay(date)}</span>
              <span className="ml-auto text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{usage.length}</span>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {usage.length === 0 ? (
                <div className="p-10 text-center text-zinc-400 text-sm font-medium">Nothing logged on this day.</div>
              ) : usage.map(u => (
                <div key={u.id} className="p-3 flex items-center gap-3">
                  <div className="size-9 rounded-md bg-amber-50 text-amber-600 ring-1 ring-amber-600/15 flex items-center justify-center shrink-0">
                    <Utensils className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{u.item_name}</p>
                    {u.used_by_name && <p className="text-[11px] text-zinc-400 font-medium mt-0.5">by {u.used_by_name}</p>}
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-600/15 px-2 py-1 rounded shrink-0">
                    {num(u.quantity_used)} {u.unit}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {addOpen && (
        <AddProvisionModal user={user} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); fetchAll(); }} />
      )}
      {logItem && (
        <LogUsageModal item={logItem} date={date} user={user} onClose={() => setLogItem(null)}
          onSaved={() => { setLogItem(null); fetchAll(); }} />
      )}
    </div>
  );
}

function AddProvisionModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ item_name: '', unit: 'g', quantity: '', image: null });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const onPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return alert('Image must be under 3 MB.');
    const reader = new FileReader();
    reader.onloadend = () => set('image', reader.result);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.item_name.trim()) return alert('Item name is required.');
    if (form.quantity === '' || isNaN(Number(form.quantity))) return alert('Enter a valid quantity.');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/kitchen/inventory`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity) })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Save failed'); }
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <ModalShell title="Add Provision" onClose={onClose}>
      <div className="flex flex-col items-center mb-5">
        <div className="relative">
          <div className="size-20 rounded-lg bg-zinc-50 ring-1 ring-black/5 overflow-hidden flex items-center justify-center">
            {form.image ? <img src={form.image} alt="" className="w-full h-full object-cover" /> : <Package className="size-7 text-zinc-300" />}
          </div>
          <label className="absolute -bottom-1 -right-1 bg-primary hover:bg-primary/90 text-white p-1.5 rounded-full cursor-pointer shadow-sm ring-2 ring-white transition-colors">
            <Camera className="size-3" />
            <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
          </label>
        </div>
      </div>
      <div className="space-y-4">
        <LabeledInput label="Item Name" required value={form.item_name} onChange={v => set('item_name', v)} placeholder="e.g. Rice" />
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label="Quantity" required type="number" value={form.quantity} onChange={v => set('quantity', v)} placeholder="e.g. 25" />
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Unit</label>
            <div className="flex flex-wrap gap-1.5">
              {UNITS.map(u => (
                <button key={u} type="button" onClick={() => set('unit', u)}
                  className={`h-8 px-2.5 rounded-md text-xs font-semibold ring-1 transition-colors ${form.unit === u ? 'bg-primary text-white ring-primary' : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'}`}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <ModalFooter saving={saving} onClose={onClose} onSave={save} label="Add Provision" />
    </ModalShell>
  );
}

function LogUsageModal({ item, date, user, onClose, onSaved }) {
  const [qty, setQty] = useState('');
  const [useDate, setUseDate] = useState(date);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (qty === '' || Number(qty) <= 0) return alert('Enter a quantity greater than 0.');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/kitchen/usage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId: item.id, quantityUsed: Number(qty), usageDate: useDate })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Save failed'); }
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <ModalShell title="Log Usage" onClose={onClose} max="max-w-sm">
      <div className="bg-zinc-50/70 ring-1 ring-black/5 rounded-md p-3 mb-4 flex items-center gap-3">
        <div className="size-10 rounded-md bg-white ring-1 ring-black/5 overflow-hidden flex items-center justify-center shrink-0">
          {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Utensils className="size-4 text-zinc-400" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">{item.item_name}</p>
          <p className="text-[11px] text-zinc-500 font-medium">Remaining: {item.quantity_remaining} {item.unit}</p>
        </div>
      </div>
      <div className="space-y-4">
        <LabeledInput label={`Quantity used (${item.unit})`} required type="number" value={qty} onChange={setQty} placeholder="e.g. 5" />
        <LabeledInput label="Date" type="date" value={useDate} onChange={setUseDate} />
      </div>
      <ModalFooter saving={saving} onClose={onClose} onSave={save} label="Log Usage" />
    </ModalShell>
  );
}

// ---- shared bits ----
function ModalShell({ title, onClose, children, max = 'max-w-md' }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-lg ring-1 ring-black/5 w-full ${max} shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[92vh]`}>
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2"><ChefHat className="size-4 text-primary" /> {title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1.5 hover:bg-zinc-100 rounded-md transition-colors"><X className="size-4" /></button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}
function ModalFooter({ saving, onClose, onSave, label }) {
  return (
    <div className="flex justify-end gap-3 mt-6">
      <button type="button" onClick={onClose} disabled={saving} className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">Cancel</button>
      <button type="button" onClick={onSave} disabled={saving} className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors min-w-[120px]">
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} {saving ? 'Saving...' : label}
      </button>
    </div>
  );
}
function LabeledInput({ label, value, onChange, type = 'text', required, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
    </div>
  );
}