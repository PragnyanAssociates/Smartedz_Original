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
        <div className={`text-xs font-black ${b.text}`}>{percentage}%</div>
        {marks && <div className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{marks}</div>}
      </div>
      <div className="w-9 sm:w-12 flex-1 bg-slate-100 rounded-t-lg flex flex-col justify-end overflow-hidden border border-slate-200">
        <div className={`w-full ${b.bar} rounded-t-lg transition-all duration-700 ease-out`}
          style={{ height: `${h}%` }} />
      </div>
      <div className="w-full h-px bg-slate-200 mt-1" />
      <span className={`mt-1.5 text-[10px] font-bold text-center truncate max-w-[84px] px-1 ${
        highlight ? 'text-blue-600' : 'text-slate-600'
      }`} title={label}>
        {label}
      </span>
      {subLabel && (
        <span className="text-[9px] text-slate-400 truncate max-w-[84px]" title={subLabel}>
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
          <span className={`w-3 h-3 rounded ${c}`} />
          <span className="text-xs font-bold text-slate-600">{t}</span>
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
      <div className="h-[300px] flex flex-col items-center justify-center text-slate-400">
        <BarChart3 className="w-14 h-14 opacity-20 mb-3" />
        <span className="font-medium">{empty || 'No data to chart.'}</span>
      </div>
    );
  }
  return (
    <div className="h-[340px] overflow-x-auto">
      <div className="flex items-end h-full min-w-max pt-8 px-2">{children}</div>
    </div>
  );
}

// --- Modal shell with header + optional filter row + legend footer --
export function ChartModal({ title, subtitle, onClose, filters, banner, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-lg font-black text-slate-800">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={22} />
          </button>
        </div>
        {filters && (
          <div className="px-6 pt-5 pb-1 border-b border-slate-100 bg-white">
            {filters}
          </div>
        )}
        {banner}
        <div className="flex-1 overflow-auto p-6">{children}</div>
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <BandLegend />
        </div>
      </div>
    </div>
  );
}