// Shared helpers for viewing/downloading payment proof.
// - Offline payments: the uploaded slip image.
// - Online payments: a generated professional receipt.

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename || 'payment-proof.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Draws a branded receipt to a canvas and downloads it as PNG.
export function downloadReceipt(fields, filename) {
  const W = 700, H = 520;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // header band
  ctx.fillStyle = '#3284c7';
  ctx.fillRect(0, 0, W, 92);

  // logo square (initials)
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  roundRect(ctx, 28, 24, 44, 44, 8); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial, sans-serif';
  const initial = (fields.schoolName || 'S').trim().charAt(0).toUpperCase();
  ctx.fillText(initial, 28 + 22 - ctx.measureText(initial).width / 2, 54);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText(fields.schoolName || 'School', 86, 46);
  ctx.font = '12px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Fee Payment Receipt', 86, 66);

  const st = (fields.status || '').toUpperCase();
  if (st) {
    ctx.font = 'bold 13px Arial, sans-serif';
    const tw = ctx.measureText(st).width;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(ctx, W - 28 - tw - 20, 34, tw + 20, 24, 12); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(st, W - 28 - tw - 10, 51);
  }

  const rows = [
    ['Receipt No', fields.receiptNo],
    ['Date & Time', fields.datetime],
    ['Student', fields.student + (fields.roll ? `  (Roll ${fields.roll})` : '')],
    ['Class', fields.className],
    ['Fee', fields.fee],
    ['Method', fields.method],
    ['Reference', fields.ref],
  ].filter(r => r[1] != null && String(r[1]).trim() !== '' && String(r[1]) !== '—');

  let y = 138;
  rows.forEach(([k, v]) => {
    ctx.fillStyle = '#71717a'; ctx.font = '13px Arial, sans-serif';
    ctx.fillText(k, 28, y);
    ctx.fillStyle = '#18181b'; ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText(String(v), 240, y);
    y += 40;
  });

  ctx.strokeStyle = '#e4e4e7';
  ctx.beginPath(); ctx.moveTo(28, y - 4); ctx.lineTo(W - 28, y - 4); ctx.stroke();
  ctx.fillStyle = '#71717a'; ctx.font = '14px Arial, sans-serif';
  ctx.fillText('Amount Paid', 28, y + 32);
  ctx.fillStyle = '#3284c7'; ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText(String(fields.amount || ''), 240, y + 36);

  // footer
  ctx.fillStyle = '#a1a1aa'; ctx.font = '11px Arial, sans-serif';
  const foot = fields.contact ? `${fields.contact}` : '';
  ctx.fillText('Computer-generated receipt' + (foot ? '  ·  ' + foot : ''), 28, H - 24);
  const smart = 'Powered by SmartEdz';
  ctx.fillText(smart, W - 28 - ctx.measureText(smart).width, H - 24);

  downloadDataUrl(canvas.toDataURL('image/png'), filename || 'receipt.png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}