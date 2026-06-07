import React, { useState, useEffect } from 'react';
import { X, BarChart3 } from 'lucide-react';
import { band } from './PerfUtils';

// =====================================================================
//  PerfBar — shared chart pieces for the Analysis views.
//    • PerfBar    — one animated vertical bar
//    • BandLegend — the green/blue/red legend strip
//    • ChartModal — modal shell with header + legend footer
//    • BarRow     — horizontal scrollable row of bars
// =====================================================================

// --- One vertical performance bar ----------------------------------
export function PerfBar({ percentage, label, subLabel, marks, highlight }) {
  const [h, setH] = useState(0);
  const b = band(percentage);

  useEffect(() => {
    const t = setTimeout(() => setH(Math.min(percentage, 100)), 80);
    return () => clearTimeout(t);
  }, [percentage]);

  return (
    <div className="flex flex-col items-center justify-end h-full group min-w-[66px] mx-1.5">
      <div className="mb-2 text-center">
        <div className={`text-xs font-semibold ${b.text}`}>{percentage}%</div>
        {marks && <div className="text-[9px] font-semibold text-zinc-400 whitespace-nowrap">{marks}</div>}
      </div>
      <div className="w-9 sm:w-12 flex-1 bg-zinc-100 rounded-t-md flex flex-col justify-end overflow-hidden ring-1 ring-inset ring-black/5">
        <div className={`w-full ${b.bar} rounded-t-md transition-all duration-700 ease-out`}
          style={{ height: `${h}%` }} />
      </div>
      <div className="w-full h-px bg-zinc-200 mt-1" />
      <span className={`mt-1.5 text-[10px] font-semibold text-center truncate max-w-[84px] px-1 ${
        highlight ? 'text-primary' : 'text-zinc-600'
      }`} title={label}>
        {label}
      </span>
      {subLabel && (
        <span className="text-[9px] text-zinc-400 font-medium truncate max-w-[84px]" title={subLabel}>
          {subLabel}
        </span>
      )}
    </div>
  );
}

// --- Green / blue / red legend (100–80 / 80–50 / 50–0) -------------
export function BandLegend() {
  return (
    <div className="flex justify-center gap-5 flex-wrap">
      {[
        ['bg-emerald-500', '80–100% Excellent'],
        ['bg-blue-500', '50–80% Average'],
        ['bg-red-500', '0–50% Needs Work']
      ].map(([c, t]) => (
        <div key={t} className="flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded-sm ${c}`} />
          <span className="text-xs font-semibold text-zinc-600 tracking-tight">{t}</span>
        </div>
      ))}
    </div>
  );
}

// --- Horizontal scrollable row of bars -----------------------------
export function BarRow({ children, empty }) {
  const items = React.Children.toArray(children);
  if (items.length === 0) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center text-zinc-400">
        <BarChart3 className="w-14 h-14 opacity-20 mb-3" />
        <span className="font-medium text-sm">{empty || 'No data to chart.'}</span>
      </div>
    );
  }
  return (
    <div className="h-[340px] overflow-x-auto custom-scrollbar">
      <div className="flex items-end h-full min-w-max pt-8 px-2">{children}</div>
    </div>
  );
}

// --- Modal shell with header + optional filter row + legend footer --
export function ChartModal({ title, subtitle, onClose, filters, banner, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-lg ring-1 ring-black/5 shadow-xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-5 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-zinc-500 font-medium mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 p-1.5 rounded-md transition-colors">
            <X className="size-5" />
          </button>
        </div>
        
        {filters && (
          <div className="px-6 pt-5 pb-3 border-b border-zinc-100 bg-white shrink-0">
            {filters}
          </div>
        )}
        
        {banner && <div className="shrink-0">{banner}</div>}
        
        <div className="flex-1 overflow-auto p-6 bg-zinc-50/30 custom-scrollbar">
          {children}
        </div>
        
        <div className="p-4 border-t border-zinc-100 bg-zinc-50 shrink-0">
          <BandLegend />
        </div>
        
      </div>
    </div>
  );
}