// =====================================================================
//  Syllabus — shared helpers
// =====================================================================

// Page-range label: "pp. 1 - 12" / "p. 5" / ""
export function pageLabel(from, to) {
  if (from && to) return from === to ? `p. ${from}` : `pp. ${from} - ${to}`;
  if (from) return `p. ${from}`;
  return '';
}

// Read a File -> { name, data(base64 data URL) }, with a size cap
export function fileToBase64(file, maxMB = 15) {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) {
      reject(new Error(`"${file.name}" is over ${maxMB} MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve({ name: file.name, data: reader.result });
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

// Date -> DD/MM/YYYY
export function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${dt.getFullYear()}`;
}