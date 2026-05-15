import React from 'react';

export const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    default: 'bg-slate-900 text-white hover:bg-slate-800'
  };
  return (
    <button className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Card = ({ children, className = '' }) => <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
export const CardHeader = ({ children, className = '' }) => <div className={`p-4 border-b border-slate-100 ${className}`}>{children}</div>;
export const CardTitle = ({ children, className = '' }) => <h3 className={`text-lg font-bold text-slate-900 ${className}`}>{children}</h3>;
export const CardContent = ({ children, className = '' }) => <div className={`p-4 ${className}`}>{children}</div>;
export const Input = ({ className = '', ...props }) => <input className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${className}`} {...props} />;
export const Label = ({ children, className = '' }) => <label className={`block text-sm font-semibold text-slate-700 mb-1 ${className}`}>{children}</label>;
export const Badge = ({ children, className = '' }) => <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase bg-slate-100 text-slate-700 ${className}`}>{children}</span>;
export const Select = ({ children, ...props }) => <select className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" {...props}>{children}</select>;

export const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};