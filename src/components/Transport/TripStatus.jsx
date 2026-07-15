import React from 'react';
import { Radio, CheckCircle2, CircleDashed } from 'lucide-react';

// Bare MySQL datetimes are UTC — add the marker before parsing, then show IST.
export const parseDbDate = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v;
  let s = String(v);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = s.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export const fmtISTTime = (v) => {
  const d = parseDbDate(v);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(d);
};

export const fmtISTDateTime = (v) => {
  const d = parseDbDate(v);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(d);
};

/**
 * The single source of truth for "is this bus actually live?".
 * A trip counts as running only while it's marked running AND the driver's
 * phone has pinged within the last 30 seconds.
 */
export function tripState(track) {
  if (!track) return { status: 'idle', live: false };
  const fresh = Number(track.seconds_ago) < 30;
  const running = track.trip_status === 'running' || (track.trip_status == null && !!track.is_active);
  if (running && fresh && track.lat != null && track.lng != null) {
    return { status: 'running', live: true, trip_type: track.trip_type, started_at: track.started_at, driver_name: track.driver_name || track.started_by_name };
  }
  if (running && !fresh) {
    // Started but we've lost the signal (app closed / no network).
    return { status: 'running', live: false, stale: true, trip_type: track.trip_type, started_at: track.started_at, driver_name: track.driver_name };
  }
  if (track.trip_status === 'completed') {
    return { status: 'completed', live: false, trip_type: track.trip_type, started_at: track.started_at, ended_at: track.ended_at, driver_name: track.driver_name };
  }
  return { status: 'idle', live: false };
}

const TRIP_LABEL = { pickup: 'Pickup', drop: 'Drop' };

/** Compact pill for lists. */
export function TripPill({ track }) {
  const t = tripState(track);
  if (t.status === 'running' && t.live) {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 ring-1 ring-green-600/20 px-2 py-0.5 rounded-full"><Radio className="size-3 animate-pulse" /> Live</span>;
  }
  if (t.status === 'running' && t.stale) {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 ring-1 ring-amber-600/20 px-2 py-0.5 rounded-full">No signal</span>;
  }
  if (t.status === 'completed') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="size-3" /> Done</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 bg-zinc-50 ring-1 ring-zinc-200 px-2 py-0.5 rounded-full">Not started</span>;
}

/** Full status line with times — used on route / duty / student screens. */
export default function TripStatus({ track, className = '' }) {
  const t = tripState(track);
  const label = TRIP_LABEL[t.trip_type] || '';

  if (t.status === 'running' && t.live) {
    return (
      <div className={`inline-flex items-center gap-2 rounded-md bg-green-50 ring-1 ring-green-600/20 px-3 py-1.5 ${className}`}>
        <Radio className="size-3.5 text-green-600 animate-pulse shrink-0" />
        <span className="text-[11px] font-semibold text-green-800">
          {label ? `${label} trip in progress` : 'Trip in progress'}
          {t.started_at && <span className="font-normal text-green-700"> · started {fmtISTTime(t.started_at)}</span>}
          {t.driver_name && <span className="font-normal text-green-700"> · {t.driver_name}</span>}
        </span>
      </div>
    );
  }
  if (t.status === 'running' && t.stale) {
    return (
      <div className={`inline-flex items-center gap-2 rounded-md bg-amber-50 ring-1 ring-amber-600/20 px-3 py-1.5 ${className}`}>
        <CircleDashed className="size-3.5 text-amber-600 shrink-0" />
        <span className="text-[11px] font-semibold text-amber-800">
          {label ? `${label} trip started` : 'Trip started'} · location paused
          {t.started_at && <span className="font-normal text-amber-700"> · since {fmtISTTime(t.started_at)}</span>}
        </span>
      </div>
    );
  }
  if (t.status === 'completed') {
    return (
      <div className={`inline-flex items-center gap-2 rounded-md bg-zinc-100 ring-1 ring-zinc-200 px-3 py-1.5 ${className}`}>
        <CheckCircle2 className="size-3.5 text-zinc-500 shrink-0" />
        <span className="text-[11px] font-semibold text-zinc-700">
          {label ? `${label} trip completed` : 'Trip completed'}
          {t.ended_at && <span className="font-normal text-zinc-500"> · {fmtISTTime(t.started_at)} → {fmtISTTime(t.ended_at)}</span>}
        </span>
      </div>
    );
  }
  return (
    <div className={`inline-flex items-center gap-2 rounded-md bg-zinc-50 ring-1 ring-zinc-200 px-3 py-1.5 ${className}`}>
      <CircleDashed className="size-3.5 text-zinc-400 shrink-0" />
      <span className="text-[11px] font-medium text-zinc-500">Trip not started — the bus will appear once the driver starts it.</span>
    </div>
  );
}