"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  Plus,
  Trophy,
  Search,
  Loader2,
  Sparkles,
  Check
} from "lucide-react";
import { SPORT_TEMPLATES } from "./templates";

export interface SportRecord {
  id: string;
  name: string;
  slug: string;
  category: string;
}

interface SportSelectorModalProps {
  currentSportName?: string;
  onSelectSport: (sportId: string, sportName: string) => void;
  onSelectTemplate?: (templateId: string) => void;
}

export default function SportSelectorModal({
  currentSportName,
  onSelectSport,
  onSelectTemplate
}: SportSelectorModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sports, setSports] = useState<SportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Tab: "database" vs "templates"
  const [activeTab, setActiveTab] = useState<"database" | "templates">("database");

  // Create state
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Team Sports");

  const fetchSports = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/knowledge-graph/sports");
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load sports`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSports(data);
      } else {
        setSports([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading sports");
      setSports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      fetchSports();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setLoading(true);
      const res = await fetch("/api/knowledge-graph/sports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, category: newCategory })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create sport");
      }
      const newSport = await res.json();
      setSports(prev => [...prev, newSport]);
      setIsCreating(false);
      setNewName("");
      onSelectSport(newSport.id, newSport.name);
      setIsOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating sport");
    } finally {
      setLoading(false);
    }
  };

  const filteredSports = useMemo(() => {
    if (!searchQuery.trim()) return sports;
    const q = searchQuery.toLowerCase();
    return sports.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [sports, searchQuery]);

  return (
    <div className="relative z-50">
      <button
        onClick={handleToggleOpen}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-medium text-slate-200 transition shadow-sm"
      >
        <Trophy className="h-3.5 w-3.5 text-sky-400" />
        <span className="font-semibold">{currentSportName || "Switch Sport"}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              {isCreating ? "Create New Sport" : "Sport Explorer"}
            </span>

            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="p-1 hover:bg-slate-800 rounded-lg text-sky-400 hover:text-sky-300 transition flex items-center gap-1 text-[11px]"
                title="Create New Sport"
              >
                <Plus className="h-3.5 w-3.5" /> New
              </button>
            )}

            {isCreating && (
              <button
                onClick={() => setIsCreating(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Navigation Tabs */}
          {!isCreating && (
            <div className="flex border-b border-slate-800 bg-slate-900/40 text-[11px]">
              <button
                onClick={() => setActiveTab("database")}
                className={`flex-1 py-2 font-medium transition flex items-center justify-center gap-1.5 ${
                  activeTab === "database"
                    ? "text-sky-400 border-b-2 border-sky-500 bg-slate-900/80"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Trophy className="h-3 w-3" /> Saved Sports ({sports.length})
              </button>
              <button
                onClick={() => setActiveTab("templates")}
                className={`flex-1 py-2 font-medium transition flex items-center justify-center gap-1.5 ${
                  activeTab === "templates"
                    ? "text-purple-400 border-b-2 border-purple-500 bg-slate-900/80"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="h-3 w-3" /> Presets ({SPORT_TEMPLATES.length})
              </button>
            </div>
          )}

          {/* Body */}
          <div className="p-2 max-h-80 overflow-y-auto">
            {/* Search Box */}
            {!isCreating && (
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter sports or presets..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            )}

            {loading && !isCreating && (
              <div className="flex justify-center p-6">
                <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
              </div>
            )}

            {error && !isCreating && activeTab === "database" && (
              <div className="p-2 text-[11px] text-amber-400 bg-amber-950/30 rounded-lg mb-2 border border-amber-900/50">
                Backend knowledge-graph offline or empty. You can still use Presets!
              </div>
            )}

            {/* Tab 1: Database Sports */}
            {!isCreating && !loading && activeTab === "database" && (
              <div className="space-y-1">
                {filteredSports.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No matching saved sports. Try the Presets tab or create one!
                  </div>
                )}

                {filteredSports.map(s => {
                  const isCurrent = currentSportName === s.name;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        onSelectSport(s.id, s.name);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between ${
                        isCurrent
                          ? "bg-sky-950/60 border border-sky-800 text-sky-200"
                          : "hover:bg-slate-900 text-slate-300"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          {s.name}
                          {isCurrent && <Check className="h-3 w-3 text-sky-400" />}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{s.category}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab 2: Preset Templates */}
            {!isCreating && activeTab === "templates" && (
              <div className="space-y-1.5">
                {SPORT_TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => {
                      onSelectTemplate?.(tmpl.id);
                      setIsOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-800 hover:border-purple-500/60 bg-slate-900/50 hover:bg-purple-950/30 transition flex flex-col gap-1 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-200 group-hover:text-purple-300">
                        {tmpl.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-purple-900/60 text-purple-300 rounded font-mono">
                        {tmpl.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2">{tmpl.description}</p>
                    <div className="text-[9px] text-slate-500 font-mono pt-0.5">
                      {tmpl.nodes.length} Nodes • {tmpl.edges.length} Wires
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Create New Sport Form */}
            {isCreating && (
              <form onSubmit={handleCreate} className="p-1 space-y-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">
                    Sport Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Curling"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="e.g. Winter Sports"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !newName.trim()}
                  className="w-full py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition shadow-lg shadow-sky-500/20"
                >
                  {loading ? "Creating..." : "Initialize Sport"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Invisible backdrop to close modal */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
