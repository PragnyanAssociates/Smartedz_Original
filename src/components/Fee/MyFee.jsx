import React, { useState, useEffect, useCallback } from 'react';
import { IndianRupee, CalendarDays, Wallet, Info, CheckCircle2 } from 'lucide-react';
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

export default function MyFee({ user }) {
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

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

  const fullFee    = plan ? Number(plan.full_fee) || 0 : 0;
  const concession = assignment ? Number(assignment.concession_amount) || 0 : 0;
  const net        = Math.max(0, fullFee - concession);
  const mode       = assignment?.payment_mode || '';
  const hasInstallments = installments.length > 0;

  const chooseMode = async (m) => {
    if (!plan || saving || m === mode) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          academic_year_id: info?.academic_year_id ?? null,
          student_id: user.id,
          class_id: student?.class_id ?? user.class_id ?? null,
          plan_id: plan.id ?? null,
          payment_mode: m,
          userId: user?.id ?? null,
          userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not update payment option.'); }
      await load();
    } finally {
      setSaving(false);
    }
  };

  // Online gateway is not wired yet — this is the hook point for it.
  const handlePay = (label, amount) => {
    alert(`Online payment isn't enabled yet.\n\n${label}: ${inr(amount)}\n\nPlease pay at the school office for now.`);
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

  return (
    <div className="p-8 max-w-[900px] w-full mx-auto animate-in fade-in duration-700 space-y-6">
      {/* Header */}
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
          {/* Fee summary */}
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-4">
              <IndianRupee className="size-4 text-primary" /> Fee Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Full Fee (Annual)</span>
                <span className="text-zinc-900 font-medium tabular-nums">{inr(fullFee)}</span>
              </div>
              {concession > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">
                    Concession{assignment?.concession_reason ? ` (${assignment.concession_reason})` : ''}
                  </span>
                  <span className="text-accent font-medium tabular-nums">− {inr(concession)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-zinc-100">
                <span className="text-zinc-900 font-semibold">Net Payable</span>
                <span className="text-primary font-bold text-lg tabular-nums">{inr(net)}</span>
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
              {/* Full */}
              <button onClick={() => chooseMode('full')} disabled={saving}
                className={`text-left rounded-lg border p-4 transition-colors disabled:opacity-60 ${
                  mode === 'full'
                    ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
                    : 'border-zinc-200 hover:bg-zinc-50'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900">Pay in Full</span>
                  {mode === 'full' && <CheckCircle2 className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-zinc-500 mt-1">One single payment of {inr(net)}.</p>
              </button>

              {/* Installments */}
              <button onClick={() => chooseMode('installment')} disabled={saving || !hasInstallments}
                title={!hasInstallments ? 'Installments are not available for your class.' : ''}
                className={`text-left rounded-lg border p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  mode === 'installment'
                    ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
                    : 'border-zinc-200 hover:bg-zinc-50'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900">Pay in Installments</span>
                  {mode === 'installment' && <CheckCircle2 className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {hasInstallments ? `Split across ${installments.length} term(s).` : 'Not available for your class.'}
                </p>
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
                {installments.map((it, idx) => (
                  <div key={it.id ?? idx} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{it.label || `Installment ${idx + 1}`}</p>
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                        <CalendarDays className="size-3" /> Due {fmtDate(it.due_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-zinc-900 tabular-nums">{inr(it.amount)}</span>
                      <button onClick={() => handlePay(it.label || `Installment ${idx + 1}`, it.amount)}
                        className="bg-primary text-white px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                        Pay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : mode === 'full' ? (
            <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">Full Payment</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Pay the entire year's fee in one go.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-primary tabular-nums">{inr(net)}</span>
                <button onClick={() => handlePay('Full payment', net)}
                  className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                  Pay Now
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 text-center py-2">Select a payment option above to continue.</p>
          )}

          <p className="text-[11px] text-zinc-400 text-center">
            Online payments are coming soon. For now, please pay at the school office.
          </p>
        </>
      )}
    </div>
  );
}