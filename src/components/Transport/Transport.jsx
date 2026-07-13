import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { Bus, Users, Route as RouteIcon, UserCheck } from 'lucide-react';
import Vehicles from './Vehicles';
import Drivers from './Drivers';
import Routes from './Routes';
import AssignStudents from './AssignStudents';

const MODULE_NAME = 'Transport';

export default function Transport() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const can = permissions?.can;
  const canEdit = can ? can(MODULE_NAME, 'edit') : true;
  const canDelete = can ? can(MODULE_NAME, 'delete') : true;

  const [tab, setTab] = useState('routes');

  const tabs = [
    { id: 'routes',   label: 'Routes',              icon: RouteIcon },
    { id: 'students', label: 'Assign Students',     icon: UserCheck },
    { id: 'vehicles', label: 'Vehicles',            icon: Bus },
    { id: 'staff',    label: 'Drivers & Conductors', icon: Users },
  ];
  const props = { user, canEdit, canDelete };

  return (
    <div className="p-8 max-w-[1440px] w-full mx-auto animate-in fade-in duration-700">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Transport</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[60ch]">Manage vehicles, drivers &amp; conductors, routes with pickup/drop points, and student assignments.</p>
        </div>
        {!canEdit && <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-full uppercase tracking-wider">View only</span>}
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-zinc-200 pb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => !t.soon && setTab(t.id)} disabled={t.soon}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-primary text-white'
              : t.soon ? 'text-zinc-300 border border-zinc-100 cursor-not-allowed'
              : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
            }`}>
            <t.icon className="size-3.5 shrink-0" /> {t.label}
            {t.soon && <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-300 ml-1">soon</span>}
          </button>
        ))}
      </div>

      {tab === 'routes' && <Routes {...props} />}
      {tab === 'students' && <AssignStudents {...props} />}
      {tab === 'vehicles' && <Vehicles {...props} />}
      {tab === 'staff' && <Drivers {...props} />}
    </div>
  );
}