import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import { Loader2 } from 'lucide-react';
import SyllabusManagement from './SyllabusManagement';
import SubjectIndex from './SubjectIndex';
import Periods from './Periods';
import SyllabusLibrary from './SyllabusLibrary';

// =====================================================================
//  Syllabus - module entry point.
//
//    SyllabusManagement  <- landing: type tabs + class filter + table
//        |  Manage ------------------> SubjectIndex
//        |  Library -----------------> SyllabusLibrary (for the active type)
//    SubjectIndex        <- chapters / PDF / keywords for ONE syllabus
//        |  Lesson Periods ----------> Periods
//    Periods             <- lesson period schedule
//
//  The selected SYLLABUS TYPE tab and CLASS filter live here (not inside
//  SyllabusManagement) and are saved to localStorage per user, so they
//  survive moving between screens AND leaving the module entirely.
// =====================================================================

const readPrefs = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
};
const writePrefs = (key, prefs) => {
  try { localStorage.setItem(key, JSON.stringify(prefs)); } catch { /* storage full / blocked */ }
};

const classSortKey = (c) => `${c.className || ''} ${c.section || ''}`;

export default function Syllabus() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('Syllabus', 'edit');

  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectClasses, setSC] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading]   = useState(true);

  // nav.screen -> 'management' | 'index' | 'periods' | 'library'
  const [nav, setNav] = useState({ screen: 'management', syllabus: null, type: null });

  // ---- remembered UI state (type tab + class filter) ----
  const prefsKey = user?.institutionId
    ? `smartedz.syllabus.prefs.${user.institutionId}.${user.id || 0}`
    : null;
  const [typeId, setTypeId]         = useState(null);
  const [classId, setClassId]       = useState('');
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    if (!prefsKey) return;
    const p = readPrefs(prefsKey);
    setTypeId(p.typeId != null ? String(p.typeId) : null);
    setClassId(p.classId != null ? String(p.classId) : '');
    setPrefsReady(true);
  }, [prefsKey]);

  useEffect(() => {
    if (!prefsKey || !prefsReady) return;
    writePrefs(prefsKey, { typeId, classId });
  }, [prefsKey, prefsReady, typeId, classId]);

  const loadData = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const d = await res.json();
      setClasses(d.classes || []);
      setSubjects(d.subjects || []);
      setSC(d.subjectClasses || {});
      const staff = (d.users || []).filter(u => (u.role || '').toLowerCase().includes('teacher'));
      setTeachers(staff);
    } catch (e) { console.error('Syllabus data error:', e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Natural order: Class 1, Class 2 ... Class 10 (not Class 1, Class 10, Class 2)
  const sortedClasses = useMemo(
    () => [...classes].sort((a, b) =>
      classSortKey(a).localeCompare(classSortKey(b), undefined, { numeric: true, sensitivity: 'base' })),
    [classes]
  );

  const onTypeChange  = useCallback((id) => setTypeId(id == null ? null : String(id)), []);
  const onClassChange = useCallback((id) => setClassId(id == null ? '' : String(id)), []);

  if (loading || !prefsReady) {
    return (
      <div className="flex items-center justify-center flex-1 h-full min-h-[calc(100vh-64px)]">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  const shared = { user, canEdit, classes: sortedClasses, subjects, subjectClasses, teachers };

  const goManagement = () => setNav({ screen: 'management', syllabus: null, type: null });
  const goIndex      = (syllabus) => setNav({ screen: 'index', syllabus, type: null });
  const goPeriods    = (syllabus) => setNav({ screen: 'periods', syllabus, type: null });
  const goLibrary    = (type) => setNav({ screen: 'library', syllabus: null, type });

  return (
    <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300">
      {nav.screen === 'management' && (
        <SyllabusManagement {...shared}
          activeTypeId={typeId} onTypeChange={onTypeChange}
          filterClass={classId} onClassChange={onClassChange}
          onOpenSyllabus={goIndex} onOpenLibrary={goLibrary} />
      )}
      {nav.screen === 'index' && nav.syllabus && (
        <SubjectIndex {...shared} syllabus={nav.syllabus}
          onBack={goManagement} onOpenPeriods={() => goPeriods(nav.syllabus)} />
      )}
      {nav.screen === 'periods' && nav.syllabus && (
        <Periods {...shared} syllabus={nav.syllabus}
          onBackToIndex={() => goIndex(nav.syllabus)} />
      )}
      {nav.screen === 'library' && nav.type && (
        <SyllabusLibrary {...shared} syllabusType={nav.type}
          filterClass={classId} onClassChange={onClassChange}
          onBack={goManagement} />
      )}
    </div>
  );
}