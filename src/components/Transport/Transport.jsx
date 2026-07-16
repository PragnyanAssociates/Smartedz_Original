import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { Bus, Users, Route as RouteIcon, UserCheck, ClipboardCheck, NotebookPen, HelpCircle, X, Lock, ShieldCheck } from 'lucide-react';
import Vehicles from './Vehicles';
import Drivers from './Drivers';
import Routes from './Routes';
import AssignStudents from './AssignStudents';
import Attendance from './Attendance';
import MyTransport from './MyTransport';
import MyDuty from './MyDuty';
import VehicleLogBook from './VehicleLogBook';

const MODULE_NAME = 'Transport';
const CREW_ROLE = 'Driver & Assistant';

export default function Transport() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const can = permissions?.can;
  const isAllAccess = !!permissions?.isAllAccess;

  // ---- Permission gates (Super Admin / Developer bypass via isAllAccess) ----
  const canView   = can ? can(MODULE_NAME, 'view')   : true;   // read OR edit OR delete
  const canEdit   = can ? can(MODULE_NAME, 'edit')   : true;
  const canDelete = can ? can(MODULE_NAME, 'delete') : true;
  // Read + Edit + Delete on this module == the full admin experience,
  // whatever the role is called. Read-only keeps the same screens, minus actions.
  const fullAccess = isAllAccess || (canEdit && canDelete);

  const role = (user?.role || '').trim();
  const isStudent = role.toLowerCase().includes('student');
  const isCrew    = role.toLowerCase() === CREW_ROLE.toLowerCase();

  // Which experience to render:
  //   student            -> their own route only
  //   crew (no full)     -> their duty: assigned bus, route, attendance, log book
  //   everyone else      -> admin console (actions gated by canEdit / canDelete)
  const view = isStudent ? 'student' : (isCrew && !fullAccess) ? 'crew' : 'admin';

  const [tab, setTab] = useState('routes');
  const [help, setHelp] = useState(false);

  if (!canView) {
    return (
      <div className="p-8 max-w-[1440px] w-full mx-auto">
        <div className="ring-1 ring-black/5 rounded-lg bg-white p-12 text-center">
          <Lock className="size-7 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-700">You don't have access to Transport.</p>
          <p className="text-xs text-zinc-500 mt-1">Ask your Super Admin to grant access in Permissions.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'routes',     label: 'Routes',               icon: RouteIcon },
    { id: 'students',   label: 'Assign Students',      icon: UserCheck },
    { id: 'attendance', label: 'Attendance',           icon: ClipboardCheck },
    { id: 'vehicles',   label: 'Vehicles',             icon: Bus },
    { id: 'staff',      label: 'Drivers & Assistants', icon: Users },
    { id: 'logbook',    label: 'Vehicle Log Book',     icon: NotebookPen },
  ];
  const props = { user, canEdit, canDelete };

  const subtitle =
    view === 'student' ? 'Your route, bus, crew contacts, live tracking and attendance.'
    : view === 'crew'  ? 'Your assigned bus, route navigation, student attendance and log book.'
    : 'Manage vehicles, drivers & assistants, routes with pickup/drop points, student assignments, attendance and the log book.';

  return (
    <div className="p-8 max-w-[1440px] w-full mx-auto animate-in fade-in duration-700">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Transport</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[62ch]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {view === 'admin' && !canEdit && (
            <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-full uppercase tracking-wider">View only</span>
          )}
          <button onClick={() => setHelp(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50">
            <HelpCircle className="size-3.5" /> How to use
          </button>
        </div>
      </header>

      {view === 'student' && <MyTransport user={user} />}
      {view === 'crew' && <MyDuty user={user} />}

      {view === 'admin' && (
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

      {help && <HelpModal view={view} onClose={() => setHelp(false)} />}
    </div>
  );
}

// =====================================================================
//  How-to-use notes — tailored to what the person can actually do.
// =====================================================================
function HelpModal({ view, onClose }) {
  const content = {
    admin: {
      title: 'Setting up Transport',
      steps: [
        ['1 · Add your buses', 'Vehicles tab → Add Vehicle. Fill the number, code (e.g. VPSB1), model, capacity, registration date and a photo. The code and photo show up across Routes and the Log Book.'],
        ['2 · Create your crew', 'Users screen → add each driver / assistant with the role "Driver & Assistant". Then in Drivers & Assistants → Add, tick them and register them as a Driver or an Assistant. Use Edit to store licence no, Aadhaar and their proof images.'],
        ['3 · Build the route', 'Routes → New Route. Name it, pick the bus, driver and assistant, then add Pickup and Drop stops under their tabs. For each stop paste a Google Maps link (short links resolve automatically) or click the map to drop a pin. Save — the map draws the road route.'],
        ['4 · Assign students', 'Assign Students → pick the route → pick a class → tick students roll-wise, optionally setting their pickup/drop stop. They now appear in attendance.'],
        ['5 · Daily running', 'The driver taps Start Trip on their screen — Google Maps opens for navigation and the bus goes live on everyone\'s map. The assistant marks Pickup and Drop attendance. The Trip column on Routes is about TODAY: Live, Done today, or Not started.'],
        ['6 · Attendance: mark vs report', 'Mark a day is the daily job — one route, one trip, one date. Summary & report is the review: any date range, per student, with pickup/drop counts and an attendance %. Download gives you it in Excel.'],
        ['7 · Records', 'Vehicle Log Book → Daily Log for trips/distance/fuel per bus per day (totals roll up over any date range), and Service / Repair for costs and work done. Both download to Excel for exactly the period on screen.'],
      ],
      note: 'Transport is kept by DATE, not academic year — roads and buses don\'t reset in June, and fuel or insurance has nothing to do with a school term. The year chips on the range filters simply fill the From / To dates from your Academics Year module, so a yearly view is one click and a range can still span years. Permissions: Read to look, Read + Edit to change things, Read + Edit + Delete for the full console. Hide removes Transport from their sidebar entirely.'
    },
    crew: {
      title: 'Your daily run',
      steps: [
        ['Before you leave', 'Check the bus and route details at the top. If you drive more than one route, pick the right one from the dropdown.'],
        ['Start the trip', 'Tap Start Trip. Google Maps opens with the full route for navigation, and your live location is shared so students and the school can see the bus. Keep this page open while driving.'],
        ['Mark attendance', 'Assistant: open the Attendance tab, choose Pickup or Drop, then mark each student Present or Absent and Save. Marking again for the same trip just updates it.'],
        ['End the trip', 'Tap Complete Trip when the run is finished. The bus disappears from everyone\'s map. Each day starts fresh — yesterday\'s trip never shows as today\'s.'],
        ['Log book', 'At the end of the day, add trips, distance and fuel for your bus under Log Book → Daily Log.'],
      ],
      note: 'You only ever see your own bus, your route and your students — nothing about other routes or crew.'
    },
    student: {
      title: 'Your school bus',
      steps: [
        ['Route & bus', 'The card at the top shows your route, bus number and name, plus your driver and assistant with their phone numbers — tap a number to call.'],
        ['Stops', 'Under My Route, switch between Pickup and Drop to see every stop in order. Your own stop is highlighted.'],
        ['Live tracking', 'When your driver starts the trip, the bus appears on the map and moves in real time, so you can see how close it is to your stop.'],
        ['Attendance', 'My Attendance shows your calendar. Green = present both trips, yellow = present on one, red = absent.'],
      ],
      note: 'Details are set by your school. If anything looks wrong, contact your transport in-charge.'
    }
  }[view];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="size-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {content.steps.map(([t, d], i) => (
            <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
              <p className="text-xs font-semibold text-zinc-800">{t}</p>
              <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
            </div>
          ))}
          <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
            <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-800 leading-relaxed">{content.note}</p>
          </div>
        </div>
      </div>
    </div>
  );
}