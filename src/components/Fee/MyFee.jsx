import React, { useState, useEffect, useCallback } from 'react';
import { IndianRupee, CalendarDays, Wallet, Info, CheckCircle2, Clock, Upload, X, CreditCard, Tag, History, Receipt, Eye, Download, BellRing, Zap, Send } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { downloadDataUrl, downloadReceipt } from './paymentProof';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

// Dates stored UTC, shown in IST.
const fmtIST = (v, withTime = false) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {})
  }).format(d);
};

const daysUntil = (due) => {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((a - b) / 86400000);
};

const dueBadge = (due) => {
  const n = daysUntil(due);
  if (n === null) return null;
  if (n < 0)   return { text: `Overdue by ${-n} day${-n === 1 ? '' : 's'}`, cls: 'bg-red-50 text-red-700 ring-red-600/20' };
  if (n === 0) return { text: 'Due today', cls: 'bg-red-50 text-red-700 ring-red-600/20' };
  if (n <= 10) return { text: `Due in ${n} day${n === 1 ? '' : 's'} — pay soon`, cls: 'bg-red-50 text-red-600 ring-red-600/20' };
  if (n <= 15) return { text: `Please pay before ${fmtIST(due)}`, cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' };
  return { text: `Due ${fmtIST(due)}`, cls: 'bg-zinc-50 text-zinc-500 ring-zinc-200' };
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
  const [tab, setTab]         = useState('annual');
  const [proof, setProof]     = useState({ open: false, payment: null, loading: false, img: null });

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

  const student   = info?.student || null;
  const payCfg    = info?.pay || { online_enabled: false, offline_enabled: true };
  const payments  = info?.payments || [];
  const otherFees = info?.other_fees || [];

  const annualFee = info?.plan
    ? { plan: info.plan, installments: info.installments || [], assignment: info.assignment || null }
    : null;

  const titleFor = (planId) => {
    if (annualFee && String(annualFee.plan.id) === String(planId)) return annualFee.plan.title || 'Annual Fee';
    const o = otherFees.find(f => String(f.plan.id) === String(planId));
    return o ? o.plan.title : 'Fee';
  };

  const receiptFields = (p) => ({
    title: payCfg.account_name || 'Payment Receipt',
    receiptNo: p.provider_payment_id || `#${p.id}`,
    datetime: fmtIST(p.created_at, true),
    student: student?.name,
    fee: titleFor(p.plan_id),
    className: student?.className,
    method: p.method,
    ref: p.reference_no || p.provider_payment_id || '—',
    amount: inr(p.amount),
    status: p.status
  });

  const viewProof = async (p) => {
    if (p.method === 'offline' && Number(p.has_slip) === 1) {
      setProof({ open: true, payment: p, loading: true, img: null });
      try {
        const res = await fetch(`${API_BASE_URL}/fees/payment-slip/${p.id}`);
        const j = await res.json();
        setProof({ open: true, payment: p, loading: false, img: j?.slip_image || null });
      } catch {
        setProof({ open: true, payment: p, loading: false, img: null });
      }
    } else {
      setProof({ open: true, payment: p, loading: false, img: null }); // online / no slip -> receipt
    }
  };

  const closeProof = () => setProof({ open: false, payment: null, loading: false, img: null });

  const downloadProof = () => {
    const p = proof.payment;
    if (!p) return;
    if (proof.img) downloadDataUrl(proof.img, `slip-${p.id}.png`);
    else downloadReceipt(receiptFields(p), `receipt-${p.id}.png`);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-[900px] w-full mx-auto">
        <div className="h-96 flex items-center justify-center">
          <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'annual',  label: 'Annual Fee',      icon: IndianRupee },
    { id: 'other',   label: 'Other Fee',       icon: Tag },
    { id: 'history', label: 'Payment History', icon: History },
    { id: 'alerts',  label: 'Alerts',          icon: BellRing },
  ];

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

      <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'annual' && (
        annualFee
          ? <FeeCard fee={annualFee} category="annual" payments={payments} payCfg={payCfg} user={user} student={student} academicYearId={info?.academic_year_id} onChanged={load} allowModeChange />
          : <Empty text="Your fee structure hasn't been published yet." />
      )}

      {tab === 'other' && (
        otherFees.length > 0
          ? <div className="space-y-6">
              {otherFees.map(f => (
                <FeeCard key={f.plan.id} fee={f} category="other" payments={payments} payCfg={payCfg} user={user} student={student} academicYearId={info?.academic_year_id} onChanged={load} allowModeChange={false} />
              ))}
            </div>
          : <Empty text="No other fees for your class." />
      )}

      {tab === 'history' && <PaymentHistory payments={payments} titleFor={titleFor} onView={viewProof} />}

      {tab === 'alerts' && <StudentAlerts user={user} annualFee={annualFee} otherFees={otherFees} payments={payments} />}

      {/* Proof modal */}
      {proof.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={closeProof}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 max-w-lg w-full p-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-zinc-900">Payment Proof</h4>
              <button onClick={closeProof} className="text-zinc-400 hover:text-zinc-700"><X className="size-5" /></button>
            </div>
            {proof.loading ? (
              <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
            ) : proof.img ? (
              <img src={proof.img} alt="Payment slip" className="w-full rounded-md ring-1 ring-black/5" />
            ) : (
              <ReceiptView fields={receiptFields(proof.payment)} />
            )}
            <div className="flex justify-end mt-4">
              <button onClick={downloadProof} disabled={proof.loading}
                className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-60">
                <Download className="size-3.5" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white p-8 text-center">
      <Info className="size-6 text-zinc-300 mx-auto mb-3" />
      <p className="text-sm font-medium text-zinc-700">{text}</p>
      <p className="text-xs text-zinc-500 mt-1">Please check back later or contact the school office.</p>
    </div>
  );
}

