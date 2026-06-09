import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, FileText, Loader2 } from 'lucide-react';

// =====================================================================
//  FileViewer — in-screen viewer for a stored base64 file object
//  ({ name, type, data }). Renders inline:
//     • images  -> <img>
//     • PDFs    -> <iframe>
//     • text    -> decoded text (txt/csv/log/md/json/…)
//     • .docx   -> converted to HTML via mammoth (loaded on demand from
//                  a CDN — nothing to install)
//  Anything else (incl. legacy .doc) falls back to a download prompt.
//  Always offers a Download button and a Close button.
//
//  Rendered above every other overlay (z-[120]).
// =====================================================================

// --- helpers -------------------------------------------------------
const extOf = (name) => {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
};

function kindOf(file) {
  const t = (file.type || '').toLowerCase();
  const e = extOf(file.name);
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(e)) return 'image';
  if (t === 'application/pdf' || e === 'pdf') return 'pdf';
  if (t.startsWith('text/') || ['txt', 'csv', 'log', 'md', 'json', 'xml', 'html', 'css', 'js'].includes(e)) return 'text';
  if (e === 'docx' || t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (e === 'doc' || t === 'application/msword') return 'doc';
  return 'other';
}

// base64 data URL -> raw bytes
function dataUrlToBytes(dataUrl) {
  const comma = String(dataUrl).indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function safeText(dataUrl) {
  try { return new TextDecoder('utf-8').decode(dataUrlToBytes(dataUrl)); }
  catch { return ''; }
}

// Load mammoth (Word -> HTML) once, on demand, from a CDN.
let _mammothPromise = null;
function loadMammoth() {
  if (typeof window !== 'undefined' && window.mammoth) return Promise.resolve(window.mammoth);
  if (_mammothPromise) return _mammothPromise;
  _mammothPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/mammoth@1.8.0/mammoth.browser.min.js';
    s.async = true;
    s.onload = () => (window.mammoth ? resolve(window.mammoth) : reject(new Error('mammoth unavailable')));
    s.onerror = () => { _mammothPromise = null; reject(new Error('Could not load the Word viewer')); };
    document.head.appendChild(s);
  });
  return _mammothPromise;
}

// Minimal typography for rendered .docx (Tailwind preflight strips defaults).
const DOCX_STYLES = `
.hw-docx-view { color:#27272a; font-size:14px; line-height:1.7; }
.hw-docx-view h1 { font-size:1.5em; font-weight:700; margin:0.6em 0 0.4em; }
.hw-docx-view h2 { font-size:1.3em; font-weight:700; margin:0.6em 0 0.4em; }
.hw-docx-view h3 { font-size:1.1em; font-weight:600; margin:0.6em 0 0.4em; }
.hw-docx-view p { margin:0 0 0.8em; }
.hw-docx-view ul { list-style:disc; padding-left:1.5em; margin:0 0 0.8em; }
.hw-docx-view ol { list-style:decimal; padding-left:1.5em; margin:0 0 0.8em; }
.hw-docx-view li { margin:0.2em 0; }
.hw-docx-view strong { font-weight:700; }
.hw-docx-view em { font-style:italic; }
.hw-docx-view a { color:#2563eb; text-decoration:underline; }
.hw-docx-view table { border-collapse:collapse; margin:0 0 0.8em; width:auto; }
.hw-docx-view td, .hw-docx-view th { border:1px solid #d4d4d8; padding:6px 10px; }
.hw-docx-view img { max-width:100%; height:auto; }
`;

export default function FileViewer({ file, onClose }) {
  const kind = useMemo(() => (file ? kindOf(file) : 'none'), [file]);
  const textContent = useMemo(
    () => (kind === 'text' && file?.data ? safeText(file.data) : ''),
    [kind, file]
  );

  // .docx -> HTML (async, on demand)
  const [docState, setDocState] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [docHtml, setDocHtml] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (kind !== 'docx' || !file?.data) { setDocState('idle'); setDocHtml(''); return; }
    setDocState('loading'); setDocHtml('');
    (async () => {
      try {
        const mammoth = await loadMammoth();
        const bytes = dataUrlToBytes(file.data);
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
        if (cancelled) return;
        setDocHtml(result.value || '<p style="color:#a1a1aa">(This document has no readable text.)</p>');
        setDocState('ready');
      } catch {
        if (!cancelled) setDocState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [kind, file]);

  if (!file) return null;

  const handleDownload = () => {
    if (!file.data) return;
    const a = document.createElement('a');
    a.href = file.data;
    a.download = file.name || 'file';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const Fallback = ({ message }) => (
    <div className="bg-white rounded-lg p-8 text-center max-w-sm shadow-lg">
      <FileText className="size-10 text-zinc-300 mx-auto mb-3" />
      <p className="text-sm font-medium text-zinc-600">{message}</p>
      <button onClick={handleDownload}
        className="mt-4 mx-auto h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors">
        <Download className="size-3.5" /> Download File
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] bg-zinc-900/70 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      <style>{DOCX_STYLES}</style>

      {/* Header: name + Download + Close */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white shrink-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-zinc-900 truncate">{file.name || 'File'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleDownload}
            className="h-9 px-3 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors">
            <Download className="size-3.5" /> Download
          </button>
          <button onClick={onClose}
            className="h-9 px-3 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors">
            <X className="size-3.5" /> Close
          </button>
        </div>
      </div>

      {/* Body: the file itself */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-3 sm:p-6 flex items-center justify-center">
        {kind === 'image' ? (
          <img src={file.data} alt={file.name || ''}
            className="max-w-full max-h-full object-contain rounded-md shadow-lg bg-white" />

        ) : kind === 'pdf' ? (
          <iframe src={file.data} title={file.name || 'PDF'}
            className="w-full bg-white rounded-md shadow-lg" style={{ height: '100%', minHeight: '70vh', border: 0 }} />

        ) : kind === 'text' ? (
          <div className="w-full max-w-4xl bg-white rounded-md shadow-lg p-4 sm:p-6">
            <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-zinc-800 font-mono">
              {textContent || '(empty file)'}
            </pre>
          </div>

        ) : kind === 'docx' ? (
          docState === 'loading' ? (
            <div className="flex flex-col items-center gap-3 text-white/90">
              <Loader2 className="size-7 animate-spin" />
              <span className="text-xs font-semibold">Opening document…</span>
            </div>
          ) : docState === 'ready' ? (
            <div className="w-full max-w-4xl bg-white rounded-md shadow-lg p-5 sm:p-8">
              <div className="hw-docx-view" dangerouslySetInnerHTML={{ __html: docHtml }} />
            </div>
          ) : (
            <Fallback message="Couldn't preview this Word file. You can download it instead." />
          )

        ) : kind === 'doc' ? (
          <Fallback message="Legacy .doc files can't be previewed in the browser. Download to open it." />

        ) : (
          <Fallback message="Preview isn't available for this file type." />
        )}
      </div>
    </div>
  );
}