import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import { X, Save, Loader2, Camera, Trash2, ChevronDown, IndianRupee } from 'lucide-react';
import {
  ASSET_STATUSES, ASSET_UNITS, fileToBase64, toYYYYMMDD, money, useAuthedImage
} from './AssetsUtils';

// =====================================================================
//  AssetFormModal — create / edit one asset.
//  Head of Account is a dropdown fed from /admin/asset-heads/:instId.
//  Photo is stored as base64 on the row; the existing photo is loaded
//  through the authed blob endpoint (never a raw <img src>).
// =====================================================================
export default function AssetFormModal({ asset, heads, institutionId, onClose, onSaved }) {
  const isEdit = !!asset;
  const [form, setForm] = useState({
    item_name: '', head_id: '', quantity: 1, unit: 'Nos', room_no: '',
    purchase_date: '', unit_cost: '', vendor: '', invoice_no: '', serial_no: '',
    status: 'In Use', warranty_expiry: '', details: ''
  });
  const [photo, setPhoto] = useState(null);        // new base64, if picked
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  // Existing photo (edit mode) via the authed blob endpoint.
  const { src: existingPhoto } = useAuthedImage(
    isEdit && asset.has_photo && !removePhoto ? `${API_BASE_URL}/admin/assets/photo/${asset.id}` : null
  );

  useEffect(() => {
    if (!asset) return;
    setForm({
      item_name: asset.item_name || '',
      head_id: asset.head_id ? String(asset.head_id) : '',
      quantity: asset.quantity ?? 1,
      unit: asset.unit || 'Nos',
      room_no: asset.room_no || '',
      purchase_date: toYYYYMMDD(asset.purchase_date),
      unit_cost: asset.unit_cost ?? '',
      vendor: asset.vendor || '',
      invoice_no: asset.invoice_no || '',
      serial_no: asset.serial_no || '',
      status: asset.status || 'In Use',
      warranty_expiry: toYYYYMMDD(asset.warranty_expiry),
      details: asset.details || ''
    });
    setPhoto(null);
    setRemovePhoto(false);
  }, [asset]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Live total so the person sees quantity x unit cost while typing.
  const total = useMemo(() => {
    const q = parseInt(form.quantity, 10) || 0;
    const c = Number(form.unit_cost);
    if (isNaN(c)) return 0;
    return q * c;
  }, [form.quantity, form.unit_cost]);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); e.target.value = ''; return; }
    try {
      const data = await fileToBase64(file, 3);
      setPhoto(data);
      setRemovePhoto(false);
    } catch (err) { alert(err.message); }
    e.target.value = '';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.item_name.trim()) return alert('Item name is required.');
    if (!form.head_id) return alert('Head of Account is required.');
    const qty = parseInt(form.quantity, 10);
    if (!qty || qty < 1) return alert('Quantity must be at least 1.');
    setSaving(true);
    try {
      const payload = {
        institutionId,
        item_name: form.item_name.trim(),
        head_id: parseInt(form.head_id, 10),
        quantity: qty,
        unit: form.unit || 'Nos',
        room_no: form.room_no.trim() || null,
        purchase_date: form.purchase_date || null,
        unit_cost: form.unit_cost === '' ? null : Number(form.unit_cost),
        vendor: form.vendor.trim() || null,
        invoice_no: form.invoice_no.trim() || null,
        serial_no: form.serial_no.trim() || null,
        status: form.status,
        warranty_expiry: form.warranty_expiry || null,
        details: form.details.trim() || null
      };
      // Only send the photo key when it actually changed, so an edit that
      // doesn't touch the picture leaves the stored one alone.
      if (photo) payload.photo = photo;
      else if (removePhoto) payload.photo = null;

      const url = isEdit ? `${API_BASE_URL}/admin/assets/${asset.id}` : `${API_BASE_URL}/admin/assets`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      onSaved();
      onClose();
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const preview = photo || (removePhoto ? null : existingPhoto);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-3xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900">{isEdit ? 'Edit Asset' : 'Add Asset'}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5">

            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="size-24 rounded-lg bg-zinc-50 ring-1 ring-black/5 overflow-hidden flex items-center justify-center shrink-0">
                {preview
                  ? <img src={preview} alt="Asset" className="w-full h-full object-cover" />
                  : <Camera className="size-7 text-zinc-300" />}
              </div>
              <div className="flex flex-col gap-2">
                <label className="h-8 px-3 inline-flex items-center gap-1.5 bg-white ring-1 ring-black/5 shadow-sm hover:bg-zinc-50 text-zinc-700 rounded-md font-semibold text-xs cursor-pointer transition-colors w-fit">
                  <Camera className="size-3.5" /> {preview ? 'Change photo' : 'Add photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
                </label>
                {preview && (
                  <button type="button" onClick={() => { setPhoto(null); setRemovePhoto(true); }}
                    className="h-8 px-3 inline-flex items-center gap-1.5 bg-white ring-1 ring-black/5 shadow-sm hover:bg-red-50 text-zinc-600 hover:text-red-600 rounded-md font-semibold text-xs transition-colors w-fit">
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                )}
                <span className="text-[10px] text-zinc-400">JPG or PNG, under 3 MB.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 pt-1 border-t border-zinc-100">
              <div className="md:col-span-2">
                <Field label="Item Name" required value={form.item_name}
                  onChange={v => set('item_name', v)} placeholder="e.g. Student Desk, Dell Latitude 3420" />
              </div>

              <Field label="Head of Account" required type="select" value={form.head_id}
                onChange={v => set('head_id', v)}
                options={[{ value: '', label: 'Select head...' },
                  ...heads.map(h => ({ value: String(h.id), label: h.name }))]} />

              <Field label="Status" type="select" value={form.status}
                onChange={v => set('status', v)}
                options={ASSET_STATUSES.map(s => ({ value: s, label: s }))} />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity" required type="number" value={form.quantity}
                  onChange={v => set('quantity', v.replace(/[^0-9]/g, ''))} />
                <Field label="Unit" type="select" value={form.unit}
                  onChange={v => set('unit', v)}
                  options={ASSET_UNITS.map(u => ({ value: u, label: u }))} />
              </div>

              <Field label="Room No / Location" value={form.room_no}
                onChange={v => set('room_no', v)} placeholder="e.g. Room 12, Lab 2, Library" />

              <Field label="Date of Purchase" type="date" value={form.purchase_date}
                onChange={v => set('purchase_date', v)} />

              <Field label="Cost per Unit" type="number" value={form.unit_cost}
                onChange={v => set('unit_cost', v)} placeholder="0.00" />

              {/* Live total */}
              <div className="md:col-span-2 -mt-1">
                <div className="bg-zinc-50 ring-1 ring-inset ring-black/5 rounded-md px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <IndianRupee className="size-3" /> Total Value
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                    {form.unit_cost === '' ? '-' : money(total)}
                  </span>
                </div>
              </div>

              <Field label="Vendor / Supplier" value={form.vendor}
                onChange={v => set('vendor', v)} placeholder="Who it was bought from" />

              <Field label="Bill / Invoice No" value={form.invoice_no}
                onChange={v => set('invoice_no', v)} />

              <Field label="Serial / Model No" value={form.serial_no}
                onChange={v => set('serial_no', v)} placeholder="For IT & lab equipment" />

              <Field label="Warranty Expires" type="date" value={form.warranty_expiry}
                onChange={v => set('warranty_expiry', v)} />

              <div className="md:col-span-2">
                <Field label="Details / Remarks" type="textarea" value={form.details}
                  onChange={v => set('details', v)} placeholder="Condition notes, accessories included, anything worth recording..." />
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
            <button type="button" onClick={onClose} disabled={saving}
              className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[140px]">
              {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
              {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Asset')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Shared input field standard (matches the rest of SmartEdz)
function Field({ label, value, onChange, type = 'text', required, placeholder, options }) {
  const base = "h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'select' ? (
        <div className="relative">
          <select value={value ?? ''} onChange={e => onChange(e.target.value)}
            className={`${base} appearance-none cursor-pointer pr-8`} required={required}>
            {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      ) : type === 'textarea' ? (
        <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} rows={3}
          placeholder={placeholder} className={`${base} h-auto py-2.5 resize-none`} required={required} />
      ) : (
        <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={base} required={required}
          {...(type === 'number' ? { min: 0, step: 'any' } : {})} />
      )}
    </div>
  );
}