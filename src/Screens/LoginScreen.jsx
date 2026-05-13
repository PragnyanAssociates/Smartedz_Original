import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import pragnyanLogo from '../assets/vpsnewlogo.png';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user, data.token);
        
        // Dynamic Redirection based on role from DB
        const role = data.user.role.toLowerCase();
        if (role === 'super_admin' || role === 'admin') navigate('/AdminDashboard');
        else if (role === 'teacher') navigate('/TeacherDashboard');
        else if (role === 'student') navigate('/StudentDashboard');
        else navigate('/OthersDashboard');
      } else {
        setError(data.message || 'Login Failed');
      }
    } catch (err) {
      setError('Connection error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
            <img src={pragnyanLogo} className="w-24 mx-auto mb-4" alt="Logo" />
            <h2 className="text-2xl font-bold text-gray-800">School ERP Login</h2>
            <p className="text-gray-500">Sign in to manage your school</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Username</label>
            <input 
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                value={username} onChange={(e) => setUsername(e.target.value)} required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Password</label>
            <input 
                type="password"
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            {loading ? "Verifying..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}