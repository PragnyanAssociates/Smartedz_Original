import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Boxes, Search, Loader2, Plus, Edit, Trash2, X, Download, ChevronDown,
  Package, IndianRupee, Wrench, Layers, Image as ImageIcon, MapPin, CalendarDays,
  FileText, User, HelpCircle, ShieldCheck, Settings2, Check
} from 'lucide-react';
import AssetFormModal from './AssetFormModal';
import {
  ASSET_STATUSES, statusStyle, fmtIST, fmtDate, money, moneyShort,
  lineValue, useAuthedImage
} from './AssetsUtils';

// =====================================================================
//  Inventory & Assets — the institution's asset register.
//    • Every item is filed under a Head of Account (dropdown, seeded
//      with the 21 standard heads; custom heads can be added).
//    • Filters: search, head, status, room, purchase year.
//    • Summary strip: line items, total quantity, total value, and how
//      many need attention (Under Repair + Damaged).
//    • Excel export follows whatever filters are applied.
//  No academic-year scoping — an asset belongs to the school, not a year.
// =====================================================================
export default function InventoryAssets() {
  const { user } = useAuth();
  const { can, isAllAccess } = usePermissions();
  const canRead = can('InventoryAssets', 'read');
  const canEdit = can('InventoryAssets', 'edit');
  const canDelete = can('InventoryAssets', 'delete');
  const isAdmin = isAllAccess;
  const mayEdit = canEdit || isAdmin;
  const mayDelete = canDelete || isAdmin;

  const [rows, setRows] = useState([]);
  const [heads, setHeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filterOpts, setFilterOpts] = useState({ years: [], rooms: [] });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Filters
  const [query, setQuery] = useState('');
  const [filterHead, setFilterHead] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterYear, setFilterYear] = useState('all');

  // UI
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [headsOpen, setHeadsOpen] = useState(false);

  const instId = user?.institutionId;

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (filterHead) p.set('headId', filterHead);
    if (filterStatus) p.set('status', filterStatus);
    if (filterRoom) p.set('room', filterRoom);
    if (filterYear && filterYear !== 'all') p.set('year', filterYear);
    return p;
  }, [query, filterHead, filterStatus, filterRoom, filterYear]);

  const loadHeads = useCallback(async () => {
    if (!instId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/asset-heads/${instId}`);
      const d = await res.json();
      setHeads(Array.isArray(d) ? d : []);
    } catch (e) { console.error('Load heads error:', e); }
  }, [instId]);

  const loadFilters = useCallback(async () => {
    if (!instId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/assets/filters/${instId}`);
      const d = await res.json();
      setFilterOpts({ years: d?.years || [], rooms: d?.rooms || [] });
    } catch (e) { console.error('Load filters error:', e); }
  }, [instId]);

  const loadList = useCallback(async () => {
    if (!instId || (!canRead && !isAdmin)) return;
    setLoading(true);
    try {
      const params = buildParams();
      const [lRes, sRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/assets/list/${instId}?${params.toString()}`),
        fetch(`${API_BASE_URL}/admin/assets/summary/${instId}?${params.toString()}`)
      ]);
      const l = await lRes.json();
      const s = await sRes.json();
      setRows(Array.isArray(l) ? l : []);
      setSummary(s || null);
    } catch (e) { console.error('Load assets error:', e); }
    setLoading(false);
  }, [instId, canRead, isAdmin, buildParams]);

  useEffect(() => { loadHeads(); loadFilters(); }, [loadHeads, loadFilters]);

  // Debounce so typing in search doesn't hammer the API.
  useEffect(() => {
    const t = setTimeout(() => loadList(), 250);
    return () => clearTimeout(t);
  }, [loadList]);

  const refreshAll = () => { loadList(); loadFilters(); loadHeads(); };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.item_name}" from the asset register? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/assets/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDetail(null);
      refreshAll();
    } catch (e) { alert(e.message); }
  };

  // Export endpoint is behind the /api gate — fetch as a blob (the
  // interceptor attaches the token) rather than a plain download link.
  const handleDownload = useCallback(async () => {
    if (!instId) return;
    setDownloading(true);
    try {
      const params = buildParams();
      const res = await fetch(`${API_BASE_URL}/admin/assets/export/${instId}?${params.toString()}`);
      if (!res.ok) throw new Error('Could not generate the Excel file.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Assets_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message || 'Download failed.'); }
    setDownloading(false);
  }, [instId, buildParams]);

  const hasFilter = Boolean(query.trim() || filterHead || filterStatus || filterRoom || (filterYear && filterYear !== 'all'));
  const clearFilters = () => {
    setQuery(''); setFilterHead(''); setFilterStatus(''); setFilterRoom(''); setFilterYear('all');
  };

  // Fallback totals if the summary endpoint is unavailable.
  const localTotals = useMemo(() => {
    const qty = rows.reduce((s, r) => s + (parseInt(r.quantity, 10) || 0), 0);
    const val = rows.reduce((s, r) => s + lineValue(r), 0);
    const attention = rows.filter(r => r.status === 'Under Repair' || r.status === 'Damaged').length;
    return { items: rows.length, qty, val, attention };
  }, [rows]);

  const totals = summary || localTotals;

  if (!canRead && !isAdmin) {
    return (
      <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <Boxes className="size-10 text-zinc-300 mb-3" />
          <h2 className="text-lg font-semibold text-zinc-900 mb-1">Access Denied</h2>
          <p className="text-sm font-medium text-zinc-500">You do not have permission to view the asset register.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2 sm:mb-0">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <Boxes className="text-primary size-5" />
            Inventory &amp; Assets
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            The school&apos;s asset register &mdash; what you own, how many, where it is and what it cost.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <AssetsHelp canEdit={mayEdit} />
          {mayEdit && (
            <button onClick={() => setHeadsOpen(true)} title="Manage heads of account"
              className="h-9 px-3 bg-white ring-1 ring-zinc-200 shadow-sm hover:bg-zinc-50 text-zinc-700 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0">
              <Settings2 className="size-3.5" /> Heads
            </button>
          )}
          <button onClick={handleDownload} disabled={downloading}
            title="Download the current view as Excel"
            className="h-9 px-3 bg-white ring-1 ring-zinc-200 shadow-sm hover:bg-zinc-50 text-zinc-700 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0">
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {downloading ? 'Preparing...' : 'Excel'}
          </button>
          {mayEdit && (
            <button onClick={() => { setEditing(null); setFormOpen(true); }}
              className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
              <Plus className="size-3.5" /> Add Asset
            </button>
          )}
        </div>
      </header>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Layers}       label="Line Items"     value={totals.items ?? 0} />
        <StatCard icon={Package}      label="Total Quantity" value={totals.qty ?? 0} />
        <StatCard icon={IndianRupee}  label="Total Value"    value={moneyShort(totals.val || 0)} />
        <StatCard icon={Wrench}       label="Needs Attention" value={totals.attention ?? 0} tone="amber" />
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-lg shadow-sm ring-1 ring-black/5 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search item, serial no, vendor, invoice or room..."
              className="h-9 w-full bg-zinc-50/50 border border-transparent rounded-md pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors placeholder:text-zinc-400" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
            <Select value={filterHead} onChange={setFilterHead}
              options={[{ value: '', label: 'All Heads' }, ...heads.map(h => ({ value: String(h.id), label: h.name }))]} />
            <Select value={filterStatus} onChange={setFilterStatus}
              options={[{ value: '', label: 'All Status' }, ...ASSET_STATUSES.map(s => ({ value: s, label: s }))]} />
            <Select value={filterRoom} onChange={setFilterRoom}
              options={[{ value: '', label: 'All Rooms' }, ...filterOpts.rooms.map(r => ({ value: r, label: r }))]} />
            <Select value={filterYear} onChange={setFilterYear}
              options={[{ value: 'all', label: 'All Years' }, ...filterOpts.years.map(y => ({ value: String(y), label: String(y) }))]} />
          </div>
        </div>
        {hasFilter && (
          <div className="flex items-center justify-between border-t border-zinc-100 pt-2">
            <span className="text-[11px] font-medium text-zinc-500">
              Showing {rows.length} filtered {rows.length === 1 ? 'item' : 'items'}
            </span>
            <button onClick={clearFilters}
              className="text-[11px] font-semibold text-primary hover:underline">Clear filters</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <Boxes className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">
              {hasFilter ? 'No assets match your filters.' : 'No assets recorded yet.'}
            </p>
            {!hasFilter && mayEdit && (
              <p className="text-zinc-400 text-xs mt-1.5">Click &quot;Add Asset&quot; to start the register.</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1080px]">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-14 text-center">S.No</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Item</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Head of Account</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-center w-24">Qty</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-32">Room</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-32">Purchased</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right w-32">Value</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-32">Status</th>
                  {(mayEdit || mayDelete) && <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right w-28">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r, idx) => {
                  const ss = statusStyle(r.status);
                  return (
                    <tr key={r.id} onClick={() => setDetail(r)}
                      className="hover:bg-zinc-50/60 transition-colors group cursor-pointer">
                      <td className="px-5 py-3 text-center font-semibold text-primary tabular-nums">{idx + 1}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {r.has_photo ? <ImageIcon className="size-3.5 text-zinc-300 shrink-0" /> : null}
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-zinc-900 truncate">{r.item_name}</div>
                            {r.serial_no && <div className="text-[11px] text-zinc-400 truncate mt-0.5">SL: {r.serial_no}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-black/5">
                          {r.head_name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center font-semibold text-zinc-900 tabular-nums">
                        {r.quantity} <span className="text-[11px] font-medium text-zinc-400">{r.unit}</span>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-zinc-700 truncate">{r.room_no || '-'}</td>
                      <td className="px-5 py-3 text-sm font-medium text-zinc-500 whitespace-nowrap">{fmtDate(r.purchase_date) || '-'}</td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-zinc-900 tabular-nums whitespace-nowrap">
                        {r.unit_cost === null || r.unit_cost === undefined ? '-' : money(lineValue(r))}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold ring-1 ring-inset ${ss.bg} ${ss.text} ${ss.ring}`}>
                          {r.status}
                        </span>
                      </td>
                      {(mayEdit || mayDelete) && (
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {mayEdit && (
                              <button onClick={e => { e.stopPropagation(); setEditing(r); setFormOpen(true); }} title="Edit"
                                className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                                <Edit className="size-3.5" />
                              </button>
                            )}
                            {mayDelete && (
                              <button onClick={e => { e.stopPropagation(); handleDelete(r); }} title="Delete"
                                className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50/80 border-t border-zinc-200/60">
                  <td className="px-5 py-4 font-semibold text-sm text-zinc-700" colSpan={3}>Totals ({rows.length} items)</td>
                  <td className="px-5 py-4 text-center font-semibold text-primary text-sm tabular-nums">{totals.qty ?? 0}</td>
                  <td className="px-5 py-4" colSpan={2}></td>
                  <td className="px-5 py-4 text-right font-semibold text-primary text-sm tabular-nums whitespace-nowrap">{money(totals.val || 0)}</td>
                  <td className="px-5 py-4" colSpan={(mayEdit || mayDelete) ? 2 : 1}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <AssetFormModal
          asset={editing}
          heads={heads}
          institutionId={instId}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={refreshAll}
        />
      )}

      {detail && (
        <AssetDetailModal
          asset={detail}
          onClose={() => setDetail(null)}
          onEdit={mayEdit ? () => { setEditing(detail); setDetail(null); setFormOpen(true); } : null}
          onDelete={mayDelete ? () => handleDelete(detail) : null}
        />
      )}

      {headsOpen && (
        <HeadsModal
          heads={heads}
          institutionId={instId}
          onClose={() => setHeadsOpen(false)}
          onChanged={() => { loadHeads(); loadList(); }}
        />
      )}
    </div>
  );
}

// --- Summary card ----------------------------------------------------
function StatCard({ icon: Icon, label, value, tone }) {
  const iconCls = tone === 'amber'
    ? 'bg-amber-50 text-amber-600 ring-amber-600/20'
    : 'bg-primary/10 text-primary ring-primary/20';
  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-4 flex items-center gap-3">
      <div className={`size-10 rounded-md flex items-center justify-center ring-1 ring-inset shrink-0 ${iconCls}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-semibold text-zinc-900 tabular-nums truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// --- Compact filter select ------------------------------------------
function Select({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-9 w-full bg-zinc-50/50 border border-transparent rounded-md pl-3 pr-8 text-xs font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white cursor-pointer appearance-none transition-colors">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="size-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

// --- Detail modal ----------------------------------------------------
function AssetDetailModal({ asset, onClose, onEdit, onDelete }) {
  const { src: photo } = useAuthedImage(
    asset.has_photo ? `${API_BASE_URL}/admin/assets/photo/${asset.id}` : null
  );
  const ss = statusStyle(asset.status);
  // "Updated by" only counts when the row was genuinely edited later.
  const wasUpdated = asset.updated_at && asset.created_at &&
    (new Date(String(asset.updated_at).replace(' ', 'T') + 'Z').getTime() -
     new Date(String(asset.created_at).replace(' ', 'T') + 'Z').getTime()) > 1000;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-zinc-100 flex justify-between items-start bg-zinc-50/50 rounded-t-lg shrink-0 gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900 truncate">{asset.item_name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-black/5">
                {asset.head_name || 'Unassigned'}
              </span>
              <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold ring-1 ring-inset ${ss.bg} ${ss.text} ${ss.ring}`}>
                {asset.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md shrink-0">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5">
          {asset.has_photo && (
            <div className="rounded-lg overflow-hidden ring-1 ring-black/5 bg-zinc-50 flex items-center justify-center min-h-[160px]">
              {photo
                ? <img src={photo} alt={asset.item_name} className="w-full max-h-72 object-contain" />
                : <Loader2 className="size-6 animate-spin text-primary" />}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={Package}     label="Quantity"        value={`${asset.quantity} ${asset.unit || ''}`.trim()} />
            <InfoRow icon={IndianRupee} label="Cost per Unit"    value={money(asset.unit_cost)} />
            <InfoRow icon={IndianRupee} label="Total Value"      value={asset.unit_cost == null ? '-' : money(lineValue(asset))} />
            <InfoRow icon={MapPin}      label="Room / Location"  value={asset.room_no || '-'} />
            <InfoRow icon={CalendarDays} label="Date of Purchase" value={fmtDate(asset.purchase_date) || '-'} />
            <InfoRow icon={CalendarDays} label="Warranty Expires" value={fmtDate(asset.warranty_expiry) || '-'} />
            <InfoRow icon={User}        label="Vendor"           value={asset.vendor || '-'} />
            <InfoRow icon={FileText}    label="Bill / Invoice No" value={asset.invoice_no || '-'} />
            <InfoRow icon={FileText}    label="Serial / Model No" value={asset.serial_no || '-'} />
          </div>

          {asset.details && (
            <div className="bg-zinc-50/60 ring-1 ring-zinc-100 rounded-md p-3">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Details</p>
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{asset.details}</p>
            </div>
          )}

          <div className="pt-4 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={User} label="Added By"
              value={asset.created_by_name || '\u2014'} sub={fmtIST(asset.created_at)} />
            {wasUpdated && (
              <InfoRow icon={Edit} label="Last Updated By"
                value={asset.updated_by_name || '\u2014'} sub={fmtIST(asset.updated_at)} />
            )}
          </div>
        </div>

        {(onEdit || onDelete) && (
          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
            {onDelete && (
              <button onClick={onDelete}
                className="h-9 px-4 bg-white ring-1 ring-inset ring-red-200 text-red-600 hover:bg-red-50 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm">
                <Trash2 className="size-3.5" /> Delete
              </button>
            )}
            {onEdit && (
              <button onClick={onEdit}
                className="h-9 px-6 bg-primary hover:bg-primary/90 text-white rounded-md font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors">
                <Edit className="size-3.5" /> Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-start gap-3 bg-white p-3 rounded-md ring-1 ring-black/5 shadow-sm">
      <div className="size-8 rounded-md bg-zinc-50 flex items-center justify-center ring-1 ring-black/5 shrink-0">
        <Icon className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-zinc-900 mt-0.5 break-words">{value}</p>
        {sub && <p className="text-[11px] text-zinc-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// --- Heads of Account manager ----------------------------------------
function HeadsModal({ heads, institutionId, onClose, onChanged }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const addHead = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/asset-heads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId, name: name.trim() })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not add head');
      setName('');
      onChanged();
    } catch (err) { alert(err.message); }
    setBusy(false);
  };

  const removeHead = async (h) => {
    if (!window.confirm(`Remove the head "${h.name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/asset-heads/${h.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not remove head');
      onChanged();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900">Heads of Account</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={addHead} className="p-4 border-b border-zinc-100 flex gap-2 shrink-0">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Add a custom head..."
            className="h-9 flex-1 bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
          <button type="submit" disabled={busy || !name.trim()}
            className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors shrink-0">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Add
          </button>
        </form>
        <div className="p-4 overflow-y-auto custom-scrollbar space-y-2">
          {heads.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-6 font-medium">No heads yet.</p>
          ) : heads.map(h => (
            <div key={h.id} className="group flex items-center justify-between bg-white ring-1 ring-black/5 rounded-md px-3 py-2 shadow-sm">
              <span className="text-sm font-medium text-zinc-800 truncate">{h.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-semibold text-zinc-400 tabular-nums">{h.asset_count ?? 0} items</span>
                <button onClick={() => removeHead(h)} title="Remove"
                  className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-zinc-100 bg-blue-50/60 shrink-0">
          <p className="text-[11px] text-blue-800 leading-relaxed">
            A head that still has assets filed under it can&apos;t be removed &mdash; move or delete those items first.
          </p>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
//  AssetsHelp — "How to use" guide (same theme as the other modules).
// =====================================================================
const GUIDES = {
  manage: {
    title: 'Inventory & Assets',
    steps: [
      ['1 \u00b7 What this is', 'The school\u2019s asset register \u2014 every table, chair, laptop, lab item and so on, with its count, where it sits, what it cost and when it was bought.'],
      ['2 \u00b7 Add an asset', 'Add Asset records the item name, Head of Account (required), quantity and unit, room or location, purchase date, cost per unit, vendor, bill no, serial no and a photo. Total value is worked out as quantity \u00d7 cost.'],
      ['3 \u00b7 Heads of Account', 'Every item is filed under a head \u2014 Office, Classroom, Computer & IT, Laboratory and so on. The standard heads are ready to use; Heads lets you add your own or remove unused ones.'],
      ['4 \u00b7 Track condition', 'Set each item to In Use, In Store, Under Repair, Damaged or Disposed. The Needs Attention box counts everything under repair or damaged.'],
      ['5 \u00b7 Find & export', 'Search by item, serial, vendor, invoice or room, and narrow by head, status, room or purchase year. Excel downloads exactly what the filters are showing.'],
    ],
    note: 'Assets are not tied to an academic year \u2014 the register carries forward until you change it. Photos are capped at 3 MB. Adding, editing and deleting depend on your permissions.'
  },
  view: {
    title: 'Inventory & Assets',
    steps: [
      ['1 \u00b7 What this is', 'The school\u2019s asset register \u2014 what the institution owns, how many, where it is and what it cost.'],
      ['2 \u00b7 Read an entry', 'Click any row for the full record: photo, quantity, cost, room, purchase and warranty dates, vendor, invoice and serial numbers.'],
      ['3 \u00b7 Find & export', 'Search by item, serial, vendor, invoice or room, and narrow by head of account, status, room or purchase year. Excel downloads the current view.'],
    ],
    note: 'This is a read-only view \u2014 the register is maintained by admins and staff with the right permissions.'
  }
};

function AssetsHelp({ canEdit = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const content = canEdit ? GUIDES.manage : GUIDES.view;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start ${className}`}>
        <HelpCircle className="size-3.5" /> How to use
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
              <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {content.steps.map(([t, d], i) => (
                <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
                  <p className="text-xs font-semibold text-zinc-800">{t}</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
                </div>
              ))}
              <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
                <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">{content.note}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}