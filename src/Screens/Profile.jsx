import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import {
  User as UserIcon, Mail, Phone, Edit, Save, X, Camera, MapPin,
  Calendar, BadgeCheck, Lock, AtSign, Loader2, ImageOff, ChevronDown
} from 'lucide-react';

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

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/profile/${user.id}`);
      const data = await res.json();
      setProfile(data);
    } catch (e) { console.error('Profile load:', e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

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

  const handlePicChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return alert('Picture must be under 3 MB.');
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, profile_pic: reader.result }));
    reader.readAsDataURL(file);
  };

  const removePic = () => setForm(f => ({ ...f, profile_pic: '' }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.email?.trim()) {
      return alert('Name and email are required.');
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/profile/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update profile.');
      } else {
        setProfile(data.user);
        
        // UPDATE AUTH CONTEXT IMMEDIATELY FOR SIDEBAR
        if (login && user) {
          login({ 
            ...user, 
            name: data.user.name, 
            email: data.user.email, 
            username: data.user.username,
            profile_pic: data.user.profile_pic // CRITICAL LINE
          }, localStorage.getItem('token'));
        }
        setEditing(false);
      }
    } catch (err) { alert('Network error.'); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 max-w-[1440px] w-full mx-auto">
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center max-w-2xl mx-auto">
          <p className="text-zinc-500 text-sm font-medium">Profile not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-[1440px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">User Profile</h1>
        <p className="text-sm text-zinc-500 mt-1">View and manage your account details.</p>
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

function DisplayView({ profile, onEdit }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg ring-1 ring-black/5 p-6 flex flex-col items-center text-center">
          <AvatarBlock src={profile.profile_pic} name={profile.name} size="lg" />
          
          <h2 className="text-base font-semibold text-zinc-900 mt-4 leading-tight">{profile.name}</h2>
          {profile.username && (
            <p className="text-xs text-zinc-500 font-medium mt-0.5">@{profile.username}</p>
          )}
          
          <div className="inline-flex items-center gap-1.5 mt-3 bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded">
            <BadgeCheck className="size-3.5" /> {profile.role}
          </div>
          
          <div className="mt-6 w-full space-y-3 text-left pt-6 border-t border-zinc-100">
            <RowIcon icon={Mail} value={profile.email} />
            <RowIcon icon={Phone} value={profile.phone_no || 'Not provided'} />
          </div>
          
          <button
            onClick={onEdit}
            className="mt-6 w-full h-9 bg-primary hover:bg-primary/90 text-white text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors">
            <Edit className="size-3.5" /> Edit Profile
          </button>
        </div>
      </div>
      
      <div className="lg:col-span-2 space-y-6">
        <Section title="Personal Information">
          <Row label="Username" value={profile.username} />
          <Row label="Date of Birth" value={fmtDMY(profile.dob)} />
          <Row label="Gender" value={profile.gender} />
        </Section>
        <Section title="Contact Information">
          <Row label="Email Address" value={profile.email} />
          <Row label="Phone Number" value={profile.phone_no} />
          <Row label="Physical Address" value={profile.address} />
        </Section>
        <Section title="System Account">
          <Row label="Assigned Role" value={profile.role} />
          <Row label="Account Status" value={<span className="capitalize">{profile.status || 'active'}</span>} />
        </Section>
      </div>
    </div>
  );
}

function EditView({ form, setForm, onSave, onCancel, onPicChange, onPicRemove, saving, role }) {
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={onSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg ring-1 ring-black/5 p-6 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <AvatarBlock src={form.profile_pic} name={form.name} size="lg" />
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium text-xs px-3 py-1.5 rounded-md transition-colors">
              <Camera className="size-3.5" /> Change Photo
              <input type="file" accept="image/*" onChange={onPicChange} className="hidden" />
            </label>
            
            {form.profile_pic && (
              <button type="button" onClick={onPicRemove}
                className="inline-flex items-center gap-1 text-accent hover:underline font-medium text-[11px]">
                <ImageOff className="size-3" /> Remove Picture
              </button>
            )}
          </div>
          
          <div className="mt-8 w-full bg-zinc-50/50 ring-1 ring-black/5 rounded-md p-4 text-left">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
              <Lock className="size-3" /> Assigned Role
            </div>
            <p className="text-sm font-medium text-zinc-900">{role}</p>
            <p className="text-[10px] text-zinc-400 mt-1">Roles cannot be changed by the user.</p>
          </div>
        </div>
      </div>
      
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
                { value: '', label: 'Select...' },
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' }
              ]} />
          </FieldRow>
        </Section>
        
        <Section title="Contact Information">
          <FieldRow>
            <Field label="Email Address" type="email" value={form.email} onChange={set('email')} icon={Mail} required />
            <Field label="Phone Number" value={form.phone_no} onChange={set('phone_no')} icon={Phone} />
          </FieldRow>
          <Field label="Physical Address" type="textarea" value={form.address} onChange={set('address')} icon={MapPin} />
        </Section>
        
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} disabled={saving} 
            className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 text-xs font-medium rounded-md hover:bg-zinc-50 transition-colors flex items-center gap-1.5">
            <X className="size-3.5" /> Cancel
          </button>
          <button type="submit" disabled={saving} 
            className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} 
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
}

// =====================================================================
// Custom UI Components (Rule Compliant)
// =====================================================================

function AvatarBlock({ src, name, size = 'lg' }) {
  const dims = size === 'lg' ? 'size-28 text-3xl' : 'size-10 text-sm';
  if (src) return <img src={src} alt={name} className={`${dims} rounded-full object-cover ring-1 ring-black/10`} />;
  return (
    <div className={`${dims} rounded-full bg-primary text-white font-semibold flex items-center justify-center ring-1 ring-black/10`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function Section({ title, children }) { 
  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-zinc-100 bg-zinc-50/50">
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      </div>
      <div className="p-5 space-y-4">
        {children}
      </div>
    </div>
  ); 
}

function Row({ label, value }) { 
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-zinc-100 last:border-0 last:pb-0">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-900 max-w-[60%] text-right truncate">{value || '—'}</span>
    </div>
  ); 
}

function RowIcon({ icon: Icon, value }) { 
  return (
    <div className="flex items-center gap-3 text-zinc-600">
      <Icon className="size-4 text-zinc-400 shrink-0" />
      <span className="text-sm font-medium break-all">{value}</span>
    </div>
  ); 
}

function FieldRow({ children }) { 
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>; 
}

function Field({ label, value, onChange, type = 'text', icon: Icon, options, required }) {
  const baseCls = "w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5" />} {label}{required && <span className="text-accent">*</span>}
      </label>
      
      {type === 'select' ? (
        <div className="relative">
          <select value={value || ''} onChange={onChange} className={`${baseCls} h-9 appearance-none cursor-pointer pr-8`}>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={onChange} rows={3} className={`${baseCls} py-2 resize-none`} />
      ) : (
        <input type={type} value={value || ''} onChange={onChange} required={required} className={`${baseCls} h-9`} />
      )}
    </div>
  );
}