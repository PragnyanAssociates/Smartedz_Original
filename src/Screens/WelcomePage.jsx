import React from 'react';
import { useNavigate } from 'react-router-dom';

// Assets
import vspngoLogo from "../assets/vpsnewlogo.png";
import schoolImage from "../assets/schoolcover.jpg";

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col xl:flex-row bg-white overflow-x-hidden">
      {/* Animation Styles */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
        .animate-fade-in-up-delay-1 { animation: fadeInUp 0.8s ease-out 0.2s forwards; }
        .animate-fade-in-up-delay-2 { animation: fadeInUp 0.8s ease-out 0.4s forwards; }
        .animate-fade-in-up-delay-3 { animation: fadeInUp 0.8s ease-out 0.6s forwards; }
        .animate-fade-in-up-delay-4 { animation: fadeInUp 0.8s ease-out 0.8s forwards; }
      `}</style>

      {/* LEFT SIDE: Content Panel */}
      <div className="flex w-full flex-col justify-between bg-gray-50 px-6 py-4 sm:px-12 xl:w-1/2 xl:px-12 z-10 shadow-xl xl:shadow-none min-h-[50vh] xl:min-h-screen">
        
        {/* Top Spacer / Main Content Container */}
        <div className="flex-1 flex flex-col justify-center max-w-lg w-full">
          
          {/* School Logo */}
          <div className="mb-0 sm:mb-2 animate-fade-in-up opacity-0">
            <img
              src={vspngoLogo || "/placeholder.svg"}
              alt="Vivekananda Public School Logo"
              className="h-20 w-auto xs:h-24 sm:h-28 md:h-36 lg:h-40 object-contain"
            />
          </div>

          {/* Text Content */}
          <div className="space-y-4 sm:space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-gray-900 animate-fade-in-up-delay-1 opacity-0 leading-tight">
              Welcome to the Future of School Management
            </h1>

            <p className="text-base sm:text-lg text-gray-600 animate-fade-in-up-delay-2 opacity-0 leading-relaxed max-w-md">
              The unified platform to manage your institution's resources, students, and operations seamlessly.
            </p>

            {/* CTA Button */}
            <div className="pt-2 sm:pt-4 animate-fade-in-up-delay-3 opacity-0">
              <button
                type="button"
                onClick={() => navigate('/login')}
                aria-label="Proceed to the application"
                className="group relative inline-flex items-center justify-center rounded-full bg-indigo-600 px-8 py-3.5 text-base sm:text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:bg-indigo-700 hover:shadow-indigo-500/30 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <span>Get Started</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
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

        {/* Footer: Powered By */}
        <div className="mt-2 sm:mt-4 animate-fade-in-up-delay-4 opacity-0 w-full max-w-lg">
        </div>
      </div>

      {/* RIGHT SIDE: Image Panel */}
      <div className="relative w-full flex-1 xl:flex-none min-h-[16rem] sm:min-h-[20rem] xl:h-auto xl:w-1/2 xl:w-7/12 bg-indigo-50">
        <img
          src={schoolImage || "/placeholder.svg"}
          alt="Students in a classroom"
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="eager"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent xl:bg-gradient-to-r xl:from-black/5 xl:to-transparent"></div>
      </div>

    </div>
  );
}