import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Import the AppProvider and Hook from your store
import { AppProvider, useAppContext } from './store'; 

// Screens
import WelcomePage from './Screens/WelcomePage';
import LoginScreen from './Screens/LoginScreen'; // This is your Login.jsx
import DeveloperDashboard from './Screens/DeveloperDashboard';
import SuperAdminDashboard from './Screens/SuperAdminDashboard';
import DashboardHeader from './Screens/DashboardHeader'; 

// 1. Protected Route Wrapper 
// Checks if currentUser exists in our global state
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAppContext();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// 2. Unified Dashboard Switcher
// This component decides which dashboard to show based on the user's role
function UnifiedDashboard() {
  const { currentUser } = useAppContext();

  if (currentUser?.role === 'Developer') {
    return <DeveloperDashboard />;
  }

  if (currentUser?.role === 'Super Admin') {
    return <SuperAdminDashboard />;
  }

  // Fallback for other roles (Admin, Teacher, etc.)
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">Module Access</h1>
        <p className="text-slate-500">This role module is currently under development.</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="mt-4 text-blue-600 underline"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

// 3. Layout Wrapper
function DashboardLayout() {
  const { currentUser } = useAppContext();

  // If it's a Developer, we might not want the standard DashboardHeader 
  // because the Developer console usually has its own specific layout.
  // But for Super Admins/Teachers, we show the Header.
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {currentUser?.role !== 'Developer' && <DashboardHeader />}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

function App() {
  return (
    // AppProvider must wrap the entire Router
    <AppProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginScreen />} />
          
          {/* Protected Dashboard Routes */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            
            {/* 
                When the user goes to /dashboard, the UnifiedDashboard 
                component handles the role-based logic 
            */}
            <Route path="/dashboard" element={<UnifiedDashboard />} />
            
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;