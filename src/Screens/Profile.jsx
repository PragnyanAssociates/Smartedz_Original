import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import {
  User as UserIcon, Mail, Phone, Edit, Save, X, Camera, MapPin,
  Calendar, BadgeCheck, Lock, AtSign, Loader2, ImageOff
} from 'lucide-react';

// ---- Helpers --------------------------------------------------------
const fmtDMY = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const isoDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export default function Profile() {
  const { user, login } = useAuth();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({});

  // ---- Load profile -------------------------------------------------
  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/profile/${user.id}`.replace('/admin/profile', '/profile'));
      // The line above is defensive: API_BASE_URL might or might not include /admin.
      // We always want /api/profile/:id, never /api/admin/profile/:id.
      const data = await res.json();
      setProfile(data);
    } catch (e) { console.error('Profile load:', e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ---- Open editor --------------------------------------------------
  const openEdit = () => {
    setForm({
      name: profile.name || '',
      email: profile.email || '',
      username: profile.username || '',
      phone_no: profile.phone_no || '',
      dob: isoDate(profile.dob),
      gender: profile.gender || '',
      address: profile.address || '',
      profile_pic: profile.profile_pic || ''
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setForm({}); };

  // ---- Image upload -> Base64 --------------------------------------
  const handlePicChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return alert('Picture must be under 3 MB.');
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, profile_pic: reader.result }));
    reader.readAsDataURL(file);
  };

  const removePic = () => setForm(f => ({ ...f, profile_pic: '' }));

  // ---- Save ---------------------------------------------------------
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.email?.trim()) {
      return alert('Name and email are required.');
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/profile/${user.id}`.replace('/admin/profile', '/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update profile.');
      } else {
        setProfile(data.user);
        // Refresh the auth context so the sidebar avatar / header updates too
        if (login && user) {
          login({ ...user, name: data.user.name, email: data.user.email, username: data.user.username }, localStorage.getItem('token'));
        }
        setEditing(false);
        alert('Profile updated.');
      }
    } catch (err) { alert('Network error.'); }
    setSaving(false);
  };

  // ---- Loading state -----------------------------------------------
  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center max-w-2xl mx-auto">
        <p className="text-slate-500 font-medium">Profile not available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-1 text-center sm:text-left">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Profile</h1>
        <p className="text-slate-500 font-medium">View and manage your account details.</p>
      </div>

      {editing ? (
        <EditView
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={cancelEdit}
          onPicChange={handlePicChange}
          onPicRemove={removePic}
          saving={saving}
          role={profile.role}
        />
      ) : (
        <DisplayView profile={profile} onEdit={openEdit} />
      )}
    </div>
  );
}


// =====================================================================
//  DISPLAY VIEW
// =====================================================================
function DisplayView({ profile, onEdit }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left — avatar card */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="relative inline-block mb-5">
            <AvatarBlock src={profile.profile_pic} name={profile.name} size="lg" />
          </div>
          <h2 className="text-xl font-black text-slate-800">{profile.name}</h2>
          {profile.username && (
            <p className="text-sm text-slate-400 font-medium mt-0.5">@{profile.username}</p>
          )}

          <div className="inline-flex items-center gap-1.5 mt-4 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
            <BadgeCheck size={12} /> {profile.role}
          </div>

          <div className="mt-6 space-y-3 text-left">
            <RowIcon icon={Mail} value={profile.email} />
            <RowIcon icon={Phone} value={profile.phone_no || 'Not provided'} />
          </div>

          <button
            onClick={onEdit}
            className="mt-7 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition-all">
            <Edit size={16} /> Edit Profile
          </button>
        </div>
      </div>

      {/* Right — details */}
      <div className="lg:col-span-2 space-y-6">
        <Section title="Personal Information">
          <Row label="Username" value={profile.username} />
          <Row label="Date of Birth" value={fmtDMY(profile.dob)} />
          <Row label="Gender" value={profile.gender} />
        </Section>

        <Section title="Contact Information">
          <Row label="Email" value={profile.email} />
          <Row label="Phone" value={profile.phone_no} />
          <Row label="Address" value={profile.address} />
        </Section>

        <Section title="Account">
          <Row label="Role" value={profile.role} />
          <Row label="Status" value={profile.status || 'active'} />
          {profile.roll_no   && <Row label="Roll No." value={profile.roll_no} />}
          {profile.admission_no && <Row label="Admission No." value={profile.admission_no} />}
        </Section>
      </div>
    </div>
  );
}


