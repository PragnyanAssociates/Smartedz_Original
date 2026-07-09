import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { IndianRupee, TrendingUp, Wallet, AlertCircle, CheckCircle2, PieChart, BarChart3, CreditCard, Landmark, Users, RefreshCw, Tag, GraduationCap, ChevronDown } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n) || 0);
const compact = (n) =>
  new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);
const monthLabel = (ym) => {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short' });
};

const PRIMARY = '#3284c7';
const ACCENT  = '#f29132';
const GREEN   = '#16a34a';
const TRACK   = '#eef2f7';

export default function FeeDashboard({ data: ctx = {}, user }) {
  const classes = ctx.classes || [];
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [feeType, setFeeType] = useState('all');
  const [classId, setClassId] = useState('');

  const feeTypes = useMemo(() => {
    const set = new Set();
    (ctx.plans || []).forEach(p => { if (p.title) set.add(p.title); });
    return [...set].sort((a, b) => (a === 'Academic Fee' ? -1 : b === 'Academic Fee' ? 1 : a.localeCompare(b)));
  }, [ctx.plans]);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (feeType && feeType !== 'all') qs.set('fee', feeType);
      if (classId) qs.set('class_id', classId);
      const res = await fetch(`${API_BASE_URL}/fees/dashboard/${user.institutionId}?${qs.toString()}`);
      const json = await res.json();
      setData(json || null);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
      setData(null);
    }
    setLoading(false);
  }, [user, feeType, classId]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals || {};
  const st = data?.students || {};
  const method = data?.byMethod || { online: 0, offline: 0 };

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50 p-3 rounded-md ring-1 ring-black/5">
        <div className="flex items-center gap-4 flex-wrap">
          <LabeledSelect icon={Tag} label="Fee" value={feeType} onChange={setFeeType}
            options={[{ v: 'all', l: 'All fees' }, ...feeTypes.map(f => ({ v: f, l: f }))]} />
          <LabeledSelect icon={GraduationCap} label="Class" value={classId} onChange={setClassId}
            options={[{ v: '', l: 'All classes' }, ...classes.map(c => ({ v: String(c.id), l: `${c.className}${c.section ? ` - ${c.section}` : ''}` }))]} />
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="h-40 flex items-center justify-center text-sm text-zinc-400">Couldn't load dashboard data.</div>
      ) : (
      <>
      <p className="text-[11px] text-zinc-400 -mt-2">
        Showing <strong className="text-zinc-600">{feeType === 'all' ? 'all fees' : feeType}</strong>
        {classId ? <> · <strong className="text-zinc-600">{classes.find(c => String(c.id) === String(classId))?.className}</strong></> : ' · all classes'} for the active academic year.
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={IndianRupee} tone="zinc"   label="Expected"        value={inr(t.expected)}    sub="Total net payable" />
        <Kpi icon={TrendingUp}  tone="green"  label="Collected"       value={inr(t.collected)}   sub={`${t.transactions || 0} payments`} />
        <Kpi icon={Wallet}      tone="accent" label="Outstanding"     value={inr(t.outstanding)} sub="Still to be collected" />
        <Kpi icon={PieChart}    tone="primary" label="Collection Rate" value={`${t.rate || 0}%`}  sub="Collected of expected" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Students paid vs unpaid */}
        <Card title="Students Paid vs Unpaid" icon={Users}>
          <div className="flex items-center gap-5">
            <Donut
              size={150} thickness={22}
              segments={[
                { label: 'Paid',   value: st.paid || 0,   color: GREEN },
                { label: 'Unpaid', value: st.unpaid || 0, color: ACCENT },
              ]}
              centerLabel={`${st.owe ? Math.round(((st.paid || 0) / st.owe) * 100) : 0}%`}
              centerSub="fully paid"
            />
            <div className="space-y-3 text-sm">
              <Legend color={GREEN}  label="Fully paid" value={st.paid || 0} />
              <Legend color={ACCENT} label="Unpaid"     value={st.unpaid || 0} />
              <Legend color={PRIMARY} label="Partial"   value={st.partial || 0} muted />
              <div className="pt-2 border-t border-zinc-100 text-[11px] text-zinc-400">{st.owe || 0} students with fees</div>
            </div>
          </div>
        </Card>

        {/* Online vs Offline */}
        <Card title="Collection by Method" icon={CreditCard}>
          {(method.online + method.offline) > 0 ? (
            <div className="flex items-center gap-5">
              <Donut
                size={150} thickness={22}
                segments={[
                  { label: 'Online',  value: method.online,  color: PRIMARY },
                  { label: 'Offline', value: method.offline, color: ACCENT },
                ]}
                centerLabel={compact(method.online + method.offline)}
                centerSub="collected"
              />
              <div className="space-y-3 text-sm">
                <Legend color={PRIMARY} label="Online"  value={inr(method.online)} />
                <Legend color={ACCENT}  label="Offline" value={inr(method.offline)} />
              </div>
            </div>
          ) : <Empty text="No payments collected yet." />}
        </Card>

        {/* Monthly trend */}
        <Card title="Monthly Collection" icon={BarChart3}>
          {data.monthly && data.monthly.length ? (
            <MonthlyBars data={data.monthly} />
          ) : <Empty text="No collection history yet." />}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By fee */}
        <Card title="Collection by Fee" icon={IndianRupee}>
          {data.byFee && data.byFee.length ? (
            <BarList items={data.byFee.map(f => ({ label: f.title, collected: f.collected, expected: f.expected }))} />
          ) : <Empty text="No fees configured yet." />}
        </Card>

        {/* By class */}
        <Card title="Collection by Class" icon={Landmark}>
          {data.byClass && data.byClass.length ? (
            <BarList items={data.byClass.map(c => ({ label: c.className, collected: c.collected, expected: c.expected }))} />
          ) : <Empty text="No classes with fees yet." />}
        </Card>
      </div>
      </>
      )}
    </div>
  );
}

