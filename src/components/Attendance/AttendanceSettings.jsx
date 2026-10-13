import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Loader2, GripVertical, Info, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';

// =====================================================================
//  AttendanceSettings — Super Admin only.
//  Two things in one place:
//    1. Which roles are ELIGIBLE for attendance (get a tab).
//    2. The ORDER those role tabs appear in.
//  Student and Teacher are permanent tabs and are not listed here.
//  Reorder by dragging; toggle the switch to include/exclude a role;
//  then Save. Saved settings drive the Attendance tabs on the next load.
// =====================================================================

export default function AttendanceSettings({ onClose, onSaved }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);       // [{ role_id, role_name, eligible }]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  useEffect(() => {
    if (!user?.institutionId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/attendance-settings/${user.institutionId}`);
        const data = await res.json();
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) setError('Could not load attendance settings.');
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const toggleEligible = (roleId) => {
    setRows(prev => prev.map(r => r.role_id === roleId ? { ...r, eligible: !r.eligible } : r));
  };

  // ---- drag to reorder ------------------------------------------------
  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(id)); } catch (_) {}
  };
  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== overId) setOverId(id);
  };
  const handleDragLeave = (id) => { if (id === overId) setOverId(null); };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const src = dragId;
    setOverId(null);
    setDragId(null);
    if (src == null || src === targetId) return;
    setRows(prev => {
      const arr = [...prev];
      const from = arr.findIndex(r => r.role_id === src);
      const to   = arr.findIndex(r => r.role_id === targetId);
      if (from < 0 || to < 0 || from === to) return prev;
      arr.splice(to, 0, arr.splice(from, 1)[0]);
      return arr;
    });
  };
  const handleDragEnd = () => { setDragId(null); setOverId(null); };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const settings = rows.map((r, i) => ({ role_id: r.role_id, eligible: !!r.eligible, sort_order: i }));
      const res = await fetch(`${API_BASE_URL}/admin/attendance-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, settings })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${res.status} ${data.error || res.statusText || ''}`.trim());
      if (typeof onSaved === 'function') onSaved();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to save.');
    }
    setSaving(false);
  };

  const eligibleCount = rows.filter(r => r.eligible).length;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[88vh] overflow-hidden shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Attendance Settings</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Choose which roles are marked for attendance and the order of their tabs.
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1 rounded-md hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1">
          <div className="bg-blue-50/60 border border-blue-100 rounded-md p-3 flex gap-2 text-[11px] text-blue-800 leading-relaxed mb-4">
            <Info className="size-3.5 shrink-0 mt-0.5 text-blue-500" />
            <span>
              <strong className="font-semibold">Students and Teachers</strong> always have their own tabs and aren't listed here.
              Toggle a role off to hide its attendance tab; drag to reorder.
            </span>
          </div>

          {loading ? (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="animate-spin size-6 text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10">
              <ShieldCheck className="size-9 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-500">No other roles yet.</p>
              <p className="text-[11px] text-zinc-400 mt-1">Create roles in System Configuration → Roles.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const isDragging = dragId === r.role_id;
                const isOver = overId === r.role_id && dragId != null && dragId !== r.role_id;
                return (
                  <div key={r.role_id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, r.role_id)}
                    onDragOver={(e) => handleDragOver(e, r.role_id)}
                    onDragLeave={() => handleDragLeave(r.role_id)}
                    onDrop={(e) => handleDrop(e, r.role_id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-2.5 rounded-md ring-1 ring-inset bg-white transition-all shadow-sm select-none ${
                      isDragging ? 'opacity-40 ring-primary/40' : 'ring-black/5'
                    } ${isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}>

                    <span className="cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 shrink-0" title="Drag to reorder">
                      <GripVertical className="size-4" />
                    </span>

                    <span className={`flex-1 text-sm font-medium truncate ${r.eligible ? 'text-zinc-900' : 'text-zinc-400'}`}>
                      {r.role_name}
                    </span>

                    {/* Eligibility toggle */}
                    <button type="button" onClick={() => toggleEligible(r.role_id)}
                      title={r.eligible ? 'Marked for attendance — click to hide' : 'Not marked — click to include'}
                      className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${
                        r.eligible ? 'bg-primary' : 'bg-zinc-200'
                      }`}>
                      <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
                        r.eligible ? 'left-[18px]' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-[11px] text-red-500 mt-3">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-zinc-400">
            {loading ? '' : `${eligibleCount} of ${rows.length} role${rows.length !== 1 ? 's' : ''} on`}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md text-xs font-semibold hover:bg-zinc-50 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving || loading}
              className="h-9 px-5 bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}