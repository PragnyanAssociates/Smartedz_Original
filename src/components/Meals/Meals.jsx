import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  UtensilsCrossed, Clock, CalendarDays, Plus, Trash2, Save,
  Loader2, AlertCircle, Coffee, Sun, Moon, Cookie, ChevronDown, User,
  HelpCircle, X, ShieldCheck, ChefHat, Warehouse
} from 'lucide-react';
import Kitchen from './Kitchen';
import Store from './Store';

// =====================================================================
//  Food Menu — three tabs:
//    • Dining Time : Weekly Menu + Meal Slots (the original Meals screen)
//    • Kitchen     : daily provisions + usage   (edit/delete only)
//    • Store       : permanent assets            (edit/delete only)
//  Read-only users see Dining Time alone; edit/delete unlock all three.
// =====================================================================

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fmtIST = (val) => {
  if (!val) return '';
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) d = new Date(val.replace(' ', 'T') + 'Z');
  else d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};

function slotIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('break')) return Coffee;
  if (n.includes('lunch')) return Sun;
  if (n.includes('dinner') || n.includes('supper')) return Moon;
  if (n.includes('snack') || n.includes('tea')) return Cookie;
  return UtensilsCrossed;
}

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hh = parseInt(h, 10);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${m || '00'} ${ampm}`;
};

const timeRank = (t) => {
  if (!t || typeof t !== 'string' || !t.includes(':')) return Number.POSITIVE_INFINITY;
  const [h, m] = t.split(':');
  const hh = parseInt(h, 10);
  const mm = parseInt(m, 10);
  if (isNaN(hh)) return Number.POSITIVE_INFINITY;
  return hh * 60 + (isNaN(mm) ? 0 : mm);
};
const sortSlotsByTime = (slots) => [...(slots || [])].sort((a, b) => timeRank(a.start_time) - timeRank(b.start_time));

const parse24to12 = (t) => {
  if (!t) return { time: '09:00', period: 'AM' };
  const [h, m] = t.split(':');
  let hh = parseInt(h, 10);
  const period = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return { time: `${String(hh).padStart(2, '0')}:${m}`, period };
};
const joinTo24 = (t, p) => {
  if (!t || !t.includes(':')) return '00:00';
  let [h, m] = t.split(':');
  let hh = parseInt(h, 10);
  if (isNaN(hh)) hh = 0;
  if (p === 'PM' && hh < 12) hh += 12;
  if (p === 'AM' && hh === 12) hh = 0;
  return `${String(hh).padStart(2, '0')}:${(m || '00').padEnd(2, '0').slice(0, 2)}`;
};

export default function Meals() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('Meals', 'edit');
  const canDelete = can('Meals', 'delete');
  const manage = canEdit || canDelete;   // unlocks Kitchen + Store

  const [mainTab, setMainTab] = useState('dining');

  // Dining Time data (slots + weekly menu)
  const [data, setData]       = useState({ slots: [], menu: [], menuMeta: null });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/meals/${user.institutionId}`);
      const d = await res.json();
      setData({ slots: d.slots || [], menu: d.menu || [], menuMeta: d.menuMeta || null });
    } catch (e) { console.error('Meals fetch error:', e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const mainTabs = [
    { id: 'dining', label: 'Dining Time', icon: UtensilsCrossed },
    ...(manage ? [
      { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
      { id: 'store',   label: 'Store',   icon: Warehouse },
    ] : []),
  ];

  const helpTopic = !manage ? 'view' : mainTab;

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-6">

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="text-primary size-5" />
            Food Menu
          </h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Plan meals, track the kitchen, and manage store assets.
          </p>
        </div>
        <MealsHelp topic={helpTopic} />
      </header>

      {/* Top tabs (hidden for read-only users who only get Dining Time) */}
      {mainTabs.length > 1 && (
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 overflow-x-auto custom-scrollbar">
          {mainTabs.map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                mainTab === t.id ? 'bg-primary text-white shadow-sm' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
              }`}>
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-[400px]">
        {mainTab === 'dining' && <DiningTime data={data} fetchData={fetchData} user={user} canEdit={canEdit} loading={loading} />}
        {mainTab === 'kitchen' && manage && <Kitchen user={user} canEdit={canEdit} canDelete={canDelete} />}
        {mainTab === 'store'   && manage && <Store   user={user} canEdit={canEdit} canDelete={canDelete} />}
      </div>
    </div>
  );
}

// =====================================================================
//  DINING TIME — Weekly Menu + Meal Slots (the original Meals content)
// =====================================================================
function DiningTime({ data, fetchData, user, canEdit, loading }) {
  const [activeTab, setActiveTab] = useState('menu');

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="size-8 text-primary animate-spin" /></div>;
  }

  const tabs = [
    { id: 'menu',  label: 'Weekly Menu', icon: CalendarDays },
    { id: 'slots', label: 'Meal Slots',  icon: Clock }
  ];
  const tabProps = { data, fetchData, user, canEdit };

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-start">
          <div className="inline-flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar max-w-full">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 flex-1 sm:flex-none px-4 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  activeTab === t.id ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
                }`}>
                <t.icon className="size-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {canEdit && activeTab === 'slots' ? <SlotsTab {...tabProps} /> : <MenuTab {...tabProps} />}
    </div>
  );
}

// =====================================================================
//  Menu audit line
// =====================================================================
function MenuMeta({ meta }) {
  const lu = meta?.lastUpdated;
  const fc = meta?.firstCreated;
  if (!lu?.at && !fc?.by) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] text-zinc-500">
      {lu?.at && (
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5 text-zinc-400 shrink-0" />
          Last updated
          <span className="font-semibold text-zinc-700">{fmtIST(lu.at)}</span>
          {lu.by && (<>by <span className="font-semibold text-zinc-700 inline-flex items-center gap-1"><User className="size-3 text-zinc-400" />{lu.by}</span></>)}
        </span>
      )}
      {fc?.by && (
        <span className="inline-flex items-center gap-1.5 text-zinc-400">
          <span className="text-zinc-300">{'\u2022'}</span>
          Created by <span className="font-medium text-zinc-600">{fc.by}</span>
        </span>
      )}
    </div>
  );
}

