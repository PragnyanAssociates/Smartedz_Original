import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  ShieldCheck, 
  Calendar, 
  Layers, 
  CircleArrowUp, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  CircleCheck, 
  X 
} from 'lucide-react';

export default function ManageLogin() {
  const { user, API_URL } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [data, setData] = useState({ users: [], roles: [], classes: [], academicYears: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/data/${user.institutionId}`);
      const json = await res.json();
      setData(json);
    } catch (e) { 
      console.error("Fetch error:", e); 
    }
    setLoading(false);
  };

  useEffect(() => { 
    if (user?.institutionId) fetchData(); 
  }, [user]);

  // --- Sub-Component: Users Tab ---
  const UserTab = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState({ 
      name: '', email: '', password: '', role: 'Student', 
      class_id: '', section: '', roll_no: '', status: 'active' 
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(`${API_URL}/api/admin/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, institutionId: user.institutionId })
        });
        if (res.ok) { 
          fetchData(); 
          setIsModalOpen(false); 
          setForm({ name: '', email: '', password: '', role: 'Student', class_id: '', section: '', roll_no: '', status: 'active' });
        }
      } catch (err) {
        console.error("Save error:", err);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">User Registry</h3>
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-100">
            <Plus size={18}/> Add User
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-5">Name & Contact</th>
                <th className="p-5">System Role</th>
                <th className="p-5">Class/Section</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.users.length > 0 ? data.users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-700">
                    {u.name}
                    <br/>
                    <span className="text-xs font-medium text-slate-400">{u.email}</span>
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      u.role === 'Super Admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-5 font-medium text-slate-500">
                    {u.class_id ? `Class ${u.class_id} - ${u.section || 'A'}` : 'Staff Member'}
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit size={16}/></button>
                      <button className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                   <td colSpan="4" className="p-10 text-center text-slate-400 font-medium italic">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600"><X size={24}/></button>
              <h2 className="text-2xl font-black mb-8 text-slate-800">Create New Account</h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                  <input required className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                  <input type="email" required className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                  <input type="password" required className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                  <select className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="Student">Student</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Admin">Admin</option>
                    <option value="Principal">Principal</option>
                  </select>
                </div>
                {form.role === 'Student' && (
                   <>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Assign Class</label>
                      <select className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none" value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})}>
                        <option value="">Select Class</option>
                        {data.classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Section</label>
                      <input className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none" placeholder="e.g. A" value={form.section} onChange={e => setForm({...form, section: e.target.value})} />
                    </div>
                   </>
                )}
                <button type="submit" className="col-span-2 bg-slate-900 hover:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-4 transition-all shadow-xl">
                  Save User Account
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- Sub-Component: Promotion Tab ---
  const PromotionTab = () => {
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [target, setTarget] = useState({ classId: '', section: '' });

    const handlePromote = async () => {
      if(selectedStudents.length === 0 || !target.classId) return alert("Select students and target class.");
      try {
        const res = await fetch(`${API_URL}/api/admin/promote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentIds: selectedStudents, targetClassId: target.classId, targetSection: target.section })
        });
        if (res.ok) { 
          alert("Students Promoted Successfully!"); 
          fetchData(); 
          setSelectedStudents([]); 
        }
      } catch (err) { console.error(err); }
    };

    return (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800">Student Promotion Engine</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-xs font-black text-blue-500 uppercase mb-6 tracking-widest flex items-center gap-2">
               <Users size={14}/> Select Students to Move
            </h4>
            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {data.users.filter(u => u.role === 'Student').map(s => (
                <label key={s.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedStudents.includes(s.id) ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-slate-50 border-transparent hover:border-slate-200'
                }`}>
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                    checked={selectedStudents.includes(s.id)} 
                    onChange={() => {
                      setSelectedStudents(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])
                    }} 
                  />
                  <div className="flex flex-col">
                    <span className="font-black text-slate-700 text-sm leading-none">{s.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Class {s.class_id || 'N/A'} • Section {s.section || 'N/A'}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
             <h4 className="text-xs font-black text-emerald-500 uppercase mb-6 tracking-widest flex items-center gap-2">
               <CircleArrowUp size={14}/> Destination Settings
             </h4>
             <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Target Class</label>
                  <select className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none" onChange={e => setTarget({...target, classId: e.target.value})}>
                    <option value="">Select Target Class</option>
                    {data.classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Target Section</label>
                  <input placeholder="e.g. A" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none" onChange={e => setTarget({...target, section: e.target.value})} />
                </div>
             </div>
             
             <div className="pt-6 border-t border-slate-50">
               <div className="flex justify-between items-center mb-6">
                 <span className="text-sm font-bold text-slate-400">Selected Students</span>
                 <span className="text-xl font-black text-slate-800">{selectedStudents.length}</span>
               </div>
               <button 
                 onClick={handlePromote} 
                 disabled={selectedStudents.length === 0}
                 className="w-full bg-blue-600 disabled:bg-slate-200 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-100"
               >
                 Execute Batch Promotion
               </button>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'roles', label: 'Roles', icon: ShieldCheck },
    { id: 'permissions', label: 'Permissions', icon: CircleCheck },
    { id: 'academics', label: 'Academics', icon: Calendar },
    { id: 'classes', label: 'Classes', icon: Layers },
    { id: 'promotion', label: 'Promotion', icon: CircleArrowUp },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit">
        {tabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-bold text-sm transition-all ${
              activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <t.icon size={18} /> {t.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="min-h-[500px]">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {activeTab === 'users' && <UserTab />}
            {activeTab === 'promotion' && <PromotionTab />}
            {(activeTab !== 'users' && activeTab !== 'promotion') && (
              <div className="bg-white p-20 rounded-[3rem] border border-dashed border-slate-200 text-center">
                 <p className="text-slate-300 font-black uppercase tracking-[0.3em] text-sm">Configuring {activeTab} Module...</p>
                 <p className="text-slate-400 mt-2 font-medium">This module will be linked to the backend endpoints soon.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}