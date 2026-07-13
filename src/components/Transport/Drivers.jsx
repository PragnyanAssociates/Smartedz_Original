import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, X, ChevronDown, UserPlus, Search, Check, Eye, Pencil, Save } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

export default function Drivers({ user, canEdit, canDelete }) {
  const [tab, setTab]         = useState('Driver');   // 'Driver' | 'Conductor'
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewing, setViewing] = useState(null);   // staff row
  const [editing, setEditing] = useState(null);   // {id, license_no, phone, is_active}
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
    try {
      const res = await fetch(`${API_BASE_URL}/transport/staff/${id}`, { method: 'DELETE' });
      if (res.ok) await load();
    } finally { setBusyId(null); }
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_BASE_URL}/transport/staff/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_no: editing.license_no, phone: editing.phone, is_active: editing.is_active })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not save.'); }
      else { setEditing(null); await load(); }
    } finally { setSavingEdit(false); }
  };

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
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead>
                <tr className="bg-zinc-50/50">
                  {['Name', 'Role', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length ? rows.map(s => (
                  <tr key={s.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-zinc-900 flex items-center gap-2"><Users className="size-4 text-primary" /> {s.name}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600">{s.staff_role}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${s.is_active ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-zinc-100 text-zinc-500 ring-zinc-300'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setViewing(s)} className="p-1.5 text-zinc-400 hover:text-primary rounded" title="View"><Eye className="size-4" /></button>
                        {canEdit && <button onClick={() => setEditing({ id: s.id, license_no: s.license_no || '', phone: s.phone || '', is_active: !!s.is_active })} className="p-1.5 text-zinc-400 hover:text-primary rounded" title="Edit"><Pencil className="size-4" /></button>}
                        {canDelete && <button onClick={() => del(s.id)} disabled={busyId === s.id} className="p-1.5 text-zinc-400 hover:text-accent rounded disabled:opacity-40" title="Remove"><Trash2 className="size-4" /></button>}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="px-5 py-10 text-center text-xs text-zinc-500 italic">No {tab.toLowerCase()}s added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && <AddStaffModal user={user} staffRole={tab} existing={rows.map(r => r.user_id)} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load(); }} />}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-bold flex items-center gap-2"><Users className="size-4" /> {viewing.name}</span>
              <button onClick={() => setViewing(null)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              <VRow label="Role" value={viewing.staff_role} />
              <VRow label="License No" value={viewing.license_no || '—'} />
              <VRow label="Phone" value={viewing.phone || '—'} />
              <VRow label="Status" value={viewing.is_active ? 'Active' : 'Inactive'} />
              {viewing.created_by_name && <VRow label="Added by" value={viewing.created_by_name} />}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-sm p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-zinc-900">Edit {tab}</h4>
              <button onClick={() => setEditing(null)} className="text-zinc-400 hover:text-zinc-700"><X className="size-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col"><label className="text-xs font-medium text-zinc-600 mb-1.5">License No</label>
                <input value={editing.license_no} onChange={e => setEditing(m => ({ ...m, license_no: e.target.value }))} className={inputCls} placeholder="For drivers" /></div>
              <div className="flex flex-col"><label className="text-xs font-medium text-zinc-600 mb-1.5">Phone</label>
                <input value={editing.phone} onChange={e => setEditing(m => ({ ...m, phone: e.target.value.replace(/[^\d+ ]/g, '') }))} className={inputCls} inputMode="tel" /></div>
              <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                <input type="checkbox" checked={editing.is_active} onChange={e => setEditing(m => ({ ...m, is_active: e.target.checked }))} className="accent-primary" /> Active
              </label>
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

function VRow({ label, value }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-zinc-500 text-xs shrink-0">{label}</span><span className="font-medium text-zinc-900 text-right">{value}</span></div>;
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

const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';