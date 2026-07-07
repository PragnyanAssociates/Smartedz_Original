import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { IndianRupee, Percent } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { usePermissions } from '../../Screens/PermissionsContext';
import FeeAssign  from './FeeAssign';
import Concession from './Concession';
import MyFee      from './MyFee';

// Must match the module_name used in Modules.js / the Permissions matrix.
const MODULE_NAME = 'FeeManagement';

export default function FeeManagement() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const can = permissions?.can;

  // Students only ever see their OWN fee — never the management UI.
  const isStudent = (user?.role || '').toLowerCase().includes('student');
  // Non-student users manage fees only if the admin granted them Edit; a
  // read-only grant shows the tables but disables every mutating control.
  const canEdit = can ? can(MODULE_NAME, 'edit') : true;

  const [activeTab, setActiveTab] = useState('assign');
  const [data, setData] = useState({
    academic_year_id: null, classes: [], students: [], plans: [], installments: [], assignments: []
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.institutionId || isStudent) return; // students don't pull institution-wide data
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/data/${user.institutionId}`);
      const json = await res.json();
      setData(json || {});
    } catch (e) {
      console.error('Fee data fetch error:', e);
    }
    setLoading(false);
  }, [user, isStudent]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- Student self-view ----
  if (isStudent) return <MyFee user={user} />;

  // ---- Management view (admin / permitted staff) ----
  const tabs = [
    { id: 'assign',     label: 'Fee Assign', icon: IndianRupee },
    { id: 'concession', label: 'Concession', icon: Percent },
  ];
  const tabProps = { data, fetchData, user, canEdit };

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
        {!canEdit && (
          <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
            View only
          </span>
        )}
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