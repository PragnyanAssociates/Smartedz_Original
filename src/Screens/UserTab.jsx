import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, X, Search, UserCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

export default function UserTab({ data, fetchData, user }) {
  const [activeRoleTab, setActiveRoleTab] = useState('all');
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [editingUser, setEditingUser]     = useState(null);
  const [search, setSearch]               = useState('');

  const emptyForm = {
    name: '', email: '', password: '', role: '',
    phone_no: '', roll_no: '', admission_no: '',
    class_id: '', section: '', status: 'active'
  };
  const [form, setForm] = useState(emptyForm);

  // Build the role-tab list: every defined role plus any role found on a user.
  const roleTabs = useMemo(() => {
    const counts = {};
    data.users.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });
    const knownRoles = data.roles.map(r => r.role_name);
    const merged = Array.from(new Set([...knownRoles, ...Object.keys(counts)]));
    return merged.map(r => ({ name: r, count: counts[r] || 0 }));
  }, [data.users, data.roles]);

  const filteredUsers = useMemo(() => {
    let list = data.users;
    if (activeRoleTab !== 'all') list = list.filter(u => u.role === activeRoleTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q));
    }
    return list;
  }, [data.users, activeRoleTab, search]);

  const openAdd = () => {
    setEditingUser(null);
    setForm({ ...emptyForm, role: data.roles[0]?.role_name || '' });
    setIsModalOpen(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setForm({
      name: u.name || '', email: u.email || '', password: u.password || '',
      role: u.role || '', phone_no: u.phone_no || '', roll_no: u.roll_no || '',
      admission_no: u.admission_no || '', class_id: u.class_id || '',
      section: u.section || '', status: u.status || 'active'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (u) => {
    if (u.role === 'Super Admin') return alert('The Super Admin account cannot be deleted from here.');
    if (!window.confirm(`Delete user "${u.name}"?`)) return;
    await fetch(`${API_BASE_URL}/admin/users/${u.id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingUser
      ? `${API_BASE_URL}/admin/users/${editingUser.id}`
      : `${API_BASE_URL}/admin/users`;
    const res = await fetch(url, {
      method: editingUser ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, institutionId: user.institutionId })
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to save user.');
    }
  };

  const isStudentRole = form.role && form.role.toLowerCase().includes('student');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between gap-4 lg:items-center">
        <h3 className="text-xl font-bold text-slate-800">User Registry</h3>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white border border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 w-72"
            />
          </div>
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
            <Plus size={18} /> Add User
          </button>
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveRoleTab('all')}
          className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
            activeRoleTab === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-300'
          }`}>
          All <span className="ml-2 opacity-60">{data.users.length}</span>
        </button>
        {roleTabs.map(t => (
          <button
            key={t.name}
            onClick={() => setActiveRoleTab(t.name)}
            className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
              activeRoleTab === t.name
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-300'
            }`}>
            {t.name} <span className="ml-2 opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="p-5">Name & Contact</th>
              <th className="p-5">Role</th>
              <th className="p-5">Class / Section</th>
              <th className="p-5">Status</th>
              <th className="p-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredUsers.length > 0 ? filteredUsers.map(u => {
              const cls = data.classes.find(c => c.id === u.class_id);
              return (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <UserCircle2 size={22} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-700">{u.name}</div>
                        <div className="text-xs font-medium text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      u.role === 'Super Admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                    }`}>{u.role}</span>
                  </td>
                  <td className="p-5 text-sm font-medium text-slate-500">
                    {cls ? `${cls.className}${u.section ? ` - ${u.section}` : ''}` : '—'}
                  </td>
                  <td className="p-5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      u.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}>{u.status || 'active'}</span>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(u)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(u)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="5" className="p-10 text-center text-slate-400 font-medium italic">No users in this view.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-8 text-slate-800">
              {editingUser ? 'Edit User' : 'Create New Account'}
            </h2>

            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                <input required className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                <input type="email" required className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                <input required className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                <select required className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                  value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="">Select a role…</option>
                  {data.roles.map(r => (
                    <option key={r.id} value={r.role_name}>{r.role_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
                <input className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                  value={form.phone_no} onChange={e => setForm({ ...form, phone_no: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                <select className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                  value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {isStudentRole && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Class</label>
                    <select className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                      value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}>
                      <option value="">Select Class</option>
                      {data.classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.className}{c.section ? ` - ${c.section}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Section</label>
                    <input className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none" placeholder="e.g. A"
                      value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Roll Number</label>
                    <input className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                      value={form.roll_no} onChange={e => setForm({ ...form, roll_no: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Admission Number</label>
                    <input className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                      value={form.admission_no} onChange={e => setForm({ ...form, admission_no: e.target.value })} />
                  </div>
                </>
              )}

              <button type="submit" className="col-span-2 bg-slate-900 hover:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-4 transition-all shadow-xl">
                {editingUser ? 'Save Changes' : 'Save User Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}