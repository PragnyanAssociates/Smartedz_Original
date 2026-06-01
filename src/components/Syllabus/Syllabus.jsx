import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import { Loader2 } from 'lucide-react';

import SyllabusManagement from './SyllabusManagement';
import SubjectIndex from './SubjectIndex';
import Periods from './Periods';

// =====================================================================
//  Syllabus - module entry point.
//
//  Navigation (matches the real screens):
//
//    SyllabusManagement  <- landing screen: list of syllabuses
//        |  green chart icon -------------> SubjectIndex
//        |
//    SubjectIndex        <- chapters / PDF / keywords for ONE syllabus
//        |  "Periods" button -------------> Periods
//        |  "Back" -----------------------> SyllabusManagement
//        |
//    Periods             <- lesson period schedule for the same syllabus
//        |  "Back to Subject Index" ------> SubjectIndex
//
//  A "nav" object { screen, syllabus } is threaded through so the same
//  class/subject/syllabus carries across all three screens.
// =====================================================================

export default function Syllabus() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('Syllabus', 'edit');

  // shared dropdown data (classes / subjects / teachers / year)
  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectClasses, setSC] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [activeYear, setYear]   = useState(null);
  const [loading, setLoading]   = useState(true);

  // nav.screen -> 'management' | 'index' | 'periods'
  // nav.syllabus = the selected syllabus row (for index / periods)
  const [nav, setNav] = useState({ screen: 'management', syllabus: null });

  const loadData = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const d = await res.json();
      setClasses(d.classes || []);
      setSubjects(d.subjects || []);
      setSC(d.subjectClasses || {});
      // teachers - users whose role is Teacher
      const staff = (d.users || []).filter(u =>
        (u.role || '').toLowerCase().includes('teacher'));
      setTeachers(staff);
      const yr = (d.academicYears || []).find(y => y.is_active) || (d.academicYears || [])[0];
      setYear(yr || null);
    } catch (e) { console.error('Syllabus data error:', e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 h-full min-h-[calc(100vh-64px)]">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  const shared = {
    user, canEdit, classes, subjects, subjectClasses, teachers, activeYear
  };

  const goManagement = () => setNav({ screen: 'management', syllabus: null });
  const goIndex   = (syllabus) => setNav({ screen: 'index', syllabus });
  const goPeriods = (syllabus) => setNav({ screen: 'periods', syllabus });

  return (
    <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300">
      {nav.screen === 'management' && (
        <SyllabusManagement {...shared} onOpenSyllabus={goIndex} />
      )}
      {nav.screen === 'index' && nav.syllabus && (
        <SubjectIndex {...shared} syllabus={nav.syllabus}
          onBack={goManagement} onOpenPeriods={() => goPeriods(nav.syllabus)} />
      )}
      {nav.screen === 'periods' && nav.syllabus && (
        <Periods {...shared} syllabus={nav.syllabus}
          onBackToIndex={() => goIndex(nav.syllabus)} />
      )}
    </div>
  );
}