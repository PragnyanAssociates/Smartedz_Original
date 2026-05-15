import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import WelcomePage from './Screens/WelcomePage';
import LoginScreen from './Screens/LoginScreen';
import DeveloperDashboard from './Screens/DeveloperDashboard';
import SuperAdminDashboard from './Screens/SuperAdminDashboard';
import { LogOut, GraduationCap } from 'lucide-react';
import { Button } from './components/ui';

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

function UnifiedDashboard() {
  const { user } = useAuth();
  if (user?.role === 'Developer') return <DeveloperDashboard />;
  if (user?.role === 'Super Admin') return <SuperAdminDashboard />;
  return <div className="p-10">Access Denied</div>;
}

// Inline Dashboard Header to replace the missing file
function SimpleHeader() {
    const { user, logout } = useAuth();
    return (
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
                <GraduationCap className="text-blue-600 w-6 h-6" />
                <span className="font-bold text-slate-800">SmartEdz Portal</span>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500 uppercase">{user?.role}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={logout}>
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </Button>
            </div>
        </header>
    );
}

function DashboardLayout() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* Show header only for non-developers */}
      {user?.role !== 'Developer' && <SimpleHeader />}
      <div className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<UnifiedDashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;