// =====================================================================
//  EDIT VIEW
// =====================================================================
function EditView({ form, setForm, onSave, onCancel, onPicChange, onPicRemove, saving, role }) {
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={onSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left — avatar */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="relative inline-block mb-5">
            <AvatarBlock src={form.profile_pic} name={form.name} size="lg" />
          </div>

          <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm px-4 py-2.5 rounded-xl transition-all">
            <Camera size={16} /> Change Photo
            <input type="file" accept="image/*" onChange={onPicChange} className="hidden" />
          </label>

          {form.profile_pic && (
            <button type="button" onClick={onPicRemove}
              className="mt-2 inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs px-4 py-2 rounded-xl">
              <ImageOff size={14} /> Remove
            </button>
          )}
          <p className="text-[10px] text-slate-400 font-bold mt-3 uppercase tracking-widest">JPG / PNG · max 3 MB</p>

          {/* Locked Role Tag */}
          <div className="mt-7 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              <Lock size={11} /> Role (locked)
            </div>
            <p className="font-bold text-slate-700">{role}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Only the Super Admin can change your role.</p>
          </div>
        </div>
      </div>

      {/* Right — fields */}
      <div className="lg:col-span-2 space-y-6">
        <Section title="Personal Information">
          <FieldRow>
            <Field label="Full Name" value={form.name} onChange={set('name')} required />
            <Field label="Username" value={form.username} onChange={set('username')} icon={AtSign} />
          </FieldRow>
          <FieldRow>
            <Field label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} icon={Calendar} />
            <Field label="Gender" type="select" value={form.gender} onChange={set('gender')}
              options={[
                { value: '', label: 'Select…' },
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' }
              ]} />
          </FieldRow>
        </Section>

        <Section title="Contact Information">
          <FieldRow>
            <Field label="Email" type="email" value={form.email} onChange={set('email')} icon={Mail} required />
            <Field label="Phone" value={form.phone_no} onChange={set('phone_no')} icon={Phone} />
          </FieldRow>
          <Field label="Address" type="textarea" value={form.address} onChange={set('address')} icon={MapPin} />
        </Section>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={saving}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2">
            <X size={16} /> Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
}


// =====================================================================
//  Reusable sub-components
// =====================================================================
function AvatarBlock({ src, name, size = 'lg' }) {
  const dims = size === 'lg' ? 'w-32 h-32 text-4xl' : 'w-12 h-12 text-base';
  if (src) {
    return (
      <img src={src} alt={name}
        className={`${dims} rounded-full object-cover border-4 border-white shadow-xl ring-1 ring-slate-100`} />
    );
  }
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div className={`${dims} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black flex items-center justify-center shadow-xl ring-1 ring-slate-100`}>
      {initial}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-50">
        <h3 className="font-black text-slate-700">{title}</h3>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-slate-700 font-bold text-right max-w-[60%] break-words">{value || '—'}</span>
    </div>
  );
}

function RowIcon({ icon: Icon, value }) {
  return (
    <div className="flex items-center gap-3 text-slate-600">
      <Icon size={16} className="text-slate-400 shrink-0" />
      <span className="text-sm font-medium break-all">{value}</span>
    </div>
  );
}

function FieldRow({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, value, onChange, type = 'text', icon: Icon, options, required }) {
  const baseCls = "w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-300 transition-all";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
        {Icon && <Icon size={11} />} {label}{required && <span className="text-red-500">*</span>}
      </label>
      {type === 'select' ? (
        <select value={value || ''} onChange={onChange} className={baseCls + ' cursor-pointer'}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={onChange} rows={3} className={baseCls + ' resize-none'} />
      ) : (
        <input type={type} value={value || ''} onChange={onChange} required={required} className={baseCls} />
      )}
    </div>
  );
}