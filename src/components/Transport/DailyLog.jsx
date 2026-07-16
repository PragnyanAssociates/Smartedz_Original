import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, Save, ChevronDown, Bus, Gauge, Fuel, Route as RouteIcon, Filter } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { RangePresets, DateField, DownloadXlsx, useAcademicYears, firstOfMonth, todayISO } from './TransportRange';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dkey = (v) => (v ? String(v).slice(0, 10) : null);
const num = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n) || 0);
const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const prettyDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); };

// Vehicle running is dated, not academic: a bus's fuel and mileage belong to
// the vehicle, not to a school term. The academic-year chips in RangePresets
// simply fill From/To, so a yearly total is one click without a second filter
// that could disagree with the dates.
export default function DailyLog({ user, canEdit, canDelete, lockedVehicleId = null }) {
  const today = new Date();
  const [vehicles, setVehicles] = useState([]);
  const [cursor, setCursor]     = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(ymd(today));
  const [monthLogs, setMonthLogs] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [busyId, setBusyId]     = useState(null);

  // range summary
  const [range, setRange]   = useState({ from: firstOfMonth(today), to: todayISO() });
  const [vehicleId, setVehicleId] = useState(lockedVehicleId ? String(lockedVehicleId) : '');
  const [summary, setSummary] = useState(null);
  const years = useAcademicYears(user?.institutionId);

  const year = cursor.getFullYear(), month = cursor.getMonth();

  useEffect(() => {
    if (!user?.institutionId) return;
    (async () => {
      try {
        const v = await fetch(`${API_BASE_URL}/transport/vehicles/${user.institutionId}`).then(x => x.json());
        const list = Array.isArray(v) ? v : [];
        setVehicles(lockedVehicleId ? list.filter(x => String(x.id) === String(lockedVehicleId)) : list);
      } catch { setVehicles([]); }
    })();
  }, [user, lockedVehicleId]);

  const loadMonth = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const from = `${year}-${pad(month + 1)}-01`;
      const to = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
      const vq = lockedVehicleId ? `&vehicle_id=${lockedVehicleId}` : '';
      const res = await fetch(`${API_BASE_URL}/transport/logs/${user.institutionId}?from=${from}&to=${to}${vq}`);
      const json = await res.json();
      setMonthLogs(Array.isArray(json) ? json : []);
    } catch { setMonthLogs([]); }
    setLoading(false);
  }, [user, year, month, lockedVehicleId]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const summaryQs = useMemo(() => {
    const qs = new URLSearchParams();
    if (range.from) qs.set('from', range.from);
    if (range.to) qs.set('to', range.to);
    if (vehicleId) qs.set('vehicle_id', vehicleId);
    return qs.toString();
  }, [range, vehicleId]);

  const loadSummary = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/transport/logs-summary/${user.institutionId}?${summaryQs}`);
      setSummary(await res.json());
    } catch { setSummary(null); }
  }, [user, summaryQs]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const byDate = useMemo(() => {
    const m = {};
    monthLogs.forEach(l => { const k = dkey(l.log_date); if (k) (m[k] = m[k] || []).push(l); });
    return m;
  }, [monthLogs]);

  const dayEntries = byDate[selected] || [];
  const dayTotals = dayEntries.reduce((a, l) => ({
    trips: a.trips + (Number(l.trips) || 0),
    distance: a.distance + (Number(l.distance_km) || 0),
    fuel: a.fuel + (Number(l.fuel_litres) || 0),
  }), { trips: 0, distance: 0, fuel: 0 });

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const refresh = async () => { await Promise.all([loadMonth(), loadSummary()]); };

  const del = async (id) => {
    if (!window.confirm('Delete this log entry?')) return;
    setBusyId(id);
    try { const res = await fetch(`${API_BASE_URL}/transport/log/${id}`, { method: 'DELETE' }); if (res.ok) await refresh(); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      {/* Range summary */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b border-zinc-100 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider self-center"><Filter className="size-3.5" /> Totals for period</span>
            <DateField label="From" value={range.from} onChange={v => setRange(r => ({ ...r, from: v }))} />
            <DateField label="To" value={range.to} onChange={v => setRange(r => ({ ...r, to: v }))} />
            {!lockedVehicleId && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Vehicle</span>
              <div className="relative">
                <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                  className="h-8 appearance-none rounded border border-zinc-200 bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
                  <option value="">All vehicles</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}{v.vehicle_code ? ` · ${v.vehicle_code}` : ''}</option>)}
                </select>
                <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            )}
            <div className="ml-auto self-end">
              <DownloadXlsx url={`${API_BASE_URL}/transport/logs-export/${user?.institutionId}?${summaryQs}`}
                disabled={!summary?.vehicles?.length} title="Download every log entry in this period as Excel" />
            </div>
          </div>
          <RangePresets years={years} value={range} onPick={(from, to) => setRange({ from, to })} />
        </div>

        {summary && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
              <Kpi icon={RouteIcon} label="Total Trips" value={num(summary.totals?.trips)} tone="primary" />
              <Kpi icon={Gauge} label="Total Distance" value={`${num(summary.totals?.distance)} km`} tone="green" />
              <Kpi icon={Fuel} label="Total Fuel" value={`${num(summary.totals?.fuel)} L`} tone="accent" />
              <Kpi icon={Bus} label="Avg Mileage" value={summary.totals?.mileage ? `${summary.totals.mileage} km/L` : '—'} sub={summary.totals?.cost ? inr(summary.totals.cost) + ' fuel cost' : ''} tone="zinc" />
            </div>
            <div className="overflow-x-auto custom-scrollbar border-t border-zinc-100">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-zinc-50/50">
                    {['Vehicle', 'Code', 'Days', 'Trips', 'Distance', 'Fuel', 'Mileage'].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {summary.vehicles?.length ? summary.vehicles.map(v => (
                    <tr key={v.vehicle_id} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-2.5 text-sm font-semibold text-zinc-900">{v.vehicle_no}<span className="text-zinc-400 font-normal">{v.vehicle_name ? ` · ${v.vehicle_name}` : ''}</span></td>
                      <td className="px-4 py-2.5 text-xs text-zinc-600">{v.vehicle_code || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-600 tabular-nums">{v.days}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-900 tabular-nums font-medium">{num(v.trips)}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-900 tabular-nums font-medium">{num(v.distance)} km</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-900 tabular-nums font-medium">{num(v.fuel)} L</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-600 tabular-nums">{v.mileage ? `${v.mileage} km/L` : '—'}</td>
                    </tr>
                  )) : <tr><td colSpan="7" className="px-4 py-8 text-center text-xs text-zinc-500 italic">No entries in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Calendar left · entries right */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-1.5 text-zinc-500 hover:text-primary hover:bg-zinc-50 rounded-md"><ChevronLeft className="size-4" /></button>
            <h3 className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5"><CalendarDays className="size-3.5 text-primary" /> {MONTHS[month]} {year}</h3>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-1.5 text-zinc-500 hover:text-primary hover:bg-zinc-50 rounded-md"><ChevronRight className="size-4" /></button>
          </div>
          <div className="p-2.5">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WD.map(w => <div key={w} className="text-center text-[9px] font-semibold text-zinc-400 uppercase py-1">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (d === null) return <div key={`e${i}`} />;
                const k = `${year}-${pad(month + 1)}-${pad(d)}`;
                const has = !!byDate[k];
                const isSel = selected === k;
                const isToday = ymd(today) === k;
                return (
                  <button key={k} onClick={() => setSelected(k)}
                    className={`relative aspect-square rounded-md text-xs flex items-center justify-center transition-colors
                      ${isSel ? 'bg-primary text-white font-semibold' : has ? 'bg-green-100 text-green-800 font-medium hover:bg-green-200' : 'text-zinc-700 hover:bg-zinc-50'}
                      ${isToday && !isSel ? 'ring-1 ring-primary/40' : ''}`}>
                    {d}
                    {has && !isSel && <span className="absolute bottom-0.5 size-1 rounded-full bg-green-500" />}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5 mt-3 px-1">
              <Legend cls="bg-green-100 ring-green-600/20" label="Log recorded" />
              <Legend cls="bg-white ring-zinc-200" label="No entry" />
              {loading && <span className="text-[10px] text-zinc-400">Loading…</span>}
            </div>
          </div>
        </div>

        <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">{prettyDate(selected)} <span className="text-zinc-400 font-normal">({dayEntries.length})</span></h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">{num(dayTotals.trips)} trips · {num(dayTotals.distance)} km · {num(dayTotals.fuel)} L</p>
            </div>
            {canEdit && (
              <button onClick={() => setModal({ vehicle_id: lockedVehicleId || vehicles[0]?.id || '', log_date: selected, trips: '', distance_km: '', fuel_litres: '', fuel_cost: '', driver_name: '', notes: '' })}
                className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 h-8 rounded-md text-xs font-semibold hover:bg-primary/90 shadow-sm">
                <Plus className="size-3.5" /> Add Log
              </button>
            )}
          </div>

          {dayEntries.length ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[680px]">
                <thead>
                  <tr className="bg-zinc-50/50">
                    {['Vehicle', 'Code', 'Trips', 'Distance', 'Fuel', 'Driver', ''].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {dayEntries.map(l => (
                    <tr key={l.id} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-2.5 text-sm font-semibold text-zinc-900 flex items-center gap-2"><Bus className="size-4 text-primary" /> {l.vehicle_no}<span className="text-zinc-400 font-normal">{l.vehicle_name ? ` · ${l.vehicle_name}` : ''}</span></td>
                      <td className="px-4 py-2.5 text-xs text-zinc-600">{l.vehicle_code || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-900 tabular-nums">{num(l.trips)}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-900 tabular-nums">{num(l.distance_km)} km</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-900 tabular-nums">{num(l.fuel_litres)} L</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-600">{l.driver_name || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && <button onClick={() => setModal({ id: l.id, vehicle_id: l.vehicle_id, log_date: dkey(l.log_date), trips: l.trips ?? '', distance_km: l.distance_km ?? '', fuel_litres: l.fuel_litres ?? '', fuel_cost: l.fuel_cost ?? '', driver_name: l.driver_name || '', notes: l.notes || '' })} className="p-1.5 text-zinc-400 hover:text-primary rounded" title="Edit"><Pencil className="size-4" /></button>}
                          {canDelete && <button onClick={() => del(l.id)} disabled={busyId === l.id} className="p-1.5 text-zinc-400 hover:text-accent rounded disabled:opacity-40" title="Delete"><Trash2 className="size-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-xs text-zinc-500 italic">No log for this day{canEdit ? ' — use “Add Log” to record one.' : '.'}</p>
          )}
        </div>
      </div>

      {modal && <LogModal user={user} vehicles={vehicles} value={modal} locked={!!lockedVehicleId} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await refresh(); }} />}
    </div>
  );
}

function LogModal({ user, vehicles, value, onClose, onSaved, locked = false }) {
  const [f, setF] = useState(value);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.vehicle_id) return alert('Select a vehicle.');
    if (!f.log_date) return alert('Pick a date.');
    setSaving(true);
    try {
      const body = { ...f, institutionId: user.institutionId, userId: user?.id ?? null, userName: user?.name ?? null };
      const url = f.id ? `${API_BASE_URL}/transport/log/${f.id}` : `${API_BASE_URL}/transport/log`;
      const res = await fetch(url, { method: f.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not save.'); }
      else onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-zinc-900">{f.id ? 'Edit Daily Log' : 'Add Daily Log'}</h4>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="size-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Vehicle *">
              <div className="relative">
                <select value={f.vehicle_id} onChange={e => set('vehicle_id', e.target.value)} disabled={locked}
                  className={`${inputCls} appearance-none pr-8 cursor-pointer disabled:bg-zinc-50 disabled:text-zinc-500`}>
                  <option value="">Select vehicle…</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}{v.vehicle_code ? ` · ${v.vehicle_code}` : ''}{v.vehicle_name ? ` · ${v.vehicle_name}` : ''}</option>)}
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Field>
          </div>
          <Field label="Date *"><input type="date" value={f.log_date} onChange={e => set('log_date', e.target.value)} className={inputCls} /></Field>
          <Field label="Trips"><input value={f.trips} onChange={e => set('trips', e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="e.g. 2" className={inputCls} /></Field>
          <Field label="Distance (km)"><input value={f.distance_km} onChange={e => set('distance_km', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="e.g. 42.5" className={inputCls} /></Field>
          <Field label="Fuel (litres)"><input value={f.fuel_litres} onChange={e => set('fuel_litres', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="e.g. 12" className={inputCls} /></Field>
          <Field label="Fuel cost (₹)"><input value={f.fuel_cost} onChange={e => set('fuel_cost', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Optional" className={inputCls} /></Field>
          <Field label="Driver"><input value={f.driver_name} onChange={e => set('driver_name', e.target.value)} placeholder="Optional" className={inputCls} /></Field>
          <div className="col-span-2"><Field label="Notes"><input value={f.notes} onChange={e => set('notes', e.target.value)} className={inputCls} /></Field></div>
        </div>
        <p className="text-[10px] text-zinc-400 mt-2">One entry per vehicle per day — saving again for the same day updates it. Totals roll up automatically into the period above.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-md text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"><Save className="size-3.5" /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }) {
  const tones = { zinc: 'bg-zinc-100 text-zinc-600', green: 'bg-green-50 text-green-600', accent: 'bg-accent/10 text-accent', primary: 'bg-primary/10 text-primary' };
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white p-3.5">
      <span className={`size-8 rounded-lg flex items-center justify-center mb-2 ${tones[tone] || tones.zinc}`}><Icon className="size-4" /></span>
      <p className="text-lg font-bold text-zinc-900 tabular-nums leading-tight">{value}</p>
      <p className="text-[11px] font-medium text-zinc-600 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}
function Legend({ cls, label }) {
  return <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500"><span className={`size-3 rounded ring-1 ${cls}`} /> {label}</span>;
}
const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';
function Field({ label, children }) { return <div className="flex flex-col"><label className="text-xs font-medium text-zinc-600 mb-1.5">{label}</label>{children}</div>; }