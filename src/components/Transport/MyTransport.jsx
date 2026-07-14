import React, { useState, useEffect } from 'react';
import { Bus, User, Users, Phone, MapPinned, Radio, BadgeInfo } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import LeafletMap from './LeafletMap';
import AttendanceCalendar from './AttendanceCalendar';

export default function MyTransport({ user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveLoc, setLiveLoc] = useState(null);

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

  // poll live bus location
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
  const points = (data.points || []).map(p => ({ point_type: p.point_type, title: p.title, lat: p.latitude != null ? Number(p.latitude) : null, lng: p.longitude != null ? Number(p.longitude) : null }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Left: route + crew */}
        <div className="space-y-5">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5">
            <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <MapPinned className="size-4 text-primary" /> {r.route_name}
              {liveLoc && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 ring-1 ring-green-600/20 px-2 py-0.5 rounded-full"><Radio className="size-3 animate-pulse" /> Live</span>}
            </h3>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Info icon={Bus} label="Bus Number" value={r.vehicle_no || '—'} />
              <Info icon={Bus} label="Bus Name" value={r.vehicle_name || '—'} />
              <CrewInfo icon={User} label="Driver" name={r.driver_name} phone={r.driver_phone} />
              <CrewInfo icon={Users} label="Conductor" name={r.conductor_name} phone={r.conductor_phone} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-600 mb-2 flex items-center gap-1.5"><BadgeInfo className="size-3.5 text-primary" /> My Attendance</p>
            <AttendanceCalendar records={data.attendance || []} />
          </div>
        </div>

        {/* Right: live map */}
        <div className="lg:sticky lg:top-4">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-3">
            <div className="flex items-center gap-3 mb-2 px-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700"><MapPinned className="size-4 text-primary" /> Live Bus</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><span className="size-2.5 rounded-full bg-primary" /> Pickup</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><span className="size-2.5 rounded-full bg-accent" /> Drop</span>
              {liveLoc ? <span className="text-[10px] text-green-700 font-medium ml-auto">🚌 On the way</span> : <span className="text-[10px] text-zinc-400 ml-auto">Bus not running now</span>}
            </div>
            <LeafletMap points={points} routed liveLocation={liveLoc} height={520} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-zinc-50 ring-1 ring-zinc-100 p-2.5">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1"><Icon className="size-3" /> {label}</p>
      <p className="text-sm font-medium text-zinc-900 truncate mt-0.5">{value}</p>
    </div>
  );
}
function CrewInfo({ icon: Icon, label, name, phone }) {
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