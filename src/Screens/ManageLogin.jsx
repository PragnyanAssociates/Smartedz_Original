import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, ShieldCheck, Calendar, Layers, CircleArrowUp, CircleCheck, BookOpen } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

import UserTab        from './UserTab';
import Rolestab       from './Rolestab';
import Permissionstab from './Permissionstab';
import Academicstab   from './Academicstab';
import Classestab     from './Classestab';
import Promotiontab   from './Promotiontab';
import SubjectsTab    from './SubjectsTab';

export default function ManageLogin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [data, setData] = useState({
    users: [], roles: [], classes: [], academicYears: [], subjects: [],
    teacherSubjects: {}, subjectClasses: {}, modules: [], institution: null
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Manage data fetch error:', e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs = [
    { id: 'users',       label: 'Users',       icon: Users },
    { id: 'roles',       label: 'Roles',       icon: ShieldCheck },
    { id: 'permissions', label: 'Permissions', icon: CircleCheck },
    { id: 'academics',   label: 'Academics Year',   icon: Calendar },
    { id: 'classes',     label: 'Classes',     icon: Layers },
    { id: 'subjects',    label: 'Subjects',    icon: BookOpen },
    { id: 'promotion',   label: 'Promotion',   icon: CircleArrowUp },
  ];

  const tabProps = { data, fetchData, user };

  return (
    <div className="p-8 max-w-[1440px] w-full mx-auto animate-in fade-in duration-700">
      
      {/* 1. Page Header */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">System Configuration</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Manage users, roles, classes, and core academic settings.
          </p>
        </div>
      </header>

      {/* Segmented Tabs (Matches Timetable style) */}
      <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-zinc-200 pb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === t.id 
                ? 'bg-primary text-white' 
                : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
            }`}
          >
            <t.icon className="size-3.5 shrink-0" /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'users'       && <UserTab {...tabProps} />}
            {activeTab === 'roles'       && <Rolestab {...tabProps} />}
            {activeTab === 'permissions' && <Permissionstab {...tabProps} />}
            {activeTab === 'academics'   && <Academicstab {...tabProps} />}
            {activeTab === 'classes'     && <Classestab {...tabProps} />}
            {activeTab === 'subjects'    && <SubjectsTab {...tabProps} />}
            {activeTab === 'promotion'   && <Promotiontab {...tabProps} />}
          </>
        )}
      </div>
    </div>
  );
}