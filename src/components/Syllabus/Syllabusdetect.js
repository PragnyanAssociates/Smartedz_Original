// =====================================================================
//  syllabusDetect.js  — textbook → chapters detection + page slicing
//
//  Put this file in your backend/ folder (next to index.js) and require
//  it from index.js (near the top, with the other requires):
//      const { detectChapters, slicePdf } = require('./syllabusDetect');
//
//  Dependencies (install once in backend/, and commit package.json):
//      npm install pdfjs-dist@3.11.174 pdf-lib --save
//
//  detectChapters(buffer) -> { total, chapters:[{title,page_from,page_to}] }
//      1) Uses the PDF's built-in outline / bookmarks   (most reliable)
//      2) Falls back to parsing the Contents/Index page text
//      3) Final fallback: a single "Full Document" chapter
//
//  The assembler is robust to broken bookmarks: it keeps the outline's
//  reading order, drops any destination that points to the wrong place
//  (e.g. page 0), and interpolates a sensible page for it. Front matter
//  is collapsed into a single "Index" entry; chapters are titled
//  "N. Clean Title".
//
//  slicePdf(buffer, from, to) -> base64 of just those pages (1-based, inclusive)
// =====================================================================

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { PDFDocument } = require('pdf-lib');

// ---------------------------------------------------------------------
//  Public: detect chapters
// ---------------------------------------------------------------------
async function detectChapters(buffer) {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const total = doc.numPages;
  let chapters = [];

  try { chapters = await fromOutline(doc, total); } catch (_) { chapters = []; }
  if (!chapters.length) {
    try { chapters = await fromTocText(doc, total); } catch (_) { chapters = []; }
  }
  if (!chapters.length) {
    chapters = [{ title: 'Full Document', page_from: 1, page_to: total }];
  }

  try { await doc.cleanup(); await doc.destroy(); } catch (_) {}
  return { total, chapters };
}

// ---------------------------------------------------------------------
//  Strategy 1 — PDF outline / bookmarks (kept in reading order)
// ---------------------------------------------------------------------
async function fromOutline(doc, total) {
  const outline = await doc.getOutline();
  if (!outline || !outline.length) return [];

  const items = [];
  for (const node of outline) {                  // top level only = chapters
    const idx = await destToPageIndex(doc, node.dest);
    items.push({ title: node.title || '', start: idx == null ? null : idx + 1 });
  }
  if (!items.some(i => i.start != null)) return [];
  return assemble(items, total);
}

async function destToPageIndex(doc, dest) {
  try {
    let d = dest;
    if (typeof d === 'string') d = await doc.getDestination(d);
    if (!Array.isArray(d) || !d.length) return null;
    const ref = d[0];
    if (ref == null) return null;
    return await doc.getPageIndex(ref);
  } catch (_) { return null; }
}

// ---------------------------------------------------------------------
//  Strategy 2 — parse the Contents page text
// ---------------------------------------------------------------------
async function fromTocText(doc, total) {
  const scan = Math.min(total, 20);
  const candidates = [];

  for (let p = 1; p <= scan; p++) {
    const page = await doc.getPage(p);
    const lines = await pageToLines(page);
    for (const ln of lines) {
      const parsed = parseTocLine(ln, total);
      if (parsed) candidates.push(parsed);
    }
  }
  if (candidates.length < 2) return [];

  candidates.sort((a, b) => a.start - b.start);
  const seen = new Set();
  const items = [];
  for (const c of candidates) {
    if (seen.has(c.start)) continue;
    seen.add(c.start);
    items.push({ title: c.title, start: c.start });
  }
  return assemble(items, total);
}

