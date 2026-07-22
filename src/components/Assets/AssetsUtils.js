// =====================================================================
//  Inventory & Assets — shared helpers
//  No academic-year logic: an asset belongs to the institution and
//  carries across years (like Syllabus). Filters are calendar-based.
// =====================================================================
import { useState, useEffect } from 'react';

// Condition/usage states an asset can be in.
export const ASSET_STATUSES = ['In Use', 'In Store', 'Under Repair', 'Damaged', 'Disposed'];

// Units of measure offered in the form.
export const ASSET_UNITS = ['Nos', 'Sets', 'Pairs', 'Boxes', 'Packets', 'Metres', 'Litres', 'Kg'];

// Chip colours per status.
export function statusStyle(status) {
  switch (status) {
    case 'In Use':       return { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-600/20' };
    case 'In Store':     return { bg: 'bg-sky-50',     text: 'text-sky-700',     ring: 'ring-sky-600/20' };
    case 'Under Repair': return { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-600/20' };
    case 'Damaged':      return { bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-600/20' };
    case 'Disposed':     return { bg: 'bg-zinc-100',   text: 'text-zinc-600',    ring: 'ring-zinc-500/20' };
    default:             return { bg: 'bg-zinc-50',    text: 'text-zinc-600',    ring: 'ring-zinc-500/20' };
  }
}

// Railway stores UTC — bare MySQL timestamps get a 'Z' before parsing so
// they render correctly in IST.
export function fmtIST(val) {
  if (!val) return '';
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) {
    d = new Date(val.replace(' ', 'T') + 'Z');
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

// Plain DATE column (no timezone shifting) -> DD/MM/YYYY
export function fmtDate(val) {
  if (!val) return '';
  const s = String(val);
  const datePart = s.includes('T') ? s.split('T')[0] : s.split(' ')[0];
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

// A DATE column -> YYYY-MM-DD for <input type="date">
export function toYYYYMMDD(val) {
  if (!val) return '';
  const s = String(val);
  const datePart = s.includes('T') ? s.split('T')[0] : s.split(' ')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : '';
}

// Indian-format rupees. Returns '-' for null/undefined so tables stay tidy.
export function money(val) {
  const n = Number(val);
  if (val === null || val === undefined || val === '' || isNaN(n)) return '-';
  return n.toLocaleString('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 2
  });
}

// Compact rupees for the summary strip (1.2L / 3.4Cr style).
export function moneyShort(val) {
  const n = Number(val || 0);
  if (isNaN(n)) return '-';
  if (n >= 10000000) return `\u20b9${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `\u20b9${(n / 100000).toFixed(2)} L`;
  if (n >= 1000)     return `\u20b9${(n / 1000).toFixed(1)} K`;
  return `\u20b9${n.toFixed(0)}`;
}

// Total value of a row = quantity x unit cost
export function lineValue(row) {
  const q = parseInt(row?.quantity, 10) || 0;
  const c = Number(row?.unit_cost);
  if (isNaN(c)) return 0;
  return q * c;
}

// Read a File -> base64 data URL with a size cap (MB).
export function fileToBase64(file, maxMB = 3) {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) {
      reject(new Error(`"${file.name}" is over ${maxMB} MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

// --- Fetch a token-protected image as a blob object URL --------------
//   /admin/assets/photo/:id sits behind the /api auth gate, so a raw
//   <img src> gets no token and 401s. Fetching it (the app's interceptor
//   attaches the token) and using the blob URL is what makes it render.
export function useAuthedImage(url) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!url) { setSrc(null); setErr(false); return; }
    let revoked = false;
    let obj = null;
    setSrc(null); setErr(false);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then(blob => {
        if (revoked) return;
        obj = URL.createObjectURL(blob);
        setSrc(obj);
      })
      .catch(() => { if (!revoked) setErr(true); });
    return () => { revoked = true; if (obj) URL.revokeObjectURL(obj); };
  }, [url]);
  return { src, err };
}