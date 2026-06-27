import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API_BASE_URL, SERVER_URL } from '../apiConfig';

const AuthContext = createContext(null);

const API_ROOT = API_BASE_URL.replace(/\/api$/, '');

// ---------------------------------------------------------------------
//  Token interceptor (installed once, app-wide)
//
//  Every request that goes to OUR backend automatically gets the login
//  token attached as  Authorization: Bearer <token>.  Components keep
//  calling fetch() exactly as they do today — they don't need to change.
//
//  If the backend ever answers 401 (token missing / expired) for one of
//  our API calls, the session is cleared and the user is sent to /login.
//  The login call itself is exempt so a failed login just shows its own
//  error instead of bouncing the page.
// ---------------------------------------------------------------------
function installFetchInterceptor() {
  if (typeof window === 'undefined' || window.__smartedzFetchPatched) return;
  window.__smartedzFetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isOurApi = url.startsWith(API_BASE_URL) || url.startsWith(SERVER_URL) || url.startsWith(API_ROOT);
    const isLogin = url.endsWith('/login');

    if (isOurApi) {
      const tok = localStorage.getItem('smartedz_token');
      const headers = new Headers(
        (init && init.headers) ||
        (typeof input !== 'string' && input && input.headers) ||
        {}
      );
      if (tok && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${tok}`);
      init = { ...init, headers };
    }

    const res = await originalFetch(input, init);

    if (isOurApi && res.status === 401 && !isLogin) {
      localStorage.removeItem('smartedz_user');
      localStorage.removeItem('smartedz_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return res;
  };
}

// Install immediately at module load so even the earliest call is covered.
installFetchInterceptor();

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(null);

  // Track whether we are still checking local storage on first load.
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

  // Do not render the app until initialization is complete.
  if (isInitializing) {
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