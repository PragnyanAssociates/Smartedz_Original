import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { FilePlus2, ListChecks } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import VoucherForm from './VoucherForm';
import Register from './Register';

const MODULE_NAME = 'DailyExpenses';

export default function DailyExpenses() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const can = permissions?.can;
  const canEdit = can ? can(MODULE_NAME, 'edit') : true;

  const [tab, setTab]           = useState('voucher');   // 'voucher' | 'register'
  const [editingId, setEditingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [school, setSchool]     = useState({});

  // School name + logo for the voucher header (same source as DashboardHeader).
  useEffect(() => {
    if (!user?.institutionId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
        const data = await res.json();
        const inst = data?.institution;
        if (!alive || !inst) return;
        const isBranch = !!inst.parent_id;
        const name = isBranch ? (inst.parent_name || inst.name || '') : (inst.name || '');
        setSchool({
          name, branch: isBranch ? (inst.name || '') : '',
          logo: inst.logo || '', email: inst.school_email || '', phone: inst.phone || ''
        });
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [user]);

  const newVoucher  = () => { setEditingId(null); setTab('voucher'); };
  const editVoucher = (id) => { setEditingId(id); setTab('voucher'); };
  const onSaved = () => { setEditingId(null); setRefreshKey(k => k + 1); setTab('register'); };

  const tabs = [
    { id: 'voucher',  label: editingId ? 'Edit Voucher' : 'New Voucher', icon: FilePlus2 },
    { id: 'register', label: 'Register', icon: ListChecks },
  ];

  return (
    <div className="p-8 max-w-[1440px] w-full mx-auto animate-in fade-in duration-700">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Daily Expenses</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Record debit vouchers for day-to-day school expenses and keep a running register.</p>
        </div>
        {!canEdit && <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-full uppercase tracking-wider">View only</span>}
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-zinc-200 pb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { if (t.id === 'voucher' && tab === 'register') setEditingId(null); setTab(t.id); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-primary text-white' : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
            }`}>
            <t.icon className="size-3.5 shrink-0" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'voucher' ? (
        <VoucherForm
          key={editingId || 'new'}
          user={user} canEdit={canEdit} editingId={editingId} school={school}
          onSaved={onSaved}
          onCancel={editingId ? () => { setEditingId(null); setTab('register'); } : null}
        />
      ) : (
        <Register
          user={user} canEdit={canEdit} refreshKey={refreshKey}
          onEdit={editVoucher} onNew={newVoucher}
        />
      )}
    </div>
  );
}