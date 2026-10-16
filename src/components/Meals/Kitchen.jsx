import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  ChefHat, Plus, Trash2, Loader2, X, Save, Camera, Calendar,
  Package, Utensils, ChevronRight, ScanBarcode, Pencil, Lock, PackagePlus, AlertTriangle, Search
} from 'lucide-react';

const UNITS = ['g', 'kg', 'l', 'ml', 'pcs', 'pkt'];

const todayStr = () => new Date().toISOString().slice(0, 10);
const shiftStr = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

const fmtDay = (d) => {
  const x = new Date(d + 'T00:00:00');
  if (isNaN(x.getTime())) return d;
  return x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

// Time-of-day in IST (Railway stores UTC) — e.g. "1:05 PM".
const fmtTimeIST = (val) => {
  if (!val) return '';
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) d = new Date(val.replace(' ', 'T') + 'Z');
  else d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
};

// How many whole days ago is the picked date (0 = today, 1 = yesterday).
const daysAgoOf = (d) => {
  const sel = new Date(d + 'T00:00:00');
  if (isNaN(sel.getTime())) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((today - sel) / 86400000);
};

const num = (v) => {
  const n = Number(v);
  if (isNaN(n)) return 0;
  return Number.isInteger(n) ? n : n.toFixed(2).replace(/\.00$/, '');
};

// Stock band from remaining / total — drives the badge + bar colour.
const stockTone = (remaining, total) => {
  const t = Number(total) || 0, r = Number(remaining) || 0;
  const pct = t > 0 ? (r / t) * 100 : 0;
  if (r <= 0)      return { key: 'empty', badge: 'text-red-700 bg-red-50 ring-red-600/15',       bar: 'bg-red-500',     pct: 0 };
  if (pct <= 15)   return { key: 'low',   badge: 'text-red-700 bg-red-50 ring-red-600/15',       bar: 'bg-red-500',     pct };
  if (pct <= 40)   return { key: 'mid',   badge: 'text-amber-700 bg-amber-50 ring-amber-600/15', bar: 'bg-amber-500',   pct };
  return              { key: 'ok',    badge: 'text-emerald-700 bg-emerald-50 ring-emerald-600/15', bar: 'bg-emerald-500', pct };
};

