import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Receipt, Plus, Trash2, Save, Upload, X, Building2, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

export const HEAD_OF_ACCOUNT = [
  'Salaries', 'Utilities', 'Office Maintenance', 'Building Maintenance',
  'Transportation', 'Academic Maintenance', 'Events & Programs',
  'IT & Equipment', 'Hostel & Canteen', 'Miscellaneous'
];
const ACCOUNT_TYPES = ['UPI', 'Bank', 'Cheque', 'Cash', 'Others'];

const fmtAmt = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);

const numberToWords = (num) => {
  num = Math.floor(Number(num) || 0);
  if (num === 0) return 'Zero';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n) => {
    if (n === 0) return '';
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + units[n % 10] : '');
    if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  return convert(num).trim();
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
};

export default function VoucherForm({ user, canEdit = true, editingId = null, school = {}, onSaved, onCancel }) {
  const isEdit = !!editingId;
  const [loading, setLoading]   = useState(isEdit);
  const [saving, setSaving]     = useState(false);
  const [voucherNo, setVoucherNo] = useState(isEdit ? '' : 'Loading…');

  const [form, setForm] = useState({
    voucher_date: todayISO(),
    name_title: '', phone_no: '',
    head_of_account: '', sub_head: '',
    account_type: 'UPI',
  });
  const [rows, setRows] = useState([{ description: '', amount: '' }]);
  const [attachment, setAttachment] = useState('');       // new base64
  const [existingProof, setExistingProof] = useState(false); // edit: had one
  const [removeProof, setRemoveProof] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const total = useMemo(() => rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0), [rows]);
  const words = useMemo(() => `${numberToWords(total)} Rupees Only`, [total]);

  // load next number (create) or details (edit)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (isEdit) {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE_URL}/expenses/details/${editingId}`);
          const d = await res.json();
          if (!alive) return;
          setVoucherNo(d.voucher_no || '');
          setForm({
            voucher_date: d.voucher_date ? String(d.voucher_date).slice(0, 10) : todayISO(),
            name_title: d.name_title || '', phone_no: d.phone_no || '',
            head_of_account: d.head_of_account || '', sub_head: d.sub_head || '',
            account_type: d.account_type || 'UPI',
          });
          setRows((d.particulars || []).length ? d.particulars.map(p => ({ description: p.description, amount: String(p.amount) })) : [{ description: '', amount: '' }]);
          setExistingProof(!!d.attachment);
        } catch (e) {
          alert('Could not load the voucher.');
        }
        if (alive) setLoading(false);
      } else {
        try {
          const res = await fetch(`${API_BASE_URL}/expenses/next-number/${user.institutionId}`);
          const d = await res.json();
          if (alive) setVoucherNo(d.voucher_no || 'VCH-00001');
        } catch { if (alive) setVoucherNo('VCH-00001'); }
      }
    })();
    return () => { alive = false; };
  }, [isEdit, editingId, user]);

  const addRow = () => setRows(r => [...r, { description: '', amount: '' }]);
  const removeRow = (i) => setRows(r => r.length > 1 ? r.filter((_, idx) => idx !== i) : r);
  const updateRow = (i, k, v) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return alert('Image must be under 3 MB.');
    const reader = new FileReader();
    reader.onloadend = () => { setAttachment(reader.result); setExistingProof(false); setRemoveProof(false); };
    reader.readAsDataURL(f);
  };

  const save = async () => {
    if (!canEdit) return;
    if (!form.head_of_account) return alert('Please select a Head of A/C.');
    const valid = rows.filter(r => r.description.trim() !== '' && parseFloat(r.amount) > 0);
    if (total !== 0 && valid.length === 0) return alert('Add at least one valid particular (description + amount).');

    setSaving(true);
    try {
      const body = {
        institutionId: user.institutionId,
        voucher_date: form.voucher_date,
        name_title: form.name_title, phone_no: form.phone_no,
        head_of_account: form.head_of_account, sub_head: form.sub_head,
        account_type: form.account_type,
        total_amount: total.toFixed(2), amount_in_words: words,
        particulars: valid.map(v => ({ description: v.description, amount: Number(v.amount) || 0 })),
        userId: user?.id ?? null, userName: user?.name ?? null,
      };
      if (attachment) body.attachment = attachment;
      if (isEdit && removeProof && !attachment) body.removeAttachment = true;

      const url = isEdit ? `${API_BASE_URL}/expenses/voucher/${editingId}` : `${API_BASE_URL}/expenses/voucher`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { alert(j.error || 'Could not save the voucher.'); return; }
      if (onSaved) onSaved(j);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-96 flex items-center justify-center"><div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  const schoolName = school?.name || 'School';
  const proofShown = attachment || (existingProof && !removeProof);

  return (
    <div className="max-w-3xl mx-auto ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
      {/* School header */}
      <div className="bg-primary/5 border-b border-zinc-100 px-6 py-4 flex items-center gap-3">
        {school?.logo
          ? <img src={school.logo} alt="logo" className="h-10 w-auto object-contain" />
          : <div className="size-10 rounded bg-primary/10 text-primary flex items-center justify-center font-bold">{schoolName.charAt(0).toUpperCase()}</div>}
        <div className="min-w-0">
          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-tight truncate">{schoolName}</h2>
          <p className="text-[11px] text-zinc-500">{school?.branch ? `${school.branch} Branch · ` : ''}Debit Voucher</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* No + date */}
        <div className="flex items-center justify-between bg-zinc-50 rounded-md px-4 py-2.5 text-sm">
          <span className="font-semibold text-zinc-700 flex items-center gap-1.5"><Receipt className="size-4 text-primary" /> {voucherNo || '—'}</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">Date</span>
            <input type="date" value={form.voucher_date} disabled={!canEdit} onChange={e => set('voucher_date', e.target.value)}
              className="rounded border border-zinc-200 bg-white px-2 h-8 text-xs text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name / Title">
            <input value={form.name_title} disabled={!canEdit} onChange={e => set('name_title', e.target.value)} placeholder="Paid to / received by"
              className={inputCls} />
          </Field>
          <Field label="Phone No">
            <input value={form.phone_no} disabled={!canEdit} onChange={e => set('phone_no', e.target.value.replace(/[^\d+ ]/g, ''))} placeholder="Optional" inputMode="tel"
              className={inputCls} />
          </Field>
          <Field label="Head of A/C" required>
            <div className="relative">
              <select value={form.head_of_account} disabled={!canEdit} onChange={e => set('head_of_account', e.target.value)}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                <option value="">Select Head of A/C</option>
                {HEAD_OF_ACCOUNT.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <Chevron />
            </div>
          </Field>
          <Field label="Sub Head">
            <input value={form.sub_head} disabled={!canEdit} onChange={e => set('sub_head', e.target.value)} placeholder="Optional detail"
              className={inputCls} />
          </Field>
          <Field label="Transfer through">
            <div className="relative">
              <select value={form.account_type} disabled={!canEdit} onChange={e => set('account_type', e.target.value)}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                {ACCOUNT_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <Chevron />
            </div>
          </Field>
        </div>

        {/* Particulars */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-zinc-600">Particulars</p>
            {canEdit && (
              <button onClick={addRow} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                <Plus className="size-3.5" /> Add row
              </button>
            )}
          </div>
          <div className="ring-1 ring-zinc-200 rounded-md overflow-hidden">
            <div className="flex items-center bg-zinc-50 border-b border-zinc-200 px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              <span className="flex-1">Description</span>
              <span className="w-32 text-right">Amount</span>
              {canEdit && <span className="w-8" />}
            </div>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 last:border-0">
                <input value={row.description} disabled={!canEdit} onChange={e => updateRow(i, 'description', e.target.value)} placeholder="Description"
                  className="flex-1 h-9 px-2 text-sm outline-none bg-transparent" />
                <input value={row.amount} disabled={!canEdit} onChange={e => updateRow(i, 'amount', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal"
                  className="w-32 h-9 px-2 text-sm text-right tabular-nums outline-none bg-transparent" />
                {canEdit && (
                  <button onClick={() => removeRow(i)} disabled={rows.length === 1}
                    className="w-8 flex justify-center text-zinc-300 hover:text-accent disabled:opacity-30">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center bg-zinc-50 border-t border-zinc-200 px-3 py-2.5">
              <span className="flex-1 text-sm font-semibold text-zinc-700">Total</span>
              <span className="w-32 text-right text-sm font-bold text-primary tabular-nums pr-2">₹{fmtAmt(total)}</span>
              {canEdit && <span className="w-8" />}
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2"><span className="font-medium text-zinc-600">In words:</span> {words}</p>
        </div>

        {/* Proof */}
        <Field label="Payment Proof">
          <div className="flex items-center gap-3">
            {canEdit && (
              <label className="cursor-pointer inline-flex items-center gap-1.5 text-primary ring-1 ring-primary/30 px-3 py-2 rounded-md text-xs font-medium hover:bg-primary/5 transition-colors">
                <Upload className="size-3.5" /> {proofShown ? 'Change image' : 'Upload proof'}
                <input type="file" accept="image/*" onChange={onFile} className="hidden" />
              </label>
            )}
            {proofShown && (
              <button onClick={() => { setAttachment(''); setExistingProof(false); setRemoveProof(true); }}
                className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                <X className="size-3.5" /> Remove
              </button>
            )}
          </div>
          {attachment && <img src={attachment} alt="proof" className="mt-2 max-h-44 rounded-md ring-1 ring-black/5" />}
          {!attachment && existingProof && !removeProof && (
            <img src={`${API_BASE_URL}/expenses/attachment/${editingId}`} alt="" className="hidden" />
          )}
          {!attachment && existingProof && !removeProof && <ExistingProof id={editingId} />}
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          {onCancel && <button onClick={onCancel} className="px-4 py-2 rounded-md text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">Cancel</button>}
          <button onClick={save} disabled={saving || !canEdit}
            className="inline-flex items-center gap-1.5 bg-green-600 text-white px-5 py-2 rounded-md text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm disabled:opacity-60">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {saving ? 'Saving…' : (isEdit ? 'Update Voucher' : 'Save Voucher')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExistingProof({ id }) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/expenses/attachment/${id}`);
        const d = await res.json();
        if (alive) setImg(d.attachment || null);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [id]);
  if (!img) return null;
  return <img src={img} alt="proof" className="mt-2 max-h-44 rounded-md ring-1 ring-black/5" />;
}

const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400';

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium text-zinc-600 mb-1.5">{label}{required && <span className="text-accent"> *</span>}</label>
      {children}
    </div>
  );
}
function Chevron() {
  return (
    <svg className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export { fmtAmt, fmtDate };