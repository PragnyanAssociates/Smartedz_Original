import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, ShieldCheck, Calendar, Layers, CircleArrowUp, CircleCheck } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

import UserTab        from './UserTab';
import Rolestab       from './Rolestab';
import Permissionstab from './Permissionstab';
import Academicstab   from './Academicstab';
import Classestab     from './Classestab';
import Promotiontab   from './Promotiontab';

export default function ManageLogin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [data, setData] = useState({
    users: [], roles: [], classes: [], academicYears: [], modules: [], institution: null
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
    { id: 'academics',   label: 'Academics',   icon: Calendar },
    { id: 'classes',     label: 'Classes',     icon: Layers },
    { id: 'promotion',   label: 'Promotion',   icon: CircleArrowUp },
  ];

  const tabProps = { data, fetchData, user };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Tab nav */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-bold text-sm transition-all ${
              activeTab === t.id
                ? 'bg-slate-900 text-white shadow-lg'
                : 'text-slate-400 hover:bg-slate-50'
            }`}>
            <t.icon size={18} /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {activeTab === 'users'       && <UserTab {...tabProps} />}
            {activeTab === 'roles'       && <Rolestab {...tabProps} />}
            {activeTab === 'permissions' && <Permissionstab {...tabProps} />}
            {activeTab === 'academics'   && <Academicstab {...tabProps} />}
            {activeTab === 'classes'     && <Classestab {...tabProps} />}
            {activeTab === 'promotion'   && <Promotiontab {...tabProps} />}
          </>
        )}
      </div>
    </div>
  );
}