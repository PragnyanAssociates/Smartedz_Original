import React from 'react';
import logo from '../assets/vpsnewlogo.png'; 
import smartEdzLogo from '../assets/smartedzlogo.png'; 

function AcademyLogo() {
  return (
    <img
      src={logo}
      alt="Vivekananda Public School Logo"
      className="h-[70px] xl:h-[90px] w-auto mx-auto"
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
}

function EmailIcon() {
  return (
    <svg className="w-3.5 h-3.5 xl:w-4 xl:h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="22,6 12,13 2,6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-3.5 h-3.5 xl:w-4 xl:h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PoweredBySmartEdz() {
  return (
    <a 
      href="https://www.smartedz.com" 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center gap-2 h-full hover:opacity-90 transition-opacity cursor-pointer"
    >
      <img
        src={smartEdzLogo}
        alt="SmartEdz Logo"
        className="h-9 sm:h-11 xl:h-12 w-auto object-contain shrink-0"
      />
      
      <div className="flex flex-col items-start justify-center mt-0.5">
        <span className="text-[8px] xl:text-[9px] text-slate-500 font-extrabold tracking-widest uppercase leading-none mb-1">
          Powered by
        </span>
        <h2 
          className="text-base sm:text-lg xl:text-xl font-bold tracking-tight leading-none"
          style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
        >
          <span className="bg-gradient-to-t from-[#18469A] via-[#1B83C5] to-[#21BEE1] bg-clip-text text-transparent">Smart</span>
          <span className="bg-gradient-to-t from-[#E35D14] to-[#F4A51D] bg-clip-text text-transparent">Edz</span>
        </h2>
      </div>
    </a>
  );
}

export default function DashboardHeader() {
  return (
    <nav className="sticky top-0 z-40 bg-slate-100 shadow-sm select-none overflow-hidden">
      {/* Changed: Removed max-w-7xl, 2xl:max-w-[85vw], and mx-auto to match the fluid layout */}
      <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8 h-16 flex items-center">
        
        {/* MOBILE VIEW */}
        <div className="flex items-center justify-between lg:hidden w-full h-full">
          <div className="flex items-center gap-2">
            <AcademyLogo />
            <h1 className="text-xs sm:text-sm font-bold text-slate-700 leading-tight max-w-[130px] break-words">
              VIVEKANANDA PUBLIC SCHOOL
            </h1>
          </div>
          
          <div className="flex flex-col items-end gap-1.5 justify-center h-full pt-1">
            <div className="flex items-center gap-3 text-slate-600 font-bold">
              <a href="mailto:vivekanandaschoolhyd@gmail.com" className="hover:text-blue-600">
                <EmailIcon />
              </a>
              <a href="tel:+918912553221" className="hover:text-blue-600">
                <PhoneIcon />
              </a>
            </div>
            <PoweredBySmartEdz />
          </div>
        </div>

        {/* DESKTOP VIEW */}
        <div className="hidden lg:flex items-center justify-between w-full h-full relative">
          
          {/* LEFT SIDE: VPS Logo */}
          <div className="flex items-center shrink-0 h-full relative z-10 pt-4">
            <AcademyLogo />
          </div>

          {/* MIDDLE: Title on Top, Contact Info Below */}
          <div className="flex flex-col items-center justify-center flex-1 px-4 h-full">
            <h1 className="text-xl font-bold text-slate-700 leading-none mb-3 xl:mb-4">
              VIVEKANANDA PUBLIC SCHOOL
            </h1>
            
            <div className="flex items-center justify-center gap-4 xl:gap-8 text-[11px] xl:text-xs">
              <a
                href="https://mail.google.com/mail/?view=cm&fs=1&to=vivekanandaschoolhyd@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-slate-600 hover:text-blue-700 transition-colors group"
              >
                <EmailIcon />
                <span className="group-hover:underline font-bold whitespace-nowrap">vivekanandaschoolhyd@gmail.com</span>
              </a>

              <a
                href="tel:+918912553221"
                className="flex items-center gap-1.5 text-slate-600 hover:text-blue-700 transition-colors group"
              >
                <PhoneIcon />
                <span className="group-hover:underline font-bold whitespace-nowrap">040-23355998 / +91 9394073325</span>
              </a>
            </div>
          </div>

          {/* RIGHT SIDE: SmartEdz Branding */}
          <div className="flex items-center shrink-0 relative z-10 h-full">
             <PoweredBySmartEdz />
          </div>

        </div>
      </div>
    </nav>
  );
}