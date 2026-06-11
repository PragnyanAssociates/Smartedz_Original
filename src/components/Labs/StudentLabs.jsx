import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Loader2, FlaskConical, Video, LinkIcon, Radio, ExternalLink,
  Search, BookOpen, Clock, ArrowLeft, User, FileText
} from 'lucide-react';

// =====================================================================
//  StudentLabs - a student browses the digital labs posted for their
//  class, opens a lab, and watches videos / opens links / joins live
//  classes.
// =====================================================================

const fmtDateTime = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// STRICT ENTERPRISE PALETTE: Replaced all rose, orange, and emerald with zinc/primary
function resMeta(type) {
  switch (type) {
    case 'video': return { icon: Video,    label: 'Video',      color: 'text-zinc-600', bg: 'bg-zinc-100' };
    case 'pdf':   return { icon: FileText, label: 'PDF',        color: 'text-zinc-600', bg: 'bg-zinc-100' };
    case 'live':  return { icon: Radio,    label: 'Live Class', color: 'text-zinc-600', bg: 'bg-zinc-100' };
    default:      return { icon: LinkIcon, label: 'Link',       color: 'text-zinc-600', bg: 'bg-zinc-100' };
  }
}

export default function StudentLabs() {
  const { user } = useAuth();

  const [labs, setLabs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');
  const [openLab, setOpenLab] = useState(null);   // lab object for detail view

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/labs/student/${user.id}`);
      const d = await res.json();
      setLabs(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return labs;
    const q = query.toLowerCase();
    return labs.filter(l =>
      (l.title || '').toLowerCase().includes(q) ||
      (l.subject_name || '').toLowerCase().includes(q));
  }, [labs, query]);

  if (openLab) {
    return <LabDetail lab={openLab} onBack={() => setOpenLab(null)} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <header className="flex flex-col mb-2 sm:mb-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <FlaskConical className="text-primary size-5" />
          Digital Labs
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch] font-medium">
          Watch lab videos, open resources and join live classes assigned to your class.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search labs..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <FlaskConical className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No labs posted for your class yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map(lab => {
              const counts = (lab.resources || []).reduce((acc, r) => {
                acc[r.resource_type] = (acc[r.resource_type] || 0) + 1;
                return acc;
              }, {});
              return (
                <button key={lab.id} onClick={() => setOpenLab(lab)}
                  className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-4 sm:p-5 flex flex-col text-left hover:ring-primary/30 hover:shadow-md transition-all h-full w-full group overflow-hidden">
                  <div className="size-10 bg-primary/10 rounded-md flex items-center justify-center text-primary ring-1 ring-inset ring-primary/20 shrink-0">
                    <FlaskConical className="size-5" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 text-base leading-tight line-clamp-2 min-h-[2.5rem] mt-3 group-hover:text-primary transition-colors">{lab.title}</h3>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-1.5 line-clamp-1">
                    {lab.subject_name || 'General'}
                    {lab.created_by_name ? ` - ${lab.created_by_name}` : ''}
                  </p>
                  {lab.description && (
                    <p className="text-xs text-zinc-500 mt-3 line-clamp-2 leading-relaxed font-medium">{lab.description}</p>
                  )}
                  <div className="mt-auto pt-4 flex flex-wrap gap-1.5 w-full">
                    {['video', 'pdf', 'live', 'link'].map(t => counts[t] ? (
                      <ResourceTag key={t} type={t} count={counts[t]} />
                    ) : null)}
                    {(lab.resources || []).length === 0 && (
                      <span className="text-[11px] text-zinc-400 italic font-medium">No resources</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
//  LAB DETAIL - all resources of one lab
// =====================================================================
function LabDetail({ lab, onBack }) {
  const resources = lab.resources || [];

  // group: live classes first, then videos, then PDFs, then links
  const ordered = useMemo(() => {
    const rank = { live: 0, video: 1, pdf: 2, link: 3 };
    return [...resources].sort((a, b) =>
      (rank[a.resource_type] ?? 9) - (rank[b.resource_type] ?? 9));
  }, [resources]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full">
      
      {/* UPDATED BACK BUTTON: Removed box styling, padding, and background */}
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ArrowLeft className="size-4" /> Back to labs
      </button>

      {/* Lab header */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="size-12 bg-primary/10 rounded-md flex items-center justify-center text-primary ring-1 ring-inset ring-primary/20 shrink-0">
            <FlaskConical className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 tracking-tight leading-tight">{lab.title}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] sm:text-xs font-medium text-zinc-500">
              <span className="flex items-center gap-1.5 bg-zinc-100 px-2 py-1 rounded-md text-zinc-600">
                <BookOpen className="size-3.5" /> {lab.subject_name || 'General'}
              </span>
              {lab.created_by_name && (
                <span className="flex items-center gap-1.5 bg-zinc-100 px-2 py-1 rounded-md text-zinc-600">
                  <User className="size-3.5" /> {lab.created_by_name}
                </span>
              )}
            </div>
          </div>
        </div>
        {lab.description && (
          <div className="mt-5 bg-zinc-50/50 p-4 rounded-md border border-zinc-100">
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap font-medium">{lab.description}</p>
          </div>
        )}
      </div>

      {/* Resources */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">Resources</h3>
        
        {ordered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <p className="text-zinc-400 font-medium text-sm">This lab has no resources yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ordered.map(r => {
              const meta = resMeta(r.resource_type);
              const Icon = meta.icon;

              // Check if file is stored in DB or is an external URL
              const clickUrl = r.has_file 
                ? `${API_BASE_URL}/admin/labs/resource/${r.id}` 
                : r.url;

              return (
                <div key={r.id}
                  className="bg-white rounded-md ring-1 ring-black/5 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-shadow group">
                  <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                    <div className={`size-10 rounded-md flex items-center justify-center shrink-0 ${meta.bg} ${meta.color} ring-1 ring-inset ring-black/5`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.color}`}>
                          {meta.label}
                        </span>
                        {r.resource_type === 'live' && r.scheduled_at && (
                          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded ring-1 ring-inset ring-black/5">
                            <Clock className="size-3" /> {fmtDateTime(r.scheduled_at)}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-zinc-900 text-sm truncate">{r.title}</p>
                    </div>
                  </div>
                  
                  {/* UNIFIED PRIMARY ACTION BUTTON */}
                  <a href={clickUrl} target="_blank" rel="noopener noreferrer"
                    className="h-9 px-4 rounded-md font-semibold text-xs text-white transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 shadow-sm bg-primary hover:bg-primary/90">
                    {r.resource_type === 'live' ? 'Join' : r.resource_type === 'video' ? 'Watch' : r.resource_type === 'pdf' ? 'Open PDF' : 'Open Link'}
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceTag({ type, count }) {
  const meta = resMeta(type);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${meta.bg} ${meta.color} ring-1 ring-inset ring-black/5`}>
      <Icon className="size-3" /> {count} {meta.label}{count !== 1 ? 's' : ''}
    </span>
  );
}