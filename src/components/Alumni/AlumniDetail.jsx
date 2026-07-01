import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, 
  Loader2, 
  Pencil, 
  Trash2, 
  X, 
  Save, 
  Mail, 
  Phone,
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Building2, 
  Link,
  CalendarDays, 
  User, 
  FileText,
  Camera
} from 'lucide-react';
import { fmtDate, initials, statusStyle } from './AlumniUtils';

// =====================================================================
//  AlumniDetail - full record for one alumni.
//   • Top: snapshot identity (photo, name, passout class/year). The photo
//     is snapshotted from the student's user profile at passout and STAYS
//     until an admin uploads a new one (camera button, edit access only).
//   • Below: contact + the editable "extra" fields (current status,
//     occupation, organization, higher education, location, linkedin,
//     notes). Edit access unlocks the edit modal + delete.
// =====================================================================

export default function AlumniDetail({ alumniId, canEdit, onBack }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [savingPic, setSavingPic] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/alumni/detail/${alumniId}`);
      const d = await res.json();
      setData(d);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [alumniId]);

  useEffect(() => { load(); }, [load]);

  const openEdit = () => {
    setForm({
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      current_status: data.current_status || '',
      occupation: data.occupation || '',
      organization: data.organization || '',
      higher_education: data.higher_education || '',
      location: data.location || '',
      linkedin: data.linkedin || '',
      notes: data.notes || ''
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/alumni/${alumniId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Save failed');
      setEditing(false);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  // Change the alumni photo. Converts to base64 and PUTs it; on success the
  // record reloads so the new picture shows immediately (and the card list
  // will pick it up too via the /pic/:id endpoint).
  const handlePickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      e.target.value = '';
      return;
    }
    const MAX_SIZE = 3 * 1024 * 1024; // 3MB
    if (file.size > MAX_SIZE) {
      alert('Image is too large! Please select a file under 3MB.');
      e.target.value = '';
      return;
    }
    setSavingPic(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/alumni/${alumniId}/pic`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_pic: reader.result })
        });
        if (!res.ok) throw new Error('Upload failed');
        await load();
      } catch (err) { alert(err.message); }
      setSavingPic(false);
      e.target.value = '';
    };
    reader.onerror = () => { alert('Could not read the image.'); setSavingPic(false); e.target.value = ''; };
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${data.name} from Alumni? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/alumni/${alumniId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onBack();
    } catch (e) { alert(e.message); }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto h-64 flex items-center justify-center animate-in fade-in duration-300">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 animate-in fade-in duration-300">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="size-4" /> Back
        </button>
        <p className="text-zinc-400 text-sm font-medium italic">Alumni record not found.</p>
      </div>
    );
  }

  const ss = statusStyle(data.current_status);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300">

      {/* Full-screen photo viewer (tap the header photo to enlarge) */}
      {viewerOpen && data.profile_pic && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setViewerOpen(false)}>
          <button onClick={(e) => { e.stopPropagation(); setViewerOpen(false); }}
            className="absolute top-6 right-6 p-2 text-white/70 hover:text-white transition-colors bg-white/10 rounded-full">
            <X className="size-6" />
          </button>
          <img src={data.profile_pic} alt={data.name}
            className="max-w-full max-h-full object-contain p-4 rounded-lg"
            onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="size-4" /> Back to Alumni
        </button>
        {canEdit && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={openEdit}
              className="h-9 px-4 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors w-full sm:w-auto">
              <Pencil className="size-3.5" /> Edit
            </button>
            <button onClick={handleDelete}
              className="h-9 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors w-full sm:w-auto">
              <Trash2 className="size-3.5" /> Remove
            </button>
          </div>
        )}
      </div>

      {/* Identity header (snapshot) */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative shrink-0 w-20 sm:w-24">
            {data.profile_pic ? (
              <button type="button" onClick={() => setViewerOpen(true)}
                title="View photo" className="block">
                <img src={data.profile_pic} alt={data.name}
                  className="size-20 sm:size-24 rounded-lg object-cover ring-1 ring-black/5 shadow-sm cursor-pointer hover:opacity-95 transition-opacity" />
              </button>
            ) : (
              <div className="size-20 sm:size-24 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold text-3xl ring-1 ring-primary/20">
                {initials(data.name)}
              </div>
            )}
            {canEdit && (
              <>
                <input type="file" accept="image/*" id="alumni-pic-upload" className="hidden"
                  onChange={handlePickImage} disabled={savingPic} />
                <label htmlFor="alumni-pic-upload"
                  title="Change photo"
                  className="absolute -bottom-1.5 -right-1.5 size-8 bg-primary hover:bg-primary/90 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md ring-2 ring-white transition-colors">
                  {savingPic ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                </label>
              </>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 tracking-tight">{data.name}</h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-[11px] sm:text-xs font-medium text-zinc-500">
              {data.passout_year && (
                <span className="flex items-center gap-1.5 bg-zinc-100 px-2 py-1 rounded-md text-zinc-600">
                  <CalendarDays className="size-3.5" /> Passed out {data.passout_year}
                </span>
              )}
              {data.final_class && (
                <span className="flex items-center gap-1.5 bg-zinc-100 px-2 py-1 rounded-md text-zinc-600">
                  <GraduationCap className="size-3.5" /> {data.final_class}
                </span>
              )}
              {data.roll_no && (
                <span className="flex items-center gap-1.5 bg-zinc-100 px-2 py-1 rounded-md text-zinc-600">
                  <User className="size-3.5" /> Roll {data.roll_no}
                </span>
              )}
            </div>
            <div className="mt-4">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold ${ss.bg} ${ss.text} ring-1 ring-inset ring-black/5`}>
                <Briefcase className="size-3" /> {data.current_status || 'Status not set'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Contact */}
        <Panel title="Contact">
          <Row icon={Phone} label="Phone" value={data.phone} />
          <Row icon={Mail} label="Email" value={data.email} />
          <Row icon={MapPin} label="Current Location" value={data.location} />
          <Row icon={Link} label="LinkedIn" value={data.linkedin} link />
        </Panel>

        {/* Where they are now */}
        <Panel title="Current Information">
          <Row icon={Briefcase} label="Current Status" value={data.current_status} />
          <Row icon={Briefcase} label="Occupation" value={data.occupation} />
          <Row icon={Building2} label="Organization" value={data.organization} />
          <Row icon={GraduationCap} label="Higher Education" value={data.higher_education} />
        </Panel>
      </div>

      {/* Notes */}
      {data.notes && (
        <Panel title="Additional Information">
          <div className="flex items-start gap-3 bg-zinc-50/50 p-4 rounded-md border border-zinc-100">
            <FileText className="size-4 text-zinc-400 mt-0.5 shrink-0" />
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{data.notes}</p>
          </div>
        </Panel>
      )}

      {/* Snapshot personal details */}
      <Panel title="Profile at Passout">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-6">
          <Mini label="Gender" value={data.gender} />
          <Mini label="Date of Birth" value={fmtDate(data.dob)} />
          <Mini label="Admission No" value={data.admission_no} />
          <Mini label="Address" value={data.address} wide />
        </div>
      </Panel>

      {/* ---- EDIT MODAL ---- */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">Edit Alumni</h2>
              <button onClick={() => setEditing(false)}
                className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
                <Field label="Current Status" value={form.current_status}
                  onChange={v => setForm({ ...form, current_status: v })}
                  placeholder="e.g. Doctor, Studying..." />
                <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
                <Field label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
                <Field label="Occupation" value={form.occupation} onChange={v => setForm({ ...form, occupation: v })} />
                <Field label="Organization" value={form.organization} onChange={v => setForm({ ...form, organization: v })} />
                <Field label="Higher Education" value={form.higher_education} onChange={v => setForm({ ...form, higher_education: v })} />
                <Field label="Current Location" value={form.location} onChange={v => setForm({ ...form, location: v })} />
              </div>
              <Field label="LinkedIn" value={form.linkedin} onChange={v => setForm({ ...form, linkedin: v })}
                placeholder="https://linkedin.com/in/..." />
              <Field label="Additional Information" type="textarea" value={form.notes}
                onChange={v => setForm({ ...form, notes: v })}
                placeholder="Anything else worth recording..." />
            </div>

            <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
              <button onClick={() => setEditing(false)} disabled={saving}
                className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto">
                {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 sm:p-6">
      <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-5">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, value, link }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="size-4 text-zinc-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</div>
        {value ? (
          link ? (
            <a href={value} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline break-all mt-0.5 block">{value}</a>
          ) : (
            <div className="text-sm font-medium text-zinc-900 break-words mt-0.5">{value}</div>
          )
        ) : (
          <div className="text-sm text-zinc-400 italic mt-0.5">Not set</div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, wide }) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-3' : ''}>
      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium text-zinc-900 mt-1">
        {value || <span className="text-zinc-400 italic font-normal">-</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  const base = "h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</label>
      {type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3}
          placeholder={placeholder} className={`${base} h-auto py-2.5 resize-none`} />
      ) : (
        <input value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={base} />
      )}
    </div>
  );
}