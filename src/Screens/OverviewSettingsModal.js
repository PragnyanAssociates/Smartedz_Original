import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Loader2, Check, LayoutDashboard, Info, CheckSquare, Square,
  ChevronUp, ChevronDown, Plus
} from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';
import { getPersona, KPI_CARDS, PANEL_CARDS, ALL_CARD_IDS, cardById, normalizeIds } from './overviewCards';

// =====================================================================
//  OverviewSettingsModal — Super Admin chooses, per role, which boxes
//  and sections appear AND in what order. Saves per-role to
//  /api/admin/overview-config. No saved config => everything on.
//
//  • Stat boxes: tick to show, set a position number (or use the arrows)
//    to order them. Each box notes who it's for.
//  • Sections: simple on/off.
//
//  Props: { instId, roles, onClose }
// =====================================================================
export default function OverviewSettingsModal({ instId, roles = [], onClose }) {
  const roleNames = useMemo(() => (roles || []).map(r => r.role_name).filter(Boolean), [roles]);

  const [configMap, setConfigMap] = useState({});
  const [selectedRole, setSelectedRole] = useState(roleNames[0] || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedRole, setSavedRole] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/overview-config/${instId}`);
        const map = res.ok ? await res.json() : {};
        if (alive) setConfigMap(map && typeof map === 'object' ? map : {});
      } catch { if (alive) setConfigMap({}); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [instId]);

  const persona = getPersona(selectedRole);

  const selectedIds = useMemo(() => {
    if (!selectedRole) return [];
    const saved = configMap[selectedRole];
    return normalizeIds(Array.isArray(saved) ? saved : ALL_CARD_IDS);
  }, [configMap, selectedRole]);

  const enabledKpi   = selectedIds.filter(id => cardById[id]?.kind === 'kpi');
  const enabledPanel = selectedIds.filter(id => cardById[id]?.kind === 'panel');
  const disabledKpi   = KPI_CARDS.filter(c => !selectedIds.includes(c.id));
  const disabledPanel = PANEL_CARDS.filter(c => !selectedIds.includes(c.id));

  const setRoleIds = (ids) => {
    setSavedRole('');
    setConfigMap(prev => ({ ...prev, [selectedRole]: normalizeIds(ids) }));
  };

  const addCard    = (id) => setRoleIds([...selectedIds, id]);
  const removeCard = (id) => setRoleIds(selectedIds.filter(x => x !== id));

  // Move a KPI to a new position (0-based) among the enabled KPIs.
  const moveKpiTo = (id, target) => {
    const arr = [...enabledKpi];
    const from = arr.indexOf(id);
    if (from < 0) return;
    const to = Math.max(0, Math.min(arr.length - 1, target));
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    setRoleIds([...arr, ...enabledPanel]);
  };

  const enableAll = () => setRoleIds([...ALL_CARD_IDS]);
  const clearAll  = () => setRoleIds([]);

  const save = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/overview-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: instId, role_name: selectedRole, card_ids: selectedIds })
      });
      if (res.ok) setSavedRole(selectedRole);
      else { const err = await res.json().catch(() => ({})); alert(err.error || 'Failed to save.'); }
    } catch (e) { alert('Failed to save.'); }
    finally { setSaving(false); }
  };

  // ---- row renderers ----
  const EnabledKpiRow = (id, idx) => {
    const c = cardById[id];
    return (
      <div key={id} className="flex items-center gap-2 p-2.5 rounded-md ring-1 ring-inset ring-primary/20 bg-primary/5 shadow-sm">
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <button type="button" onClick={() => moveKpiTo(id, idx - 1)} disabled={idx === 0}
            className="text-zinc-400 hover:text-primary disabled:opacity-30 transition-colors"><ChevronUp className="size-3.5" /></button>
          <input type="number" min={1} max={enabledKpi.length} value={idx + 1}
            onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) moveKpiTo(id, v - 1); }}
            className="w-9 h-6 text-center text-xs font-semibold tabular-nums rounded border border-zinc-200 bg-white text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
          <button type="button" onClick={() => moveKpiTo(id, idx + 1)} disabled={idx === enabledKpi.length - 1}
            className="text-zinc-400 hover:text-primary disabled:opacity-30 transition-colors"><ChevronDown className="size-3.5" /></button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 truncate">{c.label}</p>
          <p className="text-[10px] text-zinc-500 leading-snug">
            <span className="font-semibold text-primary/80 uppercase tracking-wider">{c.audience}</span>
            {' · '}{c.desc}{c.requiresModule ? ` · Needs ${c.requiresModule}` : ''}
          </p>
        </div>
        <button type="button" onClick={() => removeCard(id)} title="Remove"
          className="size-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
          <X className="size-4" />
        </button>
      </div>
    );
  };

  const AddTile = (c) => (
    <button key={c.id} type="button" onClick={() => addCard(c.id)}
      className="w-full flex items-center gap-3 p-2.5 rounded-md ring-1 ring-inset ring-black/5 bg-white hover:bg-zinc-50 text-left transition-colors shadow-sm">
      <div className="size-6 rounded-md flex items-center justify-center shrink-0 bg-zinc-100 text-zinc-500"><Plus className="size-3.5" /></div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-700 truncate">{c.label}</p>
        <p className="text-[10px] text-zinc-400 leading-snug font-medium">
          <span className="font-semibold uppercase tracking-wider">{c.audience}</span>{' · '}{c.desc}
        </p>
      </div>
    </button>
  );

  const PanelRow = (c) => {
    const on = selectedIds.includes(c.id);
    return (
      <button key={c.id} type="button" onClick={() => (on ? removeCard(c.id) : addCard(c.id))}
        className={`w-full flex items-center gap-3 p-3 rounded-md ring-1 ring-inset text-left transition-colors shadow-sm ${
          on ? 'bg-primary/5 ring-primary/30' : 'bg-white ring-black/5 hover:bg-zinc-50'
        }`}>
        <div className={`size-5 rounded flex items-center justify-center shrink-0 ${on ? 'bg-primary' : 'border border-zinc-300 bg-zinc-50'}`}>
          {on && <Check className="size-3 text-white" strokeWidth={3} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 truncate">{c.label}</p>
          <p className="text-[10px] text-zinc-500 leading-snug font-medium">
            <span className="font-semibold text-primary/80 uppercase tracking-wider">{c.audience}</span>
            {' · '}{c.desc}{c.requiresModule ? ` · Needs ${c.requiresModule}` : ''}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-0 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-4xl rounded-lg ring-1 ring-black/5 shadow-xl flex flex-col max-h-screen sm:max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">

        <div className="px-6 py-5 bg-white border-b border-zinc-100 flex items-start gap-3 shrink-0">
          <div className="size-10 rounded-md bg-primary/5 ring-1 ring-inset ring-primary/20 text-primary flex items-center justify-center shrink-0">
            <LayoutDashboard className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">Overview Settings</h2>
            <p className="text-sm text-zinc-500 font-medium mt-0.5">Pick the boxes and sections each role sees — and the order they appear in.</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 rounded-md hover:bg-zinc-100 shrink-0"><X className="size-5" /></button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20"><Loader2 className="animate-spin size-6 text-primary" /></div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-zinc-50/30">

              <div className="bg-zinc-50 ring-1 ring-inset ring-black/5 rounded-md p-4 flex gap-3 shadow-sm">
                <Info className="size-4 text-zinc-500 shrink-0 mt-0.5" />
                <div className="text-[13px] text-zinc-600 leading-relaxed font-medium">
                  <p className="font-semibold text-zinc-800 mb-1">How this works</p>
                  Every role sees <span className="font-semibold text-zinc-800">everything by default</span>. Remove what a role shouldn't see, and
                  set each box's <span className="font-semibold text-zinc-800">position number</span> (or use the arrows) to order them — e.g. push “Active Year”
                  to last. Each box shows <span className="font-semibold text-zinc-800">who it's for</span>. A box still won't appear if the role lacks
                  permission for its module, so this only narrows, never overrides, your access rules.
                </div>
              </div>

              {/* PERFECT HORIZONTAL ALIGNMENT FIX */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Configuring role</label>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <select value={selectedRole} onChange={e => { setSelectedRole(e.target.value); setSavedRole(''); }}
                    className="h-10 w-full sm:flex-1 bg-white border border-zinc-200 rounded-md px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors cursor-pointer">
                    {roleNames.map(rn => <option key={rn} value={rn}>{rn}</option>)}
                  </select>
                  
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={enableAll} className="h-10 px-3 inline-flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-md text-xs font-semibold hover:bg-zinc-50 transition-colors shadow-sm">
                      <CheckSquare className="size-3.5" /> Enable all
                    </button>
                    <button type="button" onClick={clearAll} className="h-10 px-3 inline-flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-md text-xs font-semibold hover:bg-zinc-50 transition-colors shadow-sm">
                      <Square className="size-3.5" /> Clear
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">
                  Persona: {persona} · {selectedIds.length} selected
                </p>
              </div>

              {/* Above section — ordered stat boxes */}
              <div className="pt-2">
                <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">Above Section — Stat Boxes (shown in this order)</h3>
                <div className="space-y-2">
                  {enabledKpi.length === 0 && <p className="text-xs text-zinc-400 italic px-1 font-medium">No stat boxes selected.</p>}
                  {enabledKpi.map((id, idx) => EnabledKpiRow(id, idx))}
                </div>
                {disabledKpi.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-5 mb-2">Available to add</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{disabledKpi.map(AddTile)}</div>
                  </>
                )}
              </div>

              {/* Sections */}
              <div className="pt-2">
                <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">Dashboard Sections</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[...enabledPanel.map(id => cardById[id]), ...disabledPanel].map(PanelRow)}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">{savedRole && savedRole === selectedRole ? 'Saved \u2713' : '\u00a0'}</span>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md text-xs font-semibold hover:bg-zinc-50 transition-colors shadow-sm">Close</button>
                <button type="button" onClick={save} disabled={saving || !selectedRole}
                  className="h-9 px-6 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 min-w-[140px] justify-center">
                  {saving && <Loader2 className="animate-spin size-3.5" />} Save “{selectedRole}”
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}