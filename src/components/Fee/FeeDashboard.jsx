import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { IndianRupee, TrendingUp, Wallet, AlertCircle, CheckCircle2, PieChart, BarChart3, CreditCard, Landmark, Users, RefreshCw, Tag, GraduationCap, ChevronDown, Download } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { FeeYearSelect } from './FeeYear';

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

export default function FeeDashboard({ user, school, years = [], yearId, setYearId, yearName }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [feeType, setFeeType] = useState('all');
  const [classId, setClassId] = useState('');
  const [allFees, setAllFees]       = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const printRef = useRef(null); 

  const load = useCallback(async () => {
    if (!user?.institutionId || !yearId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('year', yearId);
      if (feeType && feeType !== 'all') qs.set('fee', feeType);
      if (classId) qs.set('class_id', classId);
      const res = await fetch(`${API_BASE_URL}/fees/dashboard/${user.institutionId}?${qs.toString()}`);
      const json = await res.json();
      setData(json || null);
      if (json && feeType === 'all' && !classId) {
        setAllFees((json.byFee || []).map(f => f.title));
        setAllClasses((json.byClass || []).map(c => ({ id: c.class_id, name: c.className })));
      }
    } catch (e) {
      console.error('Dashboard fetch error:', e);
      setData(null);
    }
    setLoading(false);
  }, [user, feeType, classId, yearId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setFeeType('all'); setClassId(''); setAllFees([]); setAllClasses([]); }, [yearId]);

  const t = data?.totals || {};
  const st = data?.students || {};
  const method = data?.byMethod || { online: 0, offline: 0 };
  const className = allClasses.find(c => String(c.id) === String(classId))?.name;

  const downloadPdf = () => {
    const node = printRef.current;
    if (!node) return;
    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) { alert('Please allow pop-ups for this site to download the dashboard.'); return; }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML).join('\n');

    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const bits = [
      `Academic Year: ${esc(yearName || '-')}`,
      `Fee: ${esc(feeType === 'all' ? 'All fees' : feeType)}`,
      `Class: ${esc(className || 'All classes')}`,
      `Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', '')} IST`
    ];

    const name = school?.name || 'School';
    const title = `${name} - Fee Dashboard`;
    const header = `
      <div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #3284c7;padding-bottom:10px;margin-bottom:14px">
        ${school?.logo ? `<img src="${esc(school.logo)}" style="height:46px;width:auto" />` : ''}
        <div style="flex:1">
          <div style="font-size:17px;font-weight:600;color:#3284c7;line-height:1.2">${esc(name)}</div>
          <div style="font-size:12px;font-weight:600;color:#3f3f46;margin-top:2px">Fee Management - Dashboard</div>
        </div>
      </div>
      <div style="font-size:10px;color:#71717a;margin-bottom:14px">${bits.join(' - ')}</div>`;

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${styles}
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        html, body { background: #fff !important; margin: 0; padding: 0;
                     -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .sheet { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
        .sheet .ring-1 { break-inside: avoid; page-break-inside: avoid; }
      </style></head>
      <body><div class="sheet">${header}${node.outerHTML}</div></body></html>`);
    win.document.close();
    win.focus();

    const go = () => setTimeout(() => { win.print(); }, 350);
    if (win.document.readyState === 'complete') go();
    else win.onload = go;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50 p-3 rounded-md ring-1 ring-black/5">
        <div className="flex items-center gap-4 flex-wrap">
          <LabeledSelect icon={Tag} label="Fee" value={feeType} onChange={setFeeType}
            options={[{ v: 'all', l: 'All fees' }, ...[...allFees].sort((a, b) => (a === 'Academic Fee' ? -1 : b === 'Academic Fee' ? 1 : a.localeCompare(b))).map(f => ({ v: f, l: f }))]} />
          <LabeledSelect icon={GraduationCap} label="Class" value={classId} onChange={setClassId}
            options={[{ v: '', l: 'All classes' }, ...allClasses.map(c => ({ v: String(c.id), l: c.name }))]} />
          <FeeYearSelect years={years} value={yearId} onChange={setYearId} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} 
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 shrink-0 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 hover:text-primary transition-colors">
            <RefreshCw className="size-3.5" /> Refresh
          </button>
          <button onClick={downloadPdf} disabled={loading || !data} title="Download the dashboard as a PDF"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 shrink-0 bg-primary text-white rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50">
            <Download className="size-3.5" /> Download
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="h-40 flex items-center justify-center text-sm text-zinc-400">Couldn't load dashboard data.</div>
      ) : (
      <div ref={printRef} className="space-y-6">
      <p className="text-[11px] text-zinc-400">
        Showing <strong className="font-semibold text-zinc-600">{feeType === 'all' ? 'all fees' : feeType}</strong>
        {classId ? <> - <strong className="font-semibold text-zinc-600">{className}</strong></> : ' - all classes'} for
        <strong className="font-semibold text-zinc-600"> {yearName || 'the active academic year'}</strong>.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={IndianRupee} tone="zinc"   label="Expected"        value={inr(t.expected)}    sub="Total net payable" />
        <Kpi icon={TrendingUp}  tone="green"  label="Collected"       value={inr(t.collected)}   sub={`${t.transactions || 0} payments`} />
        <Kpi icon={Wallet}      tone="accent" label="Outstanding"     value={inr(t.outstanding)} sub="Still to be collected" />
        <Kpi icon={PieChart}    tone="primary" label="Collection Rate" value={`${t.rate || 0}%`}  sub="Collected of expected" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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

        <Card title="Monthly Collection" icon={BarChart3}>
          <MonthlyBars data={data.monthly || []} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Collection by Fee" icon={IndianRupee}>
          {data.byFee && data.byFee.length ? (
            <BarList items={data.byFee.map(f => ({ label: f.title, collected: f.collected, expected: f.expected }))} />
          ) : <Empty text="No fees configured yet." />}
        </Card>

        <Card title="Collection by Class" icon={Landmark}>
          {data.byClass && data.byClass.length ? (
            <BarList items={data.byClass.map(c => ({ label: c.className, collected: c.collected, expected: c.expected }))} />
          ) : <Empty text="No classes with fees yet." />}
        </Card>
      </div>
      </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    zinc:    'bg-zinc-50 text-zinc-700 ring-1 ring-inset ring-zinc-600/20',
    green:   'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    accent:  'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    primary: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
  };
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <span className={`size-9 rounded-lg flex items-center justify-center ${tones[tone] || tones.zinc}`}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="text-xl font-semibold text-zinc-900 tabular-nums leading-tight">{value}</p>
      <p className="text-xs text-zinc-600 mt-0.5">{label}</p>
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
        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fill="#18181b" style={{ fontSize: 22, fontWeight: 600 }}>{centerLabel}</text>
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
              <span className="font-semibold text-zinc-700 truncate pr-2">{it.label}</span>
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
  const map = {};
  (data || []).forEach(m => { map[m.ym] = m.amount; });
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ ym, amount: map[ym] || 0 });
  }
  const max = Math.max(...months.map(m => m.amount), 1);

  return (
    <div>
      <div className="relative h-44">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3].map(i => <div key={i} className="border-t border-dashed border-zinc-100" />)}
        </div>
        <div className="relative h-full flex items-end justify-between gap-2 sm:gap-4 px-1">
          {months.map((m, i) => {
            const h = m.amount > 0 ? Math.max(6, Math.min(90, (m.amount / max) * 90)) : 0;
            return (
              <div key={i} className="flex-1 h-full flex flex-col justify-end items-center">
                {m.amount > 0 && (
                  <span className="text-[9px] font-semibold text-zinc-500 tabular-nums mb-1 whitespace-nowrap">{compact(m.amount)}</span>
                )}
                <div className="w-6 sm:w-9 rounded-md bg-gradient-to-t from-primary to-primary/70 hover:from-primary hover:to-primary transition-colors"
                  style={{ height: `${h}%` }} title={`${monthLabel(m.ym)} - ${inr(m.amount)}`} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between gap-2 sm:gap-4 px-1 mt-2">
        {months.map((m, i) => (
          <span key={i} className="flex-1 text-center text-[10px] font-semibold text-zinc-400">{monthLabel(m.ym)}</span>
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
          className="h-9 appearance-none rounded border border-zinc-200 bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}