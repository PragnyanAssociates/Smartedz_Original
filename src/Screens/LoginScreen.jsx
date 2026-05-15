import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        login(data.user, data.token);
        navigate('/dashboard');
      } else {
        alert(data.message || 'Invalid credentials');
      }
    } catch (err) {
      alert('Server connection failed. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <span className="text-white text-2xl font-black italic">S</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">SmartEdz ERP</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Unified Educational Platform
          </p>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl ring-1 ring-slate-200 p-8">
          <div className="pb-4">
            <h3 className="text-center text-slate-700 font-bold flex items-center justify-center gap-2 text-lg">
              <Shield size={18} /> Sign In
            </h3>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50 hover:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50 hover:bg-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center"
              disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Login'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          © 2026 SmartEdz. All rights reserved.
        </p>
      </div>
    </div>
  );
}