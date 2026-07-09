import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Edit, ChevronDown, CalendarDays } from 'lucide-react';
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

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AcademicCalendar() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isAdmin = user?.role === 'Super Admin' || can('Academic Calendar', 'edit');

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ name: '', time: '', description: '', type: 'Meeting' });

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/calendar/${user.institutionId}`);
      const data = await res.json();
      setEvents(data);
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
  }).sort((a,b) => a.event_date.localeCompare(b.event_date));

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
      <header className="flex flex-col mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Academic Calendar</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Manage school events, holidays, and important academic dates.</p>
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
                    <div className="text-center shrink-0 w-10 flex flex-col items-center justify-center">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase">{dayNames[dt.getDay()]}</div>
                      <div className="text-lg font-semibold text-zinc-800 tabular-nums leading-none mt-0.5">{dt.getDate()}</div>
                    </div>
                    <div className="flex-1 border-l-[3px] rounded-r pl-3 flex flex-col justify-center min-w-0" style={{ borderColor: config.color }}>
                      <p className="text-sm font-semibold text-zinc-900 leading-tight truncate">{e.name}</p>
                      <p className="text-[10px] font-medium text-zinc-500 mt-1 uppercase truncate">{e.time || e.type}</p>
                      
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
                          title={e.name}
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
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Event Type</label>
                  <div className="relative">
                    <select 
                      className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors"
                      value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                      {Object.keys(eventTypesConfig).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Time <span className="text-zinc-400 normal-case">(Optional)</span></label>
                  <input placeholder="e.g. 10:00 AM" 
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" 
                    value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Description <span className="text-zinc-400 normal-case">(Optional)</span></label>
                <textarea placeholder="Add any extra details here..."
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors min-h-[80px] resize-none" 
                  value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
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