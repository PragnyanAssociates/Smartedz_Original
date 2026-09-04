import React, { useState, useEffect } from 'react';
import { X, Pencil, Clock, UserCog, Download, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { fmtAmt } from './VoucherForm';

// UTC -> IST, robust for bare MySQL datetimes.
export const parseDbDate = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v;
  let s = String(v);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = s.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export const fmtISTDateTime = (v) => {
  const d = parseDbDate(v);
  if (!d) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(d);
};

export const fmtVoucherDate = (v) => {
  if (!v) return '-';
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split('-');
  return d && m && y ? `${d}/${m}/${y}` : s;
};

// =====================================================================
//  Voucher -> PNG
//  Draws the same voucher the modal shows (details, particulars, total,
//  audit trail and the proof image) onto a canvas and downloads it, so
//  one file carries the whole record - not just the attachment.
// =====================================================================
const V_W    = 760;   // page width in CSS px
const V_PAD  = 28;
const V_SCALE = 2;    // render at 2x so the text stays sharp

const C = {
  primary: '#18469A',
  t900: '#18181B',
  t700: '#3F3F46',
  t500: '#71717A',
  t400: '#A1A1AA',
  border: '#E4E4E7',
  soft: '#FAFAFA',
  amber: '#B45309'
};

const F = (weight, size) =>
  `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

// Word wrap that also breaks a single over-long word by characters.
function wrapText(ctx, text, font, maxW) {
  ctx.font = font;
  const src = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!src) return [''];
  const out = [];
  let line = '';
  for (const word of src.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxW) { line = test; continue; }
    if (line) { out.push(line); line = ''; }
    if (ctx.measureText(word).width <= maxW) { line = word; continue; }
    let chunk = '';
    for (const ch of word) {
      if (ctx.measureText(chunk + ch).width > maxW && chunk) { out.push(chunk); chunk = ch; }
      else chunk += ch;
    }
    line = chunk;
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    if (!/^data:/i.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Single layout pass. Called once to measure (draw = false) and once to
// paint (draw = true), so the canvas is always exactly the right height.
function layoutVoucher(ctx, v, proofImg, draw) {
  const inner = V_W - V_PAD * 2;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  // ---- header band ------------------------------------------------
  const headerH = 78;
  if (draw) {
    ctx.fillStyle = C.primary;
    ctx.fillRect(0, 0, V_W, headerH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = F(700, 20);
    ctx.fillText(v.voucher_no || 'Voucher', V_PAD, 20);
    ctx.font = F(500, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`Debit Voucher - ${fmtVoucherDate(v.voucher_date)}`, V_PAD, 48);
    ctx.textAlign = 'right';
    ctx.font = F(700, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`INR ${fmtAmt(v.total_amount)}`, V_W - V_PAD, 24);
    ctx.font = F(500, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Total', V_W - V_PAD, 48);
    ctx.textAlign = 'left';
  }
  let y = headerH + 22;

  // ---- detail rows -------------------------------------------------
  const rows = [
    ['Head of A/C', v.head_of_account],
    ['Sub Head', v.sub_head],
    ['Name / Title', v.name_title],
    ['Phone', v.phone_no],
    ['Transfer through', v.account_type || '-'],
  ].filter(r => r[1] != null && String(r[1]).trim() !== '');

  for (const [label, val] of rows) {
    ctx.font = F(500, 11);
    const labelW = ctx.measureText(label).width;
    const lines = wrapText(ctx, val, F(500, 13), Math.max(80, inner - labelW - 24));
    if (draw) {
      ctx.textAlign = 'left';
      ctx.fillStyle = C.t500;
      ctx.font = F(500, 11);
      ctx.fillText(label, V_PAD, y + 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = C.t900;
      ctx.font = F(500, 13);
      lines.forEach((ln, i) => ctx.fillText(ln, V_W - V_PAD, y + i * 17));
      ctx.textAlign = 'left';
    }
    y += Math.max(18, lines.length * 17) + 8;
  }

  // ---- particulars table -------------------------------------------
  y += 8;
  const tableTop = y;
  const amtW  = 130;
  const descW = inner - amtW - 24;
  const parts = v.particulars || [];

  // table head
  if (draw) {
    ctx.fillStyle = C.soft;
    ctx.fillRect(V_PAD, y, inner, 28);
    ctx.fillStyle = C.t500;
    ctx.font = F(700, 10);
    ctx.fillText('PARTICULARS', V_PAD + 12, y + 9);
    ctx.textAlign = 'right';
    ctx.fillText('AMOUNT', V_W - V_PAD - 12, y + 9);
    ctx.textAlign = 'left';
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(V_PAD, y + 27.5);
    ctx.lineTo(V_PAD + inner, y + 27.5);
    ctx.stroke();
  }
  y += 28;

  // table rows
  parts.forEach((p, i) => {
    const lines = wrapText(ctx, p.description, F(500, 12), descW);
    const rowH = Math.max(30, lines.length * 16 + 14);
    if (draw) {
      ctx.fillStyle = C.t700;
      ctx.font = F(500, 12);
      lines.forEach((ln, li) => ctx.fillText(ln, V_PAD + 12, y + 8 + li * 16));
      ctx.textAlign = 'right';
      ctx.fillStyle = C.t900;
      ctx.font = F(500, 12);
      ctx.fillText(`INR ${fmtAmt(p.amount)}`, V_W - V_PAD - 12, y + 8);
      ctx.textAlign = 'left';
      if (i < parts.length - 1) {
        ctx.strokeStyle = '#F4F4F5';
        ctx.beginPath();
        ctx.moveTo(V_PAD, y + rowH - 0.5);
        ctx.lineTo(V_PAD + inner, y + rowH - 0.5);
        ctx.stroke();
      }
    }
    y += rowH;
  });

  // total row
  if (draw) {
    ctx.fillStyle = C.soft;
    ctx.fillRect(V_PAD, y, inner, 36);
    ctx.strokeStyle = C.border;
    ctx.beginPath();
    ctx.moveTo(V_PAD, y + 0.5);
    ctx.lineTo(V_PAD + inner, y + 0.5);
    ctx.stroke();
    ctx.fillStyle = C.t700;
    ctx.font = F(700, 13);
    ctx.fillText('Total', V_PAD + 12, y + 11);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.primary;
    ctx.fillText(`INR ${fmtAmt(v.total_amount)}`, V_W - V_PAD - 12, y + 11);
    ctx.textAlign = 'left';
  }
  y += 36;

  // table outline
  if (draw) {
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(V_PAD + 0.5, tableTop + 0.5, inner - 1, y - tableTop - 1);
  }

  // ---- amount in words ---------------------------------------------
  if (v.amount_in_words) {
    y += 12;
    const lines = wrapText(ctx, `In words: ${v.amount_in_words}`, F(500, 11), inner);
    if (draw) {
      ctx.fillStyle = C.t500;
      ctx.font = F(500, 11);
      lines.forEach((ln, i) => ctx.fillText(ln, V_PAD, y + i * 15));
    }
    y += lines.length * 15;
  }

  // ---- audit trail --------------------------------------------------
  y += 14;
  const audit = [`Created by ${v.created_by_name || 'Unknown'} - ${fmtISTDateTime(v.created_at)}`];
  if (v.updated_at) audit.push(`Updated by ${v.updated_by_name || 'Unknown'} - ${fmtISTDateTime(v.updated_at)}`);
  const auditLines = audit.flatMap(t => wrapText(ctx, t, F(500, 11), inner - 24));
  const auditH = auditLines.length * 16 + 20;
  if (draw) {
    ctx.fillStyle = C.soft;
    ctx.fillRect(V_PAD, y, inner, auditH);
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(V_PAD + 0.5, y + 0.5, inner - 1, auditH - 1);
    ctx.fillStyle = C.t500;
    ctx.font = F(500, 11);
    auditLines.forEach((ln, i) => ctx.fillText(ln, V_PAD + 12, y + 10 + i * 16));
  }
  y += auditH;

  // ---- payment proof ------------------------------------------------
  if (proofImg) {
    y += 18;
    if (draw) {
      ctx.fillStyle = C.t900;
      ctx.font = F(700, 12);
      ctx.fillText('Payment Proof', V_PAD, y);
    }
    y += 20;
    let iw = inner;
    let ih = proofImg.height * (iw / proofImg.width);
    const maxH = 640;
    if (ih > maxH) { ih = maxH; iw = proofImg.width * (ih / proofImg.height); }
    if (draw) {
      ctx.drawImage(proofImg, V_PAD, y, iw, ih);
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(V_PAD + 0.5, y + 0.5, iw - 1, ih - 1);
    }
    y += ih;
  }

  // ---- footer -------------------------------------------------------
  y += 20;
  if (draw) {
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(V_PAD, y + 0.5);
    ctx.lineTo(V_W - V_PAD, y + 0.5);
    ctx.stroke();
  }
  y += 10;
  if (draw) {
    ctx.font = F(500, 10);
    ctx.fillStyle = C.t400;
    ctx.fillText('Computer-generated voucher', V_PAD, y);
    ctx.textAlign = 'right';
    ctx.fillText('Powered by SmartEdz', V_W - V_PAD, y);
    ctx.textAlign = 'left';
  }
  y += 14;

  return y + V_PAD;
}

function paintVoucher(v, proofImg) {
  // pass 1 - measure on a scratch context
  const scratch = document.createElement('canvas').getContext('2d');
  const height = layoutVoucher(scratch, v, proofImg, false);

  // pass 2 - paint at full size
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(V_W * V_SCALE);
  canvas.height = Math.round(height * V_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(V_SCALE, V_SCALE);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, V_W, height);
  layoutVoucher(ctx, v, proofImg, true);
  return canvas;
}

function saveCanvas(canvas, filename) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('export failed'));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      }, 'image/png');
    } catch (e) { reject(e); }
  });
}

// Exported so the register (or anywhere else) can reuse the same output.
export async function downloadVoucher(v) {
  if (!v) return;
  const name = `${(v.voucher_no || 'voucher').replace(/[^\w-]+/g, '_')}.png`;
  const img = await loadImage(v.attachment);
  try {
    await saveCanvas(paintVoucher(v, img), name);
  } catch (e) {
    // A cross-origin attachment taints the canvas and blocks the export.
    // Fall back to the voucher without the image so the details still save.
    if (!img) throw e;
    await saveCanvas(paintVoucher(v, null), name);
    alert('The voucher was downloaded, but the proof image could not be added to it. You can save the image separately from the voucher view.');
  }
}

// Fetches details by id and shows the modal. Pass either `voucher` (full object) or `id`.
export default function VoucherView({ voucher, id, onClose, onEdit }) {
  const [v, setV] = useState(voucher || null);
  const [loading, setLoading] = useState(!voucher);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (voucher) { setV(voucher); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/expenses/details/${id}`);
        const d = await res.json();
        if (alive) setV(d);
      } catch { /* ignore */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [voucher, id]);

  const handleDownload = async () => {
    if (!v || downloading) return;
    setDownloading(true);
    try {
      await downloadVoucher(v);
    } catch (e) {
      console.error('Voucher download error:', e);
      alert('Could not download the voucher. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const parts = v?.particulars || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <div>
            <p className="text-sm font-semibold">{v?.voucher_no || 'Voucher'}</p>
            <p className="text-[10px] font-medium opacity-85">Debit Voucher - {fmtVoucherDate(v?.voucher_date)}</p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center size-8 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {loading || !v ? (
          <div className="h-40 flex items-center justify-center"><div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <>
            <div className="p-5 space-y-3 text-sm">
              <Info label="Head of A/C" value={v.head_of_account} />
              {v.sub_head && <Info label="Sub Head" value={v.sub_head} />}
              {v.name_title && <Info label="Name / Title" value={v.name_title} />}
              {v.phone_no && <Info label="Phone" value={v.phone_no} />}
              <Info label="Transfer through" value={v.account_type || '-'} />

              <div className="border border-zinc-200 shadow-sm rounded-md overflow-hidden mt-2">
                <div className="flex bg-zinc-50 px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-200">
                  <span className="flex-1">Particulars</span><span className="w-28 text-right">Amount</span>
                </div>
                {parts.map((p, i) => (
                  <div key={i} className="flex px-3 py-2 border-b border-zinc-100 last:border-0 text-xs">
                    <span className="flex-1 font-medium text-zinc-700">{p.description}</span>
                    <span className="w-28 text-right font-medium tabular-nums text-zinc-900">INR {fmtAmt(p.amount)}</span>
                  </div>
                ))}
                <div className="flex bg-zinc-50 px-3 py-2.5 border-t border-zinc-200">
                  <span className="flex-1 text-sm font-semibold text-zinc-700">Total</span>
                  <span className="w-28 text-right text-sm font-semibold text-primary tabular-nums">INR {fmtAmt(v.total_amount)}</span>
                </div>
              </div>
              {v.amount_in_words && <p className="text-[11px] font-medium text-zinc-500"><span className="font-semibold text-zinc-600">In words:</span> {v.amount_in_words}</p>}

              {/* Audit */}
              <div className="rounded-md bg-zinc-50 border border-zinc-200 shadow-sm p-3 space-y-1.5 mt-2">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Clock className="size-3.5 text-primary shrink-0" />
                  <span>Created by <strong className="font-semibold text-zinc-700">{v.created_by_name || 'Unknown'}</strong> - {fmtISTDateTime(v.created_at)}</span>
                </div>
                {v.updated_at && (
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <UserCog className="size-3.5 text-amber-600 shrink-0" />
                    <span>Updated by <strong className="font-semibold text-zinc-700">{v.updated_by_name || 'Unknown'}</strong> - {fmtISTDateTime(v.updated_at)}</span>
                  </div>
                )}
              </div>

              {v.attachment && (
                <div>
                  <p className="text-xs font-semibold text-zinc-900 mb-1.5 mt-4">Payment Proof</p>
                  <img src={v.attachment} alt="proof" className="w-full rounded-md border border-zinc-200 shadow-sm mt-1.5" />
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-zinc-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button onClick={handleDownload} disabled={downloading}
                title="Download this voucher with all details and the payment proof"
                className="w-full sm:w-auto h-9 px-6 min-w-[120px] flex items-center justify-center gap-1.5 bg-white text-zinc-700 border border-zinc-200 rounded-md text-xs font-semibold hover:bg-zinc-50 hover:text-primary transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
                {downloading ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <Download className="size-3.5 shrink-0" />}
                {downloading ? 'Preparing...' : 'Download'}
              </button>
              {onEdit && (
                <button onClick={() => onEdit(v.id)} className="w-full sm:w-auto h-9 px-6 min-w-[120px] flex items-center justify-center gap-1.5 bg-primary text-white rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm">
                  <Pencil className="size-3.5 shrink-0" /> Edit
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-500 font-medium text-xs shrink-0">{label}</span>
      <span className="font-medium text-zinc-900 text-right">{value}</span>
    </div>
  );
}