// ---------- pieces ----------
function Kpi({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    zinc:    'bg-zinc-100 text-zinc-600',
    green:   'bg-green-50 text-green-600',
    accent:  'bg-accent/10 text-accent',
    primary: 'bg-primary/10 text-primary',
  };
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <span className={`size-9 rounded-lg flex items-center justify-center ${tones[tone] || tones.zinc}`}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="text-xl font-bold text-zinc-900 tabular-nums leading-tight">{value}</p>
      <p className="text-xs font-medium text-zinc-600 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ title, icon: Icon, children }) {
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
      <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
        {Icon && <Icon className="size-4 text-primary" />}
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Empty({ text }) {
  return <p className="text-xs text-zinc-400 italic text-center py-8">{text}</p>;
}

function Legend({ color, label, value, muted }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-3 rounded-sm shrink-0" style={{ backgroundColor: color, opacity: muted ? 0.5 : 1 }} />
      <span className="text-zinc-500 text-xs">{label}</span>
      <span className="ml-auto font-semibold text-zinc-900 text-xs tabular-nums">{value}</span>
    </div>
  );
}

function Donut({ segments, size = 150, thickness = 22, centerLabel, centerSub }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={thickness} />
        {total > 0 && segments.map((s, i) => {
          const len = ((s.value || 0) / total) * C;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </g>
      {centerLabel != null && (
        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fill="#18181b" style={{ fontSize: 22, fontWeight: 700 }}>{centerLabel}</text>
      )}
      {centerSub && (
        <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" fill="#a1a1aa" style={{ fontSize: 10 }}>{centerSub}</text>
      )}
    </svg>
  );
}

function BarList({ items }) {
  return (
    <div className="space-y-4">
      {items.map((it, i) => {
        const pct = it.expected > 0 ? Math.min(100, (it.collected / it.expected) * 100) : 0;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-zinc-700 truncate pr-2">{it.label}</span>
              <span className="text-zinc-500 tabular-nums shrink-0">{inr(it.collected)} <span className="text-zinc-300">/</span> {inr(it.expected)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? GREEN : PRIMARY }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthlyBars({ data }) {
  const max = Math.max(...data.map(m => m.amount), 1);
  return (
    <div>
      <div className="flex items-end gap-3 h-40">
        {data.map((m, i) => {
          const h = m.amount > 0 ? Math.max(4, (m.amount / max) * 100) : 0;
          return (
            <div key={i} className="flex-1 h-full flex flex-col justify-end">
              <div className="w-full rounded-t-md bg-primary/80 hover:bg-primary transition-colors"
                style={{ height: `${h}%` }} title={`${monthLabel(m.ym)}: ${inr(m.amount)}`} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-1.5">
        {data.map((m, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-zinc-400">{monthLabel(m.ym)}</span>
        ))}
      </div>
    </div>
  );
}

function LabeledSelect({ icon: Icon, label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
        {Icon && <Icon className="size-3.5" />} {label}
      </span>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="h-8 appearance-none rounded border border-zinc-200 bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}