// group a page's text fragments into visual lines (by y), left-to-right
async function pageToLines(page) {
  const tc = await page.getTextContent();
  const buckets = [];
  for (const it of tc.items) {
    const s = it.str || '';
    if (!s.trim()) continue;
    const y = it.transform[5];
    const x = it.transform[4];
    let b = buckets.find((bk) => Math.abs(bk.y - y) <= 3);
    if (!b) { b = { y, parts: [] }; buckets.push(b); }
    b.parts.push({ x, s });
  }
  buckets.sort((a, b) => b.y - a.y);
  return buckets.map((b) =>
    b.parts.sort((p, q) => p.x - q.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim()
  );
}

// "1 Relief Features ........ 13"  ->  { title:'1 Relief Features', start:13 }
function parseTocLine(line, total) {
  if (!line || line.length < 4) return null;
  const m = line.match(/^(.*?[A-Za-z].*?)[\s.·•\-_]{1,}(\d{1,4})$/);
  if (!m) return null;
  const title = (m[1] || '').replace(/\s+/g, ' ').replace(/[\s.·•\-_]+$/, '').trim();
  const pageNum = parseInt(m[2], 10);
  if (!title || title.length < 3) return null;
  if (!/[A-Za-z]/.test(title)) return null;
  if (!(pageNum >= 1 && pageNum <= total)) return null;
  return { title, start: pageNum };
}

// ---------------------------------------------------------------------
//  Shared assembler — order-fix, interpolate, Index, clean titles
//    `items` are in reading order: [{ title, start|null }]
// ---------------------------------------------------------------------
function assemble(items, total) {
  if (!items.length) return [];
  const n = items.length;

  // 1) keep only strictly-increasing, in-range page numbers; null the rest
  const starts = items.map(it => (Number.isFinite(it.start) ? it.start : null));
  let prev = 0;
  for (let i = 0; i < n; i++) {
    if (starts[i] == null || starts[i] < 1 || starts[i] > total || starts[i] <= prev) {
      starts[i] = null;
    } else {
      prev = starts[i];
    }
  }

  // 2) interpolate the nulls between their nearest known neighbours
  for (let i = 0; i < n; i++) {
    if (starts[i] != null) continue;
    let l = i - 1; while (l >= 0 && starts[l] == null) l--;
    let r = i + 1; while (r < n && starts[r] == null) r++;
    const lv = l >= 0 ? starts[l] : 1;
    const rv = r < n ? starts[r] : total + 1;
    const base = l >= 0 ? l : -1;
    const span = (r < n ? r : n) - base;
    let v = Math.round(lv + (rv - lv) * ((i - base) / span));
    if (v <= lv) v = lv + 1;
    if (v > total) v = total;
    starts[i] = v;
  }

  // 3) clean titles
  const cleaned = items.map((it, i) => ({ title: cleanTitle(it.title), start: starts[i] }));

  // 4) front matter (titles before the first numbered chapter) -> one "Index"
  const firstChapter = cleaned.findIndex(c => /^\d+\b/.test(c.title));
  const result = [];
  let startIdx = 0;

  if (firstChapter > 0) {
    result.push({ title: 'Index', page_from: 1, page_to: Math.max(1, cleaned[firstChapter].start - 1) });
    startIdx = firstChapter;
  } else if (cleaned[0].start > 1) {
    result.push({ title: 'Index', page_from: 1, page_to: cleaned[0].start - 1 });
  }

  // 5) chapter ranges
  let seq = 0;
  for (let i = startIdx; i < n; i++) {
    seq++;
    const from = cleaned[i].start;
    const to = (i + 1 < n) ? cleaned[i + 1].start - 1 : total;
    result.push({
      title: formatChapterTitle(cleaned[i].title, seq),
      page_from: from,
      page_to: Math.max(from, to),
    });
  }
  return result;
}

function cleanTitle(t) {
  return (t || '').replace(/\.pdf\s*$/i, '').replace(/\s+/g, ' ').trim();
}

function titleCase(s) {
  return (s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

// "1 relief features" -> "1. Relief Features"; otherwise "<seq>. Title"
function formatChapterTitle(clean, seq) {
  const m = clean.match(/^(\d+)\s*[.)]?\s*(.*)$/);
  if (m && m[2]) return `${m[1]}. ${titleCase(m[2])}`;
  if (m) return `${m[1]}. Chapter ${m[1]}`;
  return `${seq}. ${titleCase(clean)}`;
}

// ---------------------------------------------------------------------
//  Public: slice a page range out of the textbook PDF
// ---------------------------------------------------------------------
async function slicePdf(buffer, from, to) {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const total = src.getPageCount();

  let start = Math.max(1, parseInt(from, 10) || 1);
  let end = Math.min(total, parseInt(to, 10) || total);
  if (end < start) end = start;

  const out = await PDFDocument.create();
  const indices = [];
  for (let i = start - 1; i <= end - 1; i++) indices.push(i);

  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));

  const bytes = await out.save();
  return Buffer.from(bytes).toString('base64');
}

module.exports = { detectChapters, slicePdf };