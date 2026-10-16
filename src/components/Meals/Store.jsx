import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  Warehouse, Plus, Trash2, Edit, Loader2, X, Save, Camera,
  Search, MapPin, Archive, Minus, Hash, Boxes, User, PencilLine,
  LayoutGrid, List as ListIcon, Eye
} from 'lucide-react';

const VIEW_KEY = 'store_view_mode';

// --- date / time helpers (Railway stores UTC → show IST) ---
const toDate = (val) => {
  if (!val) return null;
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) d = new Date(val.replace(' ', 'T') + 'Z');
  else d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};
const fmtDate = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '';
};
const fmtDateTime = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '';
};
const wasEdited = (created, updated) => {
  const c = toDate(created), u = toDate(updated);
  if (!c || !u) return false;
  return (u.getTime() - c.getTime()) > 1500;
};

// =====================================================================
//  Store — permanent assets. Grid / List views; click a card (grid) or the
//  eye (list) to see full details. Edit permission manages it.
// =====================================================================
export default function Store({ user, canEdit, canDelete }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(null);   // { item? } | null  (add / edit form)
  const [detail, setDetail]   = useState(null);   // item for the details modal
  const [preview, setPreview] = useState(null);   // enlarged image src

  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  const setViewMode = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch {} };

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

  const totalUnits = useMemo(() => items.reduce((s, i) => s + (Number(i.quantity) || 0), 0), [items]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.item_name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/store/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDetail(null);
      fetchItems();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-5">
      {/* top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets or rack..."
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
          </div>
          {!loading && items.length > 0 && (
            <span className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-white ring-1 ring-black/5 text-[11px] font-semibold text-zinc-500 shadow-sm whitespace-nowrap">
              <Boxes className="size-3.5 text-primary" /> {items.length} asset{items.length === 1 ? '' : 's'} · {totalUnits} units
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Grid / List toggle */}
          <div className="inline-flex items-center bg-zinc-100/80 p-1 rounded-md">
            <button type="button" onClick={() => setViewMode('grid')} title="Grid view"
              className={`inline-flex items-center gap-1 px-2.5 h-7 rounded text-[11px] font-semibold transition-colors ${
                view === 'grid' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              <LayoutGrid className="size-3.5" /> Grid
            </button>
            <button type="button" onClick={() => setViewMode('list')} title="List view"
              className={`inline-flex items-center gap-1 px-2.5 h-7 rounded text-[11px] font-semibold transition-colors ${
                view === 'list' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              <ListIcon className="size-3.5" /> List
            </button>
          </div>
          {canEdit && (
            <button onClick={() => setModal({})}
              className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
              <Plus className="size-3.5" /> Add Asset
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="size-8 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <Archive className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">{search ? 'No assets match your search.' : 'No assets in storage yet.'}</p>
          {!search && canEdit && (
            <button onClick={() => setModal({})}
              className="mt-3 h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors">
              <Plus className="size-3.5" /> Add your first asset
            </button>
          )}
        </div>
      ) : view === 'grid' ? (
        /* ---------------- GRID VIEW ---------------- */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {filtered.map((item, idx) => {
            const edited = wasEdited(item.created_at, item.updated_at);
            return (
              <div key={item.id} onClick={() => setDetail(item)}
                className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col group hover:ring-primary/40 hover:shadow-md transition-all cursor-pointer">
                <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden">
                  {item.image
                    ? <img src={item.image} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Archive className="size-8 text-zinc-300" /></div>}
                  <span className="absolute top-2 left-2 inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-white/90 text-zinc-700 text-[11px] font-bold ring-1 ring-black/10 shadow-sm tabular-nums backdrop-blur-sm">
                    {idx + 1}
                  </span>
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm uppercase tracking-wider">
                    <Boxes className="size-3" /> Qty {item.quantity}
                  </span>
                </div>

                <div className="p-3 flex-1 flex flex-col">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 ring-1 ring-primary/15 px-1.5 py-0.5 rounded shrink-0 mt-0.5 tabular-nums">
                      <Hash className="size-2.5" />{idx + 1}
                    </span>
                    <p className="text-sm font-semibold text-zinc-900 truncate flex-1">{item.item_name}</p>
                  </div>
                  <p className="text-[11px] text-zinc-500 font-medium mt-1 flex items-center gap-1 truncate">
                    <MapPin className="size-3 shrink-0 text-zinc-400" /> {item.rack || 'Unassigned'}
                  </p>

                  <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1">
                    <p className="text-[10px] text-zinc-400 flex items-center gap-1 truncate">
                      <User className="size-2.5 shrink-0" />
                      Added by <span className="font-semibold text-zinc-500">{item.created_by_name || '—'}</span>
                      <span className="text-zinc-300">·</span> {fmtDate(item.created_at)}
                    </p>
                    {edited && (
                      <p className="text-[10px] text-amber-600/90 flex items-center gap-1 truncate">
                        <PencilLine className="size-2.5 shrink-0" />
                        Edited <span className="text-amber-300">·</span> {fmtDate(item.updated_at)}
                      </p>
                    )}
                  </div>

                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-zinc-100" onClick={e => e.stopPropagation()}>
                      {canEdit && (
                        <button onClick={() => setModal({ item })}
                          className="flex-1 h-8 rounded-md text-xs font-semibold text-zinc-600 bg-zinc-50 hover:bg-zinc-100 ring-1 ring-zinc-200 flex items-center justify-center gap-1 transition-colors">
                          <Edit className="size-3.5" /> Edit
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(item)}
                          className="size-8 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 ring-1 ring-zinc-200 flex items-center justify-center transition-colors shrink-0">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ---------------- LIST VIEW ---------------- */
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-14 text-center">S.No</th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-16">Image</th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Item</th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-24 text-center">Qty</th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Room</th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Added By</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((item, idx) => (
                <tr key={item.id} className="hover:bg-zinc-50/60 transition-colors cursor-pointer" onClick={() => setDetail(item)}>
                  <td className="px-5 py-3 text-center text-sm font-semibold text-primary tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-3">
                    <div className="size-10 rounded-md bg-zinc-100 ring-1 ring-black/5 overflow-hidden flex items-center justify-center">
                      {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Archive className="size-4 text-zinc-300" />}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold text-sm text-zinc-900">{item.item_name}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-bold text-zinc-900 tabular-nums">{item.quantity}</span>
                    <span className="text-[10px] text-zinc-400 font-medium ml-1">Nos</span>
                  </td>
                  <td className="px-3 py-3 text-sm font-medium text-zinc-600">{item.rack || <span className="text-zinc-400">-</span>}</td>
                  <td className="px-3 py-3">
                    <div className="text-xs font-semibold text-zinc-700">{item.created_by_name || '—'}</div>
                    <div className="text-[10px] text-zinc-400 font-medium mt-0.5">{fmtDate(item.created_at)}</div>
                  </td>
                  <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetail(item)} title="View details"
                        className="size-8 rounded-md text-zinc-400 hover:text-primary hover:bg-primary/5 ring-1 ring-zinc-200 flex items-center justify-center transition-colors">
                        <Eye className="size-4" />
                      </button>
                      {canEdit && (
                        <button onClick={() => setModal({ item })} title="Edit"
                          className="size-8 rounded-md text-zinc-400 hover:text-primary hover:bg-zinc-50 ring-1 ring-zinc-200 flex items-center justify-center transition-colors">
                          <Edit className="size-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(item)} title="Delete"
                          className="size-8 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 ring-1 ring-zinc-200 flex items-center justify-center transition-colors">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details modal (opened from a grid card or the list eye button) */}
      {detail && (
        <DetailModal
          item={detail}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setDetail(null)}
          onEnlarge={(src) => setPreview(src)}
          onEdit={() => { const it = detail; setDetail(null); setModal({ item: it }); }}
          onDelete={() => handleDelete(detail)}
        />
      )}

      {/* Image lightbox */}
      {preview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreview(null)}>
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

// =====================================================================
//  Details modal — all info for one asset, clearly laid out.
// =====================================================================
function DetailModal({ item, canEdit, canDelete, onClose, onEnlarge, onEdit, onDelete }) {
  const edited = wasEdited(item.created_at, item.updated_at);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[92vh]" onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="p-5 border-b border-zinc-100 flex justify-between items-start gap-3 bg-zinc-50/50 rounded-t-lg shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900 truncate flex items-center gap-2">
              <Warehouse className="size-4 text-primary shrink-0" /> {item.item_name}
            </h2>
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-primary bg-primary/10 ring-1 ring-primary/15 px-2 py-0.5 rounded uppercase tracking-wider">
              <Boxes className="size-3" /> Qty {item.quantity}
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1.5 hover:bg-zinc-100 rounded-md transition-colors shrink-0"><X className="size-4" /></button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5">
          {/* image */}
          <div className={`w-full aspect-[16/9] rounded-lg bg-zinc-100 ring-1 ring-black/5 overflow-hidden flex items-center justify-center ${item.image ? 'cursor-zoom-in' : ''}`}
            onClick={() => item.image && onEnlarge(item.image)}>
            {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain" /> : <Archive className="size-10 text-zinc-300" />}
          </div>

          {/* key fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoTile icon={Boxes} label="Quantity" value={`${item.quantity} Nos`} />
            <InfoTile icon={MapPin} label="Room / Location" value={item.rack || '-'} />
          </div>

          {/* audit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <InfoTile icon={User} label="Added By" value={item.created_by_name || '—'} sub={fmtDateTime(item.created_at)} />
            <InfoTile icon={PencilLine} label="Last Updated By"
              value={edited ? (item.updated_by_name || '—') : (item.created_by_name || '—')}
              sub={edited ? fmtDateTime(item.updated_at) : 'Not edited yet'} tone={edited ? 'amber' : 'default'} />
          </div>
        </div>

        {/* footer */}
        {(canEdit || canDelete) && (
          <div className="p-4 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
            {canDelete && (
              <button onClick={onDelete} className="h-9 px-4 bg-white border border-zinc-200 text-red-600 rounded-md font-semibold text-xs hover:bg-red-50 transition-colors flex items-center gap-1.5">
                <Trash2 className="size-3.5" /> Delete
              </button>
            )}
            {canEdit && (
              <button onClick={onEdit} className="h-9 px-6 bg-primary hover:bg-primary/90 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors">
                <Edit className="size-3.5" /> Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, sub, tone = 'default' }) {
  const iconCls = tone === 'amber' ? 'bg-amber-50 text-amber-600 ring-amber-600/15' : 'bg-primary/5 text-primary ring-black/5';
  return (
    <div className="flex items-start gap-3 bg-white p-3 rounded-md ring-1 ring-black/5 shadow-sm">
      <div className={`size-9 rounded-md flex items-center justify-center ring-1 shrink-0 ${iconCls}`}><Icon className="size-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-zinc-900 mt-0.5 break-words">{value}</p>
        {sub && <p className="text-[11px] text-zinc-400 mt-0.5">{sub}</p>}
      </div>
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
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