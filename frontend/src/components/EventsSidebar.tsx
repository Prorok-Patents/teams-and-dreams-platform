"use client";

import { useMemo } from 'react';
import { Calendar, Filter, MapPin, Search, Trophy } from 'lucide-react';
import type { MapEvent } from '@/components/MapComponent';
import FilterSidebar from '@/components/FilterSidebar';
import type { FilterValues } from '@/components/FilterSidebar';

const SPORT_IMAGES: Record<string, string> = {
  curling: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC4u6nnxQK1duLiMykkefAARD-fL8aRxVw9Wd9F5eKgavd6ni0nduO7FBhNULnbyYOvqO5ipOFHizfWIVHqx4MWOv8qDxmYgq-ZZP-L0QgDWqGaXrUlXyQk7EQzBKbSUyjH0GJMqmIjGcfZttkUftw38F9rWa40ozc9iC5y3YOmKyjBJnzkOPyRhjGnRkV03tIsXLWWfyjBglwcWs-mQAMgSFUrqb0096Dcw0Sej-rYXeVJAfHQLKbqKO_DVXTvzdqgbIdtVzMYGiIm',
  motorsport: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBR7vxnu6Kci33oDSGoper-1qH9Q34BYbVpd5Z-cmjPPPluhEkpCLiN8mz-dRpmEiavMRhq2Nc-DkgkvM-LyOz6K2_gEjwCECXwaSPoONblsHZy85LGAmnMT5pJEifnrsSkFKcA_JRZJBwdS0XHPehEchnNy30Se49DRstCZdg9sUhc0H0FFNbsXP7tB-Bn-6r0op_nquZ4r1H1wXkYYY_P29Fx-7dtEYl4q5edVv7T3V0kF0w_vDd6pq3w2sDyTa7lFVcndqWENOQB',
  f1: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBR7vxnu6Kci33oDSGoper-1qH9Q34BYbVpd5Z-cmjPPPluhEkpCLiN8mz-dRpmEiavMRhq2Nc-DkgkvM-LyOz6K2_gEjwCECXwaSPoONblsHZy85LGAmnMT5pJEifnrsSkFKcA_JRZJBwdS0XHPehEchnNy30Se49DRstCZdg9sUhc0H0FFNbsXP7tB-Bn-6r0op_nquZ4r1H1wXkYYY_P29Fx-7dtEYl4q5edVv7T3V0kF0w_vDd6pq3w2sDyTa7lFVcndqWENOQB',
  golf: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHNAbjU2Askt8fpMdzfhW5lmezaYYKPC_tjhfMbpXbNZL107eScjjZrL0EIiBM4iRr__Gm6YpoLmIy9h0SBXPQLhRRKkkaSP9cIsx2JzsUfAaLhvbIk-3QYj0uVanX8KVGnNcyQ_ugQRmfo6PtpkczCEhF8oHB800deEKXGdRUSDmtV3NPk-wN9J5_j_uRHve6U_if2NX_0t49pO7Q6OmnoZXE27WlFFqEUm-90cOiedgB2I6gZqbooDbBp8QmbtYaJeOmXRASkFHE',
  generic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAEvXBuRoENebGnAfwZDfquwcZeDNSSCQMmEprPmfp5Wg5Yv12_ZBeYeiLyErKqyytAXWUsZovjbgliRoY4kKiG2PVcGaatclqo1MUhkxwv1zw4gpsVX3xes0fN2LL1Cx_k51ibS8EaZClHi0ykmmRo3kvlZ9hQpC6t70gKcY97ZnjhIlo0rT5wqxeQntkAslyP3udoebWMH0TdkG_KEbgXwrVB15HvjQqI8VU52-t84W4qTQsCZcK7ul-7UXz7ouAwYV1CcN2NCxL1'
};

interface EventsSidebarProps {
  events: MapEvent[];
  selectedEvent: MapEvent | null;
  onSelectEvent: (event: MapEvent) => void;
  filters: FilterValues;
  setFilters: (filters: FilterValues) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filtersOpen: boolean;
  toggleFilters: () => void;
  handleClearFilters: () => void;
}

export default function EventsSidebar({
  events,
  selectedEvent,
  onSelectEvent,
  filters,
  setFilters,
  searchQuery,
  setSearchQuery,
  filtersOpen,
  toggleFilters,
  handleClearFilters
}: EventsSidebarProps) {
  
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      e =>
        e.name.toLowerCase().includes(q) ||
        e.city?.toLowerCase().includes(q) ||
        e.country?.toLowerCase().includes(q) ||
        e.venue_name?.toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  const hasActiveFilters = filters.sport || filters.level || filters.dateStart || filters.dateEnd;

  return (
    <div className="sidebar-content-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search & Filter Buttons */}
      <div className="search-filters-section" style={{ padding: 'var(--space-6)', flexShrink: 0 }}>
        <div className="search-wrapper">
          <Search />
          <input
            id="search-events"
            type="text"
            placeholder="Discover exclusive events..."
            className="search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-bar">
          <button
            id="filter-sport"
            className={`filter-btn ${filters.sport ? 'active' : ''}`}
            onClick={toggleFilters}
          >
            <Trophy />
            Sport
          </button>
          <button
            id="filter-date"
            className={`filter-btn ${filters.dateStart || filters.dateEnd ? 'active' : ''}`}
            onClick={toggleFilters}
          >
            <Calendar />
            Date
          </button>
          <button
            id="filter-toggle"
            className={`filter-btn-icon ${hasActiveFilters ? 'active' : ''}`}
            onClick={toggleFilters}
            aria-label="Toggle filter panel"
          >
            <Filter />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <FilterSidebar
        filters={filters}
        onChange={setFilters}
        onClear={handleClearFilters}
        isOpen={filtersOpen}
      />

      {/* Event List */}
      <div className="event-list custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {filteredEvents.length === 0 ? (
          <div className="event-list-empty">
            <MapPin />
            <p>No events found.<br />Try adjusting your search or filters.</p>
          </div>
        ) : (
          filteredEvents.map((event, i) => {
            const sportLower = event.sport?.toLowerCase() || 'generic';
            const bgImage = SPORT_IMAGES[sportLower] || SPORT_IMAGES.generic;
            return (
              <div
                key={event.id || i}
                className={`event-card ${selectedEvent?.id === event.id ? 'selected' : ''} stagger-${Math.min(i + 1, 8)}`}
                onClick={() => onSelectEvent(event)}
              >
                <div className="event-card-img-wrapper">
                  <img src={bgImage} alt={event.name} className="event-card-img" />
                </div>
                <div className="event-card-overlay"></div>
                <div className="event-card-content">
                  <div className="event-card-header">
                    <span className="event-sport-badge" data-sport={event.sport}>
                      {event.sport || 'Sport'}
                    </span>
                    <span className="event-date-badge">
                      {event.start_date
                        ? new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </span>
                  </div>
                  <h4 className="event-title">{event.name}</h4>
                  <p className="event-location">
                    <MapPin />
                    {event.city}{event.country ? `, ${event.country}` : ''}
                  </p>
                  {event.level && (
                    <span className="event-level-badge">{event.level.replace(/_/g, ' ')}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
