import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { IndianRupee, Percent } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import FeeAssign  from './FeeAssign';
import Concession from './Concession';

export default function FeeManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('assign');
  const [data, setData] = useState({
    academic_year_id: null, classes: [], students: [], plans: [], installments: [], assignments: []
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/data/${user.institutionId}`);
      const json = await res.json();
      setData(json || {});
    } catch (e) {
      console.error('Fee data fetch error:', e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs = [
    { id: 'assign',     label: 'Fee Assign', icon: IndianRupee },
    { id: 'concession', label: 'Concession', icon: Percent },
  ];
  const tabProps = { data, fetchData, user };

  return (
    <div className="p-8 max-w-[1440px] w-full mx-auto animate-in fade-in duration-700">
      {/* Page Header */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Fee Management</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Set class fee structures, assign payment modes, and manage concessions.
          </p>
        </div>
      </header>

      {/* Segmented Tabs (same style as System Configuration) */}
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
            {activeTab === 'assign'     && <FeeAssign {...tabProps} />}
            {activeTab === 'concession' && <Concession {...tabProps} />}
          </>
        )}
      </div>
    </div>
  );
}