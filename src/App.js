import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import WelcomePage from './Screens/WelcomePage';
import LoginScreen from './Screens/LoginScreen';
import DeveloperDashboard from './Screens/DeveloperDashboard';
import SuperAdminDashboard from './Screens/SuperAdminDashboard';

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

function UnifiedDashboard() {
  const { user } = useAuth();
  if (user?.role === 'Developer') return <DeveloperDashboard />;
  if (user?.role === 'Super Admin') return <SuperAdminDashboard />;
  return <div className="p-10 text-center font-bold">Role access not configured.</div>;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginScreen />} />
          
          {/* 
              Direct route to Dashboard. 
              The layout (Sidebar/Header) is handled inside 
              the SuperAdminDashboard component itself.
          */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <UnifiedDashboard />
              </ProtectedRoute>
            } 
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;