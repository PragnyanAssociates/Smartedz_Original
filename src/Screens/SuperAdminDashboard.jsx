import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Shield, Trash2, Calendar as CalendarIcon, TrendingUp, Search, Mail, Lock, User } from 'lucide-react';
import Sidebar from './Sidebar';
import DashboardHeader from './DashboardHeader';

export default function SuperAdminDashboard() {
  const { user, usersList, refreshData, API_URL } = useAuth();
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'Teacher', 
    modules: '' 
  });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userForm, institutionId: user.institutionId })
    });
    if (res.ok) { 
      refreshData(); 
      setIsUserModalOpen(false); 
      setUserForm({ name: '', email: '', password: '', role: 'Teacher', modules: '' });
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader />
        
        <main className="flex-1 overflow-y-auto p-10 space-y-10">
          
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                Good afternoon, {user?.name?.split(' ')[0]} 👋
              </h2>
              <p className="text-slate-500 font-medium text-lg mt-2">Here is your academic overview for today.</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="bg-white px-6 py-3 rounded-2xl border shadow-sm flex items-center gap-3">
                  <CalendarIcon className="text-blue-500" size={20} />
                  <span className="font-bold text-slate-700">
                    {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
               </div>
               <button 
                 onClick={() => setIsUserModalOpen(true)} 
                 className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200 px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 flex items-center"
               >
                  <Plus className="mr-2" size={20}/> Add Staff
               </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform">
                  <Users size={120} />
                </div>
                <div className="flex items-center gap-2 mb-6 font-black text-[10px] uppercase tracking-widest opacity-80">
                   <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div> Total Staff
                </div>
                <h3 className="text-6xl font-black mb-2">{usersList.length}</h3>
                <p className="text-blue-100 font-bold text-sm uppercase">Active Registry Users</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Attendance Status</p>
                    <div className="w-10 h-10 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                </div>
                <div>
                    <h3 className="text-5xl font-black text-slate-800">82.5%</h3>
                    <p className="text-blue-500 font-bold text-[10px] mt-2 uppercase tracking-tighter">Up to date</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                 <div className="flex justify-between items-start mb-4">
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Overall Performance</p>
                    <TrendingUp className="text-emerald-500" />
                </div>
                <div>
                    <h3 className="text-5xl font-black text-slate-800">66%</h3>
                    <p className="text-slate-400 font-medium text-[10px] mt-2 uppercase tracking-tighter">Average Grade Rating</p>
                </div>
            </div>
          </div>

          <div className="rounded-[3rem] shadow-sm overflow-hidden bg-white ring-1 ring-slate-100">
            <div className="p-8 border-b border-slate-50 flex flex-row justify-between items-center bg-slate-50/30">
              <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Staff & Permissions</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Filter staff..." className="pl-10 pr-4 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b bg-slate-50/50">
                    <th className="p-6">Name</th>
                    <th className="p-6">Email Address</th>
                    <th className="p-6">Access Role</th>
                    <th className="p-6">Modules Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                      <td className="p-6 font-bold text-slate-800">{u.name}</td>
                      <td className="p-6 text-slate-500 font-medium text-sm">{u.email}</td>
                      <td className="p-6">
                        <span className={`px-4 py-1.5 rounded-full font-black text-[10px] uppercase ${
                          u.role === 'Super Admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-6">
                        <span className="text-[11px] font-black text-blue-600 uppercase tracking-tight">
                          {u.modules || "FULL ACCESS"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-slide-up relative">
            <button onClick={() => setIsUserModalOpen(false)} className="absolute top-6 right-6 text-slate-400 text-2xl hover:text-slate-600">&times;</button>
            <h2 className="text-2xl font-black mb-6 text-slate-800">Create User Account</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Full Name</label>
                <input required placeholder="Ex: John Doe" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Login Email</label>
                <input type="email" required placeholder="john@school.com" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Access Password</label>
                <input required placeholder="••••••••" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">System Role</label>
                <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50 appearance-none cursor-pointer">
                  <option value="Teacher">Teacher</option>
                  <option value="Admin">Admin</option>
                  <option value="Principal">Principal</option>
                  <option value="Student">Student</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Assign Modules (Comma separated)</label>
                <input placeholder="Ex: Academics, Attendance, Finance" value={userForm.modules} onChange={e => setUserForm({...userForm, modules: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50" />
              </div>
              <button type="submit" className="w-full py-6 font-black text-lg bg-slate-900 text-white rounded-[1.5rem] mt-4 shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest">
                Create User Account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}