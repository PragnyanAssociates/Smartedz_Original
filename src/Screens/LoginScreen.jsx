import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import apiClient from '../api/client';
import pragnyanLogo from '../assets/vpsnewlogo.png';
import storage from '../utils/storage';

export default function LoginScreen() {
  // STRICTLY PRESERVED NEW LOGIC STATES
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  // STRICTLY PRESERVED NEW API LOGIC
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/login', { username, password });
      
      if (response.data.token) {
        await storage.set('userToken', response.data.token);
        login(response.data.user, response.data.token);
        navigate('/Dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  // STRICTLY PRESERVED OLD UI & TAILWIND DESIGN
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 opacity-50">
        <div className="w-96 h-96 bg-blue-200/50 rounded-full blur-3xl" />
      </div>
      <div className="pointer-events-none absolute -bottom-40 -right-40 opacity-50">
        <div className="w-96 h-96 bg-indigo-200/50 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-4xl z-10 animate-slide-up">
        <div className="grid md:grid-cols-2 bg-white rounded-2xl shadow-2xl shadow-slate-300/60 overflow-hidden border border-slate-200/50">
          {/* Left Column: Branding & Illustration */}
          <div className="hidden md:flex flex-col justify-center items-center p-8 md:p-12 bg-gradient-to-br from-slate-100 to-gray-200/70 border-r border-slate-200/50">
            <img
              src={pragnyanLogo}
              alt="School Logo"
              className="w-48 h-48 object-contain mb-6"
              onError={(e) => (e.target.style.display = 'none')}
            />
            <p className="text-slate-600 mt-2 text-center">Secure, Simple, and Efficient.</p>
          </div>

          {/* Right Column: Form */}
          <div className="p-8 md:p-12">
            <div className="flex md:hidden items-center justify-center mb-6">
              <img
                src={pragnyanLogo}
                alt="Logo"
                className="w-32 h-32 object-contain"
                onError={(e) => (e.target.style.display = 'none')}
              />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 text-center mb-1">
              School Login
            </h2>
            <p className="text-center text-slate-500 mb-8">
              Welcome back! Please enter your details.
            </p>

            {/* Error Message Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Username Input */}
              <div>
                <label
                  htmlFor="username"
                  className="block mb-2 text-slate-700 font-semibold tracking-wide"
                >
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-slate-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <input
                    id="username"
                    type="text"
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                    aria-label="Username"
                    aria-invalid={!!error}
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label
                  htmlFor="password"
                  className="block mb-2 text-slate-700 font-semibold tracking-wide"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-slate-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-10 pr-12 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    aria-label="Password"
                    aria-invalid={!!error}
                    required
                  />

                  {/* Eye Icon Button */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 transition disabled:opacity-50"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.961 9.961 0 012.617-4.326m3.48-2.26A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.96 9.96 0 01-4.166 5.13M3 3l18 18"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 ease-out transform hover:bg-indigo-700 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 active:scale-[0.98] text-lg tracking-wide ${
                  loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V4a8 8 0 00-8 8h4z"
                      ></path>
                    </svg>
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  'Login'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="font-semibold text-slate-600 hover:text-slate-700 hover:underline"
                >
                  Back to Welcome Page
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Custom CSS for slide-up animation */}
      <style>{`
        @keyframes slide-up {
          0% {
            opacity: 0;
            transform: translateY(30px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.7s ease-out both;
        }
      `}</style>
    </div>
  );
}