// =====================================================================
//  Meal Slots setup
// =====================================================================
function SlotsTab({ data, fetchData, user }) {
  const [slots, setSlots] = useState(() =>
    data.slots.length > 0
      ? sortSlotsByTime(data.slots).map(s => {
          const start = parse24to12(s.start_time);
          const end = parse24to12(s.end_time);
          return { id: s.id, name: s.name, start_time: start.time, start_period: start.period, end_time: end.time, end_period: end.period };
        })
      : [{ id: null, name: 'Lunch', start_time: '12:30', start_period: 'PM', end_time: '01:15', end_period: 'PM' }]
  );
  const [saving, setSaving] = useState(false);

  const addSlot = () => setSlots(p => [...p, { id: null, name: '', start_time: '09:00', start_period: 'AM', end_time: '09:45', end_period: 'AM' }]);
  const updateSlot = (i, key, val) => setSlots(p => p.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  const removeSlot = (i) => setSlots(p => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    for (const s of slots) { if (!s.name.trim()) return alert('Every meal slot needs a name.'); }
    if (slots.length === 0) return alert('Add at least one meal slot.');
    const payload = slots.map(s => ({ id: s.id, name: s.name, start_time: joinTo24(s.start_time, s.start_period), end_time: joinTo24(s.end_time, s.end_period) }));
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/meals/slots`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, slots: payload })
      });
      if (!res.ok) throw new Error('Save failed');
      alert('Meal slots saved.');
      fetchData();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg ring-1 ring-black/5 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 bg-primary/10 rounded-md flex items-center justify-center text-primary ring-1 ring-primary/20"><Clock className="size-5" /></div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Meal Slots</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Add the meals your school serves - one, two, three or four.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          {slots.map((s, i) => {
            const Icon = slotIcon(s.name);
            return (
              <div key={i} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 rounded-md bg-zinc-50/50 ring-1 ring-zinc-200 w-full sm:w-[420px]">
                <div className="flex items-center gap-3 w-full sm:w-44 shrink-0">
                  <div className="size-6 rounded-full bg-white ring-1 ring-black/5 flex items-center justify-center text-zinc-400 shrink-0 shadow-sm"><Icon className="size-3.5" /></div>
                  <input placeholder="Meal name" value={s.name} onChange={e => updateSlot(i, 'name', e.target.value)}
                    className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5">
                    <input type="text" value={s.start_time} placeholder="00:00" onChange={e => updateSlot(i, 'start_time', e.target.value)}
                      className="h-9 w-16 bg-white border border-zinc-200 rounded-md text-center text-sm tabular-nums text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                    <div className="relative">
                      <select value={s.start_period} onChange={e => updateSlot(i, 'start_period', e.target.value)}
                        className="h-9 w-16 pl-2 pr-6 bg-white border border-zinc-200 rounded-md text-xs font-bold appearance-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer">
                        <option value="AM">AM</option><option value="PM">PM</option>
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">to</span>
                  <div className="flex items-center gap-1.5">
                    <input type="text" value={s.end_time} placeholder="00:00" onChange={e => updateSlot(i, 'end_time', e.target.value)}
                      className="h-9 w-16 bg-white border border-zinc-200 rounded-md text-center text-sm tabular-nums text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                    <div className="relative">
                      <select value={s.end_period} onChange={e => updateSlot(i, 'end_period', e.target.value)}
                        className="h-9 w-16 pl-2 pr-6 bg-white border border-zinc-200 rounded-md text-xs font-bold appearance-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer">
                        <option value="AM">AM</option><option value="PM">PM</option>
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                  <button onClick={() => removeSlot(i)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0 ml-auto sm:ml-1"><Trash2 className="size-4" /></button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 border-t border-zinc-100 pt-5 mt-2">
          <p className="text-[11px] text-zinc-400 text-center sm:text-left">Removing a slot also clears its menu items. Times are optional - the weekly menu orders meals by their start time.</p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
            <button onClick={addSlot} type="button" className="h-9 px-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors ring-1 ring-zinc-200 w-full sm:w-auto"><Plus className="size-3.5" /> Add Meal Slot</button>
            <button onClick={handleSave} disabled={saving} type="button" className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} {saving ? 'Saving...' : 'Save Meal Slots'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
//  Weekly Menu grid
// =====================================================================
function MenuTab({ data, fetchData, user, canEdit }) {
  const slots = useMemo(() => sortSlotsByTime(data.slots), [data.slots]);
  const initialCells = useMemo(() => {
    const map = {};
    data.menu.forEach(m => { map[`${m.slot_id}-${m.day_index}`] = m.items || ''; });
    return map;
  }, [data.menu]);

  const [cells, setCells] = useState(initialCells);
  useEffect(() => { setCells(initialCells); }, [initialCells]);
  const [saving, setSaving] = useState(false);

  const setCell = (slotId, dayIndex, value) => setCells(p => ({ ...p, [`${slotId}-${dayIndex}`]: value }));
  const getCell = (slotId, dayIndex) => cells[`${slotId}-${dayIndex}`] ?? '';

  const handleSave = async () => {
    const entries = [];
    slots.forEach(slot => { DAYS.forEach((_, dayIndex) => { entries.push({ slot_id: slot.id, day_index: dayIndex, items: getCell(slot.id, dayIndex) }); }); });
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/meals/menu`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, entries })
      });
      if (!res.ok) throw new Error('Save failed');
      alert('Weekly menu saved.');
      fetchData();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (slots.length === 0) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center max-w-2xl mx-auto flex flex-col items-center">
        <AlertCircle className="text-amber-400 mb-3 size-10" />
        <h3 className="text-lg font-semibold text-zinc-900">No Meal Slots Yet</h3>
        <p className="text-zinc-500 mt-1 text-sm font-medium">
          {canEdit ? <>Open the <strong>Meal Slots</strong> tab and add the meals your school serves first.</> : 'The school has not set up its meal plan yet.'}
        </p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <MenuMeta meta={data.menuMeta} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-zinc-50 border-b border-zinc-100 px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-700">{day}</div>
              <div className="divide-y divide-zinc-100">
                {slots.map(slot => {
                  const Icon = slotIcon(slot.name);
                  const items = getCell(slot.id, dayIndex);
                  return (
                    <div key={slot.id} className="p-4 bg-white hover:bg-zinc-50/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="size-5 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="size-3" /></div>
                          <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">{slot.name}</span>
                        </div>
                        {slot.start_time && <span className="text-[10px] text-zinc-400 font-medium tabular-nums bg-zinc-100 px-1.5 py-0.5 rounded">{fmtTime(slot.start_time)}</span>}
                      </div>
                      <p className="text-sm text-zinc-800 leading-relaxed ml-7">{items || <span className="text-zinc-400 italic">Not planned</span>}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="h-10 w-full sm:w-auto bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white px-6 rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors">
          {saving ? <Loader2 className="size-4 animate-spin shrink-0" /> : <Save className="size-4 shrink-0" />} {saving ? 'Saving...' : 'Save Weekly Menu'}
        </button>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-md p-4 text-[11px] font-medium text-blue-700 leading-relaxed flex gap-2">
        <AlertCircle className="size-4 shrink-0 text-blue-500" />
        <p>Type the food items for each meal, separated by commas. Leave a cell empty if there's no meal scheduled for that slot on that day. Meals are shown in start-time order, from morning to night.</p>
      </div>

      <MenuMeta meta={data.menuMeta} />

      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-zinc-50/80">
              <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider sticky left-0 bg-zinc-50/95 backdrop-blur z-10 border-b border-r border-zinc-100 w-24">Day</th>
              {slots.map(slot => {
                const Icon = slotIcon(slot.name);
                return (
                  <th key={slot.id} className="p-4 text-center border-b border-r border-zinc-100 last:border-r-0 min-w-[200px]">
                    <div className="flex items-center justify-center gap-2 text-zinc-700">
                      <div className="size-5 rounded bg-white ring-1 ring-black/5 text-primary flex items-center justify-center shadow-sm"><Icon className="size-3" /></div>
                      <span className="text-xs font-semibold uppercase tracking-wider">{slot.name}</span>
                    </div>
                    {slot.start_time && <div className="text-[10px] font-medium text-zinc-400 mt-1 tabular-nums">{fmtTime(slot.start_time)}{slot.end_time ? ` - ${fmtTime(slot.end_time)}` : ''}</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {DAYS.map((day, dayIndex) => (
              <tr key={day} className="hover:bg-zinc-50/30 transition-colors">
                <td className="px-5 py-4 font-semibold text-zinc-800 sticky left-0 bg-white z-10 border-r border-zinc-100 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                  <div>{DAYS_SHORT[dayIndex]}</div>
                  <div className="text-[10px] font-medium text-zinc-400 mt-0.5">{day}</div>
                </td>
                {slots.map(slot => (
                  <td key={slot.id} className="p-3 border-r border-zinc-100 last:border-r-0 align-top">
                    <textarea value={getCell(slot.id, dayIndex)} onChange={e => setCell(slot.id, dayIndex, e.target.value)} rows={3} placeholder="e.g. Rice, Dal, Curd, Banana"
                      className="w-full bg-zinc-50/50 border border-zinc-200 rounded-md px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:bg-white resize-none transition-all shadow-sm" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================================
//  Help
// =====================================================================
const GUIDES = {
  dining: {
    title: 'Dining Time',
    steps: [
      ['1 \u00b7 Meal Slots', 'Under the Meal Slots sub-tab, add the one to four meals your school serves (Breakfast, Lunch\u2026). Each needs a name; times are optional.'],
      ['2 \u00b7 Weekly Menu', 'The grid\u2019s rows are the seven days and columns are your slots. Type the items for each meal, separated by commas.'],
      ['3 \u00b7 Save', 'Each sub-tab saves on its own \u2014 Save Meal Slots and Save Weekly Menu. Slots run in start-time order, morning first.'],
      ['4 \u00b7 Who sees it', 'Students, parents and staff see the weekly menu read-only, with a \u201cLast updated by\u201d line.'],
    ],
    note: 'The Kitchen and Store tabs are for staff with edit access \u2014 read-only users only ever see this Dining Time view.'
  },
  kitchen: {
    title: 'Kitchen',
    steps: [
      ['1 \u00b7 Add provisions', 'Add Provision records a stock item \u2014 name, quantity, unit and an optional photo. It starts with its full quantity remaining.'],
      ['2 \u00b7 Log usage', 'Hit Use on a provision to record how much was consumed on a day. The remaining quantity drops automatically.'],
      ['3 \u00b7 Pick the day', 'The date picker at the top sets which day\u2019s usage you\u2019re viewing and logging against. It defaults to today.'],
      ['4 \u00b7 Remove', 'Deleting a provision also removes its usage history.'],
    ],
    note: 'Kitchen is for day-to-day consumables. Permanent items (furniture, equipment) belong in the Store tab.'
  },
  store: {
    title: 'Store',
    steps: [
      ['1 \u00b7 Add assets', 'Add Asset records a permanent item \u2014 name, quantity, a location/rack and an optional photo.'],
      ['2 \u00b7 Find', 'Search by name or rack to narrow a long list.'],
      ['3 \u00b7 Edit & delete', 'Each card has Edit and delete. Tap a photo to view it full-size.'],
    ],
    note: 'Store is for assets that stay with the school. Consumable stock belongs in Kitchen.'
  },
  view: {
    title: 'Weekly Menu',
    steps: [
      ['1 \u00b7 Your week of meals', 'Each card is a day. Inside it, every meal slot shows what\u2019s planned, in the order it\u2019s served.'],
      ['2 \u00b7 Reading it', '\u201cNot planned\u201d means nothing is scheduled for that meal that day. Meal times, if set, show beside each slot.'],
      ['3 \u00b7 Always current', 'The \u201cLast updated\u201d line tells you when the kitchen last changed the menu, and by whom.'],
    ],
    note: 'This is read-only \u2014 the school sets the menu. If something looks off, let the office know.'
  }
};

function MealsHelp({ topic = 'dining' }) {
  const [open, setOpen] = useState(false);
  const content = GUIDES[topic] || GUIDES.dining;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start">
        <HelpCircle className="size-3.5" /> How to use
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
              <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {content.steps.map(([t, d], i) => (
                <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
                  <p className="text-xs font-semibold text-zinc-800">{t}</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
                </div>
              ))}
              <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
                <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">{content.note}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}