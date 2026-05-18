import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, X, Search, UserCircle2, BookOpen, Camera, AtSign } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

export default function UserTab({ data, fetchData, user }) {
  const [activeRoleTab, setActiveRoleTab] = useState('all');
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [editingUser, setEditingUser]     = useState(null);
  const [search, setSearch]               = useState('');

  const emptyForm = {
    name: '', email: '', username: '', password: '', role: '',
    phone_no: '', roll_no: '', admission_no: '',
    class_id: '', section: '', status: 'active',
    dob: '', gender: '', address: '', profile_pic: '',
    subject_ids: []
  };
  const [form, setForm] = useState(emptyForm);

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
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q));
    }
    return list;
  }, [data.users, activeRoleTab, search]);

  const isoDate = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const openAdd = () => {
    setEditingUser(null);
    setForm({ ...emptyForm, role: data.roles[0]?.role_name || '' });
    setIsModalOpen(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    const subject_ids = (data.teacherSubjects && data.teacherSubjects[u.id]) || [];
    setForm({
      name: u.name || '', email: u.email || '', username: u.username || '',
      password: u.password || '', role: u.role || '',
      phone_no: u.phone_no || '', roll_no: u.roll_no || '', admission_no: u.admission_no || '',
      class_id: u.class_id || '', section: u.section || '', status: u.status || 'active',
      dob: isoDate(u.dob), gender: u.gender || '', address: u.address || '',
      profile_pic: u.profile_pic || '',
      subject_ids: subject_ids.map(String)
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (u) => {
    if (u.role === 'Super Admin') return alert('The Super Admin account cannot be deleted from here.');
    if (!window.confirm(`Delete user "${u.name}"?`)) return;
    await fetch(`${API_BASE_URL}/admin/users/${u.id}`, { method: 'DELETE' });
    fetchData();
  };

  const handlePicChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return alert('Picture must be under 3 MB.');
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, profile_pic: reader.result }));
    reader.readAsDataURL(file);
  };

  const isTeacherRole = form.role && form.role.toLowerCase().includes('teacher');
  const isStudentRole = form.role && form.role.toLowerCase().includes('student');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingUser
      ? `${API_BASE_URL}/admin/users/${editingUser.id}`
      : `${API_BASE_URL}/admin/users`;
    const payload = {
      ...form,
      institutionId: user.institutionId,
      subject_ids: isTeacherRole ? form.subject_ids : []
    };
    const res = await fetch(url, {
      method: editingUser ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to save user.');
    }
  };

  const toggleSubject = (subjectId) => {
    const id = String(subjectId);
    setForm(prev => ({
      ...prev,
      subject_ids: prev.subject_ids.includes(id)
        ? prev.subject_ids.filter(x => x !== id)
        : [...prev.subject_ids, id]
    }));
  };

  const teacherSubjectNames = (uid) => {
    const ids = (data.teacherSubjects && data.teacherSubjects[uid]) || [];
    if (ids.length === 0) return '';
    return ids.map(sid => data.subjects?.find(s => s.id === sid)?.name).filter(Boolean).join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4 lg:items-center">
        <h3 className="text-xl font-bold text-slate-800">User Registry</h3>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search name, email, username…"
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

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveRoleTab('all')}
          className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
            activeRoleTab === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-300'
          }`}>
          All <span className="ml-2 opacity-60">{data.users.length}</span>
        </button>
        {roleTabs.map(t => (
          <button key={t.name} onClick={() => setActiveRoleTab(t.name)}
            className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
              activeRoleTab === t.name ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-300'
            }`}>
            {t.name} <span className="ml-2 opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="p-5">Name & Contact</th>
              <th className="p-5">Role</th>
              <th className="p-5">Class / Subjects</th>
              <th className="p-5">Status</th>
              <th className="p-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredUsers.length > 0 ? filteredUsers.map(u => {
              const cls = data.classes.find(c => c.id === u.class_id);
              const isTeacher = (u.role || '').toLowerCase().includes('teacher');
              const isStudent = (u.role || '').toLowerCase().includes('student');
              return (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      {u.profile_pic ? (
                        <img src={u.profile_pic} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                          <UserCircle2 size={22} />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-700">{u.name}</div>
                        <div className="text-xs font-medium text-slate-400">
                          {u.email}{u.username && <span className="ml-2 text-blue-400">@{u.username}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      u.role === 'Super Admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                    }`}>{u.role}</span>
                  </td>
                  <td className="p-5 text-sm font-medium text-slate-500">
                    {isStudent && cls ? `${cls.className}${u.section ? ` - ${u.section}` : ''}`
                      : isTeacher ? (teacherSubjectNames(u.id) || <span className="italic text-slate-300">No subjects</span>)
                      : '—'}
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
              <tr><td colSpan="5" className="p-10 text-center text-slate-400 font-medium italic">No users in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-2 text-slate-800">
              {editingUser ? 'Edit User' : 'Create New Account'}
            </h2>
            <p className="text-slate-400 text-sm font-medium mb-8">Fill in all the details. The user can edit personal info later.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center gap-5">
                {form.profile_pic ? (
                  <img src={form.profile_pic} alt="preview" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-slate-100" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <UserCircle2 size={40} />
                  </div>
                )}
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition-all">
                    <Camera size={14} /> Choose Photo
                    <input type="file" accept="image/*" onChange={handlePicChange} className="hidden" />
                  </label>
                  {form.profile_pic && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, profile_pic: '' }))}
                      className="ml-2 text-xs text-red-500 font-bold">Remove</button>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">JPG/PNG · max 3 MB</p>
                </div>
              </div>

              <Section title="Account">
                <Grid>
                  <Field label="Full Name" required value={form.name} onChange={v => setForm({ ...form, name: v })} />
                  <Field label="Role" type="select" required value={form.role} onChange={v => setForm({ ...form, role: v })}
                    options={[{ value: '', label: 'Select role…' }, ...data.roles.map(r => ({ value: r.role_name, label: r.role_name }))]} />
                  <Field label="Email" type="email" required value={form.email} onChange={v => setForm({ ...form, email: v })} />
                  <Field label="Username" icon={AtSign} value={form.username} onChange={v => setForm({ ...form, username: v })} placeholder="e.g. sagar" />
                  <Field label="Password" required value={form.password} onChange={v => setForm({ ...form, password: v })} />
                  <Field label="Status" type="select" value={form.status} onChange={v => setForm({ ...form, status: v })}
                    options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
                </Grid>
              </Section>

              <Section title="Personal Information">
                <Grid>
                  <Field label="Date of Birth" type="date" value={form.dob} onChange={v => setForm({ ...form, dob: v })} />
                  <Field label="Gender" type="select" value={form.gender} onChange={v => setForm({ ...form, gender: v })}
                    options={[{ value: '', label: 'Select…' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]} />
                  <Field label="Phone" value={form.phone_no} onChange={v => setForm({ ...form, phone_no: v })} />
                </Grid>
                <Field label="Address" type="textarea" value={form.address} onChange={v => setForm({ ...form, address: v })} />
              </Section>

              {isTeacherRole && (
                <Section title="Teaching Subjects" accent="blue">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={14} className="text-blue-600" />
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Pick all that this teacher will teach</span>
                    <span className="ml-auto text-[11px] font-bold text-blue-600 bg-white px-2.5 py-0.5 rounded-full">{form.subject_ids.length} selected</span>
                  </div>
                  {(data.subjects || []).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      No subjects created yet. Open <strong>Timetable → Subjects</strong> first.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.subjects.map(s => {
                        const id = String(s.id);
                        const selected = form.subject_ids.includes(id);
                        return (
                          <button type="button" key={s.id} onClick={() => toggleSubject(s.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                              selected ? 'bg-blue-600 text-white shadow shadow-blue-200'
                                       : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
                            }`}>
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Section>
              )}

              {isStudentRole && (
                <Section title="Academic Details" accent="emerald">
                  <Grid>
                    <Field label="Class" type="select" value={form.class_id} onChange={v => setForm({ ...form, class_id: v })}
                      options={[{ value: '', label: 'Select class' }, ...data.classes.map(c => ({
                        value: c.id, label: `${c.className}${c.section ? ' - ' + c.section : ''}`
                      }))]} />
                    <Field label="Section" value={form.section} onChange={v => setForm({ ...form, section: v })} placeholder="e.g. A" />
                    <Field label="Roll Number" value={form.roll_no} onChange={v => setForm({ ...form, roll_no: v })} />
                    <Field label="Admission Number" value={form.admission_no} onChange={v => setForm({ ...form, admission_no: v })} />
                  </Grid>
                </Section>
              )}

              <button type="submit" className="w-full bg-slate-900 hover:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-2 transition-all shadow-xl">
                {editingUser ? 'Save Changes' : 'Save User Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, accent = 'slate', children }) {
  const accentMap = {
    slate:   'bg-slate-50 border-slate-100',
    blue:    'bg-blue-50/40 border-blue-100',
    emerald: 'bg-emerald-50/40 border-emerald-100'
  };
  return (
    <div className={`${accentMap[accent]} border rounded-2xl p-5 space-y-4`}>
      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</div>
      {children}
    </div>
  );
}
function Grid({ children }) { return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>; }
function Field({ label, value, onChange, type = 'text', icon: Icon, options, required, placeholder }) {
  const baseCls = "w-full bg-white border border-slate-100 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/10 text-sm";
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
        {Icon && <Icon size={10} />} {label}{required && <span className="text-red-500">*</span>}
      </label>
      {type === 'select' ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={baseCls + ' cursor-pointer'}>
          {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={2} className={baseCls + ' resize-none'} placeholder={placeholder} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder} className={baseCls} />
      )}
    </div>
  );
}