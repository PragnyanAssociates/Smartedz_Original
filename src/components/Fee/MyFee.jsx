import React, { useState, useEffect, useCallback } from 'react';
import { IndianRupee, CalendarDays, Wallet, Info, CheckCircle2, Clock, Upload, X, CreditCard } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

// Days from today to `due` (negative = overdue).
const daysUntil = (due) => {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((a - b) / 86400000);
};

// Colour-coded due badge: overdue & <=10d -> red, <=15d -> amber, else grey.
const dueBadge = (due) => {
  const n = daysUntil(due);
  if (n === null) return null;
  if (n < 0)   return { text: `Overdue by ${-n} day${-n === 1 ? '' : 's'}`, cls: 'bg-red-50 text-red-700 ring-red-600/20' };
  if (n === 0) return { text: 'Due today', cls: 'bg-red-50 text-red-700 ring-red-600/20' };
  if (n <= 10) return { text: `Due in ${n} day${n === 1 ? '' : 's'} — pay soon`, cls: 'bg-red-50 text-red-600 ring-red-600/20' };
  if (n <= 15) return { text: `Please pay before ${fmtDate(due)}`, cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' };
  return { text: `Due ${fmtDate(due)}`, cls: 'bg-zinc-50 text-zinc-500 ring-zinc-200' };
};

const loadRazorpay = () => new Promise(resolve => {
  if (window.Razorpay) return resolve(true);
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = () => resolve(true);
  s.onerror = () => resolve(false);
  document.body.appendChild(s);
});

export default function MyFee({ user }) {
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [offline, setOffline] = useState({ open: false, label: '', installment_id: null, amount: '', reference_no: '', note: '', slip: '' });

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/my/${user.id}`);
      const json = await res.json();
      setInfo(json || null);
    } catch (e) {
      console.error('My fee fetch error:', e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const student      = info?.student || null;
  const plan         = info?.plan || null;
  const installments = info?.installments || [];
  const assignment   = info?.assignment || null;
  const payments     = info?.payments || [];
  const payCfg       = info?.pay || { online_enabled: false, offline_enabled: true };

  const fullFee    = plan ? Number(plan.full_fee) || 0 : 0;
  const concession = assignment ? Number(assignment.concession_amount) || 0 : 0;
  const net        = Math.max(0, fullFee - concession);
  const mode       = assignment?.payment_mode || '';
  const hasInstallments = installments.length > 0;

  const paidTotal    = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingTotal = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance      = Math.max(0, net - paidTotal);

  const paidFor    = (id) => payments.filter(p => p.status === 'paid'    && String(p.installment_id) === String(id)).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingFor = (id) => payments.filter(p => p.status === 'pending' && String(p.installment_id) === String(id)).reduce((s, p) => s + Number(p.amount || 0), 0);

  const chooseMode = async (m) => {
    if (!plan || busy || m === mode) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId, academic_year_id: info?.academic_year_id ?? null,
          student_id: user.id, class_id: student?.class_id ?? user.class_id ?? null,
          plan_id: plan.id ?? null, payment_mode: m, userId: user?.id ?? null, userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not update payment option.'); }
      await load();
    } finally { setBusy(false); }
  };

  const payOnline = async (label, amount, installment_id) => {
    if (!plan || amount <= 0) return;
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) { alert('Payment SDK failed to load. Check your connection.'); return; }
      const orderRes = await fetch(`${API_BASE_URL}/fees/pay/order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId, student_id: user.id,
          class_id: student?.class_id ?? null, plan_id: plan.id ?? null,
          installment_id: installment_id ?? null, amount
        })
      });
      const order = await orderRes.json();
      if (!orderRes.ok) { alert(order.error || 'Could not start payment.'); return; }
      const rzp = new window.Razorpay({
        key: order.key_id, order_id: order.order_id, amount: order.amount, currency: order.currency || 'INR',
        name: order.account_name || 'School Fee', description: label,
        prefill: { name: student?.name || '' }, theme: { color: '#3284c7' },
        handler: async (resp) => {
          const vRes = await fetch(`${API_BASE_URL}/fees/pay/verify`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_row_id: order.payment_row_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature
            })
          });
          const v = await vRes.json().catch(() => ({}));
          alert(vRes.ok ? 'Payment successful!' : (v.error || 'Payment verification failed.'));
          await load();
        }
      });
      rzp.on('payment.failed', () => alert('Payment failed or was cancelled.'));
      rzp.open();
    } finally { setBusy(false); }
  };

  const openOffline = (label, amount, installment_id) =>
    setOffline({ open: true, label, installment_id: installment_id ?? null, amount: String(amount || ''), reference_no: '', note: '', slip: '' });

  const onSlipFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return alert('Image must be under 3 MB.');
    const r = new FileReader();
    r.onloadend = () => setOffline(o => ({ ...o, slip: r.result }));
    r.readAsDataURL(f);
  };

  const submitOffline = async () => {
    if (!offline.amount || Number(offline.amount) <= 0) return alert('Enter a valid amount.');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/pay/offline`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId, student_id: user.id,
          class_id: student?.class_id ?? null, plan_id: plan?.id ?? null,
          installment_id: offline.installment_id ?? null, amount: Number(offline.amount),
          slip_image: offline.slip || null, reference_no: offline.reference_no || null, note: offline.note || null
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) alert(j.error || 'Could not submit payment.');
      else { setOffline(o => ({ ...o, open: false })); await load(); }
    } finally { setBusy(false); }
  };

  const PayButtons = ({ label, amount, installment_id, disabled }) => (
    <div className="flex items-center gap-2">
      {payCfg.online_enabled && (
        <button onClick={() => payOnline(label, amount, installment_id)} disabled={busy || disabled}
          className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          <CreditCard className="size-3.5" /> Pay Online
        </button>
      )}
      {payCfg.offline_enabled && (
        <button onClick={() => openOffline(label, amount, installment_id)} disabled={busy || disabled}
          className="inline-flex items-center gap-1.5 bg-white text-zinc-700 ring-1 ring-zinc-200 px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50">
          <Upload className="size-3.5" /> Upload Slip
        </button>
      )}
      {!payCfg.online_enabled && !payCfg.offline_enabled && (
        <span className="text-[11px] text-zinc-400 italic">Pay at office</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="p-8 max-w-[900px] w-full mx-auto">
        <div className="h-96 flex items-center justify-center">
          <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[900px] w-full mx-auto animate-in fade-in duration-700 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">My Fee</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {student?.name}
          {student?.className && <span className="text-zinc-400"> · {student.className}</span>}
          {student?.roll_no && <span className="text-zinc-400"> · Roll {student.roll_no}</span>}
        </p>
      </header>

      {!plan ? (
        <div className="ring-1 ring-black/5 rounded-lg bg-white p-8 text-center">
          <Info className="size-6 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-700">Your fee structure hasn't been published yet.</p>
          <p className="text-xs text-zinc-500 mt-1">Please check back later or contact the school office.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <IndianRupee className="size-4 text-primary" /> Fee Summary
              </h3>
              {plan.due_date && mode !== 'installment' && (() => {
                const b = dueBadge(plan.due_date);
                return b ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${b.cls}`}><Clock className="size-3" /> {b.text}</span> : null;
              })()}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Full Fee (Annual)</span>
                <span className="text-zinc-900 font-medium tabular-nums">{inr(fullFee)}</span>
              </div>
              {concession > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Concession{assignment?.concession_reason ? ` (${assignment.concession_reason})` : ''}</span>
                  <span className="text-accent font-medium tabular-nums">− {inr(concession)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Net Payable</span>
                <span className="text-zinc-900 font-medium tabular-nums">{inr(net)}</span>
              </div>
              {paidTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Paid</span>
                  <span className="text-green-700 font-medium tabular-nums">− {inr(paidTotal)}</span>
                </div>
              )}
              {pendingTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Under verification</span>
                  <span className="text-amber-600 font-medium tabular-nums">{inr(pendingTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-zinc-100">
                <span className="text-zinc-900 font-semibold">Balance Due</span>
                <span className={`font-bold text-lg tabular-nums ${balance === 0 ? 'text-green-700' : 'text-primary'}`}>{inr(balance)}</span>
              </div>
            </div>
          </div>

          {/* Payment option */}
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-1">
              <Wallet className="size-4 text-primary" /> Payment Option
            </h3>
            <p className="text-[11px] text-zinc-500 mb-4">Choose how you'd like to pay this year's fee.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => chooseMode('full')} disabled={busy}
                className={`text-left rounded-lg border p-4 transition-colors disabled:opacity-60 ${mode === 'full' ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900">Pay in Full</span>
                  {mode === 'full' && <CheckCircle2 className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-zinc-500 mt-1">One single payment of {inr(net)}.</p>
              </button>
              <button onClick={() => chooseMode('installment')} disabled={busy || !hasInstallments}
                title={!hasInstallments ? 'Installments are not available for your class.' : ''}
                className={`text-left rounded-lg border p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'installment' ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900">Pay in Installments</span>
                  {mode === 'installment' && <CheckCircle2 className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-zinc-500 mt-1">{hasInstallments ? `Split across ${installments.length} term(s).` : 'Not available for your class.'}</p>
              </button>
            </div>
          </div>

          {/* Schedule + pay */}
          {mode === 'installment' && hasInstallments ? (
            <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
              <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-zinc-900">Installment Schedule</h3>
              </div>
              {concession > 0 && (
                <p className="px-5 py-2.5 text-[11px] text-blue-800 bg-blue-50/60 border-b border-blue-100">
                  A concession of {inr(concession)} applies to your total — net payable this year is {inr(net)}.
                </p>
              )}
              <div className="divide-y divide-zinc-100">
                {installments.map((it, idx) => {
                  const amt = Number(it.amount) || 0;
                  const paid = paidFor(it.id);
                  const pending = pendingFor(it.id);
                  const remaining = Math.max(0, amt - paid);
                  const settled = remaining <= 0;
                  const badge = settled ? null : dueBadge(it.due_date);
                  return (
                    <div key={it.id ?? idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-zinc-900">{it.label || `Installment ${idx + 1}`}</p>
                          {settled && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 bg-green-50 text-green-700 ring-green-600/20"><CheckCircle2 className="size-3" /> Paid</span>}
                          {!settled && pending > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 bg-amber-50 text-amber-700 ring-amber-600/20"><Clock className="size-3" /> Under verification</span>}
                          {!settled && pending === 0 && badge && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${badge.cls}`}>{badge.text}</span>}
                        </div>
                        <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5"><CalendarDays className="size-3" /> Due {fmtDate(it.due_date)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-zinc-900 tabular-nums">{inr(amt)}</span>
                        {!settled && <PayButtons label={it.label || `Installment ${idx + 1}`} amount={remaining} installment_id={it.id} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : mode === 'full' ? (
            <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">Full Payment</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Pay the remaining balance in one go.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-primary tabular-nums">{inr(balance)}</span>
                {balance > 0
                  ? <PayButtons label="Full payment" amount={balance} installment_id={null} />
                  : <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><CheckCircle2 className="size-4" /> Fully paid</span>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 text-center py-2">Select a payment option above to continue.</p>
          )}

          {/* History */}
          {payments.length > 0 && (
            <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
              <div className="p-4 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900">Payment History</h3>
              </div>
              <div className="divide-y divide-zinc-100">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 tabular-nums">{inr(p.amount)} <span className="text-zinc-400 font-normal capitalize">· {p.method}</span></p>
                      <p className="text-[11px] text-zinc-500">{fmtDate(p.created_at)}{p.reference_no ? ` · Ref ${p.reference_no}` : ''}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ring-1 capitalize ${
                      p.status === 'paid' ? 'bg-green-50 text-green-700 ring-green-600/20'
                      : p.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                      : 'bg-red-50 text-red-700 ring-red-600/20'
                    }`}>{p.status === 'pending' ? 'Under verification' : p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Offline upload modal */}
      {offline.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-zinc-900">Upload Payment Slip</h4>
              <button onClick={() => setOffline(o => ({ ...o, open: false }))} className="text-zinc-400 hover:text-zinc-700"><X className="size-5" /></button>
            </div>
            {payCfg.offline_instructions && (
              <p className="text-[11px] text-blue-800 bg-blue-50/60 border border-blue-100 rounded p-2.5 mb-4">{payCfg.offline_instructions}</p>
            )}
            <div className="space-y-3">
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-600 mb-1.5">{offline.label} — Amount</label>
                <input type="number" min="0" value={offline.amount} onChange={e => setOffline(o => ({ ...o, amount: e.target.value }))}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-600 mb-1.5">Reference / UTR (optional)</label>
                <input value={offline.reference_no} onChange={e => setOffline(o => ({ ...o, reference_no: e.target.value }))}
                  placeholder="Transaction reference"
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-600 mb-1.5">Slip / Screenshot</label>
                <label className="cursor-pointer inline-flex items-center gap-1.5 text-zinc-700 px-3 py-2 border border-zinc-200 rounded text-xs font-medium hover:bg-zinc-50 transition-colors w-fit">
                  <Upload className="size-3.5" /> {offline.slip ? 'Change image' : 'Choose image'}
                  <input type="file" accept="image/*" onChange={onSlipFile} className="hidden" />
                </label>
                {offline.slip && <img src={offline.slip} alt="slip preview" className="mt-2 max-h-40 rounded-md ring-1 ring-black/5" />}
                <p className="text-[10px] text-zinc-400 mt-1">JPG/PNG · max 3 MB</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setOffline(o => ({ ...o, open: false }))}
                  className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50">Cancel</button>
                <button onClick={submitOffline} disabled={busy}
                  className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-60">
                  {busy ? 'Submitting…' : 'Submit for verification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {plan && (
        <p className="text-[11px] text-zinc-400 text-center">
          {payCfg.online_enabled ? 'Online payments are secure via Razorpay. ' : ''}
          Offline slips are verified by the school before the balance updates.
        </p>
      )}
    </div>
  );
}