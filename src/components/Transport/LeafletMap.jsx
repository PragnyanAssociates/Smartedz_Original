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

export default function LeafletMap({ points = [], onMapClick, height = 520 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const clickRef = useRef(onMapClick);
  useEffect(() => { clickRef.current = onMapClick; }, [onMapClick]);

  // init
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
    return () => { alive = false; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw on point change
  useEffect(() => { draw(); /* eslint-disable-next-line */ }, [JSON.stringify(points)]);

  function draw() {
    const L = window.L, map = mapRef.current, layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const valid = points.filter(p => p.lat != null && p.lng != null && !isNaN(+p.lat) && !isNaN(+p.lng));
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

    const line = (list, color) => { if (list.length > 1) L.polyline(list.map(p => [p.lat, p.lng]), { color, weight: 3, opacity: 0.6, dashArray: '6,8' }).addTo(layer); };
    line(pickups, '#3284c7');
    line(drops, '#f29132');

    if (valid.length) { try { map.fitBounds(valid.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 15 }); } catch { /* noop */ } }
  }

  return (
    <div>
      <div ref={elRef} style={{ height, width: '100%', borderRadius: 8, zIndex: 0 }} className="ring-1 ring-black/5 overflow-hidden bg-zinc-100" />
      <p className="text-[10px] text-zinc-400 mt-1.5">Tip: click the map to drop a pin for the active tab, or paste a Google Maps link on a point.</p>
    </div>
  );
}