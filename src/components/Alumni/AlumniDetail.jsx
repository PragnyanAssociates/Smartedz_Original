import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, 
  LoaderCircle, 
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
  FileText
} from 'lucide-react';
import { fmtDate, initials, statusStyle } from './AlumniUtils';

// =====================================================================
//  AlumniDetail — full record for one alumni.
//   • Top: snapshot identity (photo, name, passout class/year) — frozen.
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

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${data.name} from Alumni? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/alumni/${alumniId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onBack();
    } catch (e) { alert(e.message); }
  };

  if (loading) {
    return <div className="py-20 text-center"><LoaderCircle className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
          <ArrowLeft size={15} /> Back
        </button>
        <p className="text-slate-400 italic">Alumni record not found.</p>
      </div>
    );
  }

  const ss = statusStyle(data.current_status);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
          <ArrowLeft size={15} /> Back to Alumni
        </button>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={openEdit}
              className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-xl text-sm font-bold transition-all">
              <Pencil size={15} /> Edit
            </button>
            <button onClick={handleDelete}
              className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 hover:bg-red-100 px-4 py-2 rounded-xl text-sm font-bold transition-all">
              <Trash2 size={15} /> Remove
            </button>
          </div>
        )}
      </div>

      {/* Identity header (snapshot — frozen) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-7">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {data.profile_pic ? (
            <img src={data.profile_pic} alt={data.name}
              className="w-24 h-24 rounded-3xl object-cover shrink-0" />
          ) : (
            <div className="w-24 h-24 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-3xl shrink-0">
              {initials(data.name)}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-3xl font-black text-slate-900">{data.name}</h2>
            <div className="flex flex-wrap gap-3 mt-2 text-sm font-medium text-slate-400">
              {data.passout_year && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} /> Passed out {data.passout_year}
                </span>
              )}
              {data.final_class && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap size={14} /> {data.final_class}
                </span>
              )}
              {data.roll_no && (
                <span className="flex items-center gap-1.5">
                  <User size={14} /> Roll {data.roll_no}
                </span>
              )}
            </div>
            <div className="mt-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${ss.bg} ${ss.text}`}>
                <Briefcase size={13} /> {data.current_status || 'Status not set'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
          <div className="flex items-start gap-3">
            <FileText size={16} className="text-slate-400 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{data.notes}</p>
          </div>
        </Panel>
      )}

      {/* Snapshot personal details */}
      <Panel title="Profile at Passout">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
          <Mini label="Gender" value={data.gender} />
          <Mini label="Date of Birth" value={fmtDate(data.dob)} />
          <Mini label="Admission No" value={data.admission_no} />
          <Mini label="Address" value={data.address} wide />
        </div>
      </Panel>

      {/* ---- EDIT MODAL ---- */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setEditing(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-6 text-slate-800">Edit Alumni</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
                <Field label="Current Status" value={form.current_status}
                  onChange={v => setForm({ ...form, current_status: v })}
                  placeholder="e.g. Doctor, Studying…" />
                <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
                <Field label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
                <Field label="Occupation" value={form.occupation} onChange={v => setForm({ ...form, occupation: v })} />
                <Field label="Organization" value={form.organization} onChange={v => setForm({ ...form, organization: v })} />
                <Field label="Higher Education" value={form.higher_education} onChange={v => setForm({ ...form, higher_education: v })} />
                <Field label="Current Location" value={form.location} onChange={v => setForm({ ...form, location: v })} />
              </div>
              <Field label="LinkedIn" value={form.linkedin} onChange={v => setForm({ ...form, linkedin: v })}
                placeholder="https://linkedin.com/in/…" />
              <Field label="Additional Information" type="textarea" value={form.notes}
                onChange={v => setForm({ ...form, notes: v })}
                placeholder="Anything else worth recording…" />

              <button onClick={handleSave} disabled={saving}
                className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2">
                {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving…' : 'Save Changes'}
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
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, value, link }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
        {value ? (
          link ? (
            <a href={value} target="_blank" rel="noopener noreferrer"
              className="text-sm font-bold text-blue-600 hover:underline break-all">{value}</a>
          ) : (
            <div className="text-sm font-bold text-slate-700 break-words">{value}</div>
          )
        ) : (
          <div className="text-sm text-slate-300 italic">Not set</div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, wide }) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-3' : ''}>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold text-slate-700 mt-0.5">
        {value || <span className="text-slate-300 italic font-medium">—</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  const base = "w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/10 text-sm";
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      {type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3}
          placeholder={placeholder} className={base + ' resize-none'} />
      ) : (
        <input value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={base} />
      )}
    </div>
  );
}