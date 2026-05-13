import React from 'react';
import { useNavigate } from 'react-router-dom';
import vspngoLogo from "../assets/vpsnewlogo.png";
import schoolImage from "../assets/schoolcover.jpg";

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="welcome-wrapper">
      {/* ALL STYLES IN ONE PLACE */}
      <style>{`
        .welcome-wrapper {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: white;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          overflow-x: hidden;
          margin: 0;
        }

        @media (min-width: 1280px) {
          .welcome-wrapper { flex-direction: row; }
        }

        /* LEFT SIDE CONTENT */
        .content-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 40px 24px;
          background-color: #ffffff;
          z-index: 10;
        }

        @media (min-width: 1280px) {
          .content-panel { 
            flex: 0 0 45%; 
            padding: 0 80px;
          }
        }

        .logo-container {
          margin-bottom: 40px;
          animation: fadeInUp 0.8s ease-out forwards;
        }

        .logo-img {
          height: 90px;
          width: auto;
          object-fit: contain;
        }

        .main-heading {
          font-size: 42px;
          font-weight: 800;
          color: #1a1a1a;
          line-height: 1.1;
          margin: 0 0 20px 0;
          opacity: 0;
          animation: fadeInUp 0.8s ease-out 0.2s forwards;
        }

        @media (min-width: 640px) {
          .main-heading { font-size: 56px; }
        }

        .description {
          font-size: 18px;
          color: #666;
          line-height: 1.6;
          max-width: 450px;
          margin-bottom: 40px;
          opacity: 0;
          animation: fadeInUp 0.8s ease-out 0.4s forwards;
        }

        /* INDIGO BUTTON */
        .cta-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background-color: #4f46e5;
          color: white;
          padding: 16px 36px;
          font-size: 18px;
          font-weight: 700;
          border-radius: 50px;
          border: none;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(79, 70, 229, 0.3);
          transition: all 0.3s ease;
          opacity: 0;
          animation: fadeInUp 0.8s ease-out 0.6s forwards;
          text-decoration: none;
        }

        .cta-button:hover {
          background-color: #4338ca;
          transform: translateY(-3px);
          box-shadow: 0 15px 30px rgba(79, 70, 229, 0.4);
        }

        .button-icon {
          margin-left: 12px;
          width: 20px;
          height: 20px;
          transition: transform 0.3s ease;
        }

        .cta-button:hover .button-icon {
          transform: translateX(5px);
        }

        /* RIGHT SIDE IMAGE */
        .image-panel {
          display: none;
          flex: 1;
          position: relative;
          background: #f0f2f5;
        }

        @media (min-width: 1280px) {
          .image-panel { display: block; }
        }

        .bg-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* MOBILE IMAGE */
        .mobile-hero-img {
          width: 100%;
          height: 300px;
          object-fit: cover;
        }

        @media (min-width: 1280px) {
          .mobile-hero-img { display: none; }
        }

        /* ANIMATIONS */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* LEFT SIDE: Text and Logo */}
      <div className="content-panel">
        <div className="logo-container">
          <img src={vspngoLogo} alt="School Logo" className="logo-img" />
        </div>

        <div className="text-content">
          <h1 className="main-heading">
            Welcome to the Future <br />
            <span style={{color: '#333'}}>of School Management</span>
          </h1>

          <p className="description">
            The unified platform to manage your institution's resources, students, and operations seamlessly.
          </p>

          <button className="cta-button" onClick={() => navigate('/login')}>
            Get Started
            <svg className="button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>

      {/* RIGHT SIDE: Desktop Image */}
      <div className="image-panel">
        <img src={schoolImage} alt="School Classroom" className="bg-image" />
      </div>

      {/* MOBILE HERO IMAGE */}
      <img src={schoolImage} alt="School" className="mobile-hero-img" />
    </div>
  );
}