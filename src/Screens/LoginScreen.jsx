import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Code, Shield, Loader2, Eye, EyeOff, ArrowLeft, Network, Check } from 'lucide-react';
import smartedzLogo from '../assets/smartedzlogo.png';

// Each sign-in mode themes the screen. `role` is cosmetic for the login
// screen only — the backend authenticates by credentials and returns the
// user's real role, which decides the destination. Class strings are
// written out in full so Tailwind picks them up.
const MODE_THEME = {
  'Super Admin': {
    label: 'Standard', Icon: Shield,
    seg:     'bg-primary text-white shadow-sm',
    softIcon:'bg-primary/10 text-primary ring-primary/20',
    badge:   'bg-primary/10 text-primary ring-primary/20',
    blob:    'bg-primary/10',
    subtitle:'Enter your email or username and password'
  },
  'Developer': {
    label: 'Developer', Icon: Code,
    seg:     'bg-amber-500 text-white shadow-sm',
    softIcon:'bg-amber-50 text-amber-600 ring-amber-600/20',
    badge:   'bg-amber-50 text-amber-700 ring-amber-600/20',
    blob:    'bg-amber-400/15',
    subtitle:'Developer sign-in'
  },
  'Group Admin': {
    label: 'Group', Icon: Network,
    seg:     'bg-violet-500 text-white shadow-sm',
    softIcon:'bg-violet-50 text-violet-600 ring-violet-600/20',
    badge:   'bg-violet-50 text-violet-700 ring-violet-600/20',
    blob:    'bg-violet-400/15',
    subtitle:'Group owner sign-in'
  }
};

const MODE_ORDER = ['Super Admin', 'Developer', 'Group Admin'];

const FEATURES = [
  'Multi-campus & group management',
  'Role-based access for every user',
  'Attendance, exams & performance insights'
];

export default function LoginScreen() {
  const { login, API_URL } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('Super Admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const theme = MODE_THEME[role] || MODE_THEME['Super Admin'];
  const HeaderIcon = theme.Icon;
  const isSpecial = role !== 'Super Admin';

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
      {/* Background blobs — second blob picks up the active mode colour */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className={`absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-3xl animate-pulse transition-colors duration-700 ${theme.blob}`} style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="flex-1 w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 z-10">

        {/* Main card */}
        <div className="w-full max-w-5xl bg-white rounded-2xl ring-1 ring-black/5 shadow-2xl shadow-zinc-300/30 flex flex-col md:flex-row overflow-hidden animate-in fade-in slide-in-from-bottom-4 zoom-in-[0.99] duration-500 ease-out">

          {/* Left panel */}
          <div className="w-full md:w-5/12 bg-gradient-to-br from-zinc-100/70 to-zinc-50 p-8 md:p-12 flex flex-col justify-center relative border-b md:border-b-0 md:border-r border-zinc-100">
            <div className="flex items-center gap-3 mb-8">
              <img src={smartedzLogo} alt="SmartEdz Logo" className="h-12 w-auto drop-shadow-sm" />
              <div className="text-2xl font-semibold tracking-tight">
                <span className="text-[#3284c7]">Smart</span>
                <span className="text-[#f29132]">Edz</span>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-[1.7rem] leading-tight font-semibold text-zinc-900 tracking-tight">
                Complete ERP Solution for Educational Institutions
              </h1>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-sm font-medium">
                The unified platform to manage your entire institution seamlessly.
              </p>
            </div>

            <ul className="mt-8 space-y-2.5">
              {FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600 font-medium">
                  <span className="size-5 rounded-full bg-white ring-1 ring-inset ring-black/5 shadow-sm flex items-center justify-center shrink-0">
                    <Check className="size-3 text-primary" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {isSpecial && (
              <div className="mt-8">
                <span className={`inline-flex items-center gap-1.5 text-[10px] ring-1 ring-inset px-2.5 py-1 rounded-md font-semibold uppercase tracking-wider shadow-sm ${theme.badge}`}>
                  <HeaderIcon className="size-3" /> {theme.label} access active
                </span>
              </div>
            )}
          </div>

          {/* Right panel (form) */}
          <div className="w-full md:w-7/12 p-8 md:p-12 lg:p-16 bg-white flex flex-col justify-center">
            <div className="mb-8 text-center md:text-left flex flex-col items-center md:items-start">
              <div className={`inline-flex size-12 rounded-xl items-center justify-center mb-4 ring-1 ring-inset shadow-sm transition-colors duration-300 ${theme.softIcon}`}>
                <HeaderIcon className="size-6" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Sign In</h2>
              <p className="text-zinc-500 text-sm mt-1 font-medium">{theme.subtitle}</p>
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
                  className="h-11 w-full bg-white border border-zinc-200 rounded-lg px-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
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
                    className="h-11 w-full bg-white border border-zinc-200 rounded-lg pl-3.5 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded-md hover:bg-zinc-100">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-4">
                <button type="submit" disabled={loading}
                  className="h-11 w-full bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed">
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

        {/* Footer — mode selector now sits on top, copyright moved to the bottom */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-xl ring-1 ring-inset ring-black/5 shadow-sm">
            {MODE_ORDER.map(m => {
              const t = MODE_THEME[m];
              const MIcon = t.Icon;
              const active = role === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRole(m)}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3.5 py-1.5 rounded-lg transition-all
                    ${active ? t.seg : 'text-zinc-500 hover:text-zinc-700 hover:bg-white/70'}`}>
                  <MIcon className="size-3.5" /> {t.label}
                </button>
              );
            })}
          </div>

          <div className="h-px w-12 bg-zinc-200"></div>

          <p className="text-zinc-400 text-[11px] font-medium tracking-wide">
            © {new Date().getFullYear()} <span className="font-semibold text-zinc-500">SmartEdz</span>. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}