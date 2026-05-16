import React, { useState } from 'react';
import { Plus, Edit, Trash2, X, ShieldCheck, Lock } from 'lucide-react';
import { API_BASE_URL } from '../../api';

export default function RolesTab({ data, fetchData, user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]         = useState(null);
  const [roleName, setRoleName]       = useState('');

  const openAdd = () => {
    setEditing(null);
    setRoleName('');
    setIsModalOpen(true);
  };

  const openEdit = (r) => {
    if (r.role_name === 'Super Admin') return alert('The Super Admin role cannot be edited.');
    setEditing(r);
    setRoleName(r.role_name);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roleName.trim()) return;
    const url = editing
      ? `${API_BASE_URL}/admin/roles/${editing.id}`
      : `${API_BASE_URL}/admin/roles`;
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_name: roleName.trim(), institutionId: user.institutionId })
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to save role. Maybe a role with this name already exists.');
    }
  };

  const handleDelete = async (r) => {
    if (r.role_name === 'Super Admin') return alert('The Super Admin role cannot be deleted.');
    const userCount = data.users.filter(u => u.role === r.role_name).length;
    const msg = userCount > 0
      ? `${userCount} user(s) currently hold the "${r.role_name}" role. Delete anyway? Those users will keep the role name but it will no longer be selectable.`
      : `Delete role "${r.role_name}"?`;
    if (!window.confirm(msg)) return;
    const res = await fetch(`${API_BASE_URL}/admin/roles/${r.id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
    else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to delete role.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Role Definitions</h3>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Define every kind of user that exists in your institution. These roles
            become assignable in the Users screen and configurable in Permissions.
          </p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
          <Plus size={18} /> Add Role
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {data.roles.map(r => {
          const userCount = data.users.filter(u => u.role === r.role_name).length;
          const isSystem  = r.role_name === 'Super Admin';
          return (
            <div key={r.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-5">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  {isSystem ? <Lock size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(r)}
                    disabled={isSystem}
                    className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={isSystem}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h4 className="text-lg font-black text-slate-800">{r.role_name}</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-2">
                {userCount} user{userCount === 1 ? '' : 's'}
                {isSystem && <span className="ml-2 text-purple-500">• System</span>}
              </p>
            </div>
          );
        })}

        {data.roles.length === 0 && (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-bold">No roles defined yet. Click "Add Role" to start.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-2 text-slate-800">
              {editing ? 'Rename Role' : 'Create New Role'}
            </h2>
            <p className="text-sm text-slate-400 font-medium mb-8">
              {editing
                ? 'Renaming will update every user that currently holds this role.'
                : 'e.g. Teacher, Student, Librarian, Counselor, Accountant…'}
            </p>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Role Name</label>
                <input
                  required autoFocus
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none"
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                />
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl">
                {editing ? 'Save Changes' : 'Create Role'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}