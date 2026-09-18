import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Building2, MapPin } from 'lucide-react';

// Assets
import smartedzlogo from "../assets/smartedzlogo.png";

// Backgrounds live in /public (served from the site root). A landscape image
// for the web and a portrait one for phones — swapped by a CSS media query so
// it changes live when you rotate / resize. The names MUST match the real
// files in /public exactly (case-sensitive).
//   • /public/Background_Web.png     -> desktop / tablet (wide)
//   • /public/Background_mobile.png  -> phones (<= 640px)

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="welcome-bg relative flex min-h-screen flex-col overflow-x-hidden bg-zinc-50 bg-cover bg-center bg-no-repeat">
      {/* Animations + responsive background */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
        .animate-fade-in-up-delay-1 { animation: fadeInUp 0.6s ease-out 0.15s forwards; }
        .animate-fade-in-up-delay-2 { animation: fadeInUp 0.6s ease-out 0.3s forwards; }
        .animate-fade-in-up-delay-3 { animation: fadeInUp 0.6s ease-out 0.45s forwards; }
        .animate-fade-in-up-delay-4 { animation: fadeInUp 0.6s ease-out 0.6s forwards; }

        /* Default (web / wide) background */
        .welcome-bg { background-image: url('/Background_Web.png'); }

        /* Phones — portrait mobile background */
        @media (max-width: 640px) {
          .welcome-bg { background-image: url('/Background_mobile.png'); }
        }
      `}</style>

      {/* Soft overlay — keeps the text crisp over any busy part of the image
          while still letting the background show through. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/50 via-white/25 to-white/50" />

      {/* Centered hero content (fills the space above the footer) */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">

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

          {/* Text Content */}
          <div className="space-y-4 sm:space-y-6">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 animate-fade-in-up-delay-1 opacity-0 leading-tight">
              Complete Educational ERP Solution for Schools, Colleges &amp; Educational Institutions
            </h1>

            <p className="mx-auto max-w-md text-base sm:text-lg font-medium text-zinc-600 animate-fade-in-up-delay-2 opacity-0 leading-relaxed">
              A unified Educational ERP platform to manage students, academics, administration, fees, transport, communication, and your entire institution seamlessly.
            </p>

            {/* CTA Button */}
            <div className="pt-4 sm:pt-6 flex justify-center animate-fade-in-up-delay-3 opacity-0">
              <button
                type="button"
                onClick={() => navigate('/login')}
                aria-label="Proceed to the application"
                className="group relative inline-flex items-center justify-center rounded-md bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
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

      {/* Contact footer */}
      <footer className="relative z-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 pb-6 pt-2 text-sm font-medium text-zinc-500 animate-fade-in-up-delay-4 opacity-0">
        <a
          href="mailto:smartedzhyd@gmail.com"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
        >
          <Mail className="size-4 shrink-0 text-primary fw-bold" />
          smartedzhyd@gmail.com
        </a>
        <span className="hidden text-zinc-300 sm:inline">•</span>
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="size-4 shrink-0 text-primary fw-bold" />
          SmartEdz LLP
        </span>
        <span className="hidden text-zinc-300 sm:inline">•</span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 shrink-0 text-primary fw-bold" />
          Hyderabad, India
        </span>
      </footer>
    </div>
  );
}