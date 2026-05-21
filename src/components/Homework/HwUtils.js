// =====================================================================
//  Homework — shared helpers
// =====================================================================

// Format a date as DD/MM/YYYY
export function fmtDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

// Convert a date to YYYY-MM-DD (for <input type="date">)
export function isoDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

// Read a File object → { name, type, data(base64) }
// Rejects files over maxMB to avoid bloating the DB row.
export function fileToBase64(file, maxMB = 5) {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) {
      reject(new Error(`"${file.name}" is over ${maxMB} MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve({
      name: file.name,
      type: file.type || 'application/octet-stream',
      data: reader.result            // data URL: "data:...;base64,...."
    });
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

// Trigger a browser download / open for a stored base64 file object
export function openFile(fileObj) {
  if (!fileObj || !fileObj.data) return;
  const w = window.open();
  if (!w) return;
  if ((fileObj.type || '').startsWith('image/')) {
    w.document.write(`<img src="${fileObj.data}" style="max-width:100%" />`);
  } else if (fileObj.type === 'application/pdf') {
    w.document.write(
      `<iframe src="${fileObj.data}" style="width:100%;height:100%;border:0"></iframe>`);
  } else {
    // Generic: force a download
    const a = w.document.createElement('a');
    a.href = fileObj.data;
    a.download = fileObj.name || 'file';
    w.document.body.appendChild(a);
    a.click();
  }
}

// Status → tailwind classes
export function statusStyle(status) {
  switch (status) {
    case 'Graded':    return { text: 'text-blue-700',   bg: 'bg-blue-50',    dot: 'bg-blue-500' };
    case 'Submitted': return { text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' };
    case 'Overdue':   return { text: 'text-red-700',    bg: 'bg-red-50',     dot: 'bg-red-500' };
    default:          return { text: 'text-amber-700',  bg: 'bg-amber-50',   dot: 'bg-amber-500' };
  }
}