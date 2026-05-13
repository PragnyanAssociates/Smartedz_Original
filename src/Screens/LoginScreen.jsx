import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import apiClient from '../api/client';
import pragnyanLogo from '../assets/vpsnewlogo.png';
import storage from '../utils/storage';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="login-page">
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eef2f7;
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          padding: 20px;
        }

        .login-card {
          display: flex;
          width: 100%;
          max-width: 1000px;
          min-height: 550px;
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.05);
        }

        /* LEFT SIDE: Branding */
        .branding-side {
          flex: 1;
          background-color: #f1f4f9;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          text-align: center;
        }

        .branding-side img {
          width: 180px;
          margin-bottom: 25px;
        }

        .tagline {
          color: #64748b;
          font-size: 16px;
          margin-top: 20px;
        }

        /* RIGHT SIDE: Form */
        .form-side {
          flex: 1;
          padding: 60px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .form-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .form-header h2 {
          font-size: 32px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        .form-header p {
          color: #94a3b8;
          font-size: 15px;
          margin: 10px 0 0 0;
        }

        .input-group {
          margin-bottom: 25px;
        }

        .input-group label {
          display: block;
          font-size: 15px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 10px;
        }

        .input-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-container svg {
          position: absolute;
          left: 15px;
          color: #94a3b8;
          width: 20px;
          height: 20px;
        }

        .login-input {
          width: 100%;
          padding: 14px 15px 14px 45px;
          background: #ebf2ff;
          border: 1px solid #dbeafe;
          border-radius: 12px;
          font-size: 16px;
          color: #1e293b;
          outline: none;
          transition: 0.3s;
        }

        .login-input:focus {
          background: #fff;
          border-color: #4f46e5;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
        }

        .eye-toggle {
          position: absolute;
          right: 15px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .login-button {
          width: 100%;
          background: #4f46e5;
          color: white;
          padding: 16px;
          border: none;
          border-radius: 12px;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          margin-top: 15px;
        }

        .login-button:hover {
          background: #4338ca;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);
        }

        .error-message {
          color: #e11d48;
          background: #fff1f2;
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: 500;
        }

        .back-link {
          text-align: center;
          margin-top: 30px;
        }

        .back-link button {
          background: none;
          border: none;
          color: #475569;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
        }

        @media (max-width: 850px) {
          .branding-side { display: none; }
          .login-card { max-width: 450px; }
        }
      `}</style>

      <div className="login-card">
        {/* LEFT Branding Section */}
        <div className="branding-side">
          <img src={pragnyanLogo} alt="School Logo" />
          <p className="tagline">Secure, Simple, and Efficient.</p>
        </div>

        {/* RIGHT Form Section */}
        <div className="form-side">
          <div className="form-header">
            <h2>School Login</h2>
            <p>Welcome back! Please enter your details.</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Username</label>
              <div className="input-container">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                <input 
                  type="text" 
                  className="login-input" 
                  placeholder="Enter username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-container">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="login-input" 
                  placeholder="••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
                <button 
                  type="button" 
                  className="eye-toggle" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg style={{left:'auto', right:'0'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.961 9.961 0 012.617-4.326m3.48-2.26A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.96 9.96 0 01-4.166 5.13M3 3l18 18"></path></svg>
                  ) : (
                    <svg style={{left:'auto', right:'0'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Authenticating..." : "Login"}
            </button>
          </form>

          <div className="back-link">
            <button onClick={() => navigate('/')}>Back to Welcome Page</button>
          </div>
        </div>
      </div>
    </div>
  );
}