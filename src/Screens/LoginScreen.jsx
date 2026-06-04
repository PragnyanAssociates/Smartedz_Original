import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Code, Shield, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import smartedzLogo from '../assets/smartedzlogo.png';

export default function LoginScreen() {
  const { login, API_URL } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('Super Admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, role })
      });
      const data = await res.json();
      if (data.success) {
        login(data.user, data.token);
        navigate('/dashboard');
      } else {
        alert(data.message || 'Invalid Credentials');
      }
    } catch (err) {
      alert('Server connection failed. Please check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 relative overflow-hidden flex flex-col">
      {/* Background Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="flex-1 w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 z-10">
        
        {/* Main Card */}
        <div className="w-full max-w-5xl bg-white rounded-lg ring-1 ring-black/5 shadow-xl flex flex-col md:flex-row overflow-hidden animate-in fade-in slide-in-from-bottom-4 zoom-in-[0.99] duration-500 ease-out">
          
          {/* Left Panel */}
          <div className="w-full md:w-5/12 bg-zinc-100/50 p-8 md:p-12 flex flex-col justify-center relative border-b md:border-b-0 md:border-r border-zinc-100">
            <div className="flex items-center gap-3 mb-8">
              <img src={smartedzLogo} alt="SmartEdz Logo" className="h-12 w-auto drop-shadow-sm" />
              <div className="text-2xl font-semibold tracking-tight">
                <span className="text-[#3284c7]">Smart</span>
                <span className="text-[#f29132]">Edz</span>
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold text-zinc-900 leading-tight tracking-tight">
                Complete ERP Solution for Educational Institutions
              </h1>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-sm font-medium">
                The unified platform to manage your entire institution seamlessly.
              </p>
            </div>
            {role === 'Developer' && (
              <div className="mt-8 animate-bounce">
                <span className="inline-flex items-center gap-1.5 text-[10px] bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 px-2.5 py-1 rounded-md font-semibold uppercase tracking-wider shadow-sm">
                  <Code className="size-3" /> Developer Active
                </span>
              </div>
            )}
          </div>

          {/* Right Panel (Form) */}
          <div className="w-full md:w-7/12 p-8 md:p-12 lg:p-16 bg-white flex flex-col justify-center">
            <div className="mb-8 text-center md:text-left flex flex-col items-center md:items-start">
              <div className="inline-flex size-12 rounded-lg bg-primary/10 text-primary items-center justify-center mb-4 ring-1 ring-inset ring-primary/20 shadow-sm">
                {role === 'Developer' ? <Code className="size-6" /> : <Shield className="size-6" />}
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Sign In</h2>
              <p className="text-zinc-500 text-sm mt-1 font-medium">Enter your email or username and password</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider ml-0.5">
                  Email or Username
                </label>
                <input
                  type="text"
                  placeholder="you@school.com  or  yourname"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className="h-10 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider ml-0.5">
                  Secure Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-10 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded-md hover:bg-zinc-100">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-4">
                <button type="submit" disabled={loading}
                  className="h-10 w-full bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : 'Sign In Now'}
                </button>
                
                <div className="flex justify-center">
                  <button type="button" onClick={() => navigate('/')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 hover:text-primary transition-colors group p-2 rounded-md hover:bg-zinc-50">
                    <ArrowLeft className="size-3 group-hover:-translate-x-0.5 transition-transform" />
                    Back to Welcome Page
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Footer Area */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-zinc-400 text-[11px] font-medium tracking-wide">
            © {new Date().getFullYear()} <span className="font-semibold text-zinc-500">SmartEdz</span>. All rights reserved.
          </p>
          <div className="h-px w-12 bg-zinc-200"></div>
          <button onClick={() => setRole(role === 'Developer' ? 'Super Admin' : 'Developer')}
            className="text-[10px] text-zinc-400 hover:text-primary transition-all flex items-center gap-1.5 uppercase tracking-wider font-semibold py-1.5 px-3 rounded-md hover:bg-white hover:ring-1 hover:ring-black/5 shadow-sm">
            <Code className="size-3" /> Developer Access
          </button>
        </div>
      </div>
    </div>
  );
}