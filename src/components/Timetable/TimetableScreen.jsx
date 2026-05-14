"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { MdSettings, MdClose, MdDelete, MdAdd } from 'react-icons/md';

// --- Reusable Loaders ---
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function SectionLoader() {
  return (
    <div className="py-20 flex justify-center items-center">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function ButtonLoader({ text = "Saving..." }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      <span className="font-bold tracking-wide">{text}</span>
    </div>
  );
}

// --- Constants & helpers ---
const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_DEFINITIONS = [
  { period: 1, time: '09:00-09:45' }, { period: 2, time: '09:45-10:30' },
  { period: 3, time: '10:30-10:45', isBreak: true }, { period: 4, time: '10:45-11:30' },
  { period: 5, time: '11:30-12:15' }, { period: 6, time: '12:15-01:00' },
  { period: 7, time: '01:00-01:45', isBreak: true }, { period: 8, time: '01:45-02:30' },
  { period: 9, time: '02:30-03:15' }, { period: 10, time: '03:15-04:00' },
];

const dayHeaders = [
  { name: 'MON', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  { name: 'TUE', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  { name: 'WED', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  { name: 'THU', bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
  { name: 'FRI', bgColor: 'bg-sky-100', textColor: 'text-sky-800' },
  { name: 'SAT', bgColor: 'bg-indigo-100', textColor: 'text-indigo-800' },
];

// --- Edit Slot Modal ---
function EditSlotModal({ visible, onClose, teachers, currentData, onSave, slotInfo, selectedClass, isSaving }) {
  const [selectedTeacherId, setSelectedTeacherId] = useState(currentData?.teacher_id ?? '');
  const [selectedSubject, setSelectedSubject] = useState(currentData?.subject_name ?? '');

  useEffect(() => {
    setSelectedTeacherId(currentData?.teacher_id ?? '');
    setSelectedSubject(currentData?.subject_name ?? '');
  }, [currentData, visible]);

  const availableSubjects = useMemo(() => {
    if (!selectedTeacherId) return [];
    const t = teachers.find(x => String(x.id) === String(selectedTeacherId));
    return t?.subjects_taught ?? [];
  }, [selectedTeacherId, teachers]);

  if (!visible) return null;

  const className = slotInfo.class_group || selectedClass;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true">
      <div className="fixed inset-0 bg-black/60" onClick={!isSaving ? onClose : undefined} />
      <div className="relative w-[95%] max-w-md bg-white rounded-xl p-5 z-10 shadow-lg">
        <h3 className="text-lg font-bold text-slate-800 text-center">Edit Slot</h3>
        <p className="text-sm text-slate-600 text-center mt-1">{className} - {slotInfo.day} - Period {slotInfo.period}</p>

        <label className="block mt-4 text-sm font-medium text-slate-700">Teacher</label>
        <div className="mt-2">
          <select
            value={selectedTeacherId ?? ''}
            onChange={e => { setSelectedTeacherId(e.target.value); setSelectedSubject(''); }}
            className="w-full border rounded px-3 py-2 bg-gray-50 text-slate-800"
            disabled={isSaving}
          >
            <option value="">-- Select Teacher --</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>

        <label className="block mt-4 text-sm font-medium text-slate-700">Subject</label>
        <div className="mt-2">
          <select
            value={selectedSubject ?? ''}
            onChange={e => setSelectedSubject(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-gray-50 text-slate-800"
            disabled={!selectedTeacherId || availableSubjects.length === 0 || isSaving}
          >
            <option value="">-- Select Subject --</option>
            {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => onSave({ subject_name: null, teacher_id: null })}
            disabled={isSaving}
            className="flex-1 bg-red-500 text-white py-2 rounded font-medium hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Slot
          </button>
          <button
            onClick={() => onSave({ subject_name: selectedSubject ?? null, teacher_id: selectedTeacherId ? Number(selectedTeacherId) : null })}
            disabled={isSaving}
            className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {isSaving ? <ButtonLoader text="Saving..." /> : "Save"}
          </button>
        </div>

        <div className="mt-4 text-center">
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="text-blue-600 font-semibold hover:text-blue-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---
const TimetableScreen = ({ teacherId = null, isEmbedded = false, onSelectSubModule }) => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [isTimetableLoading, setIsTimetableLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiTimetableData, setApiTimetableData] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherName, setTeacherName] = useState('');

  // State
  const [activeTab, setActiveTab] = useState('academic'); // 'academic' | 'personal'
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState(undefined);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); 

  // --- Initial Setup & Role Based Configuration ---
  useEffect(() => {
    if (isAuthLoading || !user) return; 

    const initialClass = user.class_group && CLASS_GROUPS.includes(user.class_group) ? user.class_group : CLASS_GROUPS[11];
    
    if (user.role === 'admin' || user.role === 'Super Admin') {
      if (!isEmbedded) fetchTeachers();
      setSelectedClass(initialClass);
    } 
    else if (user.role === 'teacher') {
      setSelectedClass(initialClass);
      setSelectedTeacherId(user.id);
      setActiveTab('personal');
    } 
    else if (user.role === 'student' && user.class_group) {
      setSelectedClass(user.class_group);
      setActiveTab('academic');
    }
  }, [user, isAuthLoading, isEmbedded]);

  // --- Fetch Teachers (Admin Only) ---
  const fetchTeachers = async () => {
    try {
      const response = await apiClient.get('/teachers');
      setTeachers(response.data);
    } catch (error) {
      console.error('Failed to fetch teachers list.', error);
    }
  };

  // --- Auto-select first teacher for Admin ---
  useEffect(() => {
    if (isEmbedded) return;
    if ((user?.role === 'admin' || user?.role === 'Super Admin') && teachers.length > 0 && selectedTeacherId === undefined) {
      setSelectedTeacherId(teachers[0].id);
    }
  }, [user, teachers, selectedTeacherId, isEmbedded]);

  // --- Fetch Timetable Data ---
  const fetchTimetable = useCallback(async () => {
    setIsTimetableLoading(true);
    setApiTimetableData([]);

    // 1. Embedded Mode
    if (isEmbedded && teacherId) {
      try {
        const response = await apiClient.get(`/timetable/teacher/${teacherId}`);
        setApiTimetableData(response.data);
        try {
            const tRes = await apiClient.get(`/staff/${teacherId}`);
            setTeacherName(tRes.data.full_name || 'Teacher');
        } catch { setTeacherName('Teacher'); }
      } catch (error) {
        setApiTimetableData([]);
      } finally {
        setIsTimetableLoading(false);
      }
      return;
    }

    // 2. Standard Mode OR Student Embedded Mode
    if (isAuthLoading || !user) return;

    try {
      let response;
      if (activeTab === 'academic' && selectedClass) {
        response = await apiClient.get(`/timetable/${selectedClass}`);
      } else if (activeTab === 'personal') {
        const idToFetch = (user.role === 'admin' || user.role === 'Super Admin') ? selectedTeacherId : user.id;
        
        if (!idToFetch && user.role !== 'admin' && user.role !== 'Super Admin') { setIsTimetableLoading(false); return; }
        if ((user.role === 'admin' || user.role === 'Super Admin') && !idToFetch) { 
            setApiTimetableData([]); 
            setIsTimetableLoading(false); 
            return; 
        }

        response = await apiClient.get(`/timetable/teacher/${idToFetch}`);
      } else {
        setIsTimetableLoading(false);
        return;
      }
      setApiTimetableData(response.data);
    } catch (error) {
      console.error('Failed to fetch timetable data.', error);
      setApiTimetableData([]);
    } finally {
      setIsTimetableLoading(false);
    }
  }, [user, isAuthLoading, activeTab, selectedClass, selectedTeacherId, isEmbedded, teacherId]);

  useEffect(() => { fetchTimetable(); }, [fetchTimetable]);

  // --- Data Processing for Grid ---
  const scheduleData = useMemo(() => {
    const timetableMap = new Map();
    if (Array.isArray(apiTimetableData)) {
      apiTimetableData.forEach(slot => {
        const key = `${slot.day_of_week}-${slot.period_number}`;
        timetableMap.set(key, slot);
      });
    }

    return PERIOD_DEFINITIONS.map(pDef => {
      const periods = DAYS.map(day => {
        if (pDef.isBreak) return { subject: pDef.period === 3 ? 'Break' : 'Lunch', isBreak: true };
        
        const key = `${day}-${pDef.period}`;
        const slotData = timetableMap.get(key);
        
        return {
          subject: slotData?.subject_name,
          teacher: slotData?.teacher_name,
          teacher_id: slotData?.teacher_id,
          class_group: slotData?.class_group
        };
      });
      return { time: pDef.time, periods, periodNumber: pDef.period };
    });
  }, [apiTimetableData]);

  // --- INTERACTION LOGIC ---
  const handleSlotClick = (day, periodNumber, currentSlot) => {
    if (isEmbedded || !user) return;

    if (user.role === 'admin' || user.role === 'Super Admin') {
        let classGroupToModify;
        if (activeTab === 'academic') {
            classGroupToModify = selectedClass;
        } else {
            if (currentSlot?.class_group) {
                classGroupToModify = currentSlot.class_group;
            } else if (activeTab === 'personal') {
                window.alert('Assignment Rule: To assign a new class, please use the "Academic Timetable" tab. To modify an existing slot, click an assigned period on this view.');
                return;
            } else {
                return;
            }
        }

        setSelectedSlot({ day, period: periodNumber, class_group: classGroupToModify });
        setIsModalVisible(true);
        return;
    }
  };

  const handleSaveChanges = async (slotToSave) => {
    if (!selectedSlot) return;
    
    const classGroupToUse = selectedSlot.class_group || selectedClass;
    if (!classGroupToUse) {
        window.alert('Error: Class group context missing.');
        return;
    }

    setIsSaving(true);
    const payload = {
        class_group: classGroupToUse,
        day_of_week: selectedSlot.day,
        period_number: selectedSlot.period,
        subject_name: slotToSave.subject_name || null,
        teacher_id: slotToSave.teacher_id || null,
    };

    try {
        await apiClient.post('/timetable', payload);
        window.alert('Timetable updated!');
        setIsModalVisible(false);
        fetchTimetable();
    } catch (error) {
        const errorMessage = error.response?.data?.message || 'An error occurred while updating timetable.';
        window.alert(`Unable to Assign: ${errorMessage}`);
    } finally {
        setIsSaving(false);
    }
  };

  const getContainerClasses = () => "w-full max-w-7xl 2xl:max-w-[85vw] mx-auto px-3 sm:px-4 md:px-6 lg:px-8";

  // --- Render: Embedded View ---
  if (isEmbedded) {
    if (isTimetableLoading) {
      return <SectionLoader />;
    }
    return (
      <div className="rounded-lg border border-slate-200 flex flex-col flex-1 h-full min-h-0">
        <div className="overflow-auto custom-scrollbar relative">
          <table className="w-full border-collapse min-w-[800px]">
            <thead className="sticky top-0 z-20 shadow-sm outline outline-1 outline-slate-200">
              <tr>
                <th className="p-3 text-sm font-semibold text-slate-600 bg-slate-100 border-b border-r border-slate-200 text-center uppercase w-[120px]">TIME</th>
                {dayHeaders.map(h => (
                  <th key={h.name} className="p-3 text-sm font-semibold text-slate-600 bg-slate-50 border-b border-r border-slate-200 text-center uppercase">
                    <span className={`px-2 py-1 text-xs rounded-md ${h.bgColor} ${h.textColor}`}>{h.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduleData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="p-3 text-sm font-bold text-center text-slate-700 bg-slate-100 border-b border-r border-slate-200 whitespace-nowrap">{row.time}</td>
                  {row.periods.map((period, periodIndex) => {
                    const isBreak = period.isBreak;
                    let cellClasses = 'p-3 text-center border-b border-r border-slate-200 transition-all duration-200 h-[85px] relative';
                    
                    if (isBreak) {
                      cellClasses += ' bg-slate-200 text-slate-500 font-medium italic';
                    } else if (period.subject) {
                      cellClasses += ' bg-blue-50';
                    } else {
                      cellClasses += ' bg-white';
                    }

                    return (
                      <td key={periodIndex} className={cellClasses}>
                         {isBreak ? (
                           <span className="tracking-wider">{period.subject}</span>
                         ) : (
                            <div className="flex flex-col items-center justify-center gap-1.5 h-full w-full">
                              <span className="font-bold text-slate-800 text-sm">{period.subject || '-'}</span>
                              {period.teacher && activeTab === 'academic' && (
                                <span className="inline-block px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-wide shadow-sm">
                                  {period.teacher}
                                </span>
                              )}
                              {period.class_group && activeTab === 'personal' && (
                                <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold uppercase tracking-wide shadow-sm">
                                  {period.class_group}
                                </span>
                              )}
                            </div>
                         )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- Render: Full View ---
  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <main className={`${getContainerClasses()} pt-0 pb-6 sm:pb-8 flex flex-col flex-1 min-h-0`}>
        <div className="flex flex-col h-full min-h-0 relative">
          
          {/* Header Area */}
          <div className="flex flex-col shrink-0 mb-3">
            <div className="mb-3 flex flex-col items-center justify-center text-center gap-1">
              <div className="flex items-center justify-center gap-2 mt-4">
                <h1 className="text-xl lg:text-2xl font-semibold text-slate-700 truncate">
                  Timetable
                </h1>
                <span className="bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold px-2 py-0.5 rounded-md border border-blue-100">
                  2025-2026
                </span>
              </div>
              <p className="text-sm text-slate-600">
                Manage and view class schedules
              </p>
            </div>

            {/* Controls Aligned to Left */}
            <div className="flex justify-start w-full mb-2">
              {(user?.role === 'admin' || user?.role === 'Super Admin' || user?.role === 'teacher') && (
                <div className="flex flex-wrap items-center justify-start gap-3">
                  <div className="inline-flex rounded-lg overflow-hidden bg-white border border-slate-200 shadow-sm shrink-0 h-[38px]">
                    {user?.role === 'teacher' ? (
                      <>
                        <button onClick={() => setActiveTab('personal')} className={`px-2 sm:px-4 h-full text-xs sm:text-sm whitespace-nowrap ${activeTab === 'personal' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>My Timetable</button>
                        <div className="w-px bg-slate-200"></div>
                        <button onClick={() => setActiveTab('academic')} className={`px-2 sm:px-4 h-full text-xs sm:text-sm whitespace-nowrap ${activeTab === 'academic' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>Academic Timetable</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setActiveTab('academic')} className={`px-2 sm:px-4 h-full text-xs sm:text-sm whitespace-nowrap ${activeTab === 'academic' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>Academics Timetable</button>
                        <div className="w-px bg-slate-200"></div>
                        <button onClick={() => setActiveTab('personal')} className={`px-2 sm:px-4 h-full text-xs sm:text-sm whitespace-nowrap ${activeTab === 'personal' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>{(user?.role === 'admin' || user?.role === 'Super Admin') ? 'Teachers Timetable' : 'My Timetable'}</button>
                      </>
                    )}
                  </div>
                  {activeTab === 'academic' && user?.role !== 'student' && (
                    <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="border rounded-lg px-3 bg-white text-sm shadow-sm focus:ring-2 focus:ring-blue-500 outline-none h-[38px]">
                      {CLASS_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  )}
                  {activeTab === 'personal' && (user?.role === 'admin' || user?.role === 'Super Admin') && (
                    <select value={selectedTeacherId ?? ''} onChange={e => setSelectedTeacherId(Number(e.target.value))} className="border rounded-lg px-3 bg-white text-sm shadow-sm focus:ring-2 focus:ring-blue-500 outline-none h-[38px]">
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {isTimetableLoading ? (
            <SectionLoader />
          ) : (
            <div className="rounded-xl bg-white shadow-md border border-slate-200 flex flex-col flex-1 min-h-0">
              <div className="overflow-auto custom-scrollbar">
                <table className="w-full border-collapse min-w-[800px] relative">
                  <thead className="sticky top-0 z-20 shadow-sm outline outline-1 outline-slate-200">
                    <tr>
                      <th className="p-3 text-sm font-semibold text-slate-600 bg-slate-100 border-b border-r border-slate-200 text-center uppercase w-[120px]">TIME</th>
                      {dayHeaders.map(h => (
                        <th key={h.name} className="p-3 text-sm font-semibold text-slate-600 bg-slate-50 border-b border-r border-slate-200 text-center uppercase">
                          <span className={`px-2 py-1 text-xs rounded-md ${h.bgColor} ${h.textColor}`}>{h.name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleData.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td className="p-3 text-sm font-bold text-center text-slate-700 bg-slate-100 border-b border-r border-slate-200 whitespace-nowrap">{row.time}</td>
                        {row.periods.map((period, periodIndex) => {
                          const isBreak = period.isBreak;
                          const periodNumber = row.periodNumber;
                          
                          // Clickable ONLY if user is admin
                          const isClickable = !isEmbedded && (user?.role === 'admin' || user?.role === 'Super Admin');

                          let cellClasses = 'p-3 text-center border-b border-r border-slate-200 transition-all duration-200 h-[85px] relative';

                          if (isBreak) {
                            cellClasses += ' bg-slate-200 text-slate-500 font-medium italic';
                          } else if (period.subject) {
                            cellClasses += ' bg-blue-50';
                          } else {
                            cellClasses += ' bg-white';
                          }

                          if (isClickable) {
                            cellClasses += ' cursor-pointer';
                            if (period.subject) cellClasses += ' hover:bg-blue-100';
                            else cellClasses += ' hover:bg-slate-50';
                          }

                          const onCellClick = () => handleSlotClick(DAYS[periodIndex], periodNumber, period);

                          return (
                            <td key={periodIndex} className={cellClasses} onClick={isClickable ? onCellClick : undefined}>
                                {isBreak ? (
                                    <span className="tracking-wider">{period.subject}</span>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-1.5 h-full w-full">
                                        <span className="font-bold text-slate-800 text-sm">{period.subject || ((user?.role === 'admin' || user?.role === 'Super Admin') ? 'Free' : '-')}</span>
                                        {(activeTab === 'academic' || user?.role === 'student') && period.teacher && (
                                            <span className="inline-block px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-wide shadow-sm">
                                              {period.teacher}
                                            </span>
                                        )}
                                        {activeTab === 'personal' && period.class_group && (
                                            <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold uppercase tracking-wide shadow-sm">
                                              {period.class_group}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      <EditSlotModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        teachers={teachers}
        currentData={
          selectedSlot
            ? apiTimetableData.find(d =>
                d.day_of_week === selectedSlot.day &&
                d.period_number === selectedSlot.period &&
                d.class_group === (selectedSlot.class_group || selectedClass)
              )
            : null
        }
        onSave={handleSaveChanges}
        slotInfo={selectedSlot || { day: '', period: 0 }}
        selectedClass={selectedClass}
        isSaving={isSaving}
      />
    </div>
  );
};

export default TimetableScreen;