"use client";

import React from "react";
import { Search, Filter, Eye, EyeOff } from "lucide-react";

export type FilterMode = "dim" | "hide";

interface NodeFilterBarProps {
  filterQuery: string;
  setFilterQuery: (q: string) => void;
  selectedTypes: Set<string>;
  setSelectedTypes: (types: Set<string>) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  totalNodes: number;
  matchingNodes: number;
}

const TYPE_OPTIONS = [
  { id: "sport", label: "Sport" },
  { id: "organization", label: "Org" },
  { id: "competition", label: "Comp" },
  { id: "web_source", label: "Source" },
  { id: "scraper_config", label: "Scraper" }
];

export default function NodeFilterBar({
  filterQuery,
  setFilterQuery,
  selectedTypes,
  setSelectedTypes,
  selectedStatus,
  setSelectedStatus,
  filterMode,
  setFilterMode,
  totalNodes,
  matchingNodes
}: NodeFilterBarProps) {
  const toggleType = (typeId: string) => {
    const next = new Set(selectedTypes);
    if (next.has(typeId)) {
      next.delete(typeId);
    } else {
      next.add(typeId);
    }
    setSelectedTypes(next);
  };

  const hasFiltersActive = filterQuery || selectedTypes.size < TYPE_OPTIONS.length || selectedStatus !== "all";

  const clearFilters = () => {
    setFilterQuery("");
    setSelectedTypes(new Set(TYPE_OPTIONS.map(o => o.id)));
    setSelectedStatus("all");
  };

  return (
    <div className="h-14 border-b border-[#1E293B] bg-[#0C1226]/90 px-4 flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center gap-4 flex-1">
        
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search nodes by name, ID..."
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition"
          />
        </div>

        {/* Type Toggles */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 h-8">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => toggleType(opt.id)}
              className={`px-2.5 h-full rounded text-[11px] font-medium transition ${
                selectedTypes.has(opt.id)
                  ? "bg-slate-800 text-sky-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 h-8 focus:outline-none focus:border-sky-500"
        >
          <option value="all">All Statuses</option>
          <option value="idle">Idle</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        
        {/* Clear Filters */}
        {hasFiltersActive && (
          <button 
            onClick={clearFilters}
            className="text-[11px] text-red-400 hover:text-red-300 ml-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Match Count */}
        <div className="text-[11px] text-slate-400">
          Showing <strong className="text-slate-200">{matchingNodes}</strong> of {totalNodes}
        </div>

        {/* View Mode */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setFilterMode("dim")}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition ${
              filterMode === "dim" ? "bg-slate-700 text-white" : "text-slate-500"
            }`}
            title="Dim non-matching nodes"
          >
            <Eye className="h-3 w-3" /> Dim
          </button>
          <button
            onClick={() => setFilterMode("hide")}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition ${
              filterMode === "hide" ? "bg-slate-700 text-white" : "text-slate-500"
            }`}
            title="Hide non-matching nodes entirely"
          >
            <EyeOff className="h-3 w-3" /> Hide
          </button>
        </div>
      </div>
    </div>
  );
}
