import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Edit, ChevronDown, CalendarDays, HelpCircle, ShieldCheck, User } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';

const eventTypesConfig = {
  Meeting: { color: '#3b82f6', displayName: 'Meeting' },
  Event: { color: '#f59e0b', displayName: 'Event' },
  Festival: { color: '#ef4444', displayName: 'Festival' },
  Holiday: { color: '#10b981', displayName: 'Holiday' },
  Exam: { color: '#8b5cf6', displayName: 'Exam' },
  Other: { color: '#ec4899', displayName: 'Other' },
};

const MODULE_NAME = 'Academic Calendar';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// How-to-use content — same shape/style as the Transport module guide.
const GUIDE_STEPS = [
  ['1 \u00b7 Move around the year', 'Use the arrows either side of the month name to step backward or forward. Today is always marked with a filled circle, and the sidebar lists every event of the month you are looking at.'],
  ['2 \u00b7 Add an event', 'Click any day cell on the grid \u2014 the New Event form opens with that date already filled in. Give it a title, pick a type, and optionally add a time (e.g. 10:00 AM) and a description. Save with Create Event.'],
  ['3 \u00b7 Pick the right type', 'Meeting, Event, Festival, Holiday, Exam or Other. The type decides the colour of the chip on the grid and the stripe in the sidebar \u2014 see the Color Legend card. Use Holiday for no-school days so everyone spots them at a glance.'],
  ['4 \u00b7 Edit or remove', 'Hover an event in the Events list and use Edit to change any field, or Delete to remove it. Deleting also clears the notification that went out for it.'],
  ['5 \u00b7 Who gets told', 'Creating or updating an event pushes a notification to every active user of the school \u2014 students, teachers and staff. Tapping it in Notifications brings them straight back here.'],
  ['6 \u00b7 Records', 'Each event stores who created it and who last edited it, with IST timestamps. That line shows under the event in the sidebar, so you always know the source.'],
];
const GUIDE_NOTE = 'Permissions: give a role Read to let them look, Read + Edit to let them add and change events, and Read + Edit + Delete for the full console like a Super Admin. Hide removes Academic Calendar from their sidebar entirely.';

