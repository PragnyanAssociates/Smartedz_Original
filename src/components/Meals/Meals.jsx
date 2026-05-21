import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  UtensilsCrossed, Clock, CalendarDays, Plus, Trash2, Save,
  Loader2, AlertCircle, Coffee, Sun, Moon, Cookie
} from 'lucide-react';

// =====================================================================
//  Meals — each school defines its own meal slots (Breakfast / Lunch /
//  Snacks / Dinner — 1 to 4 of them), then fills a weekly menu grid.
//
//  Two tabs:
//   • 'slots' — define the meal periods (edit access only)
//   • 'menu'  — the Mon-Sun x slot grid of food items
//
//  Students / staff without edit access see the menu read-only.
// =====================================================================

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Pick an icon for a slot based on its name
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

export default function Meals() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('Meals', 'edit');

  const [data, setData]       = useState({ slots: [], menu: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('menu');

  const fetchData = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/meals/${user.institutionId}`);
      const d = await res.json();
      setData({ slots: d.slots || [], menu: d.menu || [] });
    } catch (e) { console.error('Meals fetch error:', e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'menu',  label: 'Weekly Menu', icon: CalendarDays },
    { id: 'slots', label: 'Meal Slots',  icon: Clock }
  ];

  const tabProps = { data, fetchData, user, canEdit };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <UtensilsCrossed className="text-blue-600" size={28} />
          Meals
        </h2>
        <p className="text-slate-500 font-medium mt-1">
          Define your school's meal slots, then plan the weekly menu.
        </p>
      </div>

      {/* Only show the tab bar if the user can edit (others just see the menu) */}
      {canEdit && (
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-bold text-sm transition-all ${
                activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
              }`}>
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-[400px]">
        {canEdit && activeTab === 'slots'
          ? <SlotsTab {...tabProps} />
          : <MenuTab {...tabProps} />}
      </div>
    </div>
  );
}