// =====================================================================
//  Kitchen — daily provisions + usage. Edit permission manages it;
//  this tab isn't shown to read-only users at all.
//
//  Usage can only be logged for TODAY or YESTERDAY. Older dates are
//  view-only (history) — the "Use" button is hidden for them.
// =====================================================================
export default function Kitchen({ user, canEdit, canDelete }) {
  const [provisions, setProvisions] = useState([]);
  const [usage, setUsage]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [date, setDate]             = useState(todayStr());

  const [addOpen, setAddOpen]   = useState(false);
  const [logItem, setLogItem]   = useState(null); // provision being logged
  const [editItem, setEditItem] = useState(null); // provision being edited / restocked
  const [preview, setPreview]   = useState(null);  // enlarged image src
  const [provSearch, setProvSearch]   = useState(''); // search in Remaining Provisions
  const [usageSearch, setUsageSearch] = useState(''); // search in Usage

  // Only today & yesterday are loggable; everything older is history-only.
  const dAgo = useMemo(() => daysAgoOf(date), [date]);
  const canLogForDate = canEdit && dAgo >= 0 && dAgo <= 1;

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

  // Clear both searches when the day changes so results aren't confusing.
  useEffect(() => { setProvSearch(''); setUsageSearch(''); }, [date]);

  const filteredProvisions = useMemo(() => {
    const q = provSearch.trim().toLowerCase();
    if (!q) return provisions;
    return provisions.filter(p => (p.item_name || '').toLowerCase().includes(q));
  }, [provisions, provSearch]);

  const filteredUsage = useMemo(() => {
    const q = usageSearch.trim().toLowerCase();
    if (!q) return usage;
    return usage.filter(u =>
      (u.item_name || '').toLowerCase().includes(q) || (u.used_by_name || '').toLowerCase().includes(q));
  }, [usage, usageSearch]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.item_name}" from provisions? Its usage history will be removed too.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/kitchen/inventory/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      fetchAll();
    } catch (e) { alert(e.message); }
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
          {dAgo === 0 && <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-600/15 px-2 py-1 rounded uppercase tracking-wider">Today</span>}
          {dAgo === 1 && <span className="text-[10px] font-semibold text-primary bg-primary/10 ring-1 ring-primary/15 px-2 py-1 rounded uppercase tracking-wider">Yesterday</span>}
        </div>
        {canEdit && (
          <button onClick={() => setAddOpen(true)}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors">
            <Plus className="size-3.5" /> Add Provision
          </button>
        )}
      </div>

      {/* View-only notice for dates older than yesterday */}
      {canEdit && dAgo > 1 && (
        <div className="flex items-start gap-2 bg-amber-50/70 ring-1 ring-amber-200/70 rounded-md px-4 py-2.5 text-[11px] font-medium text-amber-800 leading-relaxed">
          <Lock className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
          <span>You're viewing <strong>{fmtDay(date)}</strong> in history. Usage can only be logged for today or yesterday, so the <strong>Use</strong> buttons are hidden here.</span>
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="size-8 text-primary animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Remaining provisions */}
          <section className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
              <Package className="size-4 text-primary shrink-0" />
              <h3 className="text-sm font-semibold text-zinc-800 shrink-0">Remaining Provisions</h3>
              <div className="relative ml-auto w-32 sm:w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
                <input value={provSearch} onChange={e => setProvSearch(e.target.value)} placeholder="Search..."
                  className="h-8 w-full bg-white border border-zinc-200 rounded-md pl-8 pr-6 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                {provSearch && (
                  <button onClick={() => setProvSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600"><X className="size-3" /></button>
                )}
              </div>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0">{filteredProvisions.length}</span>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[62vh] overflow-y-auto custom-scrollbar">
              {provisions.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <Package className="size-9 text-zinc-300 mb-2" />
                  <p className="text-zinc-500 text-sm font-medium">No provisions yet.</p>
                  {canEdit && <p className="text-zinc-400 text-xs mt-1">Click "Add Provision" to stock your kitchen.</p>}
                </div>
              ) : filteredProvisions.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <Search className="size-9 text-zinc-300 mb-2" />
                  <p className="text-zinc-400 text-sm font-medium">No provisions match "{provSearch}".</p>
                </div>
              ) : filteredProvisions.map(p => {
                const tone = stockTone(p.quantity_remaining, p.total_quantity);
                return (
                  <div key={p.id} className="p-3 flex items-center gap-3 hover:bg-zinc-50/60 transition-colors">
                    <button
                      onClick={() => p.image && setPreview(p.image)}
                      title={p.image ? 'View image' : undefined}
                      className={`size-12 rounded-md bg-zinc-100 ring-1 ring-black/5 overflow-hidden flex items-center justify-center shrink-0 ${p.image ? 'cursor-zoom-in hover:ring-primary/40 transition-all' : ''}`}>
                      {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Utensils className="size-4 text-zinc-400" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-900 truncate">{p.item_name}</p>
                        {tone.key === 'empty' && <span className="text-[9px] font-bold text-red-600 bg-red-50 ring-1 ring-red-600/15 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">Out</span>}
                        {tone.key === 'low' && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 ring-1 ring-red-600/15 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"><AlertTriangle className="size-2.5" /> Low</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[11px] font-semibold ring-1 px-1.5 py-0.5 rounded ${tone.badge}`}>
                          Left: {num(p.quantity_remaining)} {p.unit}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-medium">of {num(p.total_quantity)} {p.unit}</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden mt-1.5 max-w-[200px]">
                        <div className={`h-1.5 rounded-full ${tone.bar} transition-all`} style={{ width: `${Math.max(tone.pct, p.quantity_remaining > 0 ? 4 : 0)}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canLogForDate && (
                        <button onClick={() => setLogItem(p)} title="Log usage"
                          className="h-8 px-3 rounded-md text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 flex items-center gap-1 transition-colors">
                          Use <ChevronRight className="size-3.5" />
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => setEditItem(p)} title="Edit / restock"
                          className="size-8 rounded-md text-zinc-400 hover:text-primary hover:bg-primary/5 flex items-center justify-center transition-colors">
                          <Pencil className="size-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(p)} title="Delete"
                          className="size-8 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Usage for the day */}
          <section className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
              <ScanBarcode className="size-4 text-amber-500 shrink-0" />
              <h3 className="text-sm font-semibold text-zinc-800 shrink-0">Usage</h3>
              <span className="text-[11px] text-zinc-400 font-medium truncate hidden md:inline">· {fmtDay(date)}</span>
              <div className="relative ml-auto w-32 sm:w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
                <input value={usageSearch} onChange={e => setUsageSearch(e.target.value)} placeholder="Search..."
                  className="h-8 w-full bg-white border border-zinc-200 rounded-md pl-8 pr-6 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                {usageSearch && (
                  <button onClick={() => setUsageSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600"><X className="size-3" /></button>
                )}
              </div>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0">{filteredUsage.length}</span>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[62vh] overflow-y-auto custom-scrollbar">
              {usage.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <ScanBarcode className="size-9 text-zinc-300 mb-2" />
                  <p className="text-zinc-400 text-sm font-medium">Nothing logged on this day.</p>
                </div>
              ) : filteredUsage.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <Search className="size-9 text-zinc-300 mb-2" />
                  <p className="text-zinc-400 text-sm font-medium">No usage matches "{usageSearch}".</p>
                </div>
              ) : filteredUsage.map(u => (
                <div key={u.id} className="p-3 flex items-center gap-3">
                  <button
                    onClick={() => u.image && setPreview(u.image)}
                    title={u.image ? 'View image' : undefined}
                    className={`size-10 rounded-md bg-zinc-100 ring-1 ring-black/5 overflow-hidden flex items-center justify-center shrink-0 ${u.image ? 'cursor-zoom-in hover:ring-primary/40 transition-all' : ''}`}>
                    {u.image ? <img src={u.image} alt="" className="w-full h-full object-cover" /> : <Utensils className="size-4 text-amber-500" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{u.item_name}</p>
                    {(u.used_by_name || u.created_at) && (
                      <p className="text-[11px] text-zinc-400 font-medium mt-0.5 truncate">
                        {u.used_by_name ? `by ${u.used_by_name}` : ''}
                        {u.used_by_name && u.created_at ? ' · ' : ''}
                        {u.created_at ? fmtTimeIST(u.created_at) : ''}
                      </p>
                    )}
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
      {editItem && (
        <EditProvisionModal item={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); fetchAll(); }} />
      )}
      {logItem && (
        <LogUsageModal item={logItem} date={date} onClose={() => setLogItem(null)}
          onSaved={() => { setLogItem(null); fetchAll(); }} />
      )}

      {/* Image lightbox */}
      {preview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setPreview(null)}>
          <button onClick={() => setPreview(null)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"><X className="size-6" /></button>
          <img src={preview} alt="" onClick={e => e.stopPropagation()} className="max-w-full max-h-[90vh] rounded-lg object-contain shadow-2xl ring-1 ring-white/10" />
        </div>
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

// Edit details + RESTOCK (add newly-bought quantity to the existing stock).
function EditProvisionModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ item_name: item.item_name || '', unit: item.unit || 'g', image: item.image || null });
  const [addQty, setAddQty] = useState('');
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

  const addN = Number(addQty) || 0;
  const newRemaining = Number(item.quantity_remaining || 0) + (addN > 0 ? addN : 0);
  const newTotal = Number(item.total_quantity || 0) + (addN > 0 ? addN : 0);

  const save = async () => {
    if (!form.item_name.trim()) return alert('Item name is required.');
    if (addQty !== '' && (isNaN(Number(addQty)) || Number(addQty) < 0)) return alert('Added quantity must be a positive number.');
    setSaving(true);
    try {
      const body = { item_name: form.item_name.trim(), unit: form.unit, image: form.image };
      if (addN > 0) body.addQuantity = addN;
      const res = await fetch(`${API_BASE_URL}/admin/kitchen/inventory/${item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Save failed'); }
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <ModalShell title="Edit Provision" onClose={onClose}>
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
        <LabeledInput label="Item Name" required value={form.item_name} onChange={v => set('item_name', v)} />
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

        {/* Restock block */}
        <div className="rounded-md ring-1 ring-primary/15 bg-primary/5 p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-wider">
            <PackagePlus className="size-3.5" /> Bought more? Add stock
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <LabeledInput label={`Add quantity (${form.unit})`} type="number" value={addQty} onChange={setAddQty} placeholder="e.g. 10" />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Current left: <strong className="text-zinc-700">{num(item.quantity_remaining)} {item.unit}</strong> of {num(item.total_quantity)} {item.unit}.
            {addN > 0 && <> After adding: <strong className="text-emerald-700">{num(newRemaining)} {form.unit}</strong> of {num(newTotal)} {form.unit}.</>}
          </p>
        </div>
      </div>

      <ModalFooter saving={saving} onClose={onClose} onSave={save} label="Save Changes" />
    </ModalShell>
  );
}

function LogUsageModal({ item, date, onClose, onSaved }) {
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
          <p className="text-[11px] text-zinc-500 font-medium">Remaining: {num(item.quantity_remaining)} {item.unit}</p>
        </div>
      </div>
      <div className="space-y-4">
        <LabeledInput label={`Quantity used (${item.unit})`} required type="number" value={qty} onChange={setQty} placeholder="e.g. 5" />
        {/* Only today or yesterday are loggable. */}
        <LabeledInput label="Date" type="date" value={useDate} onChange={setUseDate} min={shiftStr(-1)} max={todayStr()} />
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
function LabeledInput({ label, value, onChange, type = 'text', required, placeholder, min, max }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} min={min} max={max}
        className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
    </div>
  );
}