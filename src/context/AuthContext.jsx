import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../apiConfig';

const AuthContext = createContext(null);

// Strip the trailing /api so components doing `${API_URL}/api/login` still work.
// (Many of the existing screens build URLs like `${API_URL}/api/...`.)
const API_ROOT = API_BASE_URL.replace(/\/api$/, '');

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(null);

  // Developer-only data (populated when a Developer logs in)
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

  return (
    <AuthContext.Provider value={{
      user, token,
      API_URL: API_ROOT,        // backward-compat: components build `${API_URL}/api/...`
      API_BASE_URL,             // explicit alias if you want it
      login, logout,
      institutions, usersList, refreshData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);