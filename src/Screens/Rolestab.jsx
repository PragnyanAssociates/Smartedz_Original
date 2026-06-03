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
      return alert(`Cannot delete "${r.role_name}" - ${usersInRole} user(s) still assigned. Reassign them first.`);
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
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header - Fixed for Mobile */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-start mb-6 shrink-0">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Role Definitions</h3>
          <p className="text-sm text-zinc-500 max-w-2xl mt-1">
            Define every kind of user that exists in your institution. These roles become assignable
            in the Users screen and configurable in Permissions.
          </p>
        </div>
        <button onClick={openAdd}
          className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 shrink-0 w-full sm:w-auto">
          <Plus className="size-4 shrink-0" /> Add Role
        </button>
      </div>

      {/* Main Grid Layout (Boxes) */}
      {sortedRoles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedRoles.map(r => {
            const locked = isRoleSystem(r.role_name);
            const count  = userCount[r.role_name] || 0;
            return (
              <div key={r.id} className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 flex flex-col relative group hover:ring-black/10 transition-all duration-200 overflow-hidden">
                
                {/* Header Row: Icon & Actions */}
                <div className="flex justify-between items-start mb-4">
                  <div className={`size-10 rounded-md flex items-center justify-center shrink-0 ring-1 ring-inset ${locked ? 'bg-zinc-50 text-zinc-400 ring-black/5' : 'bg-primary/5 text-primary ring-primary/20'}`}>
                    {locked ? <Lock className="size-5" /> : <ShieldCheck className="size-5" />}
                  </div>

                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(r)}
                      disabled={locked}
                      className={`p-1.5 rounded-md transition-colors ${
                        locked ? 'text-zinc-300 cursor-not-allowed' : 'text-zinc-400 hover:text-primary hover:bg-zinc-50'
                      }`}
                      title={locked ? 'System roles cannot be edited' : 'Edit'}>
                      <Edit className="size-4 shrink-0" />
                    </button>
                    <button
                      onClick={() => handleDelete(r)}
                      disabled={locked}
                      className={`p-1.5 rounded-md transition-colors ${
                        locked ? 'text-zinc-300 cursor-not-allowed' : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                      }`}
                      title={locked ? 'System roles cannot be deleted' : 'Delete'}>
                      <Trash2 className="size-4 shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Role Name */}
                <div className="mb-6">
                  <h4 className="text-base font-semibold text-zinc-900 tracking-tight line-clamp-1" title={r.role_name}>
                    {r.role_name}
                  </h4>
                </div>

                {/* Footer Row: Badge & Users */}
                <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center justify-between">
                  {locked ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200 uppercase tracking-wider whitespace-nowrap">
                      System Built-in
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 uppercase tracking-wider whitespace-nowrap">
                      Custom Role
                    </span>
                  )}
                  
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 tabular-nums whitespace-nowrap">
                    <Users className="size-4 text-zinc-400" />
                    <span>{count} User{count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center min-h-[300px]">
          <ShieldCheck className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 font-medium text-sm">No roles defined yet.</p>
          <p className="text-zinc-400 text-xs mt-1">Click "Add Role" to create your first role.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-sm p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors p-1 rounded-md hover:bg-zinc-100">
              <X className="size-5 shrink-0" />
            </button>
            
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-zinc-900 mb-1 tracking-tight">
                {editingRole ? 'Rename Role' : 'Add New Role'}
              </h2>
              <p className="text-sm text-zinc-500 font-medium">
                {editingRole
                  ? 'Existing users with this role will be updated automatically.'
                  : 'Create a custom role. System roles are already in place.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Coordinator"
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  required
                  className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                />
                {isSystem(roleName.trim()) && (
                  <p className="mt-1.5 text-[10px] text-red-500 font-semibold uppercase tracking-wider">
                    "{roleName.trim()}" is a reserved system role name.
                  </p>
                )}
              </div>

              <div className="bg-zinc-50 ring-1 ring-inset ring-black/5 rounded-md p-4 text-[11px] font-medium text-zinc-500 mt-4 leading-relaxed">
                <div className="flex items-center gap-1.5 mb-1.5 text-zinc-700 font-semibold uppercase tracking-wider">
                  <Lock className="size-3.5" /> System roles are protected
                </div>
                Super Admin, Student, and Teacher exist in every school and cannot be renamed or
                deleted. They guarantee a stable foundation for core modules.
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} 
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md text-xs font-semibold hover:bg-zinc-50 transition-colors w-full sm:w-auto shadow-sm">
                  Cancel
                </button>
                <button type="submit"
                  className="h-9 px-6 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold shadow-sm transition-colors w-full sm:w-auto">
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