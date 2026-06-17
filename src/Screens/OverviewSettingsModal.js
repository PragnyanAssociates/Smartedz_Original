import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Check, LayoutDashboard } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';
import { getPersona, cardsForPersona, PERSONA_DEFAULTS } from './overviewCards';

// =====================================================================
//  OverviewSettingsModal — Super Admin picks which Overview cards each
//  role sees. Saves per-role to /api/admin/overview-config. A role with
//  no saved config falls back to the persona defaults (shown pre-ticked).
//
//  Props: { instId, roles, onClose }
//    roles: array of { id, role_name } (pass data.roles from the Overview)
// =====================================================================
export default function OverviewSettingsModal({ instId, roles = [], onClose }) {
  const roleNames = useMemo(
    () => (roles || []).map(r => r.role_name).filter(Boolean),
    [roles]
  );

  const [configMap, setConfigMap] = useState({});   // { role_name: [card_ids] }
  const [selectedRole, setSelectedRole] = useState(roleNames[0] || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedRole, setSavedRole] = useState('');

  // Load existing config for every role in this school.
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
  const available = cardsForPersona(persona);

  // Selected card ids for the active role: saved config, else persona default.
  const selectedIds = useMemo(() => {
    if (!selectedRole) return [];
    const saved = configMap[selectedRole];
    if (Array.isArray(saved)) return saved;
    return PERSONA_DEFAULTS[persona] || [];
  }, [configMap, selectedRole, persona]);

  const toggle = (cardId) => {
    setSavedRole('');
    setConfigMap(prev => {
      const current = Array.isArray(prev[selectedRole])
        ? prev[selectedRole]
        : (PERSONA_DEFAULTS[persona] || []);
      const next = current.includes(cardId)
        ? current.filter(id => id !== cardId)
        : [...current, cardId];
      return { ...prev, [selectedRole]: next };
    });
  };

  const save = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const card_ids = Array.isArray(configMap[selectedRole])
        ? configMap[selectedRole]
        : (PERSONA_DEFAULTS[persona] || []);
      const res = await fetch(`${API_BASE_URL}/admin/overview-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: instId, role_name: selectedRole, card_ids })
      });
      if (res.ok) setSavedRole(selectedRole);
      else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to save.');
      }
    } catch (e) { alert('Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors p-1 rounded-md hover:bg-zinc-100">
          <X className="size-5 shrink-0" />
        </button>

        <div className="mb-5 flex items-start gap-3">
          <div className="size-9 rounded-md bg-primary/5 ring-1 ring-primary/20 text-primary flex items-center justify-center shrink-0">
            <LayoutDashboard className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">Overview Settings</h2>
            <p className="text-sm text-zinc-500 font-medium">
              Choose which dashboard cards each role sees. Unsaved roles use sensible defaults.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="animate-spin size-6 text-primary" />
          </div>
        ) : (
          <>
            {/* Role selector */}
            <div className="space-y-1.5 mb-5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Role</label>
              <select
                value={selectedRole}
                onChange={e => { setSelectedRole(e.target.value); setSavedRole(''); }}
                className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm">
                {roleNames.map(rn => <option key={rn} value={rn}>{rn}</option>)}
              </select>
              <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider pt-0.5">
                Persona: {persona}
              </p>
            </div>

            {/* Card checklist */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {available.length === 0 && (
                <p className="text-sm text-zinc-400 py-6 text-center">No cards available for this role yet.</p>
              )}
              {available.map(card => {
                const on = selectedIds.includes(card.id);
                return (
                  <button key={card.id} type="button" onClick={() => toggle(card.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-md ring-1 text-left transition-colors ${
                      on ? 'bg-primary/5 ring-primary/20' : 'bg-white ring-black/5 hover:bg-zinc-50'
                    }`}>
                    <div className={`size-4 rounded flex items-center justify-center shrink-0 ${
                      on ? 'bg-primary border-primary' : 'border border-zinc-300 bg-zinc-50'
                    }`}>
                      {on && <Check className="size-2.5 text-white shrink-0" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{card.label}</p>
                      {card.requiresModule && (
                        <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                          Needs {card.requiresModule} access
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-5 flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                {savedRole && savedRole === selectedRole ? 'Saved \u2713' : '\u00a0'}
              </span>
              <div className="flex gap-3">
                <button type="button" onClick={onClose}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md text-xs font-semibold hover:bg-zinc-50 transition-colors shadow-sm">
                  Close
                </button>
                <button type="button" onClick={save} disabled={saving || !selectedRole}
                  className="h-9 px-6 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5">
                  {saving && <Loader2 className="animate-spin size-3.5" />}
                  Save “{selectedRole}”
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}