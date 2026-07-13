import React, { useRef, useEffect } from 'react';

// Loads Leaflet from CDN once and resolves with the global L.
function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L) return resolve(window.L);
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const existing = document.getElementById('leaflet-js');
    if (existing) { existing.addEventListener('load', () => resolve(window.L)); return; }
    const s = document.createElement('script');
    s.id = 'leaflet-js'; s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve(window.L);
    s.onerror = () => resolve(null);
    document.body.appendChild(s);
  });
}

// Extract lat,lng from a Google-Maps-style link or raw "lat,lng".
export function parseLatLng(link) {
  if (!link) return null;
  const s = String(link);
  let m = s.match(/^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  if (m) return { lat: +m[1], lng: +m[2] };
  m = s.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  m = s.match(/[?&](?:q|query|ll|destination|center)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  m = s.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (m) return { lat: +m[1], lng: +m[2] };
  return null;
}

// Road geometry through the given points (in order), via OSRM. Returns [[lat,lng],...] or null.
async function osrmGeo(list) {
  if (!list || list.length < 2) return null;
  try {
    const coords = list.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const json = await res.json();
    const geo = json?.routes?.[0]?.geometry?.coordinates;
    if (geo && geo.length) return geo.map(c => [c[1], c[0]]);
  } catch { /* ignore */ }
  return null;
}

export default function LeafletMap({ points = [], onMapClick, height = 520, routed = false }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const animRef = useRef(null);
  const clickRef = useRef(onMapClick);
  useEffect(() => { clickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    let alive = true;
    loadLeaflet().then((L) => {
      if (!alive || !L || !elRef.current || mapRef.current) return;
      const map = L.map(elRef.current, { scrollWheelZoom: true }).setView([17.385, 78.4867], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
      }).addTo(map);
      map.on('click', (e) => { if (clickRef.current) clickRef.current(e.latlng.lat, e.latlng.lng); });
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
      draw();
    });
    return () => {
      alive = false;
      if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { draw(); /* eslint-disable-next-line */ }, [JSON.stringify(points), routed]);

  function stopAnim() { if (animRef.current) { clearInterval(animRef.current); animRef.current = null; } }

  function busMarker(L, latlng) {
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:#111827;border:2px solid #fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 7px rgba(0,0,0,.45)">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2V10c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v6h2"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>
      </div>`,
      iconSize: [30, 30], iconAnchor: [15, 15]
    });
    return L.marker(latlng, { icon, zIndexOffset: 1000 });
  }

  function animateBus(L, layer, geo) {
    const marker = busMarker(L, geo[0]).addTo(layer);
    let i = 0;
    const step = Math.max(1, Math.round(geo.length / 400));
    animRef.current = setInterval(() => {
      i += step;
      if (i >= geo.length) i = 0;
      marker.setLatLng(geo[i]);
    }, 70);
  }

  function draw() {
    const L = window.L, map = mapRef.current, layer = layerRef.current;
    if (!L || !map || !layer) return;
    stopAnim();
    layer.clearLayers();

    const valid = points.filter(p => p.lat != null && p.lng != null && !isNaN(+p.lat) && !isNaN(+p.lng))
      .map(p => ({ ...p, lat: +p.lat, lng: +p.lng }));
    if (!valid.length) return;

    const pickups = valid.filter(p => p.point_type !== 'drop');
    const drops = valid.filter(p => p.point_type === 'drop');

    const addMarkers = (list, color) => list.forEach((p, i) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};color:#fff;border:2px solid #fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35)">${i + 1}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13]
      });
      L.marker([p.lat, p.lng], { icon }).addTo(layer)
        .bindPopup(`<b>${(p.title || 'Point').replace(/</g, '')}</b><br/>${p.point_type === 'drop' ? 'Drop' : 'Pickup'}`);
    });
    addMarkers(pickups, '#3284c7');
    addMarkers(drops, '#f29132');

    if (!routed) {
      const straight = (list, color) => { if (list.length > 1) L.polyline(list.map(p => [p.lat, p.lng]), { color, weight: 3, opacity: 0.6, dashArray: '6,8' }).addTo(layer); };
      straight(pickups, '#3284c7'); straight(drops, '#f29132');
      try { map.fitBounds(valid.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 15 }); } catch { /* noop */ }
      return;
    }

    // routed: draw road-following lines + animate a bus on the primary line
    (async () => {
      const [pGeo, dGeo] = await Promise.all([osrmGeo(pickups), osrmGeo(drops)]);
      if (!mapRef.current || !layerRef.current) return;
      const bounds = [];

      const drawLine = (geo, list, color) => {
        if (geo) { L.polyline(geo, { color, weight: 6, opacity: 0.9 }).addTo(layer); geo.forEach(c => bounds.push(c)); return geo; }
        if (list.length > 1) { const s = list.map(p => [p.lat, p.lng]); L.polyline(s, { color, weight: 4, opacity: 0.6, dashArray: '6,8' }).addTo(layer); s.forEach(c => bounds.push(c)); return s; }
        return null;
      };
      const pLine = drawLine(pGeo, pickups, '#3284c7');
      const dLine = drawLine(dGeo, drops, '#f29132');

      const primary = (pGeo && pGeo.length > 1) ? pGeo : ((dGeo && dGeo.length > 1) ? dGeo : (pLine && pLine.length > 1 ? pLine : dLine));
      if (primary && primary.length > 1) animateBus(L, layer, primary);

      const fitPts = bounds.length ? bounds : valid.map(p => [p.lat, p.lng]);
      try { map.fitBounds(fitPts, { padding: [50, 50], maxZoom: 16 }); } catch { /* noop */ }
    })();
  }

  return (
    <div>
      <div ref={elRef} style={{ height, width: '100%', borderRadius: 8, zIndex: 0 }} className="ring-1 ring-black/5 overflow-hidden bg-zinc-100" />
      {!routed && <p className="text-[10px] text-zinc-400 mt-1.5">Tip: click the map to drop a pin for the active tab, or paste a Google Maps link on a point.</p>}
    </div>
  );
}