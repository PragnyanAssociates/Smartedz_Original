import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../apiConfig';

const AuthContext = createContext(null);

const API_ROOT = API_BASE_URL.replace(/\/api$/, '');

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(null);
  
  // 1. ADD THIS: A state to track if we are still checking local storage
  const [isInitializing, setIsInitializing] = useState(true);

  const [institutions, setInstitutions] = useState([]);
  const [usersList, setUsersList]       = useState([]);

  // -------- restore session from localStorage on first load --------
  useEffect(() => {
    const savedUser  = localStorage.getItem('smartedz_user');
    const savedToken = localStorage.getItem('smartedz_token');
    
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch { /* ignore parse error */ }
    }
    
    // 2. ADD THIS: Tell React we are done checking, regardless of success/fail
    setIsInitializing(false);
  }, []);

  // -------- login / logout ---------------------------------------
  const login = (newUser, newToken) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem('smartedz_user', JSON.stringify(newUser));
    localStorage.setItem('smartedz_token', newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setInstitutions([]);
    setUsersList([]);
    localStorage.removeItem('smartedz_user');
    localStorage.removeItem('smartedz_token');
    window.location.href = '/login';
  };

  // -------- Developer-only: refresh institutions + global user list ----
  const refreshData = useCallback(async () => {
    if (!user || user.role !== 'Developer') return;
    try {
      const res = await fetch(`${API_BASE_URL}/developer/data`);
      const json = await res.json();
      setInstitutions(json.institutions || []);
      setUsersList(json.users || []);
    } catch (err) {
      console.error('refreshData error:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'Developer') refreshData();
  }, [user, refreshData]);

  // 3. ADD THIS: Do not render the app until initialization is complete
  if (isInitializing) {
    // You can return a loading spinner here if you prefer, or just null for a blank flash
    return null; 
  }

  return (
    <AuthContext.Provider value={{
      user, token,
      API_URL: API_ROOT,
      API_BASE_URL,
      login, logout,
      institutions, usersList, refreshData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);