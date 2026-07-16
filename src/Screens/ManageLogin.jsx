import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from './PermissionsContext';
import {
  Users, ShieldCheck, Calendar, Layers, CircleArrowUp, CircleCheck, BookOpen,
  Download, UserX, ListOrdered, HelpCircle, X, ShieldAlert
} from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';
import UserTab        from './UserTab';
import InactiveTab    from './InactiveTab';
import Rolestab       from './Rolestab';
import Permissionstab from './Permissionstab';
import MenuOrderTab   from './MenuOrderTab';
import Academicstab   from './Academicstab';
import Classestab     from './Classestab';
import Promotiontab   from './Promotiontab';
import SubjectsTab    from './SubjectsTab';
import DownloadsTab   from './DownloadsTab';

const MODULE_NAME = 'Manage Logins';

export default function ManageLogin() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const can = permissions?.can;
  const isAllAccess = !!permissions?.isAllAccess;

  const canEdit   = can ? can(MODULE_NAME, 'edit')   : false;
  const canDelete = can ? can(MODULE_NAME, 'delete') : false;
  // The guide is written for whoever actually sets the school up.
  const fullAccess = isAllAccess || (canEdit && canDelete);

  const [activeTab, setActiveTab] = useState('users');
  const [help, setHelp] = useState(false);
  const [data, setData] = useState({
    users: [], roles: [], classes: [], academicYears: [], subjects: [],
    teacherSubjects: {}, subjectClasses: {}, modules: [], institution: null
  });
  const [loading, setLoading] = useState(true);

  // Menu Order rewrites the sidebar for the whole school, so it's the
  // Super Admin's call alone — matching the backend's write check.
  const canOrderMenu = user?.role === 'Super Admin' || user?.role === 'Developer';

  const fetchData = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}?fullUsers=true`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Manage data fetch error:', e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs = [
    { id: 'users',       label: 'Users',          icon: Users },
    { id: 'roles',       label: 'Roles',          icon: ShieldCheck },
    { id: 'permissions', label: 'Permissions',    icon: CircleCheck },
    ...(canOrderMenu ? [{ id: 'menu-order', label: 'Menu Order', icon: ListOrdered }] : []),
    { id: 'classes',     label: 'Classes',        icon: Layers },
    { id: 'subjects',    label: 'Subjects',       icon: BookOpen },
    { id: 'promotion',   label: 'Promotion',      icon: CircleArrowUp },
    { id: 'academics',   label: 'Academics Year', icon: Calendar },
    { id: 'inactive',    label: 'Inactive',       icon: UserX },
    { id: 'downloads',   label: 'Downloads',      icon: Download },
  ];
  const tabProps = { data, fetchData, user };

  return (
   <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* 1. Page Header */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">System Configuration</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Manage users, roles, classes, and core academic settings.
          </p>
        </div>
        {fullAccess && (
          <button onClick={() => setHelp(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start sm:self-auto">
            <HelpCircle className="size-3.5" /> How to use
          </button>
        )}
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
            {activeTab === 'inactive'    && <InactiveTab {...tabProps} />}
            {activeTab === 'roles'       && <Rolestab {...tabProps} />}
            {activeTab === 'permissions' && <Permissionstab {...tabProps} />}
            {activeTab === 'menu-order'  && canOrderMenu && <MenuOrderTab {...tabProps} />}
            {activeTab === 'academics'   && <Academicstab {...tabProps} />}
            {activeTab === 'classes'     && <Classestab {...tabProps} />}
            {activeTab === 'subjects'    && <SubjectsTab {...tabProps} />}
            {activeTab === 'promotion'   && <Promotiontab {...tabProps} />}
            {activeTab === 'downloads'   && <DownloadsTab {...tabProps} />}
          </>
        )}
      </div>

      {help && fullAccess && <HelpModal tab={activeTab} onClose={() => setHelp(false)} />}
    </div>
  );
}

// =====================================================================
//  How-to-use notes — the guide follows the tab you're standing on, so
//  it always answers "what do I do on THIS screen?". Same shell as the
//  Transport module guide.
// =====================================================================
const GUIDES = {
  users: {
    title: 'Managing users',
    steps: [
      ['1 \u00b7 Add a person', 'Users \u2192 Add. Name, login details and Role. The Role is the only thing that decides what they see \u2014 set it right and the sidebar follows automatically.'],
      ['2 \u00b7 Students need a class', 'Pick the class and give a roll number. Roll numbers are unique per class per academic year, so the same number can exist in Class 8 and Class 9, and again next year.'],
      ['3 \u00b7 Edit', 'Edit updates anything on the person, including moving them to another class or role. Every change records who made it and when, in IST.'],
      ['4 \u00b7 Deactivate vs delete', 'Deactivating parks the account under the Inactive tab and takes it out of live counts \u2014 you can bring it back. Delete is permanent and cannot be undone.'],
      ['5 \u00b7 Bulk work', 'Use the Downloads tab to pull the current user list out to Excel.'],
    ],
    note: 'A new user can only work once their role has permissions. If someone logs in to an empty sidebar, the fix is in the Permissions tab, not here.'
  },
  roles: {
    title: 'Roles',
    steps: [
      ['1 \u00b7 The three built-ins', 'Super Admin, Teacher and Student are permanent system roles \u2014 they exist for every school and cannot be removed.'],
      ['2 \u00b7 Make your own', 'Add any role your school actually uses \u2014 Principal, Accountant, Librarian, Driver & Assistant, and so on. The name you type here is what you pick when adding a user.'],
      ['3 \u00b7 A new role sees nothing', 'Every module starts hidden for a brand new role. That is deliberate \u2014 you grant access on purpose, never by accident.'],
      ['4 \u00b7 Next step', 'Go straight to the Permissions tab and give the new role its modules, otherwise anyone assigned to it logs in to an empty sidebar.'],
    ],
    note: 'Renaming a role that users are already on affects every one of them at once. Create a new role instead if you only mean to change some people.'
  },
  permissions: {
    title: 'Module permissions',
    steps: [
      ['1 \u00b7 Pick the role', 'Target Role, top right. The matrix below is that role and only that role \u2014 permissions are per role, never per person.'],
      ['2 \u00b7 Read, Edit, Delete', 'Read lets them open the module. Edit lets them change things. Delete gives them the row actions. Edit or Delete switch Read on for you automatically.'],
      ['3 \u00b7 Hide', 'Hide drops the module from their sidebar entirely \u2014 stronger than simply not granting Read. A module you never touch stays hidden anyway.'],
      ['4 \u00b7 Super Admin', 'Super Admin always keeps full Read, Edit and Delete \u2014 those boxes are locked on. The only lever is Hide, for anything you don\'t want in your own sidebar. Manage Logins can\'t be hidden, or you\'d lock yourself out of this screen.'],
      ['5 \u00b7 Save', 'Save Permissions writes the matrix for the selected role. Users pick up the change the next time they load the dashboard.'],
    ],
    note: 'Hiding a module for Super Admin hides it for every Super Admin in the school, since permissions attach to the role, not the person.'
  },
  'menu-order': {
    title: 'Menu order',
    steps: [
      ['1 \u00b7 Your school, your order', 'The arrows or the position number set where each module sits in the sidebar, top to bottom. Put what your staff use daily at the top.'],
      ['2 \u00b7 It applies to everyone', 'One order for the whole school. Each role still only sees the modules it has permission for \u2014 the order just decides where they land.'],
      ['3 \u00b7 Save', 'Save Order stores it. Reset to default puts you back on the standard SmartEdz order.'],
      ['4 \u00b7 What\'s missing', 'Profile, Notifications and Academic Calendar aren\'t listed \u2014 they live in the header and footer, not the menu, so they have no position.'],
    ],
    note: 'Order and access are separate. This tab never grants or removes a module; that stays with the Permissions tab.'
  },
  classes: {
    title: 'Classes',
    steps: [
      ['1 \u00b7 Set up the structure', 'Add each class your school runs, with its sections. This is the backbone \u2014 attendance, timetable, homework, fees and reports all hang off it.'],
      ['2 \u00b7 Get it right early', 'Students, subjects and the timetable all point at these classes, so it is far easier to settle the structure before you bulk-add users.'],
      ['3 \u00b7 Then assign', 'Once a class exists you can attach students to it in Users, subjects to it in Subjects, and periods to it in Timetable.'],
    ],
    note: 'Removing a class that still has students or records attached affects everything linked to it. Move the students out first.'
  },
  subjects: {
    title: 'Subjects',
    steps: [
      ['1 \u00b7 Add the subjects', 'Create every subject your school teaches, once. They are reused across classes rather than re-typed per class.'],
      ['2 \u00b7 Map to classes', 'Tie each subject to the classes that study it. That mapping drives the subject lists in Timetable, Homework, Marks and Reports.'],
      ['3 \u00b7 Map to teachers', 'Assign teachers to the subjects they take. This is what makes a teacher\'s own screens \u2014 their homework, their marks, their performance \u2014 show the right subjects.'],
    ],
    note: 'If a subject is missing from a dropdown elsewhere in the app, the mapping here is almost always the reason.'
  },
  promotion: {
    title: 'Promotion',
    steps: [
      ['1 \u00b7 One class at a time', 'Pick the class from the dropdown \u2014 it opens on the first class by default. There is no "all classes" option on purpose; promotion is too big an action to fire school-wide in one click.'],
      ['2 \u00b7 Promote', 'Move the selected students up into the next class for the new academic year. The promotion history is kept, so you can always trace where a student came from.'],
      ['3 \u00b7 Passing out', 'Students leaving school are passed out to Alumni from the dropdown here. Once they are alumni they drop out of live user counts and the Directory, but their records stay.'],
      ['4 \u00b7 Check the year first', 'Promotion is written against the academic year, so make sure the right year is active under the Academics Year tab before you run it.'],
    ],
    note: 'The backend decides the academic year and passout year, not the screen. Promote in the correct year and everything downstream \u2014 reports, marks, attendance \u2014 lines up.'
  },
  academics: {
    title: 'Academic year',
    steps: [
      ['1 \u00b7 Add the year', 'Create each academic year (e.g. 2026-2027) as your school moves through them.'],
      ['2 \u00b7 Mark the active one', 'Exactly one year is active. That year is what new attendance, marks, fees and promotions get stamped with.'],
      ['3 \u00b7 It drives everything', 'This tab is the single source of truth for the year filters across the whole app \u2014 Reports, Performance, Alumni and Pre-Admissions all read from it.'],
      ['4 \u00b7 Rolling over', 'Add and activate the new year first, then run Promotion. In that order the new year gets the promoted students and last year\'s records stay untouched.'],
    ],
    note: 'Switching the active year changes what every user sees by default across the app. It is the biggest single switch on this screen \u2014 do it deliberately, at the start of a session.'
  },
  inactive: {
    title: 'Inactive users',
    steps: [
      ['1 \u00b7 What lands here', 'Anyone deactivated in the Users tab. They cannot log in, and they are left out of live user counts, the Directory and notifications.'],
      ['2 \u00b7 Bring them back', 'Reactivate to put the account back in the Users tab exactly as it was \u2014 nothing was lost while it sat here.'],
      ['3 \u00b7 Or remove for good', 'Delete from here is permanent. Use it only when you are certain the record is not needed.'],
    ],
    note: 'Deactivating is the safe option for staff who have left and students who might return. It keeps the history intact and the account recoverable.'
  },
  downloads: {
    title: 'Downloads',
    steps: [
      ['1 \u00b7 Export', 'Pull the school\'s records out as spreadsheet files for your own records, audits or sharing.'],
      ['2 \u00b7 Current data', 'Exports reflect what is in the system right now, including the filters that apply to the list you are exporting.'],
      ['3 \u00b7 Handle with care', 'These files carry personal details of students and staff. Store them somewhere safe and share them only with people who should have them.'],
    ],
    note: 'The file downloads straight to your device \u2014 nothing is emailed or stored anywhere by SmartEdz.'
  }
};

function HelpModal({ tab, onClose }) {
  const content = GUIDES[tab] || GUIDES.users;
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
            <ShieldAlert className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-800 leading-relaxed">{content.note}</p>
          </div>
        </div>
      </div>
    </div>
  );
}