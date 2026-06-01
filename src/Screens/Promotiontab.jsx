import React, { useState, useMemo } from 'react';
import { Users, CircleArrowUp, Search, GraduationCap, ChevronDown } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';
import { useAuth } from '../context/AuthContext';

// Sentinel value for the special "Alumni (Passout)" destination.
const ALUMNI_TARGET = 'ALUMNI';

export default function PromotionTab({ data, fetchData }) {
  const { user } = useAuth();
  const [sourceClassId, setSourceClassId]       = useState('');
  const [target, setTarget]                     = useState({ classId: '', section: '' });
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [search, setSearch]                     = useState('');

  // Show only ACTIVE students — students who are role-student AND not
  // already passed out. Alumni (status 'alumni') have left the school
  // and must never appear in the promotion list.
  const allStudents = useMemo(
    () => data.users.filter(u =>
      (u.role || '').toLowerCase().includes('student') &&
      (u.status || '').toLowerCase() !== 'alumni'
    ),
    [data.users]
  );

  const visibleStudents = useMemo(() => {
    let list = allStudents;
    if (sourceClassId) list = list.filter(s => String(s.class_id) === String(sourceClassId));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => (s.name || '').toLowerCase().includes(q));
    }
    return list;
  }, [allStudents, sourceClassId, search]);

  const allVisibleIds = visibleStudents.map(s => s.id);
  const allSelected   = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedStudents.includes(id));

  const isAlumniTarget = target.classId === ALUMNI_TARGET;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedStudents(prev => prev.filter(id => !allVisibleIds.includes(id)));
    } else {
      setSelectedStudents(prev => Array.from(new Set([...prev, ...allVisibleIds])));
    }
  };

  const toggleOne = (id) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Resolve the active academic year from whatever the data bundle carries.
  const activeYear = useMemo(() => {
    const years = data.academicYears || data.academic_years || [];
    return years.find(y => y.is_active) || years[0] || null;
  }, [data]);

  const classLabel = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;

  // --- Normal class promotion -------------------------------------
  const promoteToClass = async () => {
    const res = await fetch(`${API_BASE_URL}/admin/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentIds: selectedStudents,
        targetClassId: target.classId,
        targetSection: target.section || null
      })
    });
    if (res.ok) {
      alert('Students promoted successfully.');
      setSelectedStudents([]);
      fetchData();
    } else {
      alert('Failed to promote students.');
    }
  };

  // --- Passout -> Alumni -------------------------------------------
  const promoteToAlumni = async () => {
    const srcClass = data.classes.find(c => String(c.id) === String(sourceClassId));
    const finalClass = srcClass ? classLabel(srcClass) : null;
    const passoutYear = (activeYear && (activeYear.year_name || activeYear.name)) || '';

    const institutionId = user?.institutionId ?? data?.institutionId ?? data?.institution?.id ?? data?.users?.[0]?.institutionId ?? null;

    if (!institutionId) {
      return alert('Could not determine the institution. Please reload and try again.');
    }

    const res = await fetch(`${API_BASE_URL}/admin/alumni/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institutionId,
        student_ids: selectedStudents,
        academic_year_id: activeYear?.id ?? null,
        passout_year: passoutYear || null,
        final_class: finalClass ?? null
      })
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      alert(`${d.added ?? selectedStudents.length} student(s) moved to Alumni.`);
      setSelectedStudents([]);
      fetchData();
    } else {
      alert(d.error || 'Failed to move students to Alumni.');
    }
  };

  const handlePromote = async () => {
    if (selectedStudents.length === 0) return alert('Select at least one student.');
    if (!target.classId) return alert('Select a target class.');

    if (isAlumniTarget) {
      if (!window.confirm(`Move ${selectedStudents.length} student(s) to Alumni? They will be marked as passed out.`)) return;
      return promoteToAlumni();
    }

    if (!window.confirm(`Promote ${selectedStudents.length} student(s) to the selected class?`)) return;
    return promoteToClass();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Student Promotion Engine</h3>
        <p className="text-[11px] text-zinc-500 max-w-3xl mt-1 leading-relaxed">
          Filter by source class, tick the students who passed (or use Select All), pick the destination
          class and section, then execute. Students who failed simply stay unchecked &mdash; they remain in their current class.
          To graduate a final-year class, pick <strong className="text-zinc-700 font-semibold">Alumni (Passout)</strong> as the destination.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT — student list */}
        <div className="ring-1 ring-black/5 rounded-lg bg-white p-6 flex flex-col h-full">
          <h4 className="text-[11px] font-semibold text-zinc-500 uppercase mb-5 tracking-wider flex items-center gap-2">
            <Users className="size-4 text-primary" /> Select Students to Move
          </h4>

          <div className="space-y-3 mb-5 shrink-0">
            <div className="relative">
              <select
                value={sourceClassId}
                onChange={e => { setSourceClassId(e.target.value); setSelectedStudents([]); }}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors">
                <option value="">All Classes</option>
                {data.classes.map(c => (
                  <option key={c.id} value={c.id}>{classLabel(c)}</option>
                ))}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <Search className="size-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                placeholder="Search by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
              />
            </div>

            {visibleStudents.length > 0 && (
              <label className="flex items-center gap-2.5 px-3 py-2 bg-zinc-50 rounded-md cursor-pointer ring-1 ring-black/5 hover:bg-zinc-100/50 transition-colors">
                <input
                  type="checkbox"
                  className="size-4 accent-primary cursor-pointer rounded border-zinc-300"
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span className="text-[10px] font-semibold text-zinc-700 uppercase tracking-wider">
                  {allSelected ? 'Deselect All Visible' : 'Select All Visible'}
                </span>
                <span className="ml-auto text-[10px] font-semibold text-zinc-400">
                  ({visibleStudents.length})
                </span>
              </label>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px] space-y-2 pr-1 custom-scrollbar">
            {visibleStudents.length > 0 ? visibleStudents.map(s => {
              const cls = data.classes.find(c => c.id === s.class_id);
              const isOn = selectedStudents.includes(s.id);
              return (
                <label key={s.id} className={`flex items-center gap-3 p-3 rounded-md transition-colors cursor-pointer ring-1 ${
                  isOn 
                    ? 'bg-primary/5 ring-primary/20' 
                    : 'bg-zinc-50/50 ring-black/5 hover:bg-zinc-50 hover:ring-zinc-200'
                }`}>
                  <input type="checkbox"
                    className="size-4 accent-primary cursor-pointer rounded border-zinc-300"
                    checked={isOn}
                    onChange={() => toggleOne(s.id)} />
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-900 text-sm">{s.name}</span>
                    <span className="text-[10px] font-medium text-zinc-500 mt-0.5 uppercase tracking-wider">
                      {cls ? classLabel(cls) : 'Unassigned'}{s.roll_no ? ` • Roll ${s.roll_no}` : ''}
                    </span>
                  </div>
                </label>
              );
            }) : (
              <p className="text-zinc-400 italic text-center py-10 text-xs">
                No students match this filter.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT — destination */}
        <div className="ring-1 ring-black/5 rounded-lg bg-white p-6 h-fit flex flex-col">
          <h4 className="text-[11px] font-semibold text-zinc-500 uppercase mb-5 tracking-wider flex items-center gap-2">
            <CircleArrowUp className="size-4 text-primary" /> Destination Settings
          </h4>

          <div className="space-y-4 mb-8">
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1.5 block">
                Target Class <span className="text-accent">*</span>
              </label>
              <div className="relative">
                <select 
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors"
                  value={target.classId}
                  onChange={e => setTarget({ ...target, classId: e.target.value })}>
                  <option value="">Select Target Class...</option>
                  {data.classes.map(c => (
                    <option key={c.id} value={c.id}>{classLabel(c)}</option>
                  ))}
                  <option value={ALUMNI_TARGET}>Alumni (Passout)</option>
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {!isAlumniTarget && (
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1.5 block">
                  Target Section <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input 
                  placeholder="e.g. A"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                  value={target.section}
                  onChange={e => setTarget({ ...target, section: e.target.value })} 
                />
              </div>
            )}

            {isAlumniTarget && (
              <div className="flex items-start gap-3 bg-accent/5 ring-1 ring-accent/20 rounded-md p-4">
                <GraduationCap className="size-5 text-accent shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-zinc-700 leading-relaxed">
                  These students will be snapshotted into <strong className="font-semibold text-accent">Alumni</strong> as passed out
                  {activeYear ? <> for <strong className="font-semibold">{activeYear.year_name || activeYear.name}</strong></> : null}
                  , and removed from the active student roster. This action cannot be auto-undone.
                </p>
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-zinc-100 mt-auto">
            <div className="flex justify-between items-center mb-5">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Selected Students</span>
              <span className="text-2xl font-semibold text-zinc-900 tabular-nums">{selectedStudents.length}</span>
            </div>
            
            <button
              onClick={handlePromote}
              disabled={selectedStudents.length === 0 || !target.classId}
              className={`w-full py-2.5 rounded-md text-xs font-medium transition-colors disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed ${
                isAlumniTarget
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}>
              {isAlumniTarget ? 'Move to Alumni' : 'Execute Batch Promotion'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}