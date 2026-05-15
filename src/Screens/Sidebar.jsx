import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Wallet, Calendar, Users, BookOpen, 
  FileText, ClipboardList, Video, MonitorPlay, 
  BarChart3, Search, LogOut, LayoutDashboard 
} from 'lucide-react';

const menuItems = [
  { icon: Wallet, label: 'Payments & Receipts' },
  { icon: Calendar, label: 'Timetable' },
  { icon: Users, label: 'My Attendance' },
  { icon: BookOpen, label: 'Syllabus' },
  { icon: FileText, label: 'Lesson Plan' },
  { icon: ClipboardList, label: 'Homework' },
  { icon: Video, label: 'Workshop Videos' },
  { icon: MonitorPlay, label: 'Online Classes' },
  { icon: ClipboardList, label: 'Exams & Schedules' },
  { icon: BarChart3, label: 'Progress Reports' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-80 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 overflow-hidden shrink-0">
      {/* Title Section */}
      <div className="p-8">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Student Dashboard</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Your Learning Gateway</p>
      </div>

      {/* Search Bar */}
      <div className="px-6 mb-6">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search Modules..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar pb-6">
        <div className="px-4 mb-4">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Main Menu</span>
        </div>
        
        {menuItems.map((item, idx) => (
          <button 
            key={idx} 
            className="w-full flex items-center gap-4 px-5 py-3.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-[1.2rem] transition-all group"
          >
            <item.icon size={22} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
            <span className="text-[14px] font-bold tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User Profile Footer */}
      <div className="p-6 border-t bg-slate-50/50">
        <div className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm relative group">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-100">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800 truncate">{user?.name}</p>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{user?.role}</p>
          </div>
          <button 
            onClick={logout}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </aside>
  );
}