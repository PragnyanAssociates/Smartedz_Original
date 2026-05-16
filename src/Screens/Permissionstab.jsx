import React, { useState, useEffect, useMemo } from 'react';
import { Save, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Module Permissions</h3>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Pick a role, then decide which sidebar modules they can see, read, edit or delete.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
          <select
            value={selectedRoleId}
            onChange={e => setSelectedRoleId(e.target.value)}
            className="bg-white border border-slate-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/10 min-w-[200px]">
            {data.roles.map(r => (
              <option key={r.id} value={r.id}>{r.role_name}</option>
            ))}
          </select>
        </div>
      </div>

      {loadingPerms ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-blue-50/50 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Configuring</p>
              <p className="text-lg font-black text-slate-800">{selectedRole?.role_name}</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || isSuperAdmin}
              title={isSuperAdmin ? 'Super Admin always has full access — no need to save.' : ''}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
              <Save size={16} />
              {saving ? 'Saving…' : 'Save Permissions'}
            </button>
          </div>

          {isSuperAdmin && (
            <div className="px-6 py-3 bg-purple-50/60 border-b border-purple-100 text-xs font-bold text-purple-700">
              The Super Admin role automatically has full access to every module. This screen is read-only for Super Admin.
            </div>
          )}

          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-5">Module</th>
                <th className="p-5 text-center"><div className="flex flex-col items-center gap-1"><EyeOff size={14} /> Hide</div></th>
                <th className="p-5 text-center"><div className="flex flex-col items-center gap-1"><Eye size={14} /> Read</div></th>
                <th className="p-5 text-center"><div className="flex flex-col items-center gap-1"><Edit size={14} /> Edit</div></th>
                <th className="p-5 text-center"><div className="flex flex-col items-center gap-1"><Trash2 size={14} /> Delete</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.modules.map(mod => {
                // Super Admin row always renders as fully checked (read/edit/delete on, hide off)
                const p = isSuperAdmin
                  ? { is_hidden: false, can_read: true, can_edit: true, can_delete: true }
                  : (matrix[mod] || {});
                const hidden = !!p.is_hidden;
                return (
                  <tr key={mod} className={`transition-colors ${hidden ? 'bg-slate-50/50' : 'hover:bg-slate-50/50'}`}>
                    <td className="p-5 font-bold text-slate-700">{mod}</td>
                    <td className="p-5 text-center">
                      <input type="checkbox" checked={!!p.is_hidden}
                        disabled={isSuperAdmin}
                        onChange={() => toggle(mod, 'is_hidden')}
                        className="w-5 h-5 accent-rose-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" />
                    </td>
                    <td className="p-5 text-center">
                      <input type="checkbox" checked={!!p.can_read} disabled={hidden || isSuperAdmin}
                        onChange={() => toggle(mod, 'can_read')}
                        className="w-5 h-5 accent-blue-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" />
                    </td>
                    <td className="p-5 text-center">
                      <input type="checkbox" checked={!!p.can_edit} disabled={hidden || isSuperAdmin}
                        onChange={() => toggle(mod, 'can_edit')}
                        className="w-5 h-5 accent-amber-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" />
                    </td>
                    <td className="p-5 text-center">
                      <input type="checkbox" checked={!!p.can_delete} disabled={hidden || isSuperAdmin}
                        onChange={() => toggle(mod, 'can_delete')}
                        className="w-5 h-5 accent-red-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 font-medium">
            <strong className="text-slate-700">Rules:</strong> <em>Hide</em> removes the module from the user's sidebar entirely. <em>Read</em> lets them open the page. <em>Edit</em> and <em>Delete</em> reveal the matching row-action buttons and auto-enable Read.
          </div>
        </div>
      )}
    </div>
  );
}