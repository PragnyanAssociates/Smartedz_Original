// =====================================================================
//  Alumni — shared helpers
// =====================================================================

export function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${dt.getFullYear()}`;
}

// Initials for the avatar fallback
export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Colour for the "current status" chip based on its text
export function statusStyle(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('study') || s.includes('student') || s.includes('college') || s.includes('university'))
    return { text: 'text-blue-700', bg: 'bg-blue-50' };
  if (s.includes('doctor') || s.includes('engineer') || s.includes('work') ||
      s.includes('job') || s.includes('employed') || s.includes('business'))
    return { text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (!status) return { text: 'text-slate-400', bg: 'bg-slate-100' };
  return { text: 'text-violet-700', bg: 'bg-violet-50' };
}