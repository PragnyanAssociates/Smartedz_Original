import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Edit } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';

const eventTypesConfig = {
    Meeting: { color: '#3b82f6', displayName: 'Meeting' },
    Event: { color: '#f59e0b', displayName: 'Event' },
    Festival: { color: '#ef4444', displayName: 'Festival' },
    'Holiday (General)': { color: '#10b981', displayName: 'Holiday (General)' },
    'Holiday (Optional)': { color: '#14b8a6', displayName: 'Holiday (Optional)' },
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

    // HELPER: Prevents timezone shifts by treating date as local string
    const getSafeDate = (dateInput) => {
        if (!dateInput) return new Date();
        const datePart = typeof dateInput === 'string' ? dateInput.split('T')[0] : dateInput.toISOString().split('T')[0];
        const [year, month, day] = datePart.split('-');
        return new Date(year, month - 1, day);
    };

    const fetchEvents = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/admin/calendar/${user.institutionId}`);
            const data = await res.json();
            setEvents(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchEvents(); }, []);

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

    // Filter events for sidebar list using safe date parsing
    const monthEvents = events.filter(e => {
        const d = getSafeDate(e.event_date);
        return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a,b) => new Date(a.event_date) - new Date(b.event_date));

    if (loading) return <div className="p-10 text-center font-bold text-slate-400">Loading Calendar...</div>;

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h1 className="text-3xl font-black text-slate-800">Academic Calendar</h1>
                <p className="text-slate-500 font-medium">Manage school events and important holidays</p>
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* Side List */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-50 bg-slate-50/50">
                            <h2 className="font-black text-slate-700">Events for {monthNames[month]}</h2>
                        </div>
                        <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                            {monthEvents.length > 0 ? monthEvents.map(e => {
                                const safeDate = getSafeDate(e.event_date);
                                return (
                                    <div key={e.id} className="p-4 flex gap-3 group">
                                        <div className="text-center shrink-0 w-10">
                                            <div className="text-[10px] font-black text-slate-400 uppercase">{dayNames[safeDate.getDay()]}</div>
                                            <div className="text-lg font-black text-slate-700">{safeDate.getDate()}</div>
                                        </div>
                                        <div className="flex-1 border-l-4 rounded-r pl-3" style={{ borderColor: eventTypesConfig[e.type].color }}>
                                            <p className="text-sm font-bold text-slate-800 leading-tight">{e.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{e.time || e.type}</p>
                                            {isAdmin && (
                                                <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEdit(e)} className="text-blue-500 hover:underline text-[10px] font-bold">Edit</button>
                                                    <button onClick={() => handleDelete(e.id)} className="text-red-500 hover:underline text-[10px] font-bold">Delete</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }) : <div className="p-10 text-center text-slate-400 text-xs italic">No events this month.</div>}
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Legend</h3>
                        <div className="space-y-2">
                            {Object.entries(eventTypesConfig).map(([key, cfg]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                                    <span className="text-xs font-bold text-slate-600">{cfg.displayName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="col-span-12 lg:col-span-9 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
                    <div className="flex items-center justify-between mb-8">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-all"><ChevronLeft /></button>
                        <h2 className="text-2xl font-black text-slate-800">{monthNames[month]} {year}</h2>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-full transition-all"><ChevronRight /></button>
                    </div>

                    <div className="grid grid-cols-7 border-t border-l border-slate-100 rounded-xl overflow-hidden">
                        {dayNames.map(d => (
                            <div key={d} className="bg-slate-50 p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-b border-slate-100">{d}</div>
                        ))}
                        {calendarGrid.map((day, idx) => {
                            if (!day) return <div key={`empty-${idx}`} className="bg-slate-50/30 border-r border-b border-slate-100 h-32" />;
                            
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const dayEvents = events.filter(e => e.event_date.split('T')[0] === dateStr);
                            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                            return (
                                <div key={idx} 
                                    onClick={() => openAdd(day)}
                                    className={`relative h-32 border-r border-b border-slate-100 p-2 transition-all ${isAdmin ? 'cursor-pointer hover:bg-blue-50/30' : ''}`}>
                                    <span className={`inline-flex items-center justify-center w-7 h-7 text-xs font-black rounded-full ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-700'}`}>
                                        {day}
                                    </span>
                                    
                                    <div className="mt-1 space-y-1 overflow-y-auto max-h-20 custom-scrollbar">
                                        {dayEvents.map(e => (
                                            <div key={e.id} className="px-1.5 py-0.5 rounded text-[9px] font-bold truncate text-white" style={{ backgroundColor: eventTypesConfig[e.type].color }}>
                                                {e.name}
                                            </div>
                                        ))}
                                    </div>

                                    {isAdmin && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-blue-500"><Plus size={14} /></div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500"><X /></button>
                        <h2 className="text-xl font-black text-slate-800 mb-6">{editingEvent ? 'Edit Event' : 'New Event'} — {selectedDate}</h2>
                        
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Title</label>
                                <input required className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none" 
                                    value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Type</label>
                                    <select className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                                        value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                                        {Object.keys(eventTypesConfig).map(k => <option key={k} value={k}>{k}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Time</label>
                                    <input placeholder="e.g. 10:00 AM" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none" 
                                        value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Description</label>
                                <textarea className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none h-24 resize-none" 
                                    value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl">
                                {editingEvent ? 'Save Changes' : 'Create Event'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}