export default function AcademicCalendar() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const can = permissions?.can;
  const isAllAccess = !!permissions?.isAllAccess;

  const canEdit   = can ? can(MODULE_NAME, 'edit')   : false;
  const canDelete = can ? can(MODULE_NAME, 'delete') : false;

  const isAdmin = user?.role === 'Super Admin' || canEdit;
  // The guide is written for people who actually set the calendar up.
  // Read-only (and hidden) roles never see the button.
  const fullAccess = isAllAccess || (canEdit && canDelete);

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ name: '', time: '', description: '', type: 'Meeting' });

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/calendar/${user.institutionId}`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (user?.institutionId) {
      fetchEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.institutionId]);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const calendarGrid = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  }, [month, year]);

  const changeMonth = (offset) => {
    setCurrentDate(new Date(year, month + offset, 1));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isEdit = !!editingEvent;
    const url = isEdit ? `${API_BASE_URL}/admin/calendar/${editingEvent.id}` : `${API_BASE_URL}/admin/calendar`;
    const method = isEdit ? 'PUT' : 'POST';
    const body = { ...form, event_date: selectedDate, institutionId: user.institutionId, adminId: user.id };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      setIsModalOpen(false);
      fetchEvents();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    await fetch(`${API_BASE_URL}/admin/calendar/${id}`, { method: 'DELETE' });
    fetchEvents();
  };

  const openAdd = (day) => {
    if (!isAdmin) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setEditingEvent(null);
    setForm({ name: '', time: '', description: '', type: 'Meeting' });
    setIsModalOpen(true);
  };

  const openEdit = (event) => {
    if (!isAdmin) return;
    setEditingEvent(event);
    setSelectedDate(event.event_date.split('T')[0]);
    setForm({ name: event.name, time: event.time || '', description: event.description || '', type: event.type });
    setIsModalOpen(true);
  };

  // Standardized Parsing for display
  const parseDBDate = (dateStr) => {
    const clean = dateStr.split('T')[0];
    const [y, m, d] = clean.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const monthEvents = events.filter(e => {
    const d = parseDBDate(e.event_date);
    return d.getMonth() === month && d.getFullYear() === year;
  }).sort((a, b) => a.event_date.localeCompare(b.event_date));

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Academic Calendar</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Manage school events, holidays, and important academic dates.</p>
        </div>
        {fullAccess && (
        <button
          onClick={() => setShowGuide(true)}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start">
          <HelpCircle className="size-3.5" /> How to use
        </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

        {/* SIDEBAR: Events List (Stacks below calendar on mobile) */}
        <div className="lg:col-span-3 flex flex-col gap-6 order-2 lg:order-1">

          <div className="bg-white rounded-lg ring-1 ring-black/5 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
              <CalendarDays className="size-4 text-primary shrink-0" />
              <h2 className="text-sm font-semibold text-zinc-800">Events for {monthNames[month]}</h2>
            </div>

            <div className="divide-y divide-zinc-100 max-h-[500px] overflow-y-auto custom-scrollbar">
              {monthEvents.length > 0 ? monthEvents.map(e => {
                const dt = parseDBDate(e.event_date);
                const config = eventTypesConfig[e.type] || eventTypesConfig.Other;
                return (
                  <div key={e.id} className="p-4 flex gap-3 group hover:bg-zinc-50/50 transition-colors">
                    <div className="text-center shrink-0 w-10 flex flex-col items-center justify-start pt-0.5">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase">{dayNames[dt.getDay()]}</div>
                      <div className="text-lg font-semibold text-zinc-800 tabular-nums leading-none mt-0.5">{dt.getDate()}</div>
                    </div>
                    <div className="flex-1 border-l-[3px] rounded-r pl-3 flex flex-col justify-center min-w-0" style={{ borderColor: config.color }}>
                      <p className="text-sm font-semibold text-zinc-900 leading-tight break-words">{e.name}</p>

                      <p className="text-[10px] font-medium text-zinc-500 mt-1 uppercase truncate">
                        {e.time ? `${e.time} · ${config.displayName}` : config.displayName}
                      </p>

                      {e.description && (
                        <p className="text-xs text-zinc-600 mt-1.5 leading-snug whitespace-pre-wrap break-words">
                          {e.description}
                        </p>
                      )}

                      {(e.created_by_name || e.updated_by_name) && (
                        <div className="mt-2 flex flex-col gap-0.5">
                          {e.created_by_name && (
                            <span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1 min-w-0">
                              <User className="size-3 shrink-0" />
                              <span className="truncate">
                                Created by {e.created_by_name}{e.created_at_ist ? ` · ${e.created_at_ist}` : ''}
                              </span>
                            </span>
                          )}
                          {e.updated_by_name && (
                            <span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1 min-w-0">
                              <Edit className="size-3 shrink-0" />
                              <span className="truncate">
                                Edited by {e.updated_by_name}{e.updated_at_ist ? ` · ${e.updated_at_ist}` : ''}
                              </span>
                            </span>
                          )}
                        </div>
                      )}

                      {isAdmin && (
                        <div className="flex gap-2 mt-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(e)} className="text-zinc-500 hover:text-zinc-900 text-[10px] font-semibold transition-colors flex items-center gap-1">
                            <Edit className="size-3" /> Edit
                          </button>
                          <button onClick={() => handleDelete(e.id)} className="text-zinc-500 hover:text-accent text-[10px] font-semibold transition-colors flex items-center gap-1">
                            <Trash2 className="size-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div className="p-8 text-center text-zinc-400 text-xs italic">No events scheduled.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg ring-1 ring-black/5 p-5">
            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-4">Color Legend</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-2">
              {Object.entries(eventTypesConfig).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: cfg.color }} />
                  <span className="text-xs font-medium text-zinc-700">{cfg.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN: Calendar Grid (Stays on top on mobile) */}
        <div className="lg:col-span-9 ring-1 ring-black/5 bg-white rounded-lg p-4 sm:p-6 lg:p-8 order-1 lg:order-2">

          {/* Calendar Controls */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => changeMonth(-1)} className="p-1.5 sm:p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all">
              <ChevronLeft className="size-5 sm:size-6" />
            </button>
            <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 tabular-nums">
              {monthNames[month]} {year}
            </h2>
            <button onClick={() => changeMonth(1)} className="p-1.5 sm:p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all">
              <ChevronRight className="size-5 sm:size-6" />
            </button>
          </div>

          {/* Scrollable Calendar Wrapper */}
          <div className="overflow-x-auto custom-scrollbar w-full rounded-lg ring-1 ring-zinc-200">
            <div className="min-w-[700px] grid grid-cols-7 bg-zinc-50/50">

              {/* Day Headers */}
              {dayNames.map(d => (
                <div key={d} className="p-3 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-r border-b border-zinc-200 last:border-r-0">
                  {d}
                </div>
              ))}

              {/* Days Grid */}
              {calendarGrid.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="bg-zinc-50/30 border-r border-b border-zinc-100 h-24 sm:h-32 last:border-r-0" />;

                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = events.filter(e => e.event_date.split('T')[0] === dateStr);
                const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                return (
                  <div key={idx}
                    onClick={() => openAdd(day)}
                    className={`relative h-24 sm:h-32 border-r border-b border-zinc-100 p-1.5 sm:p-2 flex flex-col gap-1 overflow-hidden group transition-colors ${isAdmin ? 'cursor-pointer hover:bg-primary/5' : 'bg-white'}`}>

                    <div className="flex justify-between items-start">
                      <span className={`inline-flex items-center justify-center size-6 sm:size-7 text-[11px] sm:text-xs font-semibold rounded-full shrink-0 ${
                        isToday ? 'bg-primary text-white shadow-sm ring-1 ring-primary/20' : 'text-zinc-700'
                      }`}>
                        {day}
                      </span>
                      {isAdmin && (
                        <div className="opacity-0 group-hover:opacity-100 text-primary p-0.5 transition-opacity">
                          <Plus className="size-3.5 sm:size-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-0.5">
                      {dayEvents.map(e => (
                        <div
                          key={e.id}
                          title={e.description ? `${e.name} — ${e.description}` : e.name}
                          className="px-1.5 py-0.5 rounded-[3px] text-[9px] sm:text-[10px] font-medium truncate text-white shadow-sm"
                          style={{ backgroundColor: (eventTypesConfig[e.type] || eventTypesConfig.Other).color }}
                        >
                          {e.name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* How to use — guide modal (same shell as Transport) */}
      {showGuide && fullAccess && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setShowGuide(false)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={ev => ev.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
              <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> Using the Academic Calendar</span>
              <button onClick={() => setShowGuide(false)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {GUIDE_STEPS.map(([t, d], i) => (
                <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
                  <p className="text-xs font-semibold text-zinc-800">{t}</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
                </div>
              ))}
              <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
                <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">{GUIDE_NOTE}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md p-6 shadow-xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors">
              <X className="size-5 shrink-0" />
            </button>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 mb-1">
                {editingEvent ? 'Edit Event' : 'New Event'}
              </h2>
              <p className="text-[11px] text-zinc-500 font-medium flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> {selectedDate}
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                  Event Title <span className="text-accent">*</span>
                </label>
                <input required placeholder="e.g. Science Fair"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Event Type</label>
                  <div className="relative">
                    <select
                      className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors"
                      value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      {Object.keys(eventTypesConfig).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Time <span className="text-zinc-400 normal-case">(Optional)</span></label>
                  <input placeholder="e.g. 10:00 AM"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                    value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Description <span className="text-zinc-400 normal-case">(Optional)</span></label>
                <textarea placeholder="Add any extra details here..."
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors min-h-[80px] resize-none"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="pt-4 border-t border-zinc-100 flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="h-9 px-4 text-zinc-700 bg-white border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="h-9 px-6 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm">
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}