// =====================================================================
//  TAB 1 — Meal Slots setup
// =====================================================================
function SlotsTab({ data, fetchData, user, canEdit }) {
  const [slots, setSlots] = useState(() =>
    data.slots.length > 0
      ? data.slots.map(s => ({
          id: s.id, name: s.name,
          start_time: (s.start_time || '').slice(0, 5),
          end_time:   (s.end_time   || '').slice(0, 5)
        }))
      : [{ id: null, name: 'Lunch', start_time: '12:30', end_time: '13:15' }]
  );
  const [saving, setSaving] = useState(false);

  const addSlot = () => setSlots(p => [...p, { id: null, name: '', start_time: '', end_time: '' }]);
  const updateSlot = (i, key, val) => setSlots(p => p.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  const removeSlot = (i) => setSlots(p => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    for (const s of slots) {
      if (!s.name.trim()) return alert('Every meal slot needs a name.');
    }
    if (slots.length === 0) return alert('Add at least one meal slot.');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/meals/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, slots })
      });
      if (!res.ok) throw new Error('Save failed');
      alert('Meal slots saved.');
      fetchData();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Clock size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Meal Slots</h3>
            <p className="text-xs text-slate-400 font-medium">
              Add the meals your school serves — one, two, three or four.
            </p>
          </div>
        </div>

        <div className="space-y-2 mt-6 mb-4">
          {slots.map((s, i) => {
            const Icon = slotIcon(s.name);
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="col-span-1 text-center text-slate-400">
                  <Icon size={18} />
                </div>
                <input placeholder="Meal name (e.g. Breakfast)" value={s.name}
                  onChange={e => updateSlot(i, 'name', e.target.value)}
                  className="col-span-5 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
                <input type="time" value={s.start_time}
                  onChange={e => updateSlot(i, 'start_time', e.target.value)}
                  className="col-span-3 bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none" />
                <input type="time" value={s.end_time}
                  onChange={e => updateSlot(i, 'end_time', e.target.value)}
                  className="col-span-2 bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none" />
                <button onClick={() => removeSlot(i)}
                  className="col-span-1 text-slate-300 hover:text-red-500 transition-colors flex justify-center">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>

        <button onClick={addSlot}
          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all mb-4">
          <Plus size={14} /> Add Meal Slot
        </button>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-3 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save Meal Slots'}
        </button>

        <p className="text-[11px] text-slate-400 font-medium mt-3">
          Removing a slot also clears its menu items. Times are optional.
        </p>
      </div>
    </div>
  );
}


// =====================================================================
//  TAB 2 — Weekly Menu grid
// =====================================================================
function MenuTab({ data, fetchData, user, canEdit }) {
  // Build cell map: `${slotId}-${dayIndex}` → items text
  const initialCells = useMemo(() => {
    const map = {};
    data.menu.forEach(m => { map[`${m.slot_id}-${m.day_index}`] = m.items || ''; });
    return map;
  }, [data.menu]);

  const [cells, setCells] = useState(initialCells);
  useEffect(() => { setCells(initialCells); }, [initialCells]);

  const [saving, setSaving] = useState(false);

  const setCell = (slotId, dayIndex, value) => {
    setCells(p => ({ ...p, [`${slotId}-${dayIndex}`]: value }));
  };
  const getCell = (slotId, dayIndex) => cells[`${slotId}-${dayIndex}`] ?? '';

  const handleSave = async () => {
    const entries = [];
    data.slots.forEach(slot => {
      DAYS.forEach((_, dayIndex) => {
        entries.push({
          slot_id: slot.id,
          day_index: dayIndex,
          items: getCell(slot.id, dayIndex)
        });
      });
    });
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/meals/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, entries })
      });
      if (!res.ok) throw new Error('Save failed');
      alert('Weekly menu saved.');
      fetchData();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  // --- No slots yet ----------------------------------------------
  if (data.slots.length === 0) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center max-w-2xl mx-auto">
        <AlertCircle className="mx-auto text-amber-400 mb-3" size={42} />
        <h3 className="text-2xl font-black text-slate-800">No Meal Slots Yet</h3>
        <p className="text-slate-500 mt-2 font-medium">
          {canEdit
            ? <>Open the <strong>Meal Slots</strong> tab and add the meals your school serves first.</>
            : 'The school has not set up its meal plan yet.'}
        </p>
      </div>
    );
  }

  // --- Read-only view (students / staff without edit access) -----
  if (!canEdit) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-slate-900 text-white px-5 py-3 font-black text-sm uppercase tracking-widest">
                {day}
              </div>
              <div className="divide-y divide-slate-50">
                {data.slots.map(slot => {
                  const Icon = slotIcon(slot.name);
                  const items = getCell(slot.id, dayIndex);
                  return (
                    <div key={slot.id} className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className="text-blue-500" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                          {slot.name}
                        </span>
                        {slot.start_time && (
                          <span className="text-[10px] text-slate-300 ml-auto">
                            {fmtTime(slot.start_time)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-700">
                        {items || <span className="text-slate-300 italic">Not planned</span>}
                      </p>
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

  // --- Editable grid ---------------------------------------------
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save Weekly Menu'}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left" style={{ minWidth: 720 }}>
          <thead>
            <tr className="bg-slate-50">
              <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest sticky left-0 bg-slate-50 z-10"
                style={{ minWidth: 110 }}>
                Day
              </th>
              {data.slots.map(slot => {
                const Icon = slotIcon(slot.name);
                return (
                  <th key={slot.id} className="p-4 text-center border-l border-slate-100"
                    style={{ minWidth: 200 }}>
                    <div className="flex items-center justify-center gap-1.5 text-slate-600">
                      <Icon size={14} className="text-blue-500" />
                      <span className="text-xs font-black uppercase tracking-wider">{slot.name}</span>
                    </div>
                    {slot.start_time && (
                      <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                        {fmtTime(slot.start_time)}{slot.end_time ? ` – ${fmtTime(slot.end_time)}` : ''}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DAYS.map((day, dayIndex) => (
              <tr key={day}>
                <td className="p-4 font-black text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-100">
                  <div>{DAYS_SHORT[dayIndex]}</div>
                  <div className="text-[10px] font-medium text-slate-400 normal-case">{day}</div>
                </td>
                {data.slots.map(slot => (
                  <td key={slot.id} className="p-2 border-l border-slate-100 align-top">
                    <textarea
                      value={getCell(slot.id, dayIndex)}
                      onChange={e => setCell(slot.id, dayIndex, e.target.value)}
                      rows={3}
                      placeholder="e.g. Rice, Dal, Curd, Banana"
                      className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 resize-none" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 font-medium">
        Type the food items for each meal, separated by commas. Leave a cell empty if there's no meal that day.
      </p>
    </div>
  );
}