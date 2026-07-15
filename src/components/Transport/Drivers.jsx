import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, X, ChevronDown, UserPlus, Search, Check, Eye, Pencil, Save, Upload, FileText, Phone, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

const fmtDate = (v) => { if (!v) return '—'; const s = String(v).slice(0, 10); const [y, m, d] = s.split('-'); return d ? `${d}/${m}/${y}` : s; };

export default function Drivers({ user, canEdit, canDelete }) {
  const [tab, setTab]         = useState('Driver');   // 'Driver' | 'Conductor'
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewId, setViewId]   = useState(null);
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyId, setBusyId]   = useState(null);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/transport/staff/${user.institutionId}?staff_role=${tab}`);
      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
    } catch (e) { console.error('Staff fetch error:', e); setRows([]); }
    setLoading(false);
  }, [user, tab]);

  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    if (!window.confirm(`Remove this ${tab.toLowerCase()}?`)) return;
    setBusyId(id);
    try { const res = await fetch(`${API_BASE_URL}/transport/staff/${id}`, { method: 'DELETE' }); if (res.ok) await load(); }
    finally { setBusyId(null); }
  };

  const openEdit = async (s) => {
    try {
      const d = await fetch(`${API_BASE_URL}/transport/staff-details/${s.id}`).then(x => x.json());
      setEditing({
        id: d.id, name: d.name, staff_role: d.staff_role,
        license_no: d.license_no || '', aadhar_no: d.aadhar_no || '', phone: d.phone || d.user_phone || '',
        is_active: !!d.is_active,
        license_image: '', existingLicense: d.license_image || '', removeLicense: false,
        aadhar_image: '', existingAadhar: d.aadhar_image || '', removeAadhar: false,
      });
    } catch { alert('Could not load the record.'); }
  };

  const pickImage = (e, key) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return alert('Image must be under 3 MB.');
    const reader = new FileReader();
    reader.onloadend = () => setEditing(m => ({ ...m, [key]: reader.result, [key === 'license_image' ? 'removeLicense' : 'removeAadhar']: false }));
    reader.readAsDataURL(f);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      const body = {
        license_no: editing.license_no, aadhar_no: editing.aadhar_no,
        phone: editing.phone, is_active: editing.is_active
      };
      if (editing.license_image) body.license_image = editing.license_image;
      else if (editing.removeLicense) body.removeLicenseImage = true;
      if (editing.aadhar_image) body.aadhar_image = editing.aadhar_image;
      else if (editing.removeAadhar) body.removeAadharImage = true;

      const res = await fetch(`${API_BASE_URL}/transport/staff/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not save.'); }
      else { setEditing(null); await load(); }
    } finally { setSavingEdit(false); }
  };

  const licenseShown = editing && (editing.license_image || (!editing.removeLicense ? editing.existingLicense : ''));
  const aadharShown  = editing && (editing.aadhar_image || (!editing.removeAadhar ? editing.existingAadhar : ''));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
          {['Driver', 'Conductor'].map(r => (
            <button key={r} onClick={() => setTab(r)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === r ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
              {r}s
            </button>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 h-9 rounded-md text-xs font-semibold hover:bg-primary/90 shadow-sm">
            <UserPlus className="size-4" /> Add {tab}s
          </button>
        )}
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        {loading ? (
          <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['Name', 'Role', 'Phone', 'Licence No', 'Proofs', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length ? rows.map(s => (
                  <tr key={s.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-zinc-900 flex items-center gap-2"><Users className="size-4 text-primary" /> {s.name}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600">{s.staff_role}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600">{s.phone || '—'}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600">{s.license_no || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Chip on={!!s.has_license_image} label="DL" />
                        <Chip on={!!s.has_aadhar_image} label="Aadhaar" />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${s.is_active ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-zinc-100 text-zinc-500 ring-zinc-300'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setViewId(s.id)} className="p-1.5 text-zinc-400 hover:text-primary rounded" title="View"><Eye className="size-4" /></button>
                        {canEdit && <button onClick={() => openEdit(s)} className="p-1.5 text-zinc-400 hover:text-primary rounded" title="Edit"><Pencil className="size-4" /></button>}
                        {canDelete && <button onClick={() => del(s.id)} disabled={busyId === s.id} className="p-1.5 text-zinc-400 hover:text-accent rounded disabled:opacity-40" title="Remove"><Trash2 className="size-4" /></button>}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="px-5 py-10 text-center text-xs text-zinc-500 italic">No {tab.toLowerCase()}s added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && <AddStaffModal user={user} staffRole={tab} existing={rows.map(r => r.user_id)} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load(); }} />}

      {viewId && <StaffView id={viewId} onClose={() => setViewId(null)} />}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-zinc-900">Edit {editing.staff_role} · <span className="text-zinc-500 font-normal">{editing.name}</span></h4>
              <button onClick={() => setEditing(null)} className="text-zinc-400 hover:text-zinc-700"><X className="size-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Licence No"><input value={editing.license_no} onChange={e => setEditing(m => ({ ...m, license_no: e.target.value }))} className={inputCls} placeholder="Driving licence number" /></Field>
              <Field label="Aadhaar No"><input value={editing.aadhar_no} onChange={e => setEditing(m => ({ ...m, aadhar_no: e.target.value.replace(/\D/g, '').slice(0, 12) }))} className={inputCls} inputMode="numeric" placeholder="12 digits" /></Field>
              <Field label="Phone"><input value={editing.phone} onChange={e => setEditing(m => ({ ...m, phone: e.target.value.replace(/[^\d+ ]/g, '') }))} className={inputCls} inputMode="tel" /></Field>
              <label className="flex items-end gap-2 text-xs text-zinc-600 cursor-pointer pb-2">
                <input type="checkbox" checked={editing.is_active} onChange={e => setEditing(m => ({ ...m, is_active: e.target.checked }))} className="accent-primary" /> Active
              </label>
            </div>

            <p className="text-xs font-semibold text-zinc-700 mt-5 mb-2 flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-primary" /> Proofs</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ProofBox title="Driving Licence" img={licenseShown}
                onPick={e => pickImage(e, 'license_image')}
                onRemove={() => setEditing(m => ({ ...m, license_image: '', removeLicense: true }))} />
              <ProofBox title="Aadhaar Card" img={aadharShown}
                onPick={e => pickImage(e, 'aadhar_image')}
                onRemove={() => setEditing(m => ({ ...m, aadhar_image: '', removeAadhar: true }))} />
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-md text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit} className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-md text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"><Save className="size-3.5" /> {savingEdit ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProofBox({ title, img, onPick, onRemove }) {
  return (
    <div className="ring-1 ring-zinc-200 rounded-md p-3">
      <p className="text-[11px] font-medium text-zinc-700 mb-2 flex items-center gap-1.5"><FileText className="size-3.5 text-zinc-400" /> {title}</p>
      {img
        ? <img src={img} alt={title} className="w-full max-h-32 object-contain rounded ring-1 ring-black/5 bg-zinc-50 mb-2" />
        : <div className="w-full h-24 rounded bg-zinc-50 ring-1 ring-zinc-100 flex items-center justify-center text-[10px] text-zinc-400 mb-2">Not uploaded</div>}
      <div className="flex items-center gap-2">
        <label className="cursor-pointer inline-flex items-center gap-1.5 text-primary ring-1 ring-primary/30 px-2.5 py-1.5 rounded text-[11px] font-medium hover:bg-primary/5">
          <Upload className="size-3" /> {img ? 'Change' : 'Upload'}
          <input type="file" accept="image/*" onChange={onPick} className="hidden" />
        </label>
        {img && <button onClick={onRemove} className="text-[11px] text-accent hover:underline">Remove</button>}
      </div>
    </div>
  );
}

function StaffView({ id, onClose }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const j = await fetch(`${API_BASE_URL}/transport/staff-details/${id}`).then(x => x.json()); if (alive) setD(j); }
      catch { if (alive) setD(null); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <span className="text-sm font-bold flex items-center gap-2"><Users className="size-4" /> {d?.name || 'Staff'}</span>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="size-5" /></button>
        </div>
        {loading || !d ? (
          <div className="h-40 flex items-center justify-center"><div className="size-6 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-2.5 text-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
              {d.profile_pic
                ? <img src={d.profile_pic} alt={d.name} className="size-14 rounded-full object-cover ring-1 ring-black/5" />
                : <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">{(d.name || '?').charAt(0).toUpperCase()}</div>}
              <div className="min-w-0">
                <p className="text-base font-semibold text-zinc-900 truncate">{d.name}</p>
                <p className="text-[11px] text-zinc-500">{d.staff_role} · {d.user_role}</p>
                {(d.phone || d.user_phone) && <a href={`tel:${d.phone || d.user_phone}`} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"><Phone className="size-3" /> {d.phone || d.user_phone}</a>}
              </div>
            </div>

            <VRow label="Licence No" value={d.license_no || '—'} />
            <VRow label="Aadhaar No" value={d.aadhar_no || '—'} />
            <VRow label="Email" value={d.email || '—'} />
            <VRow label="Username" value={d.username || '—'} />
            <VRow label="Date of Birth" value={fmtDate(d.dob)} />
            <VRow label="Gender" value={d.gender || '—'} />
            <VRow label="Joining Date" value={fmtDate(d.joining_date)} />
            <VRow label="Experience" value={d.experience || '—'} />
            {d.address && (
              <div className="pt-1">
                <p className="text-zinc-500 text-xs mb-1">Address</p>
                <p className="text-sm text-zinc-800 rounded-md bg-zinc-50 ring-1 ring-zinc-100 p-2.5">{d.address}</p>
              </div>
            )}
            <VRow label="Status" value={d.is_active ? 'Active' : 'Inactive'} />

            <p className="text-xs font-semibold text-zinc-700 pt-3 flex items-center gap-1.5 border-t border-zinc-100"><ShieldCheck className="size-3.5 text-primary" /> Proofs</p>
            <div className="grid grid-cols-2 gap-3">
              <ProofShow title="Driving Licence" img={d.license_image} />
              <ProofShow title="Aadhaar Card" img={d.aadhar_image} />
            </div>

            {d.created_by_name && <p className="text-[11px] text-zinc-400 pt-2 border-t border-zinc-100">Added by {d.created_by_name}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function ProofShow({ title, img }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{title}</p>
      {img
        ? <a href={img} target="_blank" rel="noreferrer"><img src={img} alt={title} className="w-full max-h-28 object-contain rounded ring-1 ring-black/5 bg-zinc-50 hover:opacity-90" /></a>
        : <div className="w-full h-20 rounded bg-zinc-50 ring-1 ring-zinc-100 flex items-center justify-center text-[10px] text-zinc-400">Not uploaded</div>}
    </div>
  );
}

// role -> users -> checkbox select -> register as Driver/Conductor
function AddStaffModal({ user, staffRole, existing, onClose, onAdded }) {
  const [roles, setRoles]     = useState([]);
  const [role, setRole]       = useState('');
  const [users, setUsers]     = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [picked, setPicked]   = useState(new Set());
  const [search, setSearch]   = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/transport/roles/${user.institutionId}`);
        const json = await res.json();
        setRoles(Array.isArray(json) ? json : []);
      } catch { setRoles([]); }
    })();
  }, [user]);

  useEffect(() => {
    if (!role) { setUsers([]); return; }
    let alive = true;
    (async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch(`${API_BASE_URL}/transport/users-by-role/${user.institutionId}?role=${encodeURIComponent(role)}`);
        const json = await res.json();
        if (alive) { setUsers(Array.isArray(json) ? json : []); setPicked(new Set()); }
      } catch { if (alive) setUsers([]); }
      if (alive) setLoadingUsers(false);
    })();
    return () => { alive = false; };
  }, [role, user]);

  const toggle = (id) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filtered = users.filter(u => !search.trim() || (u.name || '').toLowerCase().includes(search.trim().toLowerCase()));

  const save = async () => {
    if (!picked.size) return alert('Select at least one user.');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/transport/staff`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, staff_role: staffRole, user_ids: [...picked], userId: user?.id ?? null, userName: user?.name ?? null })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not add.'); }
      else onAdded();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md max-h-[90vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-zinc-100">
          <h4 className="text-sm font-semibold text-zinc-900">Add {staffRole}s</h4>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="size-5" /></button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-zinc-600 mb-1.5">1 · Select a role</label>
            <div className="relative">
              <select value={role} onChange={e => setRole(e.target.value)} className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                <option value="">Choose role…</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {role && (
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1.5 block">2 · Select users ({picked.size} chosen)</label>
              <div className="relative mb-2">
                <Search className="size-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name…" className={`${inputCls} pl-8`} />
              </div>
              <div className="ring-1 ring-zinc-200 rounded-md max-h-56 overflow-y-auto divide-y divide-zinc-100">
                {loadingUsers ? (
                  <div className="h-24 flex items-center justify-center"><div className="size-6 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
                ) : filtered.length ? filtered.map(u => {
                  const already = existing.includes(u.id);
                  const on = picked.has(u.id);
                  return (
                    <button key={u.id} onClick={() => !already && toggle(u.id)} disabled={already}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${already ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50'}`}>
                      <span className={`size-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary' : 'border-zinc-300'}`}>
                        {on && <Check className="size-3 text-white" />}
                      </span>
                      <span className="text-sm text-zinc-800 flex-1">{u.name}</span>
                      {already && <span className="text-[10px] text-zinc-400">already added</span>}
                    </button>
                  );
                }) : <p className="px-3 py-6 text-center text-xs text-zinc-400 italic">No users in this role.</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-zinc-100">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">Cancel</button>
          <button onClick={save} disabled={saving || !picked.size} className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-md text-xs font-semibold hover:bg-primary/90 disabled:opacity-60">
            <Plus className="size-3.5" /> {saving ? 'Adding…' : `Add ${picked.size || ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ on, label }) {
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${on ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20' : 'bg-zinc-100 text-zinc-400'}`}>{label}</span>;
}
function VRow({ label, value }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-zinc-500 text-xs shrink-0">{label}</span><span className="font-medium text-zinc-900 text-right">{value}</span></div>;
}
const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';
function Field({ label, children }) { return <div className="flex flex-col"><label className="text-xs font-medium text-zinc-600 mb-1.5">{label}</label>{children}</div>; }