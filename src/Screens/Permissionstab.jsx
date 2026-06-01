import React, { useState, useEffect, useMemo } from 'react';
import { Save, Eye, EyeOff, Edit, Trash2, ShieldAlert, ChevronDown } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

export default function PermissionsTab({ data }) {
  // Pick the Super Admin role by default. Falls back to the first role if
  // for some reason Super Admin isn't present.
  const defaultRoleId = useMemo(() => {
    const sa = data.roles.find(r => r.role_name === 'Super Admin');
    return sa ? String(sa.id) : (data.roles[0] ? String(data.roles[0].id) : '');
  }, [data.roles]);

  const [selectedRoleId, setSelectedRoleId] = useState(defaultRoleId);
  const [matrix, setMatrix]                 = useState({});
  const [saving, setSaving]                 = useState(false);
  const [loadingPerms, setLoadingPerms]     = useState(false);

  // Re-apply default if the roles list refreshes (e.g. after creating a new role)
  useEffect(() => {
    if (!selectedRoleId && defaultRoleId) setSelectedRoleId(defaultRoleId);
  }, [defaultRoleId, selectedRoleId]);

  const loadPermissionsForRole = async (roleId) => {
    if (!roleId) { setMatrix({}); return; }
    setLoadingPerms(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/permissions/${roleId}`);
      const rows = await res.json();
      const m = {};
      data.modules.forEach(mod => {
        const existing = rows.find(r => r.module_name === mod);
        m[mod] = {
          can_read:   existing ? !!existing.can_read   : false,
          can_edit:   existing ? !!existing.can_edit   : false,
          can_delete: existing ? !!existing.can_delete : false,
          is_hidden:  existing ? !!existing.is_hidden  : false,
        };
      });
      setMatrix(m);
    } catch (e) {
      console.error(e);
    }
    setLoadingPerms(false);
  };

  useEffect(() => {
    loadPermissionsForRole(selectedRoleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoleId, data.modules]);

  const toggle = (mod, key) => {
    setMatrix(prev => {
      const cur = { ...prev[mod], [key]: !prev[mod][key] };
      // "Hidden" clears everything else
      if (key === 'is_hidden' && cur.is_hidden) {
        cur.can_read = cur.can_edit = cur.can_delete = false;
      }
      // Edit / Delete imply Read
      if ((key === 'can_edit' || key === 'can_delete') && cur[key] && !cur.can_read) {
        cur.can_read = true;
      }
      return { ...prev, [mod]: cur };
    });
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    const payload = {
      role_id: parseInt(selectedRoleId, 10),
      permissions: Object.entries(matrix).map(([module_name, perms]) => ({
        module_name, ...perms
      }))
    };
    try {
      const res = await fetch(`${API_BASE_URL}/admin/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) alert('Permissions saved.');
      else alert('Failed to save permissions.');
    } catch (e) { alert('Network error.'); }
    setSaving(false);
  };

  const selectedRole = data.roles.find(r => String(r.id) === String(selectedRoleId));
  const isSuperAdmin = selectedRole?.role_name === 'Super Admin';

  return (
    <div className="space-y-6">
      
      {/* Header - Fixed for Mobile */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Module Permissions</h3>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-2xl">
            Pick a role, then decide which sidebar modules they can see, read, edit or delete.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
          <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Target Role</label>
          <div className="relative w-full sm:w-auto">
            <select
              value={selectedRoleId}
              onChange={e => setSelectedRoleId(e.target.value)}
              className="h-9 w-full sm:w-48 rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors">
              {data.roles.map(r => (
                <option key={r.id} value={r.id}>{r.role_name}</option>
              ))}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {loadingPerms ? (
        <div className="h-64 flex items-center justify-center">
          <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden flex flex-col">
          
          {/* Action Bar - Stacks gracefully on mobile */}
          <div className="px-5 py-4 bg-zinc-50/50 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider">Configuring Matrix For</p>
              <p className="text-sm font-semibold text-zinc-900 mt-0.5">{selectedRole?.role_name}</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || isSuperAdmin}
              title={isSuperAdmin ? 'Super Admin always has full access — no need to save.' : ''}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shrink-0">
              <Save className="size-3.5 shrink-0" />
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>

          {/* Super Admin Notice */}
          {isSuperAdmin && (
            <div className="px-5 py-3 bg-accent/5 border-b border-accent/10 flex items-start sm:items-center gap-2 text-xs font-medium text-accent">
              <ShieldAlert className="size-4 shrink-0 mt-0.5 sm:mt-0" />
              <span className="leading-relaxed">The Super Admin role automatically has full access to every module. This matrix is read-only.</span>
            </div>
          )}

          {/* Data Table - Wrapped in a horizontally scrollable container */}
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-white">
                  <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Module</th>
                  <th className="px-5 py-3 border-b border-zinc-100 whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      <EyeOff className="size-3.5" /> Hide
                    </div>
                  </th>
                  <th className="px-5 py-3 border-b border-zinc-100 whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      <Eye className="size-3.5" /> Read
                    </div>
                  </th>
                  <th className="px-5 py-3 border-b border-zinc-100 whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      <Edit className="size-3.5" /> Edit
                    </div>
                  </th>
                  <th className="px-5 py-3 border-b border-zinc-100 whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      <Trash2 className="size-3.5" /> Delete
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.modules.map(mod => {
                  // Super Admin row always renders as fully checked (read/edit/delete on, hide off)
                  const p = isSuperAdmin
                    ? { is_hidden: false, can_read: true, can_edit: true, can_delete: true }
                    : (matrix[mod] || {});
                  const hidden = !!p.is_hidden;
                  
                  return (
                    <tr key={mod} className={`transition-colors ${hidden ? 'bg-zinc-50/50' : 'hover:bg-zinc-50/30'}`}>
                      <td className="px-5 py-3 text-xs font-semibold text-zinc-700 whitespace-nowrap">{mod}</td>
                      <td className="px-5 py-3 text-center">
                        <input type="checkbox" checked={!!p.is_hidden}
                          disabled={isSuperAdmin}
                          onChange={() => toggle(mod, 'is_hidden')}
                          className="size-3.5 accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded border-zinc-300" />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input type="checkbox" checked={!!p.can_read} disabled={hidden || isSuperAdmin}
                          onChange={() => toggle(mod, 'can_read')}
                          className="size-3.5 accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded border-zinc-300" />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input type="checkbox" checked={!!p.can_edit} disabled={hidden || isSuperAdmin}
                          onChange={() => toggle(mod, 'can_edit')}
                          className="size-3.5 accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded border-zinc-300" />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input type="checkbox" checked={!!p.can_delete} disabled={hidden || isSuperAdmin}
                          onChange={() => toggle(mod, 'can_delete')}
                          className="size-3.5 accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded border-zinc-300" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Guide */}
          <div className="px-5 py-4 bg-zinc-50/50 border-t border-zinc-100 text-[11px] text-zinc-500 font-medium leading-relaxed">
            <strong className="text-zinc-700 font-semibold">Rules:</strong> <em>Hide</em> removes the module from the user's sidebar entirely. <em>Read</em> lets them open the page. <em>Edit</em> and <em>Delete</em> reveal the matching row-action buttons and auto-enable Read.
          </div>
        </div>
      )}
    </div>
  );
}