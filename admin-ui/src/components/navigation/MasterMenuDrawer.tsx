"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  X,
  Network,
  Zap,
  Layers,
  FileText,
  ShieldCheck,
  Download,
  ChevronRight,
  Compass,
  Trophy,
  GitBranch,
  ExternalLink
} from "lucide-react";
import { SPORT_TEMPLATES } from "@/components/sport-builder/templates";

interface MasterMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSport?: (sportId: string) => void;
}

interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  category: "workspace" | "sport" | "tool" | "portal";
  icon: React.ElementType;
  href?: string;
  badge?: string;
  badgeColor?: string;
  onClick?: () => void;
  keywords?: string[];
}

export default function MasterMenuDrawer({
  isOpen,
  onClose,
  onSelectSport
}: MasterMenuDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleClose = useCallback(() => {
    setSearchQuery("");
    onClose();
  }, [onClose]);

  // Focus search input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Keyboard shortcut listener: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Build list of all navigable items
  const menuItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [
      // 1. Workspaces
      {
        id: "ws-intake",
        title: "Sports Intake Studio",
        subtitle: "Visual domain graph builder, embedded scrapers, AI document ingestion",
        category: "workspace",
        icon: Network,
        href: "/intake",
        badge: "Studio",
        badgeColor: "bg-sky-500/20 text-sky-400 border-sky-500/30",
        keywords: ["canvas", "nodes", "graph", "copilot", "builder", "sport root"]
      },
      {
        id: "ws-pipeline",
        title: "Pipeline Operations Hub",
        subtitle: "5-Stage site lifecycle (Discover, Map, Configure, Scrape, Verify)",
        category: "workspace",
        icon: Zap,
        href: "/",
        badge: "Pipeline",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        keywords: ["ops", "scrapers", "playwright", "proxy", "events", "stage"]
      },
      {
        id: "ws-directory",
        title: "Sites & Selectors Directory",
        subtitle: "Inventory of monitored governing bodies, URL patterns, and CSS selectors",
        category: "workspace",
        icon: Layers,
        href: "/?tab=directory",
        badge: "Registry",
        badgeColor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
        keywords: ["selectors", "domains", "urls", "federations", "governing"]
      },

      // 2. Sports Templates (Live synchronized from SPORT_TEMPLATES)
      ...SPORT_TEMPLATES.map(tmpl => {
        const orgCount = tmpl.nodes.filter(n => n.type === "organization").length;
        const compCount = tmpl.nodes.filter(n => n.type === "competition").length;
        return {
          id: `sport-${tmpl.id}`,
          title: tmpl.name,
          subtitle: `${tmpl.category} • ${orgCount} Orgs • ${compCount} Competitions`,
          category: "sport" as const,
          icon: Trophy,
          href: `/intake?sport=${tmpl.id}`,
          badge: tmpl.badge || "Template",
          badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
          onClick: () => {
            if (onSelectSport) onSelectSport(tmpl.id);
          },
          keywords: [tmpl.name.toLowerCase(), tmpl.category.toLowerCase(), ...tmpl.nodes.map(n => n.label.toLowerCase())]
        };
      }),

      // 3. Tools & Utilities
      {
        id: "tool-doc-parser",
        title: "Document & PDF Ingestion",
        subtitle: "Upload rulebooks, tournament lists or PDFs for AI entity extraction",
        category: "tool",
        icon: FileText,
        href: "/intake?drawer=copilot",
        badge: "AI Parser",
        badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        keywords: ["pdf", "text", "unpdf", "ai", "upload", "parse", "csv"]
      },
      {
        id: "tool-diagnostics",
        title: "Graph Diagnostics & Sanity Validator",
        subtitle: "Audit orphan nodes, empty scraper endpoints, and broken wiring",
        category: "tool",
        icon: ShieldCheck,
        href: "/intake?drawer=diagnostics",
        badge: "Health",
        badgeColor: "bg-teal-500/20 text-teal-400 border-teal-500/30",
        keywords: ["diagnostics", "validation", "lint", "health", "warnings", "errors"]
      },
      {
        id: "tool-export-import",
        title: "Schema Export & Import",
        subtitle: "Export graph schemas as JSON or Markdown; import external graphs",
        category: "tool",
        icon: Download,
        href: "/intake?modal=export",
        badge: "Backup",
        badgeColor: "bg-slate-700/60 text-slate-300 border-slate-600",
        keywords: ["json", "export", "import", "markdown", "backup"]
      },

      // 4. External Portals
      {
        id: "portal-map-explorer",
        title: "Public Event Map Explorer",
        subtitle: "Frontend Mapbox visualizer with event cards & hospitality packages",
        category: "portal",
        icon: Compass,
        href: "http://localhost:3001",
        badge: "Frontend :3001",
        badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        keywords: ["frontend", "map", "mapbox", "public", "events", "hospitality"]
      },
      {
        id: "portal-api-docs",
        title: "FastAPI Backend Swagger",
        subtitle: "Interactive REST API documentation and crawler test endpoints",
        category: "portal",
        icon: Zap,
        href: "http://localhost:8000/docs",
        badge: "Swagger :8000",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        keywords: ["api", "swagger", "fastapi", "backend", "docs", "endpoints"]
      },
      {
        id: "portal-github",
        title: "GitHub Repository",
        subtitle: "Prorok-Patents/teams-and-dreams-platform (main branch)",
        category: "portal",
        icon: GitBranch,
        href: "https://github.com/Prorok-Patents/teams-and-dreams-platform",
        badge: "GitHub",
        badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
        keywords: ["git", "github", "repo", "source", "code"]
      }
    ];

    return items;
  }, [onSelectSport]);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;
    const q = searchQuery.toLowerCase().trim();
    return menuItems.filter(item => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.keywords && item.keywords.some(k => k.includes(q)))
      );
    });
  }, [menuItems, searchQuery]);

  // Group by category
  const workspaces = filteredItems.filter(i => i.category === "workspace");
  const sports = filteredItems.filter(i => i.category === "sport");
  const tools = filteredItems.filter(i => i.category === "tool");
  const portals = filteredItems.filter(i => i.category === "portal");

  const handleItemClick = (item: MenuItem) => {
    handleClose();
    if (item.onClick) {
      item.onClick();
    }
    if (item.href) {
      if (item.href.startsWith("http")) {
        window.open(item.href, "_blank", "noopener,noreferrer");
      } else {
        router.push(item.href);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Slide-over Drawer */}
      <div className="relative w-full max-w-xl bg-[#090D1A] border-r border-slate-800 h-full flex flex-col shadow-2xl shadow-black z-10">
        {/* Drawer Header & Search */}
        <div className="p-5 pb-4 border-b border-slate-800 bg-[#0C1226]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Network className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  Teams & Dreams
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono">
                    Master Menu
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">Global navigation & control hub</p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Menu (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search workspaces, sports, tools, or scrapers..."
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-12 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-sm">
              ESC
            </kbd>
          </div>
        </div>

        {/* Scrollable Menu Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Search className="h-8 w-8 mx-auto text-slate-600" />
              <p className="text-sm font-medium">No results found for &quot;{searchQuery}&quot;</p>
              <p className="text-xs text-slate-600">Try searching for &quot;Curling&quot;, &quot;Pipeline&quot;, &quot;PDF&quot;, or &quot;Swagger&quot;.</p>
            </div>
          ) : (
            <>
              {/* Section: Workspaces */}
              {workspaces.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-sky-400" /> Workspaces & Core Modules
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{workspaces.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {workspaces.map(item => {
                      const Icon = item.icon;
                      const isActive = item.href && pathname === item.href;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className={`w-full text-left p-3 rounded-xl border transition flex items-start justify-between gap-3 group ${
                            isActive
                              ? "bg-sky-950/40 border-sky-500/40 shadow-sm"
                              : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg mt-0.5 ${
                              isActive ? "bg-sky-500 text-white shadow-md shadow-sky-500/30" : "bg-slate-800 text-slate-300 group-hover:text-white group-hover:bg-slate-700"
                            }`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200 group-hover:text-white text-xs">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${item.badgeColor}`}>
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                {item.subtitle}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition shrink-0 mt-2" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section: Sports Library */}
              {sports.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <span className="flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-amber-400" /> Sports Knowledge Library
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{sports.length} templates</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {sports.map(item => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className="text-left p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/80 hover:border-amber-500/40 transition group flex items-start gap-2.5"
                        >
                          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-black transition mt-0.5">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-200 group-hover:text-white truncate">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {item.subtitle}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section: Tools & Automation */}
              {tools.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <span className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-purple-400" /> Studio Tools & Diagnostics
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{tools.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {tools.map(item => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className="w-full text-left p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/70 hover:bg-slate-800/60 hover:border-slate-700 transition flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:text-purple-300 group-hover:bg-purple-950/40 transition">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-slate-200 group-hover:text-white text-xs block truncate">
                                {item.title}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {item.subtitle}
                              </span>
                            </div>
                          </div>
                          {item.badge && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section: External Portals */}
              {portals.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <span className="flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 text-sky-400" /> External Portals & APIs
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{portals.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {portals.map(item => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className="w-full text-left p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/70 hover:bg-slate-800/60 hover:border-slate-700 transition flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:text-sky-300 group-hover:bg-sky-950/40 transition">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-slate-200 group-hover:text-white text-xs flex items-center gap-1.5">
                                {item.title}
                                <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-400" />
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {item.subtitle}
                              </span>
                            </div>
                          </div>
                          {item.badge && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 border-t border-slate-800 bg-[#0C1226] text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px] text-slate-400">Ctrl</kbd>
              <span className="text-slate-600">+</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px] text-slate-400">K</kbd>
              <span className="text-slate-500 text-[10px]">Open Menu</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px] text-slate-400">Esc</kbd>
              <span className="text-slate-500 text-[10px]">Close</span>
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            Live Ops
          </span>
        </div>
      </div>
    </div>
  );
}
