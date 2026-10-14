import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  Warehouse, Plus, Trash2, Edit, Loader2, X, Save, Camera,
  Search, MapPin, Archive, Minus
} from 'lucide-react';

// =====================================================================
//  Store — permanent assets (furniture, equipment, etc). Edit permission
//  manages it; not shown to read-only users.
// =====================================================================
export default function Store({ user, canEdit, canDelete }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(null); // { item? } | null
  const [preview, setPreview] = useState(null);

  const fetchItems = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/store/${user.institutionId}`);
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } catch (e) { console.error('Store fetch error:', e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => (i.item_name || '').toLowerCase().includes(q) || (i.rack || '').toLowerCase().includes(q));
  }, [items, search]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.item_name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/store/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      fetchItems();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets or rack..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
        </div>
        {canEdit && (
          <button onClick={() => setModal({})}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors">
            <Plus className="size-3.5" /> Add Asset
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="size-8 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <Archive className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">{search ? 'No assets match your search.' : 'No assets in storage yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col group">
              <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden cursor-zoom-in"
                onClick={() => item.image && setPreview(item.image)}>
                {item.image
                  ? <img src={item.image} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Archive className="size-8 text-zinc-300" /></div>}
                <span className="absolute top-2 right-2 text-[11px] font-bold text-white bg-black/55 px-2 py-0.5 rounded">
                  {item.quantity}
                </span>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <p className="text-sm font-semibold text-zinc-900 truncate">{item.item_name}</p>
                <p className="text-[11px] text-zinc-500 font-medium mt-1 flex items-center gap-1 truncate">
                  <MapPin className="size-3 shrink-0 text-zinc-400" /> {item.rack || 'Unassigned'}
                </p>
                {(canEdit || canDelete) && (
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-zinc-100">
                    {canEdit && (
                      <button onClick={() => setModal({ item })}
                        className="flex-1 h-8 rounded-md text-xs font-semibold text-zinc-600 bg-zinc-50 hover:bg-zinc-100 ring-1 ring-zinc-200 flex items-center justify-center gap-1 transition-colors">
                        <Edit className="size-3.5" /> Edit
                      </button>
                    )}
                    {(canDelete || canEdit) && (
                      <button onClick={() => handleDelete(item)}
                        className="size-8 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 ring-1 ring-zinc-200 flex items-center justify-center transition-colors shrink-0">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white p-2"><X className="size-6" /></button>
          <img src={preview} alt="" onClick={e => e.stopPropagation()} className="max-w-full max-h-[90vh] rounded-lg object-contain shadow-2xl" />
        </div>
      )}

      {modal && (
        <AssetModal user={user} item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); fetchItems(); }} />
      )}
    </div>
  );
}

function AssetModal({ user, item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    item_name: item?.item_name || '',
    quantity: item?.quantity ?? 0,
    rack: item?.rack || '',
    image: item?.image || null
  });
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
    if (!form.item_name.trim()) return alert('Asset name is required.');
    setSaving(true);
    try {
      const url = isEdit ? `${API_BASE_URL}/admin/store/${item.id}` : `${API_BASE_URL}/admin/store`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity) || 0, institutionId: user.institutionId })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Save failed'); }
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[92vh]">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2"><Warehouse className="size-4 text-primary" /> {isEdit ? 'Edit Asset' : 'Add Asset'}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1.5 hover:bg-zinc-100 rounded-md transition-colors"><X className="size-4" /></button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col items-center mb-5">
            <div className="relative">
              <div className="size-24 rounded-lg bg-zinc-50 ring-1 ring-black/5 overflow-hidden flex items-center justify-center">
                {form.image ? <img src={form.image} alt="" className="w-full h-full object-cover" /> : <Archive className="size-8 text-zinc-300" />}
              </div>
              <label className="absolute -bottom-1 -right-1 bg-primary hover:bg-primary/90 text-white p-1.5 rounded-full cursor-pointer shadow-sm ring-2 ring-white transition-colors">
                <Camera className="size-3.5" />
                <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">Asset Name <span className="text-red-500">*</span></label>
              <input value={form.item_name} onChange={e => set('item_name', e.target.value)} placeholder="e.g. Wooden Chairs"
                className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Quantity</label>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => set('quantity', Math.max(0, Number(form.quantity) - 1))}
                    className="size-9 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-primary flex items-center justify-center shrink-0"><Minus className="size-4" /></button>
                  <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)}
                    className="h-9 w-full bg-white border border-zinc-200 rounded-md px-2 text-center text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                  <button type="button" onClick={() => set('quantity', Number(form.quantity) + 1)}
                    className="size-9 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-primary flex items-center justify-center shrink-0"><Plus className="size-4" /></button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Location / Rack</label>
                <input value={form.rack} onChange={e => set('rack', e.target.value)} placeholder="e.g. Room 101"
                  className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} disabled={saving} className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors min-w-[120px]">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} {saving ? 'Saving...' : (isEdit ? 'Update' : 'Add Asset')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}