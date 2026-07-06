import React, { useState, useMemo, useEffect } from 'react';
import { Trash2, Search, UserCircle2, GraduationCap, ChevronDown, RotateCcw, Info, UserX } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

// =====================================================================
//  InactiveTab — the same filtering UI as the Users tab (role tabs +
//  class filter + search), but scoped to status === 'inactive'. These
//  users are kept for records but cannot log in. Per row:
//    • Reactivate -> flips status back to 'active' (moves to Users tab)
//    • Delete     -> permanent hard delete (frees roll / PEN / TC)
//  While a user sits here they still HOLD their roll number for their
//  academic year (the backend counts them), so a new student can't reuse
//  it until this user is deleted or the academic year changes.
// =====================================================================
export default function InactiveTab({ data, fetchData, user }) {
  const [activeRoleTab, setActiveRoleTab] = useState('all');
  const [activeClass, setActiveClass]     = useState('');
  const [search, setSearch]               = useState('');
  const [busyId, setBusyId]               = useState(null);

  // Only inactive users belong here.
  const inactiveUsers = useMemo(
    () => data.users.filter(u => (u.status || '').toLowerCase() === 'inactive'),
    [data.users]
  );

  const roleTabs = useMemo(() => {
    const counts = {};
    inactiveUsers.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });
    return Object.keys(counts).map(r => ({ name: r, count: counts[r] }));
  }, [inactiveUsers]);

  const classFilters = useMemo(() => {
    const counts = {};
    inactiveUsers.forEach(u => { if (u.class_id) counts[u.class_id] = (counts[u.class_id] || 0) + 1; });
    return (data.classes || [])
      .map(c => ({
        id: c.id,
        label: `${c.className}${c.section ? ` - ${c.section}` : ''}`,
        count: counts[c.id] || 0
      }))
      .filter(c => c.count > 0);
  }, [inactiveUsers, data.classes]);

  const showClassFilter = useMemo(() => {
    if (classFilters.length === 0) return false;
    return activeRoleTab.toLowerCase().includes('student');
  }, [classFilters, activeRoleTab]);

  // Keep a valid class selected when the student class filter is showing.
  useEffect(() => {
    if (!showClassFilter) return;
    const stillValid = classFilters.some(c => String(c.id) === String(activeClass));
    if (!stillValid && classFilters.length) setActiveClass(String(classFilters[0].id));
  }, [showClassFilter, classFilters, activeClass]);

  const filteredUsers = useMemo(() => {
    const onStudentTab = activeRoleTab.toLowerCase().includes('student');
    let list = inactiveUsers;
    if (activeRoleTab !== 'all') list = list.filter(u => u.role === activeRoleTab);
    if (onStudentTab && activeClass) list = list.filter(u => String(u.class_id) === String(activeClass));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q));
    }
    const isStudentRow = (u) => (u.role || '').toLowerCase().includes('student');
    const rollVal = (u) => { const n = parseInt(u.roll_no, 10); return isNaN(n) ? Number.POSITIVE_INFINITY : n; };
    return [...list].sort((a, b) => {
      const aStu = isStudentRow(a), bStu = isStudentRow(b);
      if (aStu !== bStu) return aStu ? -1 : 1;
      if (aStu && bStu) {
        const ra = rollVal(a), rb = rollVal(b);
        if (ra !== rb) return ra - rb;
        return (a.name || '').localeCompare(b.name || '');
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [inactiveUsers, activeRoleTab, activeClass, search]);

  const serialMap = useMemo(() => {
    const map = {}; let n = 0;
    filteredUsers.forEach(u => {
      if (!(u.role || '').toLowerCase().includes('student')) { n += 1; map[u.id] = n; }
    });
    return map;
  }, [filteredUsers]);

  const teacherSubjectNames = (uid) => {
    const ids = (data.teacherSubjects && data.teacherSubjects[uid]) || [];
    if (ids.length === 0) return '';
    return ids.map(sid => data.subjects?.find(s => s.id === sid)?.name).filter(Boolean).join(', ');
  };

  const handleReactivate = async (u) => {
    if (!window.confirm(`Reactivate "${u.name}"?\n\nThey will regain login access and move back to the Users tab.`)) return;
    setBusyId(u.id);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${u.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to reactivate.');
      } else {
        fetchData();
      }
    } catch (e) { alert('Failed to reactivate.'); }
    setBusyId(null);
  };

  const handleDelete = async (u) => {
    if (u.role === 'Super Admin') return alert('The Super Admin account cannot be deleted from here.');
    if (!window.confirm(`Permanently delete "${u.name}"?\n\nThis removes the record entirely and frees their roll number / PEN / TC for reuse. This cannot be undone.`)) return;
    setBusyId(u.id);
    try {
      await fetch(`${API_BASE_URL}/admin/users/${u.id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { alert('Failed to delete.'); }
    setBusyId(null);
  };

  const useDropdown = classFilters.length > 6;
  const firstColHeader = useMemo(() => {
    const tab = (activeRoleTab || '').toLowerCase();
    if (tab === 'all') return 'Roll / S.No';
    if (tab.includes('student')) return 'Roll';
    return 'S.No';
  }, [activeRoleTab]);

  return (
    <div className="space-y-6">
      {/* Note */}
      <div className="bg-amber-50/60 border border-amber-100 rounded-md p-4 flex gap-3 text-[11px] text-amber-800 leading-relaxed">
        <Info className="size-4 shrink-0 text-amber-500 mt-0.5" />
        <p>
          <strong className="font-semibold text-amber-900">Inactive users.</strong>{' '}
          These people are kept for records but <strong>cannot log in</strong>. Use <strong>Reactivate</strong> to restore login access (they move back to the Users tab), or <strong>Delete</strong> to remove them permanently.
          While a user stays here, their roll number is still reserved for their academic year — a new student can reuse that roll only after this user is deleted, or once the academic year changes.
        </p>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center mb-2">
        <div className="relative w-full sm:w-auto flex-1 max-w-sm">
          <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0 pointer-events-none" />
          <input
            placeholder="Search name, email, username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm bg-white border border-zinc-200 rounded-md pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-zinc-900 placeholder:text-zinc-400 transition-colors shadow-sm"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveRoleTab('all')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              activeRoleTab === 'all'
                ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
            }`}>
            All <span className="ml-1 opacity-80 tabular-nums">{inactiveUsers.length}</span>
          </button>
          {roleTabs.map(t => (
            <button key={t.name} onClick={() => setActiveRoleTab(t.name)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                activeRoleTab === t.name
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                  : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
              }`}>
              {t.name} <span className="ml-1 opacity-80 tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>

        {showClassFilter && (
          <div className="flex items-center gap-3 flex-wrap bg-zinc-50/50 p-2.5 rounded-md ring-1 ring-black/5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">
              <GraduationCap className="size-3.5 shrink-0" /> Class Filter
            </span>
            {useDropdown ? (
              <div className="relative w-full sm:w-auto">
                <select value={activeClass} onChange={e => setActiveClass(e.target.value)}
                  className="h-8 w-full sm:w-auto appearance-none rounded border border-zinc-200 bg-white pl-2 pr-7 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
                  {classFilters.map(c => (<option key={c.id} value={c.id}>{c.label} ({c.count})</option>))}
                </select>
                <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
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

      {/* Table */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-zinc-50/50">
              <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">{firstColHeader} / User Details</th>
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
                      <span className="w-6 shrink-0 text-center text-xs font-semibold text-zinc-400 tabular-nums">
                        {isStudent ? (u.roll_no || '—') : (serialMap[u.id] || '—')}
                      </span>
                      {u.profile_pic ? (
                        <img src={u.profile_pic} alt={u.name} className="size-8 rounded-full object-cover shrink-0 ring-1 ring-black/5 grayscale" />
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
                      u.role === 'Super Admin'
                        ? 'bg-primary/10 text-primary ring-primary/20'
                        : 'bg-zinc-50 text-zinc-700 ring-zinc-200'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-700">
                    {isStudent && cls ? `${cls.className}${u.section ? ` - ${u.section}` : ''}`
                      : isTeacher ? (teacherSubjectNames(u.id) || <span className="italic text-zinc-400">Unassigned</span>)
                      : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ring-1 bg-amber-50 text-amber-700 ring-amber-600/10">
                      inactive
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleReactivate(u)} disabled={busyId === u.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50">
                        <RotateCcw className="size-3.5 shrink-0" /> Reactivate
                      </button>
                      <button onClick={() => handleDelete(u)} disabled={busyId === u.id}
                        className="p-1.5 text-zinc-400 hover:text-accent rounded transition-colors disabled:opacity-50" title="Delete permanently">
                        <Trash2 className="size-4 shrink-0" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="5" className="px-5 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <UserX className="size-8" />
                    <span className="text-xs italic">No inactive users in this view.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}