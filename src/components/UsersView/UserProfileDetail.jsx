import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import { 
  ChevronLeft, Mail, Phone, MapPin, Calendar, 
  BookOpen, Award, Clock, ShieldCheck, User, Loader2 
} from 'lucide-react';
import Timetable from '../Timetable/Timetable';

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

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center animate-in fade-in duration-300">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      
      {/* Back Button */}
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ChevronLeft className="size-4" /> Back to Directory
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 items-start">
        
        {/* Profile Card (Left Column) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-6 sm:p-8 text-center flex flex-col items-center">
            
            <div className="relative mb-5">
              {profile.profile_pic ? (
                <img src={profile.profile_pic} className="size-32 sm:size-40 rounded-full object-cover ring-1 ring-black/5 shadow-sm" alt={profile.name} />
              ) : (
                <div className="size-32 sm:size-40 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-300 ring-1 ring-black/5 shadow-sm">
                  <User className="size-16" />
                </div>
              )}
            </div>
            
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight leading-tight">{profile.name}</h2>
            
            <div className="mt-2.5">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary ring-1 ring-primary/20">
                {profile.role}
              </span>
            </div>
            
            <p className="text-zinc-500 text-xs font-medium mt-2">
              ID: {profile.admission_no || profile.username || userId}
            </p>
          </div>
        </div>

        {/* Dynamic Content Pane (Right Column) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Tab Switcher */}
          <div className="flex justify-start">
            <div className="inline-flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar w-full sm:w-auto">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-4 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                    activeTab === t.id ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  <t.icon className="size-3.5 shrink-0" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content Area */}
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 sm:p-8 min-h-[400px]">
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                <div className="space-y-6">
                  <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider border-b border-zinc-100 pb-2">Personal & Contact</h4>
                  <div className="space-y-4">
                    <InfoRow icon={Mail} label="Email" value={profile.email} />
                    <InfoRow icon={Phone} label="Phone" value={profile.phone_no} />
                    <InfoRow icon={Calendar} label="Date of Birth" value={profile.dob} />
                    <InfoRow icon={MapPin} label="Address" value={profile.address} />
                  </div>
                </div>
                
                <div className="space-y-6">
                  <h4 className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider border-b border-zinc-100 pb-2">Academic Info</h4>
                  <div className="space-y-4">
                    {profile.role === 'Student' && (
                      <>
                        <InfoRow icon={BookOpen} label="Class" value={profile.class_id} />
                        <InfoRow icon={ShieldCheck} label="Roll No" value={profile.roll_no} />
                      </>
                    )}
                    <InfoRow icon={ShieldCheck} label="Status" value={profile.status} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'timetable' && (
               <Timetable teacherId={userId} isEmbedded={true} />
            )}

            {activeTab === 'performance' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Award className="size-12 text-zinc-200 mb-4" />
                <p className="font-medium text-zinc-500 text-sm">Performance Analytics Loading...</p>
              </div>
            )}
            
            {activeTab === 'attendance' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShieldCheck className="size-12 text-zinc-200 mb-4" />
                <p className="font-medium text-zinc-500 text-sm">Attendance Records Loading...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <div className="size-8 sm:size-10 rounded-md bg-zinc-50 ring-1 ring-zinc-200 flex items-center justify-center text-zinc-400 shrink-0">
        <Icon className="size-4 sm:size-5" />
      </div>
      <div className="flex flex-col min-w-0 pt-0.5">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-zinc-900 truncate">{value || '-'}</p>
      </div>
    </div>
  );
}