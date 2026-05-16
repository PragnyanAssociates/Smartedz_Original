// =====================================================================
//  SmartEdz ERP - Module Registry (single source of truth)
//
//  Every dashboard module is defined HERE once. The sidebar reads from
//  it, the Permissions matrix reads from it, and the access guard reads
//  from it. To add a new ERP screen (e.g. "Library"), just append one
//  entry below and rebuild.
//
//  IMPORTANT: `module_name` is what gets stored in the `permissions`
//  table. Don't rename it once users start saving permissions for it;
//  if you must, write a migration that updates `permissions.module_name`
//  at the same time.
// =====================================================================

import {
  LayoutDashboard, ShieldCheck, Wallet, Calendar, Users, BookOpen,
  FileText, ClipboardList, Video, MonitorPlay, BarChart3
} from 'lucide-react';

export const MODULES = [
  { id: 'overview',       module_name: 'Overview',            label: 'Overview',            icon: LayoutDashboard, alwaysVisible: true },
  { id: 'manage-login',   module_name: 'Manage Logins',       label: 'Manage Logins',       icon: ShieldCheck },
  { id: 'payments',       module_name: 'Payments & Receipts', label: 'Payments & Receipts', icon: Wallet },
  { id: 'timetable',      module_name: 'Timetable',           label: 'Timetable',           icon: Calendar },
  { id: 'attendance',     module_name: 'My Attendance',       label: 'My Attendance',       icon: Users },
  { id: 'syllabus',       module_name: 'Syllabus',            label: 'Syllabus',            icon: BookOpen },
  { id: 'lesson-plan',    module_name: 'Lesson Plan',         label: 'Lesson Plan',         icon: FileText },
  { id: 'homework',       module_name: 'Homework',            label: 'Homework',            icon: ClipboardList },
  { id: 'workshop',       module_name: 'Workshop Videos',     label: 'Workshop Videos',     icon: Video },
  { id: 'online-classes', module_name: 'Online Classes',      label: 'Online Classes',      icon: MonitorPlay },
  { id: 'progress',       module_name: 'Progress Reports',    label: 'Progress Reports',    icon: BarChart3 }
];

// Plain string list — what the backend serves to the Permissions tab.
// Mirrors MODULES exactly, in the same order.
export const MODULE_NAMES = MODULES.map(m => m.module_name);

// Map of id → module_name, useful when the dashboard knows the tab id.
export const TAB_TO_MODULE = MODULES.reduce((acc, m) => {
  acc[m.id] = m.module_name;
  return acc;
}, {});