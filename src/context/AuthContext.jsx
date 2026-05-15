import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [institutions, setInstitutions] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [classes, setClasses] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);

    const API_URL = 'https://smartedzoriginal-production.up.railway.app';

    const login = (userData, userToken) => {
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('token', userToken);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.clear();
    };

    const refreshData = async () => {
        if (!user || !token) return;
        try {
            const endpoint = user.role === 'Developer' 
                ? `${API_URL}/api/developer/data` 
                : `${API_URL}/api/admin/data/${user.institutionId}`;
            
            const res = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (user.role === 'Developer') {
                setInstitutions(data.institutions || []);
                setUsersList(data.users || []);
            } else {
                setUsersList(data.users || []);
                setClasses(data.classes || []);
                setAcademicYears(data.academicYears || []);
            }
        } catch (err) { console.error("Refresh failed:", err); }
    };

    useEffect(() => { if (user) refreshData(); }, [user]);

    return (
        <AuthContext.Provider value={{ 
            user, token, login, logout, 
            institutions, usersList, classes, academicYears, 
            refreshData, API_URL 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export const useAppContext = useAuth; // Helper so screens don't break