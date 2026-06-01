import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { Loader2, Printer, AlertCircle } from 'lucide-react';
import ReportCardView from './ReportCardView';

// =====================================================================
//  StudentReportCard - the logged-in student's own report card.
//  Read-only. Reuses the shared ReportCardView + print CSS.
// =====================================================================

export default function StudentReportCard() {
  const { user } = useAuth();
  const [card, setCard]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/reports/my-report-card/${user.id}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load report card');
        return d;
      })
      .then(d => setCard(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center animate-in fade-in duration-300">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center animate-in fade-in duration-300">
        <AlertCircle className="size-10 text-red-400 mb-3" />
        <p className="text-zinc-500 text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      
      <div className="flex justify-end print:hidden">
        <button onClick={handlePrint}
          className="h-9 px-6 bg-primary hover:bg-primary/90 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto shrink-0">
          <Printer className="size-4 shrink-0" /> Print
        </button>
      </div>

      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden print:ring-0 print:shadow-none print:rounded-none">
        <ReportCardView card={card} />
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-card-printable, #report-card-printable * { visibility: visible; }
          #report-card-printable {
            position: absolute; left: 0; top: 0; width: 100%;
          }
        }
      `}</style>
      
    </div>
  );
}