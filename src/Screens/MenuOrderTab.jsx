import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RotateCcw, ListOrdered, Info, GripVertical } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';
import { MODULES } from './Modules';

// =====================================================================
//  MenuOrderTab
//  Lets each school's Super Admin decide the order of their own sidebar
//  instead of inheriting the order hard-coded in Modules.js.
//
//  - Only modules that actually appear in the sidebar are listed
//    (hideFromSidebar ones - Profile, Notifications, Academic Calendar -
//    are reached from the header/footer, so they have no position).
//  - Saved as a plain ordered list of module_name. Anything a school
//    hasn't positioned yet falls in behind, in Modules.js order.
//  - This is order only. Whether a role SEES a module is still decided
//    entirely by the Permissions tab.
//
//  Reordering is now drag-and-drop (the up/down buttons are gone) and
//  every drop saves automatically. The numbered badge shows the live
//  position (1, 2, 3 ...).
//
//  Props: { user }
// =====================================================================

const ORDERABLE = MODULES.filter(m => !m.hideFromSidebar);
const DEFAULT_ORDER = ORDERABLE.map(m => m.module_name);
const byName = ORDERABLE.reduce((a, m) => { a[m.module_name] = m; return a; }, {});

// Saved names first (in their saved order), then anything new that the
// school has never positioned - so shipping a new module never breaks.
const mergeWithDefaults = (saved) => {
  const known = (saved || []).filter(n => byName[n]);
  const rest = DEFAULT_ORDER.filter(n => !known.includes(n));
  return [...known, ...rest];
};

export default function MenuOrderTab({ user }) {
  const [order, setOrder]     = useState(DEFAULT_ORDER);
  const [initial, setInitial] = useState(DEFAULT_ORDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  // Drag-and-drop state (replaces the old up/down move buttons).
  const [dragName, setDragName] = useState(null);
  const [overName, setOverName] = useState(null);
  const orderRef = useRef(order);
  useEffect(() => { orderRef.current = order; }, [order]);

  useEffect(() => {
    if (!user?.institutionId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/module-order/${user.institutionId}`);
        const rows = res.ok ? await res.json() : [];
        const names = Array.isArray(rows) ? rows.map(r => r.module_name) : [];
        const merged = mergeWithDefaults(names);
        if (alive) { setOrder(merged); setInitial(merged); }
      } catch (e) {
        console.error('Menu order fetch error:', e);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.institutionId]);

  const dirty = useMemo(() => order.join('|') !== initial.join('|'), [order, initial]);

  // Persist. Accepts the array to save explicitly so a drop can save the
  // freshly-computed order without waiting on a state flush.
  const save = async (ord) => {
    const payloadOrder = ord || orderRef.current;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/module-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, order: payloadOrder })
      });
      if (res.ok) {
        setInitial(payloadOrder);
        setSaved(true);
      } else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'Failed to save the menu order.');
      }
    } catch (e) { alert('Network error.'); }
    setSaving(false);
  };

  const resetDefault = () => {
    setSaved(false);
    setOrder(DEFAULT_ORDER);
    save(DEFAULT_ORDER);
  };

  // ---- Drag and drop --------------------------------------------------
  const handleDragStart = (e, name) => {
    setDragName(name);
    setSaved(false);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', name); } catch (_) {}
  };
  const handleDragOver = (e, name) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (name !== overName) setOverName(name);
  };
  const handleDragLeave = (name) => {
    if (name === overName) setOverName(null);
  };
  const handleDrop = (e, targetName) => {
    e.preventDefault();
    const from = order.indexOf(dragName);
    const to   = order.indexOf(targetName);
    setOverName(null);
    setDragName(null);
    if (!dragName || from < 0 || to < 0 || from === to) return;
    const arr = [...order];
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    setOrder(arr);
    save(arr);           // auto-save on drop
  };
  const handleDragEnd = () => { setDragName(null); setOverName(null); };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Menu Order</h3>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-2xl">
            Drag any item to arrange the sidebar the way your school works. Changes save automatically
            and apply to everyone here.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={resetDefault}
            className="h-9 px-3 inline-flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors shadow-sm">
            <RotateCcw className="size-3.5" /> Reset to default
          </button>
        </div>
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden flex flex-col">

        <div className="px-5 py-4 bg-zinc-50/50 border-b border-zinc-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ListOrdered className="size-4 text-primary shrink-0" />
            <p className="text-sm font-semibold text-zinc-900 truncate">Sidebar, top to bottom</p>
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
            saving ? 'text-primary' : (saved && !dirty) ? 'text-emerald-600' : 'text-zinc-400'
          }`}>
            {saving ? 'Saving...' : (saved && !dirty) ? 'Saved' : `${order.length} modules`}
          </span>
        </div>

        <div className="p-3 sm:p-4 space-y-2">
          {order.map((name, idx) => {
            const m = byName[name];
            if (!m) return null;
            const isDragging = dragName === name;
            const isOver = overName === name && dragName && dragName !== name;
            return (
              <div key={name}
                draggable
                onDragStart={(e) => handleDragStart(e, name)}
                onDragOver={(e) => handleDragOver(e, name)}
                onDragLeave={() => handleDragLeave(name)}
                onDrop={(e) => handleDrop(e, name)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-2.5 rounded-md ring-1 ring-inset bg-white transition-all shadow-sm cursor-grab active:cursor-grabbing select-none ${
                  isDragging ? 'opacity-40 ring-primary/40' : 'ring-black/5 hover:bg-zinc-50/60'
                } ${isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}>

                {/* Live position number (1, 2, 3 ...) */}
                <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-semibold tabular-nums">
                  {idx + 1}
                </span>

                <div className="p-1 rounded bg-zinc-50 ring-1 ring-black/5 shrink-0">
                  <img src={m.imageSource} alt="" className="size-5 object-contain" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{m.label}</p>
                  <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider truncate">{m.module_name}</p>
                </div>

                <GripVertical className="size-4 text-zinc-300 shrink-0" />
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 bg-zinc-50/50 border-t border-zinc-100 flex gap-2 text-[11px] text-zinc-500 font-medium leading-relaxed">
          <Info className="size-3.5 shrink-0 mt-0.5 text-zinc-400" />
          <span>
            Order only - a module still appears solely for roles that have permission for it in the
            <strong className="text-zinc-700 font-semibold"> Permissions</strong> tab. Profile, Notifications and
            Academic Calendar are not listed here: they live in the header and footer, not the menu.
            Users see the new order the next time they load the dashboard.
          </span>
        </div>
      </div>
    </div>
  );
}