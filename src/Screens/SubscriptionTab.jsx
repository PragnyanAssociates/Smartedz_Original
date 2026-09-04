import React from 'react';
import {
  CreditCard, CalendarRange, AlertTriangle, CheckCircle2, Clock,
  Infinity as InfinityIcon, Building2, Network, MessageCircle, ShieldCheck
} from 'lucide-react';

// =====================================================================
//  SubscriptionTab — read-only view of THIS institution's SmartEdz plan.
//
//  Everything shown here comes from data.institution, which the backend
//  already computes in /admin/data/:instId:
//    usage_plan, plan_start_date, planEndDate, daysLeft, expired
//  For a branch these are the GROUP's inherited plan, and parent_name is
//  the group it belongs to.
//
//  This screen never edits the plan — renewing/extending is done by
//  contacting SmartEdz. (The in-app developer chat, when it lands, will
//  slot into the "Renew" card below.)
// =====================================================================

const planLabel = (p) => (p === 'Full Time' ? 'Life Time' : (p || 'Life Time'));

const fmtDMY = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

// Map the institution's plan state to a status banner.
function statusOf(inst) {
  const lifetime = inst.usage_plan === 'Full Time' || inst.daysLeft === null || inst.daysLeft === undefined;
  if (lifetime) {
    return { key: 'lifetime', icon: InfinityIcon, headline: 'Life Time — never expires',
      wrap: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' };
  }
  if (inst.expired) {
    return { key: 'expired', icon: AlertTriangle, headline: 'Your plan has expired',
      wrap: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-500' };
  }
  if (inst.daysLeft <= 7) {
    return { key: 'critical', icon: AlertTriangle, headline: `Only ${inst.daysLeft} day${inst.daysLeft === 1 ? '' : 's'} left`,
      wrap: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-500' };
  }
  if (inst.daysLeft <= 30) {
    return { key: 'soon', icon: Clock, headline: `${inst.daysLeft} days left`,
      wrap: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' };
  }
  return { key: 'active', icon: CheckCircle2, headline: `${inst.daysLeft} days left`,
    wrap: 'bg-primary/5 text-primary ring-primary/20', dot: 'bg-primary' };
}

export default function SubscriptionTab({ data }) {
  const inst = data?.institution;

  if (!inst) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
        <CreditCard className="size-10 text-zinc-300 mb-3" />
        <p className="text-zinc-500 text-sm font-medium">Subscription details aren't available right now.</p>
      </div>
    );
  }

  const st = statusOf(inst);
  const StatusIcon = st.icon;
  const lifetime = st.key === 'lifetime';
  const isBranch = !!inst.parent_id;
  const parentName = inst.parent_name || null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Subscription</h3>
        <p className="text-[11px] text-zinc-500 max-w-2xl mt-1">
          Your SmartEdz plan and how long it runs. Renew before it expires to keep everyone signed in.
        </p>
      </div>

      {/* Status banner */}
      <div className={`rounded-lg ring-1 ring-inset ${st.wrap} p-5 flex items-center gap-4`}>
        <div className="size-11 rounded-md bg-white/60 ring-1 ring-inset ring-black/5 flex items-center justify-center shrink-0">
          <StatusIcon className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
            {planLabel(inst.usage_plan)} Plan{isBranch ? ' · inherited from group' : ''}
          </div>
          <div className="text-lg font-bold leading-tight">{st.headline}</div>
          {!lifetime && (
            <div className="text-[11px] font-medium opacity-80 mt-0.5 tabular-nums">
              {fmtDMY(inst.plan_start_date)} — {fmtDMY(inst.planEndDate)}
            </div>
          )}
          {lifetime && (
            <div className="text-[11px] font-medium opacity-80 mt-0.5">Active since {fmtDMY(inst.plan_start_date)}</div>
          )}
        </div>
      </div>

      {/* Detail grid */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <CreditCard className="size-4 text-primary shrink-0" />
          <h4 className="text-sm font-semibold text-zinc-900">Plan details</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-zinc-100">
          <DetailCell icon={<Building2 className="size-4 text-primary" />} label="Institution" value={inst.name} />
          <DetailCell icon={<CreditCard className="size-4 text-primary" />} label="Plan" value={planLabel(inst.usage_plan)} />
          <DetailCell icon={<CalendarRange className="size-4 text-primary" />} label="Start date" value={fmtDMY(inst.plan_start_date)} />
          <DetailCell
            icon={lifetime ? <InfinityIcon className="size-4 text-primary" /> : <Clock className="size-4 text-primary" />}
            label="Valid until"
            value={lifetime ? 'No expiry (Life Time)' : fmtDMY(inst.planEndDate)} />
          {!lifetime && (
            <DetailCell
              icon={<span className={`size-2.5 rounded-full ${st.dot}`} />}
              label="Days remaining"
              value={inst.expired ? 'Expired' : `${inst.daysLeft} day${inst.daysLeft === 1 ? '' : 's'}`} />
          )}
          {isBranch && (
            <DetailCell icon={<Network className="size-4 text-violet-500" />} label="Managed by group" value={parentName || '—'} />
          )}
        </div>
      </div>

      {/* Branch note */}
      {isBranch && (
        <div className="rounded-md bg-violet-50/60 ring-1 ring-inset ring-violet-500/15 px-4 py-3 flex items-start gap-2.5">
          <Network className="size-4 text-violet-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-violet-800 leading-relaxed">
            This is a branch of <strong>{parentName || 'your group'}</strong>. The subscription is held at the group level, so
            renewals are handled for the whole group together.
          </p>
        </div>
      )}

      {/* Renew */}
      <div className="rounded-lg ring-1 ring-black/5 bg-white shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="size-11 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <MessageCircle className="size-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">Need to renew or extend?</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">
            Reach out to your SmartEdz team to renew{lifetime ? '' : ' before the date above'}. You can connect SmartEdz team through directly or Support module.
          </p>
        </div>
      </div>

      <div className="rounded-md bg-blue-50/60 ring-1 ring-inset ring-blue-500/15 px-4 py-3 flex items-start gap-2.5">
        <ShieldCheck className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-800 leading-relaxed">
          This screen is read-only — plans are set by SmartEdz. If a date looks wrong, contact your representative and it will be
          corrected from the SmartEdz admin board.
        </p>
      </div>
    </div>
  );
}

function DetailCell({ icon, label, value }) {
  return (
    <div className="bg-white p-4 flex items-center gap-3">
      <div className="size-8 rounded-md bg-zinc-50 ring-1 ring-inset ring-black/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-zinc-900 truncate">{value}</p>
      </div>
    </div>
  );
}