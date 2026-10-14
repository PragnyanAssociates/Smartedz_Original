import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RotateCcw, ListOrdered, Info, GripVertical } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';
import { MODULES } from './Modules';

// =====================================================================
//  MenuOrderTab  (shown as "Menu Settings")
//  Super Admin controls two things for their school's sidebar:
//    1. ORDER  — drag any row (by its handle) to reorder; auto-saves.
//    2. NAME   — type an Alias on the right to rename a module for the
//               whole school. Blank = the default (developer) name.
//  Both live on the module_order table (one row per module, carrying
//  sort_order + alias). Whether a role SEES a module is still decided
//  entirely by the Permissions tab.
//
//  Props: { user }
// =====================================================================

const ORDERABLE = MODULES.filter(m => !m.hideFromSidebar);
const DEFAULT_ORDER = ORDERABLE.map(m => m.module_name);
const byName = ORDERABLE.reduce((a, m) => { a[m.module_name] = m; return a; }, {});

const mergeWithDefaults = (saved) => {
  const known = (saved || []).filter(n => byName[n]);
  const rest = DEFAULT_ORDER.filter(n => !known.includes(n));
  return [...known, ...rest];
};

export default function MenuOrderTab({ user }) {
  const [order, setOrder]     = useState(DEFAULT_ORDER);
  const [initial, setInitial] = useState(DEFAULT_ORDER);
  const [aliases, setAliases]               = useState({});   // module_name -> alias
  const [initialAliases, setInitialAliases] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const [dragName, setDragName] = useState(null);
  const [overName, setOverName] = useState(null);

  const orderRef   = useRef(order);
  const aliasesRef = useRef(aliases);
  useEffect(() => { orderRef.current = order; }, [order]);

  const fmtSaved = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  useEffect(() => {
    if (!user?.institutionId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/module-order/${user.institutionId}`);
        const rows = res.ok ? await res.json() : [];
        const names = Array.isArray(rows) ? rows.map(r => r.module_name) : [];
        const merged = mergeWithDefaults(names);
        const al = {};
        (Array.isArray(rows) ? rows : []).forEach(r => { if (r.alias) al[r.module_name] = r.alias; });
        const times = Array.isArray(rows)
          ? rows.map(r => (r.updated_at ? new Date(r.updated_at).getTime() : 0)).filter(Boolean) : [];
        const latest = times.length ? Math.max(...times) : null;
        if (alive) {
          setOrder(merged); setInitial(merged);
          setAliases(al); setInitialAliases(al); aliasesRef.current = al;
          setLastSaved(latest ? new Date(latest).toISOString() : null);
        }
      } catch (e) { console.error('Menu settings fetch error:', e); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.institutionId]);

  const dirty = useMemo(
    () => order.join('|') !== initial.join('|') || JSON.stringify(aliases) !== JSON.stringify(initialAliases),
    [order, initial, aliases, initialAliases]
  );

  // Persist order + aliases together. Pass the order explicitly on a drop
  // so we don't wait on a state flush; aliases always come from the ref.
  const save = async (ord) => {
    const payloadOrder = ord || orderRef.current;
    const payloadAliases = aliasesRef.current;
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/module-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, order: payloadOrder, aliases: payloadAliases })
      });
      if (res.ok) {
        setInitial(payloadOrder);
        setInitialAliases({ ...payloadAliases });
        setSaved(true);
        setLastSaved(new Date().toISOString());
      } else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'Failed to save the menu settings.');
      }
    } catch (e) { alert('Network error.'); }
    setSaving(false);
  };

  const resetDefault = () => {
    setSaved(false);
    setOrder(DEFAULT_ORDER);
    setAliases({}); aliasesRef.current = {};
    save(DEFAULT_ORDER);
  };

  // ---- alias editing --------------------------------------------------
  const setAlias = (name, val) => {
    setSaved(false);
    setAliases(prev => { const next = { ...prev, [name]: val }; aliasesRef.current = next; return next; });
  };
  const onAliasBlur = (name) => {
    if ((aliases[name] || '') !== (initialAliases[name] || '')) save();
  };

  // ---- drag to reorder (handle only, so typing in the alias works) ----
  const handleDragStart = (e, name) => {
    setDragName(name); setSaved(false);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', name); } catch (_) {}
  };
  const handleDragOver = (e, name) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (name !== overName) setOverName(name);
  };
  const handleDragLeave = (name) => { if (name === overName) setOverName(null); };
  const handleDrop = (e, targetName) => {
    e.preventDefault();
    const from = order.indexOf(dragName);
    const to   = order.indexOf(targetName);
    setOverName(null); setDragName(null);
    if (!dragName || from < 0 || to < 0 || from === to) return;
    const arr = [...order];
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    setOrder(arr);
    save(arr);
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
          <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Menu Settings</h3>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-2xl">
            Arrange the sidebar and rename modules for your school. Drag a row to reorder it.
            The name on the left is the default; type an <strong className="text-zinc-700 font-semibold">Alias</strong> on
            the right to show a different name to everyone here. Changes save automatically.
          </p>
          {lastSaved && (
            <p className="text-[11px] text-zinc-400 mt-1">
              Last saved: <span className="font-medium text-zinc-500">{fmtSaved(lastSaved)}</span>
            </p>
          )}
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
            <p className="text-sm font-semibold text-zinc-900 truncate">Sidebar — order &amp; names</p>
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
            saving ? 'text-primary' : (saved && !dirty) ? 'text-emerald-600' : 'text-zinc-400'
          }`}>
            {saving ? 'Saving...' : (saved && !dirty) ? 'Saved' : `${order.length} modules`}
          </span>
        </div>

        {/* column hints */}
        <div className="px-3 sm:px-4 pt-3 flex items-center gap-3">
          <span className="w-7 shrink-0" />
          <span className="p-1 shrink-0 w-7" />
          <span className="flex-1 text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Default name</span>
          <span className="w-40 sm:w-56 shrink-0 text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Alias (shown to everyone)</span>
          <span className="w-6 shrink-0" />
        </div>

        <div className="p-3 sm:p-4 space-y-2">
          {order.map((name, idx) => {
            const m = byName[name];
            if (!m) return null;
            const isDragging = dragName === name;
            const isOver = overName === name && dragName && dragName !== name;
            return (
              <div key={name}
                onDragOver={(e) => handleDragOver(e, name)}
                onDragLeave={() => handleDragLeave(name)}
                onDrop={(e) => handleDrop(e, name)}
                className={`flex items-center gap-3 p-2.5 rounded-md ring-1 ring-inset bg-white transition-all shadow-sm ${
                  isDragging ? 'opacity-40 ring-primary/40' : 'ring-black/5'
                } ${isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}>

                <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-semibold tabular-nums">
                  {idx + 1}
                </span>

                <div className="p-1 rounded bg-zinc-50 ring-1 ring-black/5 shrink-0">
                  <img src={m.imageSource} alt="" className="size-5 object-contain" />
                </div>

                {/* left: default name */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{m.label}</p>
                  <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider truncate">{m.module_name}</p>
                </div>

                {/* right: alias */}
                <div className="w-40 sm:w-56 shrink-0">
                  <input
                    value={aliases[name] || ''}
                    onChange={(e) => setAlias(name, e.target.value)}
                    onBlur={() => onAliasBlur(name)}
                    maxLength={100}
                    placeholder={m.label}
                    className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                  />
                </div>

                {/* drag handle */}
                <span draggable
                  onDragStart={(e) => handleDragStart(e, name)}
                  onDragEnd={handleDragEnd}
                  title="Drag to reorder"
                  className="cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 shrink-0 p-1 select-none">
                  <GripVertical className="size-4" />
                </span>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 bg-zinc-50/50 border-t border-zinc-100 flex gap-2 text-[11px] text-zinc-500 font-medium leading-relaxed">
          <Info className="size-3.5 shrink-0 mt-0.5 text-zinc-400" />
          <span>
            A module still appears solely for roles that have permission for it in the
            <strong className="text-zinc-700 font-semibold"> Permissions</strong> tab — this screen only sets the
            order and the name shown. Leave an alias blank to use the default name. Profile, Notifications and
            Academic Calendar are not listed here. Users see the new order and names the next time they load the dashboard.
          </span>
        </div>
      </div>
    </div>
  );
}