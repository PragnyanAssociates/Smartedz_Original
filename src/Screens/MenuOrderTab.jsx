import React, { useState, useEffect, useMemo } from 'react';
import { Save, ChevronUp, ChevronDown, RotateCcw, ListOrdered, Info, GripVertical } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';
import { MODULES } from './Modules';

// =====================================================================
//  MenuOrderTab
//  Lets each school's Super Admin decide the order of their own sidebar
//  instead of inheriting the order hard-coded in Modules.js.
//
//  • Only modules that actually appear in the sidebar are listed
//    (hideFromSidebar ones — Profile, Notifications, Academic Calendar —
//    are reached from the header/footer, so they have no position).
//  • Saved as a plain ordered list of module_name. Anything a school
//    hasn't positioned yet falls in behind, in Modules.js order.
//  • This is order only. Whether a role SEES a module is still decided
//    entirely by the Permissions tab.
//
//  Props: { user }
// =====================================================================

const ORDERABLE = MODULES.filter(m => !m.hideFromSidebar);
const DEFAULT_ORDER = ORDERABLE.map(m => m.module_name);
const byName = ORDERABLE.reduce((a, m) => { a[m.module_name] = m; return a; }, {});

// Saved names first (in their saved order), then anything new that the
// school has never positioned — so shipping a new module never breaks.
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

  const moveTo = (name, target) => {
    setSaved(false);
    setOrder(prev => {
      const arr = [...prev];
      const from = arr.indexOf(name);
      if (from < 0) return prev;
      const to = Math.max(0, Math.min(arr.length - 1, target));
      if (to === from) return prev;
      arr.splice(to, 0, arr.splice(from, 1)[0]);
      return arr;
    });
  };

  const resetDefault = () => { setSaved(false); setOrder(DEFAULT_ORDER); };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/module-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, order })
      });
      if (res.ok) {
        setInitial(order);
        setSaved(true);
      } else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'Failed to save the menu order.');
      }
    } catch (e) { alert('Network error.'); }
    setSaving(false);
  };

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
            Arrange the sidebar the way your school works. This order applies to everyone here.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={resetDefault}
            className="h-9 px-3 inline-flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors shadow-sm">
            <RotateCcw className="size-3.5" /> Reset to default
          </button>
          <button type="button" onClick={save} disabled={saving || !dirty}
            className="h-9 px-4 inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white rounded-md text-xs font-medium transition-colors shadow-sm">
            <Save className="size-3.5 shrink-0" />
            {saving ? 'Saving...' : 'Save Order'}
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
            saved && !dirty ? 'text-emerald-600' : 'text-zinc-400'
          }`}>
            {saved && !dirty ? 'Saved \u2713' : dirty ? 'Unsaved changes' : `${order.length} modules`}
          </span>
        </div>

        <div className="p-3 sm:p-4 space-y-2">
          {order.map((name, idx) => {
            const m = byName[name];
            if (!m) return null;
            return (
              <div key={name}
                className="flex items-center gap-3 p-2.5 rounded-md ring-1 ring-inset ring-black/5 bg-white hover:bg-zinc-50/60 transition-colors shadow-sm">

                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <button type="button" onClick={() => moveTo(name, idx - 1)} disabled={idx === 0}
                    title="Move up"
                    className="text-zinc-400 hover:text-primary disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors">
                    <ChevronUp className="size-3.5" />
                  </button>
                  <input type="number" min={1} max={order.length} value={idx + 1}
                    onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) moveTo(name, v - 1); }}
                    className="w-9 h-6 text-center text-xs font-semibold tabular-nums rounded border border-zinc-200 bg-white text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                  <button type="button" onClick={() => moveTo(name, idx + 1)} disabled={idx === order.length - 1}
                    title="Move down"
                    className="text-zinc-400 hover:text-primary disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors">
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>

                <div className="p-1 rounded bg-zinc-50 ring-1 ring-black/5 shrink-0">
                  <img src={m.imageSource} alt="" className="size-5 object-contain" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{m.label}</p>
                  <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider truncate">{m.module_name}</p>
                </div>

                <GripVertical className="size-4 text-zinc-200 shrink-0" />
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 bg-zinc-50/50 border-t border-zinc-100 flex gap-2 text-[11px] text-zinc-500 font-medium leading-relaxed">
          <Info className="size-3.5 shrink-0 mt-0.5 text-zinc-400" />
          <span>
            Order only — a module still appears solely for roles that have permission for it in the
            <strong className="text-zinc-700 font-semibold"> Permissions</strong> tab. Profile, Notifications and
            Academic Calendar aren't listed here: they live in the header and footer, not the menu.
            Users see the new order the next time they load the dashboard.
          </span>
        </div>
      </div>
    </div>
  );
}