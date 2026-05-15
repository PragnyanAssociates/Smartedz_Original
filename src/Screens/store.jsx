import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  // Change this to your Railway Backend URL
  const API_URL = "https://smartedzoriginal-production.up.railway.app"; 

  const refreshData = async () => {
    if (!currentUser) return;
    
    try {
      const endpoint = currentUser.role === 'Developer' 
        ? `${API_URL}/api/developer/data`
        : `${API_URL}/api/admin/data/${currentUser.institutionId}`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      
      if (currentUser.role === 'Developer') {
        setInstitutions(data.institutions || []);
        setUsers(data.users || []);
      } else {
        setUsers(data.users || []);
        setClasses(data.classes || []);
        setAcademicYears(data.academicYears || []);
      }
    } catch (err) { console.error("Refresh Error:", err); }
  };

  useEffect(() => { refreshData(); }, [currentUser]);

  return (
    <AppContext.Provider value={{ 
      currentUser, setCurrentUser, 
      institutions, users, classes, academicYears,
      refreshData, API_URL 
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);