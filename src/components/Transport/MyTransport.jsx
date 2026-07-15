import React, { useState, useEffect, useMemo } from 'react';
import { Bus, User, Users, Phone, MapPinned, Radio, CalendarDays, MapPin, Info, Navigation } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import LeafletMap from './LeafletMap';
import AttendanceCalendar from './AttendanceCalendar';

export default function MyTransport({ user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveLoc, setLiveLoc] = useState(null);
  const [tab, setTab]         = useState('route');      // 'route' | 'attendance'
  const [stopTab, setStopTab] = useState('pickup');     // 'pickup' | 'drop'

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await fetch(`${API_BASE_URL}/transport/my/${user.id}`).then(x => x.json());
        if (alive) setData(d || null);
      } catch { if (alive) setData(null); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const routeId = data?.route?.id;

  // Live bus position — only while the driver has a trip running.
  useEffect(() => {
    if (!routeId) return;
    let alive = true;
    const tick = async () => {
      try {
        const d = await fetch(`${API_BASE_URL}/transport/track/${routeId}`).then(x => x.json());
        if (!alive) return;
        if (d && d.is_active && d.lat != null && d.lng != null && Number(d.seconds_ago) < 30) setLiveLoc({ lat: Number(d.lat), lng: Number(d.lng) });
        else setLiveLoc(null);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [routeId]);

  const allPoints = useMemo(() => (data?.points || []).map(p => ({
    id: p.id, point_type: p.point_type, title: p.title, arrival_time: p.arrival_time,
    lat: p.latitude != null ? Number(p.latitude) : null,
    lng: p.longitude != null ? Number(p.longitude) : null,
  })), [data]);

  if (loading) return <div className="h-96 flex items-center justify-center"><div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" /></div>;

  if (!data?.route) {
    return (
      <div className="ring-1 ring-black/5 rounded-lg bg-white p-10 text-center">
        <Bus className="size-6 text-zinc-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-zinc-700">You're not assigned to a transport route yet.</p>
        <p className="text-xs text-zinc-500 mt-1">Please contact your school's transport in-charge.</p>
      </div>
    );
  }

  const r = data.route;
  const shown = allPoints.filter(p => p.point_type === stopTab);
  const myPointId = stopTab === 'pickup' ? data.pickup_point_id : data.drop_point_id;
  const color = stopTab === 'pickup' ? '#3284c7' : '#f29132';

  return (
    <div className="space-y-5">
      {/* Route + crew card */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white p-5">
        <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <MapPinned className="size-4 text-primary" /> {r.route_name}
          {r.route_code && <span className="text-[11px] font-normal text-zinc-400">{r.route_code}</span>}
          {liveLoc && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 ring-1 ring-green-600/20 px-2 py-0.5 rounded-full"><Radio className="size-3 animate-pulse" /> Live</span>}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Info2 icon={Bus} label="Bus Number" value={r.vehicle_no || '—'} />
          <Info2 icon={Bus} label="Bus Name" value={r.vehicle_name || '—'} />
          <Crew icon={User} label="Driver" name={r.driver_name} phone={r.driver_phone} />
          <Crew icon={Users} label="Assistant" name={r.assistant_name} phone={r.assistant_phone} />
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
        <button onClick={() => setTab('route')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'route' ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          <MapPinned className="size-3.5" /> My Route
        </button>
        <button onClick={() => setTab('attendance')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'attendance' ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          <CalendarDays className="size-3.5" /> My Attendance
        </button>
      </div>

      {tab === 'attendance' ? (
        <div className="max-w-md">
          <AttendanceCalendar records={data.attendance || []} />
          <p className="text-[11px] text-zinc-400 mt-2 flex items-start gap-1.5">
            <Info className="size-3.5 shrink-0 mt-px" />
            Marked by your bus assistant at each trip. Green = present on both trips, yellow = present on one, red = absent.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Left — stops with Pickup / Drop tabs */}
          <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
                {['pickup', 'drop'].map(t => (
                  <button key={t} onClick={() => setStopTab(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${stopTab === t ? (t === 'pickup' ? 'bg-white text-primary shadow-sm' : 'bg-white text-accent shadow-sm') : 'text-zinc-600 hover:text-zinc-900'}`}>
                    {t === 'pickup' ? 'Pickup' : 'Drop'} <span className="text-zinc-400">({allPoints.filter(p => p.point_type === t).length})</span>
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-zinc-400">Stops in order</span>
            </div>
            <div className="p-4 space-y-2">
              {shown.length ? shown.map((p, i) => {
                const mine = String(p.id) === String(myPointId);
                return (
                  <div key={p.id} className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 ring-1 ${mine ? 'ring-primary/40 bg-primary/5' : 'ring-zinc-200'}`}>
                    <span className="size-6 shrink-0 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: color }}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-900 truncate">
                        {p.title}
                        {mine && <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">My stop</span>}
                      </p>
                      {p.arrival_time && <p className="text-[11px] text-zinc-400 flex items-center gap-1"><MapPin className="size-3" /> {p.arrival_time}</p>}
                    </div>
                    {p.lat != null && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`} target="_blank" rel="noreferrer"
                        className="text-[10px] text-primary hover:underline inline-flex items-center gap-1 shrink-0"><Navigation className="size-3" /> map</a>
                    )}
                  </div>
                );
              }) : <p className="text-xs text-zinc-400 italic text-center py-8">No {stopTab} stops on this route.</p>}
            </div>
          </div>

          {/* Right — live map */}
          <div className="lg:sticky lg:top-4">
            <div className="ring-1 ring-black/5 rounded-lg bg-white p-3">
              <div className="flex items-center gap-3 mb-2 px-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700"><MapPinned className="size-4 text-primary" /> Live Bus</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><span className="size-2.5 rounded-full bg-primary" /> Pickup</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><span className="size-2.5 rounded-full bg-accent" /> Drop</span>
                {liveLoc ? <span className="text-[10px] text-green-700 font-medium ml-auto">🚌 On the way</span> : <span className="text-[10px] text-zinc-400 ml-auto">Bus not running now</span>}
              </div>
              <LeafletMap points={allPoints} routed liveLocation={liveLoc} height={520} />
              <p className="text-[10px] text-zinc-400 mt-1.5">The bus appears once your driver starts the trip, and moves in real time.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info2({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-zinc-50 ring-1 ring-zinc-100 p-2.5">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1"><Icon className="size-3" /> {label}</p>
      <p className="text-sm font-medium text-zinc-900 truncate mt-0.5">{value}</p>
    </div>
  );
}
function Crew({ icon: Icon, label, name, phone }) {
  return (
    <div className="rounded-md bg-zinc-50 ring-1 ring-zinc-100 p-2.5">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1"><Icon className="size-3" /> {label}</p>
      <p className="text-sm font-medium text-zinc-900 truncate mt-0.5">{name || '—'}</p>
      {phone
        ? <a href={`tel:${phone}`} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-0.5"><Phone className="size-3" /> {phone}</a>
        : <span className="text-[11px] text-zinc-400">No phone</span>}
    </div>
  );
}