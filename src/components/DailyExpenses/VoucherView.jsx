import React, { useState, useEffect } from 'react';
import { X, Pencil, Clock, UserCog } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { fmtAmt } from './VoucherForm';

// UTC -> IST, robust for bare MySQL datetimes.
export const parseDbDate = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v;
  let s = String(v);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = s.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export const fmtISTDateTime = (v) => {
  const d = parseDbDate(v);
  if (!d) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(d);
};

export const fmtVoucherDate = (v) => {
  if (!v) return '-';
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split('-');
  return d && m && y ? `${d}/${m}/${y}` : s;
};

// Fetches details by id and shows the modal. Pass either `voucher` (full object) or `id`.
export default function VoucherView({ voucher, id, onClose, onEdit }) {
  const [v, setV] = useState(voucher || null);
  const [loading, setLoading] = useState(!voucher);

  useEffect(() => {
    if (voucher) { setV(voucher); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/expenses/details/${id}`);
        const d = await res.json();
        if (alive) setV(d);
      } catch { /* ignore */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [voucher, id]);

  const parts = v?.particulars || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <div>
            <p className="text-sm font-semibold">{v?.voucher_no || 'Voucher'}</p>
            <p className="text-[10px] font-medium opacity-85">Debit Voucher - {fmtVoucherDate(v?.voucher_date)}</p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center size-8 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {loading || !v ? (
          <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <>
            <div className="p-5 space-y-3 text-sm">
              <Info label="Head of A/C" value={v.head_of_account} />
              {v.sub_head && <Info label="Sub Head" value={v.sub_head} />}
              {v.name_title && <Info label="Name / Title" value={v.name_title} />}
              {v.phone_no && <Info label="Phone" value={v.phone_no} />}
              <Info label="Transfer through" value={v.account_type || '-'} />

              <div className="border border-zinc-200 shadow-sm rounded-md overflow-hidden mt-2">
                <div className="flex bg-zinc-50 px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-200">
                  <span className="flex-1">Particulars</span><span className="w-28 text-right">Amount</span>
                </div>
                {parts.map((p, i) => (
                  <div key={i} className="flex px-3 py-2 border-b border-zinc-100 last:border-0 text-xs">
                    <span className="flex-1 font-medium text-zinc-700">{p.description}</span>
                    <span className="w-28 text-right font-medium tabular-nums text-zinc-900">INR {fmtAmt(p.amount)}</span>
                  </div>
                ))}
                <div className="flex bg-zinc-50 px-3 py-2.5 border-t border-zinc-200">
                  <span className="flex-1 text-sm font-semibold text-zinc-700">Total</span>
                  <span className="w-28 text-right text-sm font-semibold text-primary tabular-nums">INR {fmtAmt(v.total_amount)}</span>
                </div>
              </div>
              {v.amount_in_words && <p className="text-[11px] font-medium text-zinc-500"><span className="font-semibold text-zinc-600">In words:</span> {v.amount_in_words}</p>}

              {/* Audit */}
              <div className="rounded-md bg-zinc-50 border border-zinc-200 shadow-sm p-3 space-y-1.5 mt-2">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Clock className="size-3.5 text-primary shrink-0" />
                  <span>Created by <strong className="font-semibold text-zinc-700">{v.created_by_name || 'Unknown'}</strong> - {fmtISTDateTime(v.created_at)}</span>
                </div>
                {v.updated_at && (
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <UserCog className="size-3.5 text-amber-600 shrink-0" />
                    <span>Updated by <strong className="font-semibold text-zinc-700">{v.updated_by_name || 'Unknown'}</strong> - {fmtISTDateTime(v.updated_at)}</span>
                  </div>
                )}
              </div>

              {v.attachment && (
                <div>
                  <p className="text-xs font-semibold text-zinc-900 mb-1.5 mt-4">Payment Proof</p>
                  <img src={v.attachment} alt="proof" className="w-full rounded-md border border-zinc-200 shadow-sm mt-1.5" />
                </div>
              )}
            </div>
            {onEdit && (
              <div className="px-5 py-3 border-t border-zinc-100 flex justify-end">
                <button onClick={() => onEdit(v.id)} className="w-full sm:w-auto h-9 px-6 min-w-[120px] flex items-center justify-center gap-1.5 bg-primary text-white rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm">
                  <Pencil className="size-3.5" /> Edit
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-500 font-medium text-xs shrink-0">{label}</span>
      <span className="font-medium text-zinc-900 text-right">{value}</span>
    </div>
  );
}