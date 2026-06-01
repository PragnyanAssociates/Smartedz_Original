import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, X, ShieldCheck, Lock, Users } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

const SYSTEM_ROLES = ['Super Admin', 'Student', 'Teacher'];
const isSystem = (name) => SYSTEM_ROLES.includes(name);

export default function RolesTab({ data, fetchData, user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleName, setRoleName]       = useState('');

  const systemRoles = data.systemRoles && data.systemRoles.length ? data.systemRoles : SYSTEM_ROLES;
  const isRoleSystem = (name) => systemRoles.includes(name);

  const sortedRoles = useMemo(() => {
    const sys = [];
    const custom = [];
    (data.roles || []).forEach(r => {
      if (isRoleSystem(r.role_name)) sys.push(r);
      else custom.push(r);
    });
    sys.sort((a, b) => systemRoles.indexOf(a.role_name) - systemRoles.indexOf(b.role_name));
    custom.sort((a, b) => a.role_name.localeCompare(b.role_name));
    return [...sys, ...custom];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.roles]);

  const userCount = useMemo(() => {
    const map = {};
    (data.users || []).forEach(u => { map[u.role] = (map[u.role] || 0) + 1; });
    return map;
  }, [data.users]);

  const openAdd = () => {
    setEditingRole(null);
    setRoleName('');
    setIsModalOpen(true);
  };

  const openEdit = (r) => {
    if (isRoleSystem(r.role_name)) return;
    setEditingRole(r);
    setRoleName(r.role_name);
    setIsModalOpen(true);
  };

  const handleDelete = async (r) => {
    if (isRoleSystem(r.role_name)) {
      return alert(`"${r.role_name}" is a system role and cannot be deleted.`);
    }
    const usersInRole = userCount[r.role_name] || 0;
    if (usersInRole > 0) {
      return alert(`Cannot delete "${r.role_name}" — ${usersInRole} user(s) still assigned. Reassign them first.`);
    }
    if (!window.confirm(`Delete the role "${r.role_name}"?`)) return;
    const res = await fetch(`${API_BASE_URL}/admin/roles/${r.id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
    else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to delete role.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = roleName.trim();
    if (!trimmed) return alert('Role name is required.');
    if (isRoleSystem(trimmed)) return alert(`"${trimmed}" is a reserved system role name.`);

    const url = editingRole
      ? `${API_BASE_URL}/admin/roles/${editingRole.id}`
      : `${API_BASE_URL}/admin/roles`;
    const payload = { role_name: trimmed, institutionId: user.institutionId };
    const res = await fetch(url, {
      method: editingRole ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to save role.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header - Fixed for Mobile */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Role Definitions</h3>
          <p className="text-[11px] text-zinc-500 max-w-2xl mt-1">
            Define every kind of user that exists in your institution. These roles become assignable
            in the Users screen and configurable in Permissions.
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm shrink-0 w-fit self-start sm:self-auto">
          <Plus className="size-3.5 shrink-0" /> Add Role
        </button>
      </div>

      {/* Main Table Layout - Fixed Mobile Scroll Overflow */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-zinc-50/50">
              <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Role Definition</th>
              <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Type</th>
              <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Current Assignment</th>
              <th className="px-5 py-3 border-b border-zinc-100"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedRoles.length > 0 ? sortedRoles.map(r => {
              const locked = isRoleSystem(r.role_name);
              const count  = userCount[r.role_name] || 0;
              return (
                <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded flex items-center justify-center shrink-0 ring-1 ring-black/5 ${
                        locked ? 'bg-zinc-50 text-zinc-400' : 'bg-primary/5 text-primary'
                      }`}>
                        {locked ? <Lock className="size-4" /> : <ShieldCheck className="size-4" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-900">{r.role_name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {locked ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 whitespace-nowrap">
                        System Built-in
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary ring-1 ring-primary/20 whitespace-nowrap">
                        Custom Role
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 tabular-nums whitespace-nowrap">
                      <Users className="size-3.5 text-zinc-400" />
                      {count} User{count !== 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(r)}
                        disabled={locked}
                        className={`p-1.5 rounded transition-colors ${
                          locked ? 'text-zinc-200 cursor-not-allowed' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50'
                        }`}
                        title={locked ? 'System roles cannot be edited' : 'Edit'}>
                        <Edit className="size-4 shrink-0" />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={locked}
                        className={`p-1.5 rounded transition-colors ${
                          locked ? 'text-zinc-200 cursor-not-allowed' : 'text-zinc-400 hover:text-accent hover:bg-accent/10'
                        }`}
                        title={locked ? 'System roles cannot be deleted' : 'Delete'}>
                        <Trash2 className="size-4 shrink-0" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan="4" className="px-5 py-8 text-center text-xs text-zinc-500 italic">No roles defined yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-sm p-6 shadow-xl relative">
            <button onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors">
              <X className="size-5 shrink-0" />
            </button>
            
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-zinc-900 mb-1">
                {editingRole ? 'Rename Role' : 'Add New Role'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                {editingRole
                  ? 'Existing users with this role will be updated automatically.'
                  : 'Create a custom role. System roles are already in place.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1.5 block">
                  Role Name <span className="text-accent">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Coordinator"
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                />
                {isSystem(roleName.trim()) && (
                  <p className="mt-1.5 text-[10px] text-accent font-medium">
                    "{roleName.trim()}" is a reserved system role name.
                  </p>
                )}
              </div>

              <div className="bg-zinc-50 ring-1 ring-black/5 rounded-md p-4 text-[11px] text-zinc-500 mt-4">
                <div className="flex items-center gap-1.5 mb-1.5 text-zinc-700 font-semibold">
                  <Lock className="size-3" /> System roles are protected
                </div>
                Super Admin, Student, and Teacher exist in every school and cannot be renamed or
                deleted. They guarantee a stable foundation for core modules.
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="bg-primary text-white px-6 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}