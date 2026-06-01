// =====================================================================
//  syllabusDetect.js  — textbook → chapters detection + page slicing
//
//  Put this file in your backend/ folder (next to index.js) and require
//  it from Section 22:
//      const { detectChapters, slicePdf } = require('./syllabusDetect');
//
//  Dependencies (install once in backend/):
//      npm install pdfjs-dist@3.11.174 pdf-lib
//
//  detectChapters(buffer) -> { total, chapters:[{title,page_from,page_to}] }
//      1) Uses the PDF's built-in outline / bookmarks   (most reliable)
//      2) Falls back to parsing the Contents/Index page text
//      3) Final fallback: a single "Full Document" chapter
//      A synthetic "Index" entry is prepended for the front matter.
//
//  slicePdf(buffer, from, to) -> base64 of just those pages (1-based, inclusive)
// =====================================================================

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { PDFDocument } = require('pdf-lib');

const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();

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

  // 1) built-in outline / bookmarks (top level = chapters)
  try { chapters = await fromOutline(doc, total); } catch (_) { chapters = []; }

  // 2) parse the contents/index page text
  if (!chapters.length) {
    try { chapters = await fromTocText(doc, total); } catch (_) { chapters = []; }
  }

  // 3) give up gracefully — one chapter for the whole book
  if (!chapters.length) {
    chapters = [{ title: 'Full Document', page_from: 1, page_to: total }];
  }

  try { await doc.cleanup(); await doc.destroy(); } catch (_) {}
  return { total, chapters };
}

// ---------------------------------------------------------------------
//  Strategy 1 — PDF outline
// ---------------------------------------------------------------------
async function fromOutline(doc, total) {
  const outline = await doc.getOutline();
  if (!outline || !outline.length) return [];

  const items = [];
  for (const node of outline) {               // top level only = chapters
    const idx = await destToPageIndex(doc, node.dest);
    if (idx != null) items.push({ title: clean(node.title), start: idx + 1 });
  }
  if (!items.length) return [];

  items.sort((a, b) => a.start - b.start);

  // collapse duplicate start pages
  const dedup = [];
  for (const it of items) {
    if (!dedup.length || dedup[dedup.length - 1].start !== it.start) dedup.push(it);
  }
  return buildRanges(dedup, total);
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
  return buildRanges(items, total);
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
  buckets.sort((a, b) => b.y - a.y); // top of page first
  return buckets.map((b) =>
    b.parts.sort((p, q) => p.x - q.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim()
  );
}

// "1 Relief Features ........ 13"  ->  { title:'1 Relief Features', start:13 }
function parseTocLine(line, total) {
  if (!line || line.length < 4) return null;
  const m = line.match(/^(.*?[A-Za-z].*?)[\s.·•\-_]{1,}(\d{1,4})$/);
  if (!m) return null;

  const title = clean(m[1]).replace(/[\s.·•\-_]+$/, '').trim();
  const pageNum = parseInt(m[2], 10);

  if (!title || title.length < 3) return null;
  if (!/[A-Za-z]/.test(title)) return null;
  if (!(pageNum >= 1 && pageNum <= total)) return null;
  return { title, start: pageNum };
}

// ---------------------------------------------------------------------
//  Shared — turn start pages into ranges + prepend "Index"
// ---------------------------------------------------------------------
function buildRanges(items, total) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const from = items[i].start;
    const to = i + 1 < items.length ? items[i + 1].start - 1 : total;
    out.push({ title: items[i].title, page_from: from, page_to: Math.max(from, to) });
  }
  if (out.length && out[0].page_from > 1) {
    out.unshift({ title: 'Index', page_from: 1, page_to: out[0].page_from - 1 });
  }
  return out;
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