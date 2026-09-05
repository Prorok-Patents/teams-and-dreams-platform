"use client";

import React, { useRef, useEffect } from "react";
import { Search, Eye, EyeOff, X, AlertTriangle } from "lucide-react";
import { NodeData } from "./NodeCanvas";

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
  nodes?: NodeData[];
  orphanCount?: number;
  showOrphansOnly?: boolean;
  setShowOrphansOnly?: (show: boolean) => void;
}

const TYPE_CONFIG = [
  { id: "sport", label: "Sport", color: "text-purple-400" },
  { id: "organization", label: "Orgs", color: "text-emerald-400" },
  { id: "competition", label: "Comps", color: "text-amber-400" },
  { id: "web_source", label: "Sources", color: "text-sky-400" },
  { id: "scraper_config", label: "Scrapers", color: "text-rose-400" }
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
  matchingNodes,
  nodes = [],
  orphanCount = 0,
  showOrphansOnly = false,
  setShowOrphansOnly
}: NodeFilterBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused =
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA";

      if (e.key === "/" && !isInputFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleType = (typeId: string) => {
    const next = new Set(selectedTypes);
    if (next.has(typeId)) {
      next.delete(typeId);
    } else {
      next.add(typeId);
    }
    setSelectedTypes(next);
  };

  const hasFiltersActive =
    Boolean(filterQuery) ||
    selectedTypes.size < TYPE_CONFIG.length ||
    selectedStatus !== "all" ||
    showOrphansOnly;

  const clearFilters = () => {
    setFilterQuery("");
    setSelectedTypes(new Set(TYPE_CONFIG.map(o => o.id)));
    setSelectedStatus("all");
    setShowOrphansOnly?.(false);
  };

  // Node count per type
  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    TYPE_CONFIG.forEach(t => (counts[t.id] = 0));
    nodes.forEach(n => {
      if (counts[n.type] !== undefined) {
        counts[n.type]++;
      }
    });
    return counts;
  }, [nodes]);

  return (
    <div className="h-12 border-b border-[#1E293B] bg-[#0C1226]/90 px-4 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
      <div className="flex items-center gap-3 flex-1">
        {/* Search Input with '/' shortcut hint */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search nodes... (Press '/')"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Type Toggle Pills with Dynamic Counts */}
        <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 h-8 gap-0.5">
          {TYPE_CONFIG.map(opt => {
            const isSelected = selectedTypes.has(opt.id);
            const count = typeCounts[opt.id] ?? 0;

            return (
              <button
                key={opt.id}
                onClick={() => toggleType(opt.id)}
                className={`px-2.5 h-full rounded text-[11px] font-medium transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-800 text-slate-200 shadow-sm"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <span className={isSelected ? opt.color : ""}>{opt.label}</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                    isSelected ? "bg-slate-950 text-slate-300" : "text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Orphan Nodes Quick Filter Pill */}
        {setShowOrphansOnly && orphanCount > 0 && (
          <button
            onClick={() => setShowOrphansOnly(!showOrphansOnly)}
            title="Filter to only orphan nodes with 0 wire connections"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 border ${
              showOrphansOnly
                ? "bg-amber-950/80 border-amber-500 text-amber-300 ring-1 ring-amber-400"
                : "bg-slate-900/80 border-slate-700/80 text-amber-400 hover:bg-amber-950/30"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>Orphans ({orphanCount})</span>
          </button>
        )}

        {/* Status Dropdown */}
        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 h-8 focus:outline-none focus:border-sky-500 font-medium"
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
            className="text-[11px] text-rose-400 hover:text-rose-300 ml-1 flex items-center gap-1 transition"
          >
            <X className="h-3 w-3" /> Clear Filters
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Match Count */}
        <div className="text-[11px] text-slate-400 font-mono">
          Showing <strong className="text-sky-400">{matchingNodes}</strong> of {totalNodes} nodes
        </div>

        {/* Filter Presentation Mode: Dim vs Hide */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 h-8">
          <button
            onClick={() => setFilterMode("dim")}
            className={`px-2 h-full rounded text-[11px] font-medium flex items-center gap-1.5 transition ${
              filterMode === "dim" ? "bg-slate-800 text-sky-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Dim non-matching nodes on the canvas"
          >
            <Eye className="h-3 w-3" /> Dim
          </button>
          <button
            onClick={() => setFilterMode("hide")}
            className={`px-2 h-full rounded text-[11px] font-medium flex items-center gap-1.5 transition ${
              filterMode === "hide" ? "bg-slate-800 text-sky-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
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
