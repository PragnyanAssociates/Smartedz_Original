import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bus, MapPinned, ClipboardCheck, NotebookPen, Play, CheckCircle2, Navigation, User, Users, Phone, ChevronDown, Route as RouteIcon, Info, MapPin } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import LeafletMap from './LeafletMap';
import Attendance from './Attendance';
import VehicleLogBook from './VehicleLogBook';
import { Thumb, Lightbox } from './ImageBits';
import TripStatus, { tripState } from './TripStatus';

// Turn-by-turn link through a set of points, in order.
function gmapsDir(list) {
  const pts = list.filter(p => p.lat != null && p.lng != null);
  if (!pts.length) return null;
  const origin = `${pts[0].lat},${pts[0].lng}`;
  const destination = `${pts[pts.length - 1].lat},${pts[pts.length - 1].lng}`;
  const waypoints = pts.slice(1, -1).map(p => `${p.lat},${p.lng}`).join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return url;
}

export default function MyDuty({ user }) {
  const [duty, setDuty]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeId, setRouteId] = useState('');
  const [tab, setTab]       = useState('route');     // 'route' | 'attendance' | 'logbook'
  const [stopTab, setStopTab] = useState('pickup');
  const [track, setTrack]   = useState(null);   // server trip state
  const [liveLoc, setLiveLoc] = useState(null); // my own GPS while driving
  const [tracking, setTracking] = useState(false);
  const [zoom, setZoom]     = useState(null);
  const watchRef = useRef(null);
  const lastPost = useRef(0);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await fetch(`${API_BASE_URL}/transport/my-duty/${user.id}`).then(x => x.json());
        if (!alive) return;
        setDuty(d || null);
        if (d?.routes?.length) setRouteId(String(d.routes[0].id));
      } catch { if (alive) setDuty(null); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const route = useMemo(() => (duty?.routes || []).find(r => String(r.id) === String(routeId)) || null, [duty, routeId]);

  // Watch this route's trip state (so an assistant sees the driver's bus too).
  useEffect(() => {
    if (!routeId) return;
    let alive = true;
    const tick = async () => {
      try {
        const d = await fetch(`${API_BASE_URL}/transport/track/${routeId}`).then(x => x.json());
        if (alive) setTrack(d || null);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [routeId]);

  useEffect(() => () => { if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current); }, []);

  const points = useMemo(() => (route?.points || []).map(p => ({
    id: p.id, point_type: p.point_type, title: p.title, arrival_time: p.arrival_time,
    lat: p.latitude != null ? Number(p.latitude) : null,
    lng: p.longitude != null ? Number(p.longitude) : null,
  })), [route]);

  const pickups = points.filter(p => p.point_type === 'pickup');
  const drops = points.filter(p => p.point_type === 'drop');
  const pickupNav = gmapsDir(pickups);
  const dropNav = gmapsDir(drops);

  const postTrack = (action, lat, lng, heading) =>
    fetch(`${API_BASE_URL}/transport/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action, route_id: routeId, institutionId: user?.institutionId,
        lat, lng, heading, trip_type: stopTab,
        driver_id: user?.id ?? null, driver_name: user?.name ?? null
      })
    }).catch(() => {});

  const refreshTrack = async () => {
    try { const d = await fetch(`${API_BASE_URL}/transport/track/${routeId}`).then(x => x.json()); setTrack(d || null); } catch { /* ignore */ }
  };

  const startTrip = async () => {
    if (!navigator.geolocation) return alert('Location is not supported on this device/browser.');
    const label = stopTab === 'drop' ? 'DROP' : 'PICKUP';
    if (!window.confirm(`Start the ${label} trip for ${route?.route_name}?\n\nYour live location will be shared with students and the school until you complete the trip.`)) return;

    setTracking(true);
    await postTrack('start', null, null, null);   // marks the trip running immediately
    await refreshTrack();

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading } = pos.coords;
        setLiveLoc({ lat: latitude, lng: longitude });
        const now = Date.now();
        if (now - lastPost.current > 2500) { lastPost.current = now; postTrack('ping', latitude, longitude, heading ?? null); }
      },
      (err) => { alert('Could not get location: ' + err.message); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
    );

    const nav = stopTab === 'drop' ? (dropNav || pickupNav) : (pickupNav || dropNav);
    if (nav) window.open(nav, '_blank');
  };

  const completeTrip = async () => {
    if (!window.confirm('Complete this trip?\n\nLive tracking stops and the bus disappears from the map.')) return;
    if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setTracking(false);
    setLiveLoc(null);
    await postTrack('complete', null, null, null);
    await refreshTrack();
  };

  if (loading) return <div className="h-96 flex items-center justify-center"><div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>;

  if (!duty?.routes?.length) {
    return (
      <div className="ring-1 ring-black/5 shadow-sm rounded-lg bg-white p-10 text-center">
        <Bus className="size-6 text-zinc-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-zinc-700">No route is assigned to you yet.</p>
        <p className="text-xs text-zinc-500 mt-1">Your transport in-charge will assign you to a bus route.</p>
      </div>
    );
  }

  const live = tripState(track);
  const running = live.status === 'running';
  const busAt = tracking && liveLoc ? liveLoc : (live.live ? { lat: Number(track.lat), lng: Number(track.lng) } : null);

  const shown = stopTab === 'pickup' ? pickups : drops;
  const color = stopTab === 'pickup' ? '#3284c7' : '#f29132';

  return (
    <div className="space-y-5">
      {/* Duty header */}
      <div className="ring-1 ring-black/5 shadow-sm rounded-lg bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Thumb endpoint={`/transport/vehicle-image/${route?.vehicle_id}`} has={route?.vehicle_has_image} alt={route?.vehicle_no} icon={Bus}
              className="size-14" onEnlarge={(src, alt) => setZoom({ src, alt })} />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2 flex-wrap">
                {route?.route_name}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 ring-1 ring-inset ring-primary/20 px-2 py-0.5 rounded-full">You are the {route?.my_role}</span>
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">{route?.vehicle_no || 'No bus'}{route?.vehicle_code ? ` - ${route.vehicle_code}` : ''}{route?.vehicle_name ? ` - ${route.vehicle_name}` : ''}{route?.capacity ? ` - ${route.capacity} seats` : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(duty.routes || []).length > 1 && (
              <div className="relative">
                <select value={routeId} disabled={tracking} onChange={e => setRouteId(e.target.value)}
                  title={tracking ? 'Complete the current trip before switching routes' : ''}
                  className="h-9 appearance-none rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-xs font-medium text-zinc-700 shadow-sm outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer">
                  {duty.routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {running
              ? <button onClick={completeTrip} className="inline-flex items-center justify-center gap-1.5 h-9 px-4 shrink-0 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 shadow-sm"><CheckCircle2 className="size-3.5" /> Complete Trip</button>
              : <button onClick={startTrip} className="inline-flex items-center justify-center gap-1.5 h-9 px-4 shrink-0 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 shadow-sm"><Play className="size-3.5" /> Start {stopTab === 'drop' ? 'Drop' : 'Pickup'} Trip</button>}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Meta icon={RouteIcon} label="Students" value={route?.student_count ?? 0} />
          <Meta icon={MapPin} label="Stops" value={`${pickups.length} pickup - ${drops.length} drop`} />
          <Crew icon={User} label="Driver" name={route?.driver_name} phone={route?.driver_phone} me={route?.my_role === 'Driver'} />
          <Crew icon={Users} label="Assistant" name={route?.assistant_name} phone={route?.assistant_phone} me={route?.my_role === 'Assistant'} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <TripStatus track={track} />
          <p className="text-[11px] text-zinc-400 flex items-start gap-1.5 max-w-[52ch]">
            <Info className="size-3.5 shrink-0 mt-px" />
            {running
              ? 'Keep this page open while driving so your location keeps updating. Tap Complete Trip when the run is finished.'
              : `Pick the ${stopTab === 'drop' ? 'Drop' : 'Pickup'} tab below, then Start Trip - Google Maps opens for navigation and the bus goes live for students.`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg flex-wrap">
        <TabBtn on={tab === 'route'} onClick={() => setTab('route')} icon={MapPinned} label="My Route" />
        <TabBtn on={tab === 'attendance'} onClick={() => setTab('attendance')} icon={ClipboardCheck} label="Attendance" />
        <TabBtn on={tab === 'logbook'} onClick={() => setTab('logbook')} icon={NotebookPen} label="Log Book" />
      </div>

      {tab === 'route' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="ring-1 ring-black/5 shadow-sm rounded-lg bg-white overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
                {['pickup', 'drop'].map(t => (
                  <button key={t} onClick={() => setStopTab(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${stopTab === t ? (t === 'pickup' ? 'bg-white text-primary shadow-sm' : 'bg-white text-accent shadow-sm') : 'text-zinc-600 hover:text-zinc-900'}`}>
                    {t === 'pickup' ? 'Pickup' : 'Drop'} <span className="text-zinc-400">({t === 'pickup' ? pickups.length : drops.length})</span>
                  </button>
                ))}
              </div>
              {(stopTab === 'pickup' ? pickupNav : dropNav) && (
                <a href={stopTab === 'pickup' ? pickupNav : dropNav} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"><Navigation className="size-3.5" /> Navigate this trip</a>
              )}
            </div>
            <div className="p-4 space-y-2">
              {shown.length ? shown.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2.5 rounded-md px-3 py-2.5 ring-1 ring-zinc-200">
                  <span className="size-6 shrink-0 rounded-full text-white text-[10px] font-semibold flex items-center justify-center" style={{ backgroundColor: color }}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-900 truncate">{p.title}</p>
                    {p.arrival_time && <p className="text-[11px] text-zinc-400">{p.arrival_time}</p>}
                  </div>
                  {p.lat != null && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`} target="_blank" rel="noreferrer"
                      className="text-[10px] text-primary hover:underline inline-flex items-center gap-1 shrink-0"><Navigation className="size-3" /> open</a>
                  )}
                </div>
              )) : <p className="text-xs text-zinc-400 italic text-center py-8">No {stopTab} stops on this route.</p>}
            </div>
          </div>

          <div className="lg:sticky lg:top-4">
            <div className="ring-1 ring-black/5 shadow-sm rounded-lg bg-white p-3">
              <div className="flex items-center gap-3 mb-2 px-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700"><MapPinned className="size-4 text-primary" /> Route Map</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><span className="size-2.5 rounded-full bg-primary" /> Pickup</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><span className="size-2.5 rounded-full bg-accent" /> Drop</span>
                {busAt
                  ? <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium ml-auto"><Bus className="size-3" /> Live</span>
                  : <span className="text-[10px] text-zinc-400 ml-auto">Bus hidden until trip starts</span>}
              </div>
              <LeafletMap points={points} routed liveLocation={busAt} height={520} />
            </div>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <Attendance user={user} canEdit={false} lockedRouteId={routeId} routesOverride={duty.routes} />
      )}

      {tab === 'logbook' && (
        route?.vehicle_id
          ? <VehicleLogBook user={user} canEdit canDelete={false} lockedVehicleId={route.vehicle_id} />
          : <div className="ring-1 ring-black/5 shadow-sm rounded-lg bg-white p-10 text-center text-sm text-zinc-500">No bus is assigned to this route yet.</div>
      )}

      {zoom && <Lightbox src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />}
    </div>
  );
}

function TabBtn({ on, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${on ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
      <Icon className="size-3.5" /> {label}
    </button>
  );
}
function Meta({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-zinc-50 ring-1 ring-zinc-100 p-2.5">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1"><Icon className="size-3" /> {label}</p>
      <p className="text-sm font-medium text-zinc-900 truncate mt-0.5">{value}</p>
    </div>
  );
}
function Crew({ icon: Icon, label, name, phone, me }) {
  return (
    <div className={`rounded-md p-2.5 ring-1 ${me ? 'bg-primary/5 ring-primary/20' : 'bg-zinc-50 ring-zinc-100'}`}>
      <p className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1"><Icon className="size-3" /> {label}{me && <span className="text-primary font-medium"> - you</span>}</p>
      <p className="text-sm font-medium text-zinc-900 truncate mt-0.5">{name || '-'}</p>
      {phone
        ? <a href={`tel:${phone}`} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-0.5"><Phone className="size-3" /> {phone}</a>
        : <span className="text-[11px] text-zinc-400">No phone</span>}
    </div>
  );
}