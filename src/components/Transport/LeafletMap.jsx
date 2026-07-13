import React, { useRef, useEffect } from 'react';

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

// Inject animation styles once.
function ensureStyles() {
  if (document.getElementById('transport-map-css')) return;
  const st = document.createElement('style');
  st.id = 'transport-map-css';
  st.textContent = `
  @keyframes pinDrop{0%{transform:translateY(-16px) scale(.7);opacity:0}60%{transform:translateY(3px) scale(1.05)}100%{transform:translateY(0) scale(1);opacity:1}}
  .tp-pin{animation:pinDrop .5s cubic-bezier(.34,1.56,.64,1) both}
  @keyframes tpPing{0%{transform:scale(.5);opacity:.7}100%{transform:scale(2);opacity:0}}
  .tp-pin-ring{position:absolute;inset:-4px;border-radius:50%;animation:tpPing 1.8s ease-out infinite}
  @keyframes busBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
  @keyframes busRing{0%{transform:scale(.5);opacity:.55}100%{transform:scale(2.2);opacity:0}}
  .live-bus-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:38px;height:38px}
  .live-bus-ring{position:absolute;width:38px;height:38px;border-radius:50%;background:rgba(50,132,199,.4);animation:busRing 1.6s ease-out infinite}
  .live-bus-glyph{position:relative;font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));animation:busBob 1s ease-in-out infinite}
  .leaflet-marker-icon.live-bus{transition:transform 1.1s linear}
  `;
  document.head.appendChild(st);
}

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

export default function LeafletMap({ points = [], onMapClick, height = 520, routed = false, liveLocation = null }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const busRef = useRef(null);
  const clickRef = useRef(onMapClick);
  useEffect(() => { clickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    let alive = true;
    ensureStyles();
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
      updateBus();
    });
    return () => { alive = false; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } busRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { draw(); /* eslint-disable-next-line */ }, [JSON.stringify(points), routed]);
  useEffect(() => { updateBus(); /* eslint-disable-next-line */ }, [liveLocation && liveLocation.lat, liveLocation && liveLocation.lng]);

  function busIcon(L) {
    return L.divIcon({
      className: '',
      html: `<div class="live-bus-wrap"><span class="live-bus-ring"></span><span class="live-bus-glyph">🚌</span></div>`,
      iconSize: [38, 38], iconAnchor: [19, 19]
    });
  }

  function updateBus() {
    const L = window.L, map = mapRef.current;
    if (!L || !map) return;
    if (!liveLocation || liveLocation.lat == null || liveLocation.lng == null) {
      if (busRef.current) { map.removeLayer(busRef.current); busRef.current = null; }
      return;
    }
    const ll = [Number(liveLocation.lat), Number(liveLocation.lng)];
    if (!busRef.current) {
      busRef.current = L.marker(ll, { icon: busIcon(L), zIndexOffset: 1000 }).addTo(map);
      const el = busRef.current.getElement(); if (el) el.classList.add('live-bus');
    } else {
      busRef.current.setLatLng(ll);
    }
  }

  function draw() {
    const L = window.L, map = mapRef.current, layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();

    const valid = points.filter(p => p.lat != null && p.lng != null && !isNaN(+p.lat) && !isNaN(+p.lng))
      .map(p => ({ ...p, lat: +p.lat, lng: +p.lng }));
    if (!valid.length) return;

    const pickups = valid.filter(p => p.point_type !== 'drop');
    const drops = valid.filter(p => p.point_type === 'drop');

    const addMarkers = (list, color) => list.forEach((p, i) => {
      const icon = L.divIcon({
        className: '',
        html: `<div class="tp-pin" style="position:relative;width:26px;height:26px">
                 <span class="tp-pin-ring" style="box-shadow:0 0 0 3px ${color}"></span>
                 <div style="position:relative;background:${color};color:#fff;border:2px solid #fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35)">${i + 1}</div>
               </div>`,
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

    (async () => {
      const [pGeo, dGeo] = await Promise.all([osrmGeo(pickups), osrmGeo(drops)]);
      if (!mapRef.current || !layerRef.current) return;
      const bounds = [];
      const drawLine = (geo, list, color) => {
        if (geo) { L.polyline(geo, { color, weight: 6, opacity: 0.9 }).addTo(layer); geo.forEach(c => bounds.push(c)); return; }
        if (list.length > 1) { const s = list.map(p => [p.lat, p.lng]); L.polyline(s, { color, weight: 4, opacity: 0.6, dashArray: '6,8' }).addTo(layer); s.forEach(c => bounds.push(c)); }
      };
      drawLine(pGeo, pickups, '#3284c7');
      drawLine(dGeo, drops, '#f29132');
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