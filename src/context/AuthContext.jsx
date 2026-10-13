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

  // Write the user to localStorage without letting an oversized profile
  // picture (base64) crash the app on a quota error — the picture still
  // lives in memory for this session and is re-fetched on the next load.
  const persistUser = (u) => {
    try { localStorage.setItem('smartedz_user', JSON.stringify(u)); }
    catch (e) { /* quota exceeded — keep it in memory only */ }
  };

  // -------- merge new fields into the logged-in user (keeps token) ----
  //  Used by the Profile screen after an edit, and by the hydration
  //  effect below. This is what keeps the sidebar / header avatar in
  //  sync everywhere without a re-login.
  const updateUser = useCallback((partial) => {
    if (!partial) return;
    setUser(prev => {
      const merged = { ...(prev || {}), ...partial };
      persistUser(merged);
      return merged;
    });
  }, []);

  // -------- login / logout ---------------------------------------
  const login = (newUser, newToken) => {
    setUser(newUser);
    setToken(newToken);
    persistUser(newUser);
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

  // -------- Hydrate the full user (incl. profile_pic) after login -----
  //  The login response and the light /admin/data query don't carry the
  //  profile picture, so the stored `user` only has the basics and the
  //  sidebar falls back to the initial. Here we pull the complete record
  //  once (the same endpoint the Profile page uses) and merge in the
  //  display fields, so the avatar shows up app-wide on every load.
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/profile/${user.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const p = data && data.user ? data.user : data;   // GET returns the record; PUT returns { user }
        if (!alive || !p) return;
        const patch = {};
        ['name', 'email', 'username', 'profile_pic'].forEach(k => {
          if (p[k] !== undefined) patch[k] = p[k];
        });
        if (Object.keys(patch).length) updateUser(patch);
      } catch (e) { /* silent — sidebar just keeps the initial until next load */ }
    })();
    return () => { alive = false; };
    // Runs once per login / session-restore (user id change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
      login, logout, updateUser, setUser,
      institutions, usersList, refreshData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);