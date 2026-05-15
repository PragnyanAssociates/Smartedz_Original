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
  // Super Admin AND every other school role (Teacher, Student, etc.) share
  // the SuperAdminDashboard shell. The sidebar / permissions decide what
  // each role can actually see and do.
  if (user) return <SuperAdminDashboard />;
  return <div className="p-10 text-center font-bold">Role access not configured.</div>;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginScreen />} />

          {/* Single dashboard route. Layout (Sidebar / Header) lives inside the dashboard components. */}
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