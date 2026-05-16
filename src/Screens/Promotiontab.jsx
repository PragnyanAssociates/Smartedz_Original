import React, { useState, useMemo } from 'react';
import { Users, CircleArrowUp, Search } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

export default function PromotionTab({ data, fetchData }) {
  const [sourceClassId, setSourceClassId]       = useState('');
  const [target, setTarget]                     = useState({ classId: '', section: '' });
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [search, setSearch]                     = useState('');

  // Show only students (any role containing "student", case-insensitive)
  const allStudents = useMemo(
    () => data.users.filter(u => (u.role || '').toLowerCase().includes('student')),
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

  const handlePromote = async () => {
    if (selectedStudents.length === 0) return alert('Select at least one student.');
    if (!target.classId) return alert('Select a target class.');
    if (!window.confirm(`Promote ${selectedStudents.length} student(s) to the selected class?`)) return;
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

  const classLabel = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800">Student Promotion Engine</h3>
        <p className="text-slate-400 text-sm font-medium mt-1">
          Filter by source class, tick the students who passed (or use Select All), pick the destination
          class and section, then execute. Students who failed simply stay unchecked — they remain in their current class.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* LEFT — student list */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h4 className="text-xs font-black text-blue-500 uppercase mb-6 tracking-widest flex items-center gap-2">
            <Users size={14} /> Select Students to Move
          </h4>

          <div className="space-y-3 mb-5">
            <select
              value={sourceClassId}
              onChange={e => { setSourceClassId(e.target.value); setSelectedStudents([]); }}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500/10">
              <option value="">All Classes</option>
              {data.classes.map(c => (
                <option key={c.id} value={c.id}>{classLabel(c)}</option>
              ))}
            </select>

            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search by name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            {visibleStudents.length > 0 && (
              <label className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-2xl cursor-pointer border border-blue-100">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-blue-600 cursor-pointer"
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span className="text-sm font-black text-blue-700 uppercase tracking-wider">
                  {allSelected ? 'Deselect All Visible' : 'Select All Visible'}
                </span>
                <span className="ml-auto text-xs font-bold text-blue-500">
                  ({visibleStudents.length})
                </span>
              </label>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {visibleStudents.length > 0 ? visibleStudents.map(s => {
              const cls = data.classes.find(c => c.id === s.class_id);
              const isOn = selectedStudents.includes(s.id);
              return (
                <label key={s.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                  isOn ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-slate-50 border-transparent hover:border-slate-200'
                }`}>
                  <input type="checkbox"
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                    checked={isOn}
                    onChange={() => toggleOne(s.id)} />
                  <div className="flex flex-col">
                    <span className="font-black text-slate-700 text-sm leading-none">{s.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                      {cls ? classLabel(cls) : 'Unassigned'}{s.roll_no ? ` • Roll ${s.roll_no}` : ''}
                    </span>
                  </div>
                </label>
              );
            }) : (
              <p className="text-slate-400 italic text-center py-10 font-medium text-sm">
                No students match this filter.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT — destination */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6 h-fit">
          <h4 className="text-xs font-black text-emerald-500 uppercase mb-6 tracking-widest flex items-center gap-2">
            <CircleArrowUp size={14} /> Destination Settings
          </h4>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Target Class</label>
              <select className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                value={target.classId}
                onChange={e => setTarget({ ...target, classId: e.target.value })}>
                <option value="">Select Target Class</option>
                {data.classes.map(c => (
                  <option key={c.id} value={c.id}>{classLabel(c)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Target Section (optional)</label>
              <input placeholder="e.g. A"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                value={target.section}
                onChange={e => setTarget({ ...target, section: e.target.value })} />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-50">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-bold text-slate-400">Selected Students</span>
              <span className="text-3xl font-black text-slate-800">{selectedStudents.length}</span>
            </div>
            <button
              onClick={handlePromote}
              disabled={selectedStudents.length === 0 || !target.classId}
              className="w-full bg-blue-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-100">
              Execute Batch Promotion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}