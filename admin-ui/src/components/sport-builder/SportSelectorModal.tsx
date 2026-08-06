"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, Plus, Trophy, Search, Loader2 } from "lucide-react";

export interface SportRecord {
  id: string;
  name: string;
  slug: string;
  category: string;
}

interface SportSelectorModalProps {
  onSelectSport: (sportId: string, sportName: string) => void;
}

export default function SportSelectorModal({ onSelectSport }: SportSelectorModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sports, setSports] = useState<SportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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

  useEffect(() => {
    if (isOpen) {
      fetchSports();
    }
  }, [isOpen]);

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

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition"
      >
        <Trophy className="h-3.5 w-3.5 text-sky-400" />
        <span>Switch / Load Sport</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              {isCreating ? "Create New Sport" : "Select Sport"}
            </span>
            {!isCreating && (
              <button 
                onClick={() => setIsCreating(true)}
                className="p-1 hover:bg-slate-800 rounded text-sky-400 transition"
                title="Create New Sport"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            {isCreating && (
              <button 
                onClick={() => setIsCreating(false)}
                className="text-[10px] text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            )}
          </div>
          
          <div className="p-2 max-h-80 overflow-y-auto relative z-50">
            {loading && !isCreating && (
              <div className="flex justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
              </div>
            )}
            
            {error && (
              <div className="p-2 text-[11px] text-red-400 bg-red-950/30 rounded mb-2 border border-red-900/50">
                {error}
              </div>
            )}

            {!isCreating && !loading && sports.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500">
                No sports found. Create one!
              </div>
            )}

            {!isCreating && sports.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  onSelectSport(s.id, s.name);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-300 transition flex flex-col mb-1"
              >
                <span className="font-medium text-slate-200">{s.name}</span>
                <span className="text-[10px] text-slate-500">{s.category}</span>
              </button>
            ))}

            {isCreating && (
              <form onSubmit={handleCreate} className="p-2 space-y-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Sport Name</label>
                  <input 
                    type="text" 
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Curling"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Category</label>
                  <input 
                    type="text" 
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="e.g. Winter Sports"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !newName.trim()}
                  className="w-full py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition"
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
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)} 
        />
      )}
    </div>
  );
}
