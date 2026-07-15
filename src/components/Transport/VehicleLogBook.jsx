import React, { useState } from 'react';
import { History, Wrench } from 'lucide-react';
import DailyLog from './DailyLog';
import ServiceRepair from './ServiceRepair';

export default function VehicleLogBook({ user, canEdit, canDelete }) {
  const [tab, setTab] = useState('daily');
  const props = { user, canEdit, canDelete };

  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
        <button onClick={() => setTab('daily')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'daily' ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          <History className="size-3.5" /> Daily Log
        </button>
        <button onClick={() => setTab('service')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'service' ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          <Wrench className="size-3.5" /> Service / Repair
        </button>
      </div>

      {tab === 'daily' ? <DailyLog {...props} /> : <ServiceRepair {...props} />}
    </div>
  );
}