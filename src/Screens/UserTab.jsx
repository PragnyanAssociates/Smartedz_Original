import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, X, Search, UserCircle2, BookOpen, Camera, AtSign, GraduationCap, ChevronDown } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

export default function UserTab({ data, fetchData, user }) {
  const [activeRoleTab, setActiveRoleTab] = useState('all');
  const [activeClass, setActiveClass]     = useState('all');
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

  const activeUsers = useMemo(
    () => data.users.filter(u => (u.status || '').toLowerCase() !== 'alumni'),
    [data.users]
  );

  const roleTabs = useMemo(() => {
    const counts = {};
    activeUsers.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });
    const knownRoles = data.roles.map(r => r.role_name);
    const merged = Array.from(new Set([...knownRoles, ...Object.keys(counts)]));
    return merged.map(r => ({ name: r, count: counts[r] || 0 }));
  }, [activeUsers, data.roles]);

  const classFilters = useMemo(() => {
    const counts = {};
    activeUsers.forEach(u => {
      if (u.class_id) counts[u.class_id] = (counts[u.class_id] || 0) + 1;
    });
    return (data.classes || []).map(c => ({
      id: c.id,
      label: `${c.className}${c.section ? ` - ${c.section}` : ''}`,
      count: counts[c.id] || 0
    }));
  }, [activeUsers, data.classes]);

  const showClassFilter = useMemo(() => {
    if (classFilters.length === 0) return false;
    if (activeRoleTab === 'all') return true;
    return activeRoleTab.toLowerCase().includes('student');
  }, [classFilters, activeRoleTab]);

  const filteredUsers = useMemo(() => {
    let list = activeUsers;
    if (activeRoleTab !== 'all') list = list.filter(u => u.role === activeRoleTab);
    if (activeClass !== 'all') {
      list = list.filter(u => String(u.class_id) === String(activeClass));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q));
    }
    return list;
  }, [activeUsers, activeRoleTab, activeClass, search]);

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

  const handleRoleTab = (roleName) => {
    setActiveRoleTab(roleName);
    if (roleName !== 'all' && !roleName.toLowerCase().includes('student')) {
      setActiveClass('all');
    }
  };

  const useDropdown = classFilters.length > 6;

  return (
    <div className="space-y-6">
      
      {/* Top action bar - Fixed Mobile Responsive Widths */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center mb-6">
        <div className="relative w-full sm:w-auto flex-1 max-w-sm">
          <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0 pointer-events-none" />
          <input
            placeholder="Search name, email, username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm bg-white border border-zinc-200 rounded-md pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-zinc-900 placeholder:text-zinc-400 transition-colors shadow-sm"
          />
        </div>
        <button onClick={openAdd} className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-sm w-fit shrink-0 self-start sm:self-auto">
          <Plus className="size-3.5 shrink-0" /> New User
        </button>
      </div>

      {/* Filters Area */}
      <div className="flex flex-col gap-4">
        
        {/* Role tabs */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleRoleTab('all')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              activeRoleTab === 'all' 
                ? 'bg-primary/10 text-primary ring-1 ring-primary/20' 
                : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
            }`}>
            All <span className="ml-1 opacity-80 tabular-nums">{activeUsers.length}</span>
          </button>
          {roleTabs.map(t => (
            <button key={t.name} onClick={() => handleRoleTab(t.name)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                activeRoleTab === t.name 
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/20' 
                  : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
              }`}>
              {t.name} <span className="ml-1 opacity-80 tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Class filters */}
        {showClassFilter && (
          <div className="flex items-center gap-3 flex-wrap bg-zinc-50/50 p-2.5 rounded-md ring-1 ring-black/5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">
              <GraduationCap className="size-3.5 shrink-0" /> Class Filter
            </span>

            {useDropdown ? (
              <div className="relative w-full sm:w-auto">
                <select
                  value={activeClass}
                  onChange={e => setActiveClass(e.target.value)}
                  className="h-8 w-full sm:w-auto appearance-none rounded border border-zinc-200 bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
                  <option value="all">All Classes ({classFilters.reduce((s, c) => s + c.count, 0)})</option>
                  {classFilters.map(c => (
                    <option key={c.id} value={c.id}>{c.label} ({c.count})</option>
                  ))}
                </select>
                <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveClass('all')}
                  className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    activeClass === 'all' 
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/20' 
                      : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
                  }`}>
                  All <span className="ml-1 opacity-80 tabular-nums">{classFilters.reduce((s, c) => s + c.count, 0)}</span>
                </button>
                {classFilters.map(c => (
                  <button key={c.id} onClick={() => setActiveClass(String(c.id))}
                    className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                      String(activeClass) === String(c.id) 
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20' 
                        : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
                    }`}>
                    {c.label} <span className="ml-1 opacity-80 tabular-nums">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Table - Fixed Mobile Scroll Overflow */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-zinc-50/50">
              <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">User Details</th>
              <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Role</th>
              <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Assignment</th>
              <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">Status</th>
              <th className="px-5 py-3 border-b border-zinc-100"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredUsers.length > 0 ? filteredUsers.map(u => {
              const cls = data.classes.find(c => c.id === u.class_id);
              const isTeacher = (u.role || '').toLowerCase().includes('teacher');
              const isStudent = (u.role || '').toLowerCase().includes('student');
              return (
                <tr key={u.id} className="hover:bg-zinc-50/60 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {u.profile_pic ? (
                        <img src={u.profile_pic} alt={u.name} className="size-8 rounded-full object-cover shrink-0 ring-1 ring-black/5" />
                      ) : (
                        <div className="size-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 shrink-0 ring-1 ring-black/5">
                          <UserCircle2 className="size-4" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-900">{u.name}</span>
                        <span className="text-[10px] text-zinc-500">
                          {u.email}{u.username && <span className="ml-1 text-zinc-400">@{u.username}</span>}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${
                      u.role === 'Super Admin' ? 'bg-primary/10 text-primary ring-primary/20' : 'bg-zinc-50 text-zinc-700 ring-zinc-200'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-700">
                    {isStudent && cls ? `${cls.className}${u.section ? ` - ${u.section}` : ''}`
                      : isTeacher ? (teacherSubjectNames(u.id) || <span className="italic text-zinc-400">Unassigned</span>)
                      : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${
                      u.status === 'active' ? 'bg-green-50 text-green-700 ring-green-600/10' : 'bg-zinc-50 text-zinc-600 ring-zinc-600/10'
                    }`}>{u.status || 'active'}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded transition-colors">
                        <Edit className="size-4 shrink-0" />
                      </button>
                      <button onClick={() => handleDelete(u)} className="p-1.5 text-zinc-400 hover:text-accent rounded transition-colors">
                        <Trash2 className="size-4 shrink-0" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan="5" className="px-5 py-8 text-center text-xs text-zinc-500 italic">No users found in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-3xl p-6 shadow-xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors">
              <X className="size-5 shrink-0" />
            </button>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-zinc-900">
                {editingUser ? 'Edit User Record' : 'Create New User'}
              </h2>
              <p className="text-[11px] text-zinc-500 mt-1">Fill in the required information. Users can update personal details later.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Photo Upload */}
              <div className="flex items-center gap-4">
                {form.profile_pic ? (
                  <img src={form.profile_pic} alt="preview" className="size-16 rounded-full object-cover ring-1 ring-black/5" />
                ) : (
                  <div className="size-16 rounded-full bg-zinc-50 ring-1 ring-black/5 flex items-center justify-center text-zinc-400">
                    <UserCircle2 className="size-8" />
                  </div>
                )}
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 text-zinc-700 px-3 py-1.5 border border-zinc-200 rounded text-xs font-medium hover:bg-zinc-50 transition-colors">
                      <Camera className="size-3.5 shrink-0" /> Upload Photo
                      <input type="file" accept="image/*" onChange={handlePicChange} className="hidden" />
                    </label>
                    {form.profile_pic && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, profile_pic: '' }))} className="text-xs font-medium text-accent hover:underline">
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400">JPG/PNG · max 3 MB</p>
                </div>
              </div>

              <Section title="Account Credentials">
                <Grid>
                  <Field label="Full Name" required value={form.name} onChange={v => setForm({ ...form, name: v })} />
                  <Field label="Role" type="select" required value={form.role} onChange={v => setForm({ ...form, role: v })}
                    options={[{ value: '', label: 'Select role...' }, ...data.roles.map(r => ({ value: r.role_name, label: r.role_name }))]} />
                  <Field label="Email Address" type="email" required value={form.email} onChange={v => setForm({ ...form, email: v })} />
                  <Field label="Username" value={form.username} onChange={v => setForm({ ...form, username: v })} placeholder="e.g. jsmith" />
                  <Field label="Password" required value={form.password} onChange={v => setForm({ ...form, password: v })} />
                  <Field label="Account Status" type="select" value={form.status} onChange={v => setForm({ ...form, status: v })}
                    options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'alumni', label: 'Alumni' }]} />
                </Grid>
              </Section>

              <Section title="Personal Information">
                <Grid>
                  <Field label="Date of Birth" type="date" value={form.dob} onChange={v => setForm({ ...form, dob: v })} />
                  <Field label="Gender" type="select" value={form.gender} onChange={v => setForm({ ...form, gender: v })}
                    options={[{ value: '', label: 'Select...' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]} />
                  <Field label="Phone Number" value={form.phone_no} onChange={v => setForm({ ...form, phone_no: v })} />
                </Grid>
                <div className="mt-4">
                  <Field label="Full Address" type="textarea" value={form.address} onChange={v => setForm({ ...form, address: v })} />
                </div>
              </Section>

              {isTeacherRole && (
                <Section title="Teaching Assignments">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] text-zinc-500">Select all subjects this teacher is qualified to teach.</p>
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full tabular-nums">{form.subject_ids.length} selected</span>
                  </div>
                  {(data.subjects || []).length === 0 ? (
                    <p className="text-xs text-accent bg-accent/5 p-3 rounded border border-accent/20">
                      No subjects available. Configure them in System Configuration → Subjects first.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.subjects.map(s => {
                        const id = String(s.id);
                        const selected = form.subject_ids.includes(id);
                        return (
                          <button type="button" key={s.id} onClick={() => toggleSubject(s.id)}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                              selected ? 'bg-primary text-white ring-1 ring-primary' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
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
                <Section title="Academic Details">
                  <Grid>
                    <Field label="Class Assignment" type="select" value={form.class_id} onChange={v => setForm({ ...form, class_id: v })}
                      options={[{ value: '', label: 'Select class...' }, ...data.classes.map(c => ({
                        value: c.id, label: `${c.className}${c.section ? ' - ' + c.section : ''}`
                      }))]} />
                    <Field label="Section (Optional)" value={form.section} onChange={v => setForm({ ...form, section: v })} placeholder="e.g. A" />
                    <Field label="Roll Number" value={form.roll_no} onChange={v => setForm({ ...form, roll_no: v })} />
                    <Field label="Admission Number" value={form.admission_no} onChange={v => setForm({ ...form, admission_no: v })} />
                  </Grid>
                </Section>
              )}

              <div className="pt-4 border-t border-zinc-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="bg-primary text-white px-6 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
            
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Sub-components matching Rule 12 & Layout Rules
// =====================================================================

function Section({ title, children }) {
  return (
    <div className="ring-1 ring-black/5 rounded-md p-5 bg-zinc-50/30">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }) { 
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>; 
}

function Field({ label, value, onChange, type = 'text', options, required, placeholder }) {
  const baseCls = "h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors";
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium text-zinc-600 mb-1.5 flex items-center gap-1">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      {type === 'select' ? (
        <div className="relative">
          <select value={value || ''} onChange={e => onChange(e.target.value)} className={`${baseCls} appearance-none cursor-pointer pr-8`}>
            {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} className={`${baseCls} h-auto py-2 resize-none`} placeholder={placeholder} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder} className={baseCls} />
      )}
    </div>
  );
}