// Styled receipt shown in the modal for online / slip-less payments.
function ReceiptView({ fields }) {
  const rows = [
    ['Receipt No', fields.receiptNo],
    ['Date & Time', fields.datetime],
    ['Student', fields.student],
    ['Fee', fields.fee],
    ['Class', fields.className],
    ['Method', fields.method],
    ['Reference', fields.ref],
  ].filter(r => r[1] && r[1] !== '—');
  return (
    <div className="rounded-md ring-1 ring-black/5 overflow-hidden">
      <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{fields.title}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider">{fields.status}</span>
      </div>
      <div className="p-4 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">{k}</span>
            <span className="font-medium text-zinc-900">{v}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-100">
          <span className="text-zinc-500 text-xs">Amount</span>
          <span className="text-primary font-bold text-lg tabular-nums">{fields.amount}</span>
        </div>
      </div>
    </div>
  );
}

// =================================================================
//  One fee (Annual or a single Other fee) — single connected card
// =================================================================
function FeeCard({ fee, category, payments, payCfg, user, student, academicYearId, onChanged, allowModeChange }) {
  const plan = fee.plan;
  const installments = fee.installments || [];
  const assignment = fee.assignment || null;

  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState({ open: false, label: '', installment_id: null, amount: '', reference_no: '', note: '', slip: '' });

  const isAnnual = category === 'annual';
  const fullFee = Number(plan.full_fee) || 0;
  const concession = isAnnual && assignment ? Number(assignment.concession_amount) || 0 : 0;
  const net = Math.max(0, fullFee - concession);
  const mode = assignment?.payment_mode || (isAnnual ? '' : 'full');
  const hasInstallments = installments.length > 0;

  const mine = payments.filter(p => String(p.plan_id) === String(plan.id));
  const paidTotal    = mine.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingTotal = mine.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance  = Math.max(0, net - paidTotal);
  const feePaid  = net > 0 && balance <= 0;

  const paidFor    = (id) => mine.filter(p => p.status === 'paid'    && String(p.installment_id) === String(id)).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingFor = (id) => mine.filter(p => p.status === 'pending' && String(p.installment_id) === String(id)).reduce((s, p) => s + Number(p.amount || 0), 0);

  const chooseMode = async (m) => {
    if (!allowModeChange || busy || m === mode) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId, academic_year_id: academicYearId ?? null,
          student_id: user.id, class_id: student?.class_id ?? user.class_id ?? null,
          plan_id: plan.id, payment_mode: m, userId: user?.id ?? null, userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not update payment option.'); }
      await onChanged();
    } finally { setBusy(false); }
  };

  const payOnline = async (label, amount, installment_id) => {
    if (amount <= 0) return;
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) { alert('Payment SDK failed to load. Check your connection.'); return; }
      const orderRes = await fetch(`${API_BASE_URL}/fees/pay/order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId, student_id: user.id,
          class_id: student?.class_id ?? null, plan_id: plan.id,
          installment_id: installment_id ?? null, amount
        })
      });
      const order = await orderRes.json();
      if (!orderRes.ok) { alert(order.error || 'Could not start payment.'); return; }
      const rzp = new window.Razorpay({
        key: order.key_id, order_id: order.order_id, amount: order.amount, currency: order.currency || 'INR',
        name: order.account_name || 'School Fee', description: `${plan.title || 'Fee'} · ${label}`,
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
          await onChanged();
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
          class_id: student?.class_id ?? null, plan_id: plan.id,
          installment_id: offline.installment_id ?? null, amount: Number(offline.amount),
          slip_image: offline.slip || null, reference_no: offline.reference_no || null, note: offline.note || null
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) alert(j.error || 'Could not submit payment.');
      else { setOffline(o => ({ ...o, open: false })); await onChanged(); }
    } finally { setBusy(false); }
  };

  const PaidPill = () => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 bg-green-50 text-green-700 ring-green-600/20">
      <CheckCircle2 className="size-3" /> Paid
    </span>
  );

  const PayButtons = ({ label, amount, installment_id, settled }) => {
    if (settled) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 ring-1 ring-green-600/20 px-3 py-1.5 rounded-md">
          <CheckCircle2 className="size-3.5" /> You already paid
        </span>
      );
    }
    return (
      <div className="flex items-center gap-2">
        {payCfg.online_enabled && (
          <button onClick={() => payOnline(label, amount, installment_id)} disabled={busy}
            className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            <CreditCard className="size-3.5" /> Pay Online
          </button>
        )}
        {payCfg.offline_enabled && (
          <button onClick={() => openOffline(label, amount, installment_id)} disabled={busy}
            className="inline-flex items-center gap-1.5 bg-white text-zinc-700 ring-1 ring-zinc-200 px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50">
            <Upload className="size-3.5" /> Upload Slip
          </button>
        )}
        {!payCfg.online_enabled && !payCfg.offline_enabled && <span className="text-[11px] text-zinc-400 italic">Pay at office</span>}
      </div>
    );
  };

  return (
    <div className={`ring-1 rounded-lg bg-white overflow-hidden ${feePaid ? 'ring-green-600/20' : 'ring-black/5'}`}>
      {/* Summary */}
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Receipt className="size-4 text-primary" /> {plan.title || (isAnnual ? 'Annual Fee' : 'Fee')}
          </h3>
          {feePaid ? <PaidPill /> : (plan.due_date && mode !== 'installment' && (() => {
            const b = dueBadge(plan.due_date);
            return b ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${b.cls}`}><Clock className="size-3" /> {b.text}</span> : null;
          })())}
        </div>
        <div className="space-y-2 text-sm">
          <Row label={isAnnual ? 'Full Fee (Annual)' : 'Fee Amount'} value={inr(fullFee)} />
          {concession > 0 && <Row label={`Concession${assignment?.concession_reason ? ` (${assignment.concession_reason})` : ''}`} value={`− ${inr(concession)}`} valueClass="text-accent" />}
          <Row label="Net Payable" value={inr(net)} />
          {paidTotal > 0 && <Row label="Paid" value={`− ${inr(paidTotal)}`} valueClass="text-green-700" />}
          {pendingTotal > 0 && <Row label="Under verification" value={inr(pendingTotal)} valueClass="text-amber-600" />}
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-zinc-100">
            <span className="text-zinc-900 font-semibold">Balance Due</span>
            <span className={`font-bold text-lg tabular-nums ${balance === 0 ? 'text-green-700' : 'text-primary'}`}>{inr(balance)}</span>
          </div>
        </div>
      </div>

      {/* Payment option (annual only) */}
      {allowModeChange && (
        <div className="border-t border-zinc-100 p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-1"><Wallet className="size-4 text-primary" /> Payment Option</h3>
          <p className="text-[11px] text-zinc-500 mb-4">Choose how you'd like to pay this fee.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => chooseMode('full')} disabled={busy || feePaid}
              className={`text-left rounded-lg border p-4 transition-colors disabled:opacity-60 ${mode === 'full' ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-zinc-200 hover:bg-zinc-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-900">Pay in Full</span>
                {mode === 'full' && <CheckCircle2 className="size-4 text-primary" />}
              </div>
              <p className="text-xs text-zinc-500 mt-1">One single payment of {inr(net)}.</p>
            </button>
            <button onClick={() => chooseMode('installment')} disabled={busy || feePaid || !hasInstallments}
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
      )}

      {/* Schedule / pay */}
      <div className="border-t border-zinc-100">
        {mode === 'installment' && hasInstallments ? (
          <>
            <div className="p-4 flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-zinc-900">Installment Schedule</h3>
            </div>
            {feePaid && <p className="px-5 py-2.5 text-[11px] text-green-800 bg-green-50/70 border-y border-green-100">This fee is fully paid — nothing more due.</p>}
            <div className="divide-y divide-zinc-100 border-t border-zinc-100">
              {installments.map((it, idx) => {
                const amt = Number(it.amount) || 0;
                const paid = paidFor(it.id);
                const pending = pendingFor(it.id);
                const remaining = Math.max(0, amt - paid);
                const settled = feePaid || remaining <= 0;
                const badge = settled ? null : dueBadge(it.due_date);
                return (
                  <div key={it.id ?? idx} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 ${settled ? 'opacity-60' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-zinc-900">{it.label || `Installment ${idx + 1}`}</p>
                        {settled && <PaidPill />}
                        {!settled && pending > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 bg-amber-50 text-amber-700 ring-amber-600/20"><Clock className="size-3" /> Under verification</span>}
                        {!settled && pending === 0 && badge && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${badge.cls}`}>{badge.text}</span>}
                      </div>
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5"><CalendarDays className="size-3" /> Due {fmtIST(it.due_date)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-zinc-900 tabular-nums">{inr(amt)}</span>
                      <PayButtons label={it.label || `Installment ${idx + 1}`} amount={remaining} installment_id={it.id} settled={settled} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : mode === 'full' ? (
          <div className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${feePaid ? 'opacity-80' : ''}`}>
            <div>
              <p className="text-sm font-medium text-zinc-900 flex items-center gap-2">Full Payment {feePaid && <PaidPill />}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{feePaid ? 'This fee is fully paid.' : 'Pay the remaining balance in one go.'}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold tabular-nums ${feePaid ? 'text-green-700' : 'text-primary'}`}>{inr(balance)}</span>
              <PayButtons label="Full payment" amount={balance} installment_id={null} settled={feePaid || balance <= 0} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 text-center py-5">
            {allowModeChange ? 'Select a payment option above to continue.' : 'Waiting for the school to set a payment option.'}
          </p>
        )}
      </div>

      {/* Offline modal */}
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
              <Field label={`${plan.title || 'Fee'} · ${offline.label} — Amount`}>
                <input type="number" min="0" value={offline.amount} onChange={e => setOffline(o => ({ ...o, amount: e.target.value }))}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40" />
              </Field>
              <Field label="Reference / UTR (optional)">
                <input value={offline.reference_no} onChange={e => setOffline(o => ({ ...o, reference_no: e.target.value }))} placeholder="Transaction reference"
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40" />
              </Field>
              <Field label="Slip / Screenshot">
                <label className="cursor-pointer inline-flex items-center gap-1.5 text-zinc-700 px-3 py-2 border border-zinc-200 rounded text-xs font-medium hover:bg-zinc-50 transition-colors w-fit">
                  <Upload className="size-3.5" /> {offline.slip ? 'Change image' : 'Choose image'}
                  <input type="file" accept="image/*" onChange={onSlipFile} className="hidden" />
                </label>
                {offline.slip && <img src={offline.slip} alt="slip preview" className="mt-2 max-h-40 rounded-md ring-1 ring-black/5" />}
                <p className="text-[10px] text-zinc-400 mt-1">JPG/PNG · max 3 MB</p>
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setOffline(o => ({ ...o, open: false }))} className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50">Cancel</button>
                <button onClick={submitOffline} disabled={busy} className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-60">
                  {busy ? 'Submitting…' : 'Submit for verification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, valueClass = 'text-zinc-900' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-medium tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium text-zinc-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// =================================================================
//  Payment History (student)
// =================================================================
function PaymentHistory({ payments, titleFor, onView }) {
  const statusStyle = (s) =>
    s === 'paid' ? 'bg-green-50 text-green-700 ring-green-600/20'
    : s === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
    : 'bg-red-50 text-red-700 ring-red-600/20';

  if (!payments.length) return <Empty text="No payments yet." />;

  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
      <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
        <History className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-zinc-900">Payment History <span className="text-zinc-400 font-normal">({payments.length})</span></h3>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead>
            <tr className="bg-zinc-50/50">
              {['Date & Time', 'Fee', 'Amount', 'Method', 'Status', 'Reference', 'Proof'].map(h => (
                <th key={h} className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {payments.map(p => (
              <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
                <td className="px-5 py-3 text-xs text-zinc-600 whitespace-nowrap">{fmtIST(p.created_at, true)}</td>
                <td className="px-5 py-3 text-sm font-medium text-zinc-900">{titleFor(p.plan_id)}</td>
                <td className="px-5 py-3 text-sm font-semibold text-zinc-900 tabular-nums">{inr(p.amount)}</td>
                <td className="px-5 py-3 text-xs text-zinc-600 capitalize">{p.method}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ring-1 capitalize ${statusStyle(p.status)}`}>
                    {p.status === 'pending' ? 'Under verification' : p.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-[11px] text-zinc-500">{p.reference_no || p.provider_payment_id || '—'}</td>
                <td className="px-5 py-3">
                  <button onClick={() => onView(p)} title="View proof"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-[11px] font-medium">
                    <Eye className="size-3.5" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =================================================================
//  Student Alerts — reminders from unpaid dues + messages from school
// =================================================================
function StudentAlerts({ user, annualFee, otherFees, payments }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/fees/alerts/my/${user.id}`);
        const json = await res.json();
        if (alive) setMessages(Array.isArray(json?.alerts) ? json.alerts : []);
      } catch (e) {
        if (alive) setMessages([]);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  // Build due-date reminders from the student's own unpaid fees.
  const reminders = useMemo(() => {
    const fees = [];
    if (annualFee) fees.push({ ...annualFee, isAnnual: true });
    (otherFees || []).forEach(f => fees.push({ ...f, isAnnual: false }));

    const out = [];
    fees.forEach(f => {
      const plan = f.plan;
      const installments = f.installments || [];
      const assignment = f.assignment || null;
      const fullFee = Number(plan.full_fee) || 0;
      const concession = f.isAnnual && assignment ? Number(assignment.concession_amount) || 0 : 0;
      const net = Math.max(0, fullFee - concession);
      const mine = (payments || []).filter(p => String(p.plan_id) === String(plan.id));
      const paidTotal = mine.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
      const feePaid = net > 0 && paidTotal >= net;
      if (feePaid || net <= 0) return;

      const mode = assignment?.payment_mode || (f.isAnnual ? '' : 'full');
      const paidFor = (id) => mine.filter(p => p.status === 'paid' && String(p.installment_id) === String(id)).reduce((s, p) => s + Number(p.amount || 0), 0);

      if (mode === 'installment' && installments.length) {
        installments.forEach(it => {
          const remaining = Math.max(0, (Number(it.amount) || 0) - paidFor(it.id));
          if (remaining > 0 && it.due_date) {
            out.push({ key: `${plan.id}-${it.id}`, title: `${plan.title || 'Fee'} · ${it.label || 'Installment'}`, amount: remaining, due: it.due_date, badge: dueBadge(it.due_date) });
          }
        });
      } else if (plan.due_date) {
        out.push({ key: `${plan.id}-full`, title: `${plan.title || 'Fee'}`, amount: net - paidTotal, due: plan.due_date, badge: dueBadge(plan.due_date) });
      }
    });
    // soonest first
    return out.sort((a, b) => new Date(a.due) - new Date(b.due));
  }, [annualFee, otherFees, payments]);

  return (
    <div className="space-y-6">
      {/* Due reminders */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-900">Payment Reminders</h3>
        </div>
        {reminders.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-zinc-500 italic">You're all caught up — no pending dues.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {reminders.map(r => (
              <div key={r.key} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{r.title}</p>
                  {r.badge && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 mt-1 ${r.badge.cls}`}><Clock className="size-3" /> {r.badge.text}</span>}
                </div>
                <span className="text-sm font-semibold text-zinc-900 tabular-nums shrink-0">{inr(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages from school */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
          <Send className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-900">Messages from School</h3>
        </div>
        {loading ? (
          <div className="h-24 flex items-center justify-center"><div className="size-6 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : messages.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-zinc-500 italic">No messages yet.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {messages.map(m => (
              <div key={m.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ${m.alert_type === 'auto' ? 'bg-primary/10 text-primary ring-primary/20' : 'bg-accent/10 text-accent ring-accent/20'}`}>
                    {m.alert_type === 'auto' ? <Zap className="size-3" /> : <Send className="size-3" />} {m.alert_type}
                  </span>
                  <span className="text-[11px] text-zinc-400">{fmtIST(m.created_at, true)}</span>
                </div>
                {m.message && <p className="text-sm text-zinc-700 mt-1.5">{m.message}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}