import React from 'react';
import { useNavigate } from 'react-router-dom';

// Assets
import smartedzlogo from "../assets/smartedzlogo.png";

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-white overflow-x-hidden">
      {/* Animation Styles */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
        .animate-fade-in-up-delay-1 { animation: fadeInUp 0.6s ease-out 0.15s forwards; }
        .animate-fade-in-up-delay-2 { animation: fadeInUp 0.6s ease-out 0.3s forwards; }
        .animate-fade-in-up-delay-3 { animation: fadeInUp 0.6s ease-out 0.45s forwards; }
      `}</style>

      {/* Main Content Panel */}
      <div className="flex w-full flex-1 flex-col justify-center items-center bg-zinc-50 px-6 py-8 sm:px-12 z-10 min-h-screen">
        
        <div className="flex flex-col justify-center max-w-lg w-full mx-auto">
          
          {/* Logo Section - UNTOUCHED */}
          <div className="mb-6 flex items-center gap-3 animate-fade-in-up opacity-0">
            <img
              src={smartedzlogo || "/placeholder.svg"}
              alt="SmartEdz Logo"
              className="h-16 w-auto xs:h-20 sm:h-24 object-contain drop-shadow-sm"
            />
            <div className="text-4xl sm:text-5xl font-bold tracking-tight">
              <span className="text-[#3284c7]">Smart</span>
              <span className="text-[#f29132]">Edz</span>
            </div>
          </div>

          {/* Text Content - UPDATED TO RULES */}
          <div className="space-y-4 sm:space-y-6">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 animate-fade-in-up-delay-1 opacity-0 leading-tight">
              Complete ERP Solution for Educational Institutions
            </h1>

            <p className="text-base sm:text-lg text-zinc-500 animate-fade-in-up-delay-2 opacity-0 leading-relaxed max-w-md font-medium">
              The unified platform to manage your entire institution seamlessly.
            </p>

            {/* CTA Button */}
            <div className="pt-4 sm:pt-6 animate-fade-in-up-delay-3 opacity-0">
              <button
                type="button"
                onClick={() => navigate('/login')}
                aria-label="Proceed to the application"
                className="group relative inline-flex items-center justify-center rounded-md bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
              >
                <span>Get Started</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="ml-2 size-5 transition-transform duration-200 group-hover:translate-x-1"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}