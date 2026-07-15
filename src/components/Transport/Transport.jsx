import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { Bus, Users, Route as RouteIcon, UserCheck, ClipboardCheck, NotebookPen } from 'lucide-react';
import Vehicles from './Vehicles';
import Drivers from './Drivers';
import Routes from './Routes';
import AssignStudents from './AssignStudents';
import Attendance from './Attendance';
import MyTransport from './MyTransport';
import VehicleLogBook from './VehicleLogBook';

const MODULE_NAME = 'Transport';

export default function Transport() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const can = permissions?.can;
  const canEdit = can ? can(MODULE_NAME, 'edit') : true;
  const canDelete = can ? can(MODULE_NAME, 'delete') : true;

  const isStudent = (user?.role || '').toLowerCase().includes('student');

  const [tab, setTab] = useState('routes');

  const tabs = [
    { id: 'routes',     label: 'Routes',               icon: RouteIcon },
    { id: 'students',   label: 'Assign Students',      icon: UserCheck },
    { id: 'attendance', label: 'Attendance',           icon: ClipboardCheck },
    { id: 'vehicles',   label: 'Vehicles',             icon: Bus },
    { id: 'staff',      label: 'Drivers & Conductors', icon: Users },
    { id: 'logbook',    label: 'Vehicle Log Book',     icon: NotebookPen },
  ];
  const props = { user, canEdit, canDelete };

  return (
    <div className="p-8 max-w-[1440px] w-full mx-auto animate-in fade-in duration-700">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Transport</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[60ch]">
            {isStudent ? 'Your route, bus, crew details, live tracking and attendance.' : 'Manage vehicles, drivers & conductors, routes with pickup/drop points, student assignments and attendance.'}
          </p>
        </div>
        {!isStudent && !canEdit && <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-full uppercase tracking-wider">View only</span>}
      </header>

      {isStudent ? (
        <MyTransport user={user} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-zinc-200 pb-4">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  tab === t.id ? 'bg-primary text-white' : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
                }`}>
                <t.icon className="size-3.5 shrink-0" /> {t.label}
              </button>
            ))}
          </div>

          {tab === 'routes' && <Routes {...props} />}
          {tab === 'students' && <AssignStudents {...props} />}
          {tab === 'attendance' && <Attendance user={user} canEdit={canEdit} />}
          {tab === 'vehicles' && <Vehicles {...props} />}
          {tab === 'staff' && <Drivers {...props} />}
          {tab === 'logbook' && <VehicleLogBook {...props} />}
        </>
      )}
    </div>
  );
}