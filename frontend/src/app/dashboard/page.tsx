'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import EventsSidebar from '@/components/EventsSidebar';
import EventDetailCard from '@/components/EventDetailCard';
import type { MapEvent } from '@/components/MapComponent';
import type { FilterValues } from '@/components/FilterSidebar';

// Dynamic import MapComponent to avoid SSR issues with mapbox-gl
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0f1115]">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading map...</p>
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [filters, setFilters] = useState<FilterValues>({
    sport: '',
    level: '',
    dateStart: '',
    dateEnd: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const handleEventsLoaded = useCallback((loadedEvents: MapEvent[]) => {
    setEvents(loadedEvents);
  }, []);

  const handleSelectEvent = useCallback((event: MapEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleClearFilters = () => {
    setFilters({ sport: '', level: '', dateStart: '', dateEnd: '' });
  };

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      {/* Full-bleed map background */}
      <MapComponent
        filters={filters}
        onEventsLoaded={handleEventsLoaded}
        onSelectEvent={handleSelectEvent}
        selectedEventId={selectedEvent?.id}
      />

      {/* Floating events panel (left side) */}
      {panelOpen && (
        <div className="events-panel glass-panel">
          {/* Panel header */}
          <div className="events-panel-header">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">Teams & Dreams</h2>
                <span className="text-[10px] text-slate-500">Event Explorer</span>
              </div>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition"
              aria-label="Close panel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          </div>

          <EventsSidebar
            events={events}
            selectedEvent={selectedEvent}
            onSelectEvent={handleSelectEvent}
            filters={filters}
            setFilters={setFilters}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filtersOpen={filtersOpen}
            toggleFilters={() => setFiltersOpen(!filtersOpen)}
            handleClearFilters={handleClearFilters}
          />
        </div>
      )}

      {/* Collapsed panel toggle */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute top-4 left-4 z-20 h-10 w-10 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-black/80 transition shadow-lg"
          aria-label="Open events panel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      {/* Event count badge (floating bottom-left) */}
      <div className="absolute bottom-6 left-6 z-10">
        <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-300 font-medium">{events.length} events in view</span>
        </div>
      </div>

      {/* Event detail overlay */}
      {selectedEvent && (
        <EventDetailCard
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
