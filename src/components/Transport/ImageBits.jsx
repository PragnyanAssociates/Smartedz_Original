import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

// Simple in-memory cache so a thumbnail is fetched once per session.
const cache = {};

export function useLazyImage(endpoint, enabled) {
  const [src, setSrc] = useState(() => (enabled && endpoint && cache[endpoint]) || null);
  useEffect(() => {
    if (!enabled || !endpoint) return;
    if (cache[endpoint]) { setSrc(cache[endpoint]); return; }
    let alive = true;
    (async () => {
      try {
        const d = await fetch(`${API_BASE_URL}${endpoint}`).then(x => x.json());
        const img = d?.image || null;
        if (img) { cache[endpoint] = img; if (alive) setSrc(img); }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [endpoint, enabled]);
  return src;
}

/**
 * Lazily loads an image from `endpoint` (only when `has` is true) and shows a
 * fallback icon otherwise. Clicking a loaded image calls onEnlarge(src).
 */
export function Thumb({ endpoint, has, alt = '', icon: Icon, className = 'size-9', rounded = 'rounded-md', onEnlarge }) {
  const src = useLazyImage(endpoint, !!has);
  if (src) {
    return (
      <img src={src} alt={alt}
        onClick={(e) => { e.stopPropagation(); onEnlarge && onEnlarge(src, alt); }}
        className={`${className} ${rounded} object-cover ring-1 ring-black/5 shrink-0 ${onEnlarge ? 'cursor-zoom-in hover:opacity-90 transition-opacity' : ''}`} />
    );
  }
  return (
    <div className={`${className} ${rounded} bg-zinc-100 ring-1 ring-black/5 flex items-center justify-center text-zinc-400 shrink-0`}>
      {Icon && <Icon className="size-4" />}
    </div>
  );
}

/** Full-screen image viewer. Click anywhere (or Esc) to close. */
export function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-900/85 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-md hover:bg-white/10">
        <X className="size-6" />
      </button>
      {alt && <span className="absolute top-5 left-5 text-white/80 text-xs font-medium">{alt}</span>}
      <img src={src} alt={alt || ''} onClick={e => e.stopPropagation()}
        className="max-w-full max-h-[88vh] object-contain rounded-lg shadow-2xl" />
      <span className="absolute bottom-5 text-white/50 text-[11px]">Click anywhere or press Esc to close</span>
    </div>
  );
}