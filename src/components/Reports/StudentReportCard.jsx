import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { Loader2, Printer, AlertCircle } from 'lucide-react';
import ReportCardView from './ReportCardView';

// =====================================================================
//  StudentReportCard — the logged-in student's own report card.
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
    return <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }

  if (error) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
        <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">{error}</p>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <button onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-100">
          <Printer size={15} /> Print
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden print:border-0 print:shadow-none print:rounded-none">
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