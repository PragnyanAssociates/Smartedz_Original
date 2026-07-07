import React, { useState, useEffect, useCallback } from 'react';
import { Landmark, Save, KeyRound, Info, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

const EMPTY = {
  account_name: '', owner_name: '', owner_phone: '', owner_email: '',
  upi_id: '', bank_name: '', bank_account_name: '', bank_account_no: '', bank_ifsc: '',
  gateway: 'razorpay', razorpay_key_id: '', razorpay_key_secret: '',
  online_enabled: false, offline_enabled: true, offline_instructions: ''
};

export default function Account({ user, canEdit = true }) {
  const [form, setForm]         = useState(EMPTY);
  const [secretSet, setSecret]  = useState(false);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/account/${user.institutionId}`);
      const a = await res.json();
      if (a) {
        setForm({
          account_name: a.account_name || '', owner_name: a.owner_name || '',
          owner_phone: a.owner_phone || '', owner_email: a.owner_email || '',
          upi_id: a.upi_id || '', bank_name: a.bank_name || '',
          bank_account_name: a.bank_account_name || '', bank_account_no: a.bank_account_no || '',
          bank_ifsc: a.bank_ifsc || '', gateway: a.gateway || 'razorpay',
          razorpay_key_id: a.razorpay_key_id || '', razorpay_key_secret: '',
          online_enabled: !!a.online_enabled, offline_enabled: !!a.offline_enabled,
          offline_instructions: a.offline_instructions || ''
        });
        setSecret(!!a.razorpay_secret_set);
      } else {
        setForm(EMPTY); setSecret(false);
      }
    } catch (e) {
      console.error('Account fetch error:', e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!canEdit) return;
    if (form.online_enabled && (!form.razorpay_key_id || (!secretSet && !form.razorpay_key_secret))) {
      return alert('To enable online payments, add both the Razorpay Key ID and Key Secret.');
    }
    setSaving(true);
    try {
      const body = { ...form, institutionId: user.institutionId, userId: user?.id ?? null, userName: user?.name ?? null };
      // Only send the secret if the admin typed a new one.
      if (!form.razorpay_key_secret) delete body.razorpay_key_secret;
      const res = await fetch(`${API_BASE_URL}/fees/account`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to save account.'); }
      else { await load(); alert('Account details saved.'); }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-blue-50/60 border border-blue-100 rounded-md p-4 flex gap-3 text-[11px] text-blue-800 leading-relaxed">
        <Info className="size-4 shrink-0 text-blue-500 mt-0.5" />
        <p>
          Configure how this school collects fees. <strong>Online</strong> uses your own Razorpay account (each school keeps
          its own keys). <strong>Offline</strong> lets students upload a payment slip that an admin verifies. Your Key Secret is
          stored securely on the server and is never shown again after saving.
        </p>
      </div>

      {/* Collector / owner */}
      <Card title="Collector Details" icon={Landmark}>
        <Grid>
          <Field label="Display Name (shown on payment)" value={form.account_name} disabled={!canEdit}
            onChange={v => set('account_name', v)} placeholder="e.g. Vivekananda Public School" />
          <Field label="Owner / Contact Name" value={form.owner_name} disabled={!canEdit} onChange={v => set('owner_name', v)} />
          <Field label="Contact Phone" value={form.owner_phone} disabled={!canEdit} inputMode="numeric"
            onChange={v => set('owner_phone', v.replace(/\D/g, '').slice(0, 10))} />
          <Field label="Contact Email" type="email" value={form.owner_email} disabled={!canEdit} onChange={v => set('owner_email', v)} />
        </Grid>
      </Card>

      {/* Bank / UPI */}
      <Card title="Bank & UPI" icon={Landmark}>
        <Grid>
          <Field label="UPI ID" value={form.upi_id} disabled={!canEdit} onChange={v => set('upi_id', v)} placeholder="name@bank" />
          <Field label="Bank Name" value={form.bank_name} disabled={!canEdit} onChange={v => set('bank_name', v)} />
          <Field label="Account Holder Name" value={form.bank_account_name} disabled={!canEdit} onChange={v => set('bank_account_name', v)} />
          <Field label="Account Number" value={form.bank_account_no} disabled={!canEdit}
            onChange={v => set('bank_account_no', v.replace(/\D/g, '').slice(0, 20))} />
          <Field label="IFSC" value={form.bank_ifsc} disabled={!canEdit}
            onChange={v => set('bank_ifsc', v.toUpperCase().slice(0, 11))} />
        </Grid>
      </Card>

      {/* Online gateway */}
      <Card title="Online Payments (Razorpay)" icon={KeyRound}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] text-zinc-500 max-w-md">Enter your Razorpay API keys from the Razorpay Dashboard → Settings → API Keys.</p>
          <Toggle checked={form.online_enabled} disabled={!canEdit} onChange={v => set('online_enabled', v)} label="Enabled" />
        </div>
        <Grid>
          <Field label="Razorpay Key ID" value={form.razorpay_key_id} disabled={!canEdit}
            onChange={v => set('razorpay_key_id', v.trim())} placeholder="rzp_live_xxxxxxxx" />
          <Field label="Razorpay Key Secret" value={form.razorpay_key_secret} disabled={!canEdit}
            onChange={v => set('razorpay_key_secret', v.trim())}
            placeholder={secretSet ? '•••••••• (leave blank to keep current)' : 'Enter key secret'}
            hint={secretSet ? 'A secret is already saved. Leave blank to keep it.' : null} />
        </Grid>
      </Card>

      {/* Offline */}
      <Card title="Offline Payments" icon={ShieldCheck}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] text-zinc-500 max-w-md">Students upload a payment slip; an admin verifies it in the Payments tab.</p>
          <Toggle checked={form.offline_enabled} disabled={!canEdit} onChange={v => set('offline_enabled', v)} label="Enabled" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-zinc-600 mb-1.5">Instructions for students (optional)</label>
          <textarea value={form.offline_instructions} disabled={!canEdit} rows={3}
            onChange={e => set('offline_instructions', e.target.value)}
            placeholder="e.g. Pay to UPI id school@bank and upload the screenshot here."
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none disabled:bg-zinc-50 disabled:text-zinc-400" />
        </div>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="bg-primary text-white px-6 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-60">
            <Save className="size-3.5" /> {saving ? 'Saving…' : 'Save Account'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---- small building blocks ----
function Card({ title, icon: Icon, children }) {
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-4">
        {Icon && <Icon className="size-4 text-primary" />} {title}
      </h3>
      {children}
    </div>
  );
}
function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}
function Field({ label, value, onChange, type = 'text', placeholder, hint, disabled, inputMode }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium text-zinc-600 mb-1.5">{label}</label>
      <input type={type} value={value || ''} disabled={disabled} inputMode={inputMode}
        onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-zinc-50 disabled:text-zinc-400" />
      {hint && <p className="text-[10px] text-zinc-400 mt-1">{hint}</p>}
    </div>
  );
}
function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className="inline-flex items-center gap-2 disabled:opacity-60">
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-zinc-300'}`}>
        <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <span className="text-xs font-medium text-zinc-600">{label}</span>
    </button>
  );
}