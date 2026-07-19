import React from 'react';
import { Radio, CheckCircle2, CircleDashed } from 'lucide-react';

// Bare MySQL datetimes are UTC - add the marker before parsing, then show IST.
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
  if (!d) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(d);
};

// The school day is IST. en-CA gives a sortable YYYY-MM-DD.
const istDay = (d) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(d);

/** Did this timestamp happen on today's IST date? */
export const isTodayIST = (v) => {
  const d = parseDbDate(v);
  if (!d) return false;
  return istDay(d) === istDay(new Date());
};

/**
 * The single source of truth for "is this bus actually live?".
 *
 * A trip is a TODAY thing. transport_live_location keeps ONE row per route
 * and never clears it, so yesterday's finished run would otherwise sit on
 * the Routes list saying "Done" forever - and a driver who forgot to tap
 * Complete would show "No signal" indefinitely. Anything that didn't happen
 * on today's IST date falls back to idle: the bus simply isn't out yet.
 *
 * The one exception is a trip that started before midnight and is still
 * pinging - a genuinely running bus stays live no matter what the date says.
 */
export function tripState(track) {
  if (!track) return { status: 'idle', live: false };
  const fresh = Number(track.seconds_ago) < 30;
  const running = track.trip_status === 'running' || (track.trip_status == null && !!track.is_active);
  const completed = track.trip_status === 'completed';

  if (completed) {
    // Finished today -> "Done". Finished on an earlier day -> nothing to show.
    if (!isTodayIST(track.ended_at || track.started_at)) return { status: 'idle', live: false, oldDay: true };
    return {
      status: 'completed', live: false, trip_type: track.trip_type,
      started_at: track.started_at, ended_at: track.ended_at, driver_name: track.driver_name
    };
  }

  if (running) {
    // Still pinging = still driving, even across midnight.
    if (fresh && track.lat != null && track.lng != null) {
      return {
        status: 'running', live: true, trip_type: track.trip_type,
        started_at: track.started_at, driver_name: track.driver_name || track.started_by_name
      };
    }
    // Signal lost. Only worth flagging if the run started today - otherwise
    // it's an abandoned row from a previous day, not a bus on the road.
    if (!isTodayIST(track.started_at)) return { status: 'idle', live: false, oldDay: true };
    return {
      status: 'running', live: false, stale: true, trip_type: track.trip_type,
      started_at: track.started_at, driver_name: track.driver_name
    };
  }

  return { status: 'idle', live: false };
}

const TRIP_LABEL = { pickup: 'Pickup', drop: 'Drop' };

/** Compact pill for lists. */
export function TripPill({ track }) {
  const t = tripState(track);
  if (t.status === 'running' && t.live) {
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-600/20 px-2 py-0.5 rounded-full"><Radio className="size-3 animate-pulse" /> Live</span>;
  }
  if (t.status === 'running' && t.stale) {
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20 px-2 py-0.5 rounded-full">No signal</span>;
  }
  if (t.status === 'completed') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 bg-zinc-100 ring-1 ring-inset ring-zinc-500/20 px-2 py-0.5 rounded-full"><CheckCircle2 className="size-3" /> Done today</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 bg-zinc-50 ring-1 ring-inset ring-zinc-200 px-2 py-0.5 rounded-full">Not started</span>;
}

/** Full status line with times - used on route / duty / student screens. */
export default function TripStatus({ track, className = '' }) {
  const t = tripState(track);
  const label = TRIP_LABEL[t.trip_type] || '';

  if (t.status === 'running' && t.live) {
    return (
      <div className={`inline-flex items-center gap-2 rounded-md bg-emerald-50 ring-1 ring-inset ring-emerald-600/20 px-3 py-1.5 ${className}`}>
        <Radio className="size-3.5 text-emerald-600 animate-pulse shrink-0" />
        <span className="text-[11px] font-semibold text-emerald-800">
          {label ? `${label} trip in progress` : 'Trip in progress'}
          {t.started_at && <span className="font-normal text-emerald-700"> - started {fmtISTTime(t.started_at)}</span>}
          {t.driver_name && <span className="font-normal text-emerald-700"> - {t.driver_name}</span>}
        </span>
      </div>
    );
  }
  if (t.status === 'running' && t.stale) {
    return (
      <div className={`inline-flex items-center gap-2 rounded-md bg-amber-50 ring-1 ring-inset ring-amber-600/20 px-3 py-1.5 ${className}`}>
        <CircleDashed className="size-3.5 text-amber-600 shrink-0" />
        <span className="text-[11px] font-semibold text-amber-800">
          {label ? `${label} trip started` : 'Trip started'} - location paused
          {t.started_at && <span className="font-normal text-amber-700"> - since {fmtISTTime(t.started_at)}</span>}
        </span>
      </div>
    );
  }
  if (t.status === 'completed') {
    return (
      <div className={`inline-flex items-center gap-2 rounded-md bg-zinc-100 ring-1 ring-inset ring-zinc-200 px-3 py-1.5 ${className}`}>
        <CheckCircle2 className="size-3.5 text-zinc-500 shrink-0" />
        <span className="text-[11px] font-semibold text-zinc-700">
          {label ? `${label} trip completed today` : 'Trip completed today'}
          {t.ended_at && <span className="font-normal text-zinc-500"> - {fmtISTTime(t.started_at)} to {fmtISTTime(t.ended_at)}</span>}
        </span>
      </div>
    );
  }
  return (
    <div className={`inline-flex items-center gap-2 rounded-md bg-zinc-50 ring-1 ring-inset ring-zinc-200 px-3 py-1.5 ${className}`}>
      <CircleDashed className="size-3.5 text-zinc-400 shrink-0" />
      <span className="text-[11px] font-medium text-zinc-500">Trip not started - the bus will appear once the driver starts it.</span>
    </div>
  );
}