import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import { 
  ChevronLeft, Mail, Phone, MapPin, Calendar, 
  BookOpen, Award, Clock, ShieldCheck, User 
} from 'lucide-react';
import Timetable from '../Timetable/Timetable'; // Use your existing component
// Import your Attendance/Performance components if needed

export default function UserProfileDetail({ userId, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/profile/${userId}`);
      const data = await res.json();
      setProfile(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const tabs = useMemo(() => {
    const t = [{ id: 'info', label: 'Basic Info', icon: User }];
    if (profile?.role === 'Teacher') t.push({ id: 'timetable', label: 'Schedule', icon: Clock });
    if (profile?.role === 'Student' || profile?.role === 'Teacher') {
      t.push({ id: 'performance', label: 'Performance', icon: Award });
      t.push({ id: 'attendance', label: 'Attendance', icon: ShieldCheck });
    }
    return t;
  }, [profile]);

  if (loading) return <div className="h-96 flex items-center justify-center animate-pulse text-slate-400 font-black">LOADING PROFILE...</div>;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Back Button */}
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm transition-colors">
        <ChevronLeft size={20} /> Back to Directory
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 text-center sticky top-6">
            <div className="w-40 h-40 mx-auto rounded-[2rem] overflow-hidden shadow-xl ring-4 ring-white mb-6">
              {profile.profile_pic ? (
                <img src={profile.profile_pic} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                  <User size={64} />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{profile.name}</h2>
            <div className="mt-2 inline-block px-4 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-full">
              {profile.role}
            </div>
            <p className="text-slate-400 text-sm font-medium mt-1">ID: {profile.admission_no || profile.username || userId}</p>
          </div>
        </div>

        {/* Dynamic Content Pane */}
        <div className="lg:col-span-3 space-y-6">
          {/* Tab Switcher */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${
                  activeTab === t.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'
                }`}
              >
                <t.icon size={16} /> {t.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 min-h-[500px]">
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest">Personal & Contact</h4>
                  <InfoRow icon={Mail} label="Email" value={profile.email} />
                  <InfoRow icon={Phone} label="Phone" value={profile.phone_no} />
                  <InfoRow icon={Calendar} label="Date of Birth" value={profile.dob} />
                  <InfoRow icon={MapPin} label="Address" value={profile.address} />
                </div>
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest">Academic Info</h4>
                  {profile.role === 'Student' && (
                    <>
                      <InfoRow icon={BookOpen} label="Class" value={profile.class_id} />
                      <InfoRow icon={ShieldCheck} label="Roll No" value={profile.roll_no} />
                    </>
                  )}
                  <InfoRow icon={ShieldCheck} label="Status" value={profile.status} />
                </div>
              </div>
            )}

            {activeTab === 'timetable' && (
               <Timetable teacherId={userId} isEmbedded={true} />
            )}

            {activeTab === 'performance' && (
              <div className="text-center py-20 text-slate-400">
                <Award size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold">Performance Analytics Loading...</p>
              </div>
            )}
            
            {/* Add other tab contents as needed */}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-slate-700">{value || '—'}</p>
      </div>
    </div>
  );
}