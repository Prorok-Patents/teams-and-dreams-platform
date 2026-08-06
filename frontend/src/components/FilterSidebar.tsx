'use client';

import { Trophy, Layers, Calendar, RotateCcw } from 'lucide-react';

export interface FilterValues {
  sport: string;
  level: string;
  dateStart: string;
  dateEnd: string;
}

interface FilterSidebarProps {
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
  onClear: () => void;
  isOpen: boolean;
}

const SPORTS = [
  { value: '', label: 'All Sports' },
  { value: 'curling', label: 'Curling' },
  // Future expansions:
  // { value: 'hockey', label: 'Hockey' },
  // { value: 'basketball', label: 'Basketball' },
];

const LEVELS = [
  { value: '', label: 'All Levels' },
  { value: 'professional', label: 'Professional' },
  { value: 'semi-pro', label: 'Semi-Pro' },
  { value: 'college', label: 'College' },
  { value: 'amateur', label: 'Amateur' },
  { value: 'youth', label: 'Youth' },
  { value: 'international', label: 'International' },
  { value: 'olympic', label: 'Olympic' },
  { value: 'paralympic', label: 'Paralympic' },
];

export default function FilterSidebar({ filters, onChange, onClear, isOpen }: FilterSidebarProps) {
  if (!isOpen) return null;

  const hasActiveFilters = filters.sport || filters.level || filters.dateStart || filters.dateEnd;

  return (
    <div className="filter-panel">
      <div className="filter-panel-inner">
        {/* Sport */}
        <div className="filter-group">
          <label className="filter-label">
            <Trophy style={{ display: 'inline', width: '0.75rem', height: '0.75rem', marginRight: '0.25rem', verticalAlign: 'text-bottom' }} />
            Sport
          </label>
          <select
            className="filter-select"
            value={filters.sport}
            onChange={e => onChange({ ...filters, sport: e.target.value })}
          >
            {SPORTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Level */}
        <div className="filter-group">
          <label className="filter-label">
            <Layers style={{ display: 'inline', width: '0.75rem', height: '0.75rem', marginRight: '0.25rem', verticalAlign: 'text-bottom' }} />
            Level
          </label>
          <select
            className="filter-select"
            value={filters.level}
            onChange={e => onChange({ ...filters, level: e.target.value })}
          >
            {LEVELS.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="filter-group">
          <label className="filter-label">
            <Calendar style={{ display: 'inline', width: '0.75rem', height: '0.75rem', marginRight: '0.25rem', verticalAlign: 'text-bottom' }} />
            Date Range
          </label>
          <div className="filter-date-row">
            <input
              type="date"
              className="filter-date-input"
              value={filters.dateStart}
              onChange={e => onChange({ ...filters, dateStart: e.target.value })}
              placeholder="Start"
            />
            <input
              type="date"
              className="filter-date-input"
              value={filters.dateEnd}
              onChange={e => onChange({ ...filters, dateEnd: e.target.value })}
              placeholder="End"
            />
          </div>
        </div>

        {/* Actions */}
        {hasActiveFilters && (
          <div className="filter-actions">
            <button className="filter-clear-btn" onClick={onClear}>
              <RotateCcw style={{ display: 'inline', width: '0.75rem', height: '0.75rem', marginRight: '0.25rem', verticalAlign: 'text-bottom' }} />
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
