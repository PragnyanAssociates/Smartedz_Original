import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';

export default function Overview() {
  const { user, usersList } = useAuth();

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Greeting Section */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            Good afternoon, {user?.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-slate-500 font-medium text-lg mt-2">Here is your academic overview for today.</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl border shadow-sm flex items-center gap-3">
          <CalendarIcon className="text-blue-500" size={20} />
          <span className="font-bold text-slate-700">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Total Staff Card */}
        <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform duration-500">
            <Users size={120} />
          </div>
          <div className="flex items-center gap-2 mb-6 font-black text-[10px] uppercase tracking-widest opacity-80">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div> Total Staff
          </div>
          <h3 className="text-6xl font-black mb-2">{usersList.length}</h3>
          <p className="text-blue-100 font-bold text-sm uppercase">Active Registry Users</p>
        </div>

        {/* Attendance Card */}
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

        {/* Performance Card */}
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
    </div>
  );
}