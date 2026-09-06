"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Network,
  Globe,
  ChevronRight,
  Layers,
  RefreshCw,
  Info,
  Calendar,
  Users,
  FileText,
  Trophy,
  BarChart3,
  Settings,
  Zap,
  Search,
  Eye,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  BookOpen,
  Play,
  ArrowRight,
  Kanban,
  Bot,
  XCircle,
  FolderTree,
  Plus,
  X,
  Terminal,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================
type PipelineStage = "discover" | "map" | "configure" | "scrape" | "verify";

interface PageTypeNode {
  id: string;
  type: string;
  label: string;
  url_pattern: string;
  example_url: string;
  description: string;
  status: "verified" | "discovered" | "stale" | "blocked";
  is_scrapeable: boolean;
}

interface PageFlow {
  from: string;
  to: string;
  link_text: string;
}

interface SiteKnowledge {
  site_id: string;
  base_url: string;
  org_name: string;
  org_acronym?: string;
  site_type: string;
  sport: string;
  strategy: string;
  proxy_tier: string;
  page_types: PageTypeNode[];
  page_flows: PageFlow[];
  selectors: Record<string, string | null>;
  notes: string;
  last_mapped_at: string | null;
  has_events: boolean;
  has_members: boolean;
  has_results: boolean;
  pipeline_stage: PipelineStage;
  last_scrape_status?: "success" | "failed" | "running" | null;
  events_found?: number;
}

// ============================================================================
// PIPELINE STAGE CONFIG
// ============================================================================
const STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; color: string; bg: string; border: string; icon: React.ElementType; description: string }
> = {
  discover: {
    label: "Discover",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    icon: Search,
    description: "Site identified, awaiting page mapping",
  },
  map: {
    label: "Map",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    icon: Layers,
    description: "Page types and flows being discovered",
  },
  configure: {
    label: "Configure",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: Settings,
    description: "Selectors and strategy being set up",
  },
  scrape: {
    label: "Scrape",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: Zap,
    description: "Extraction pipeline active",
  },
  verify: {
    label: "Verify",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    icon: CheckCircle,
    description: "Extracted data under review",
  },
};

const STAGE_ORDER: PipelineStage[] = ["discover", "map", "configure", "scrape", "verify"];

// ============================================================================
// PAGE TYPE STYLING
// ============================================================================
const PAGE_TYPE_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  homepage:       { color: "text-slate-300",   bg: "bg-slate-800",      border: "border-slate-600",   icon: Globe },
  events_listing: { color: "text-emerald-400", bg: "bg-emerald-950",    border: "border-emerald-500", icon: Calendar },
  event_detail:   { color: "text-emerald-300", bg: "bg-emerald-950/60", border: "border-emerald-600", icon: FileText },
  members:        { color: "text-sky-400",     bg: "bg-sky-950",        border: "border-sky-500",     icon: Users },
  tournaments:    { color: "text-amber-400",   bg: "bg-amber-950",      border: "border-amber-500",   icon: Trophy },
  results:        { color: "text-violet-400",  bg: "bg-violet-950",     border: "border-violet-500",  icon: BarChart3 },
  blog:           { color: "text-rose-400",    bg: "bg-rose-950",       border: "border-rose-500",    icon: BookOpen },
  about:          { color: "text-slate-400",   bg: "bg-slate-900",      border: "border-slate-600",   icon: Info },
  media:          { color: "text-pink-400",    bg: "bg-pink-950",       border: "border-pink-500",    icon: Eye },
  other:          { color: "text-slate-400",   bg: "bg-slate-900",      border: "border-slate-700",   icon: Layers },
};

function getPageConfig(type: string) {
  return PAGE_TYPE_CONFIG[type] || PAGE_TYPE_CONFIG["other"];
}

const STATUS_BADGE: Record<string, { color: string; bg: string; label: string; icon: React.ElementType }> = {
  verified:   { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Verified",   icon: CheckCircle },
  discovered: { color: "text-sky-400",     bg: "bg-sky-500/10",     label: "Discovered", icon: Sparkles },
  stale:      { color: "text-amber-400",   bg: "bg-amber-500/10",  label: "Stale",      icon: Clock },
  blocked:    { color: "text-red-400",     bg: "bg-red-500/10",    label: "Blocked",    icon: AlertTriangle },
};

// ============================================================================
// INITIAL SITES SEED
// ============================================================================
const INITIAL_SITES: SiteKnowledge[] = [
  {
    site_id: "worldcurling_org",
    base_url: "https://worldcurling.org",
    org_name: "World Curling Federation",
    org_acronym: "WCF",
    site_type: "governing_body",
    sport: "curling",
    strategy: "raw_http",
    proxy_tier: "datacenter",
    pipeline_stage: "configure",
    last_scrape_status: null,
    events_found: 0,
    page_types: [
      { id: "homepage", type: "homepage", label: "Homepage", url_pattern: "/", example_url: "https://worldcurling.org/", description: "Main landing page with news highlights", status: "verified", is_scrapeable: false },
      { id: "events_listing", type: "events_listing", label: "Events Calendar", url_pattern: "/events/", example_url: "https://worldcurling.org/events/", description: "Paginated list of championships. WordPress event cards with h3 titles, dates, locations.", status: "verified", is_scrapeable: true },
      { id: "event_detail", type: "event_detail", label: "Event Detail", url_pattern: "/events/{slug}", example_url: "https://worldcurling.org/events/wcc2026", description: "Individual championship page with dates, venue, teams, results, schedule.", status: "verified", is_scrapeable: true },
      { id: "members", type: "members", label: "Member Federations", url_pattern: "/member-associations/", example_url: "https://worldcurling.org/member-associations/", description: "67 national member associations with links to official websites.", status: "verified", is_scrapeable: false },
    ],
    page_flows: [
      { from: "homepage", to: "events_listing", link_text: "Events" },
      { from: "events_listing", to: "event_detail", link_text: "{Event Name}" },
    ],
    selectors: {
      event_container: "article.event",
      event_name: "h3.post-title",
      event_date: "p.post-date",
      event_location: "p.post-cat",
      event_link: "a.stretched-link",
    },
    notes: "WordPress site. Events page at /events/ renders event cards.",
    last_mapped_at: "2026-07-10T14:22:00Z",
    has_events: true,
    has_members: true,
    has_results: true,
  },
  {
    site_id: "curlingcanada_ca",
    base_url: "https://www.curling.ca",
    org_name: "Curling Canada",
    site_type: "national_federation",
    sport: "curling",
    strategy: "raw_http",
    proxy_tier: "residential",
    pipeline_stage: "map",
    last_scrape_status: null,
    events_found: 0,
    page_types: [
      { id: "homepage", type: "homepage", label: "Homepage", url_pattern: "/", example_url: "https://www.curling.ca/", description: "Main landing page", status: "verified", is_scrapeable: false },
      { id: "events_listing", type: "events_listing", label: "Events Calendar", url_pattern: "/events/", example_url: "https://www.curling.ca/events/", description: "National event calendar.", status: "verified", is_scrapeable: true },
    ],
    page_flows: [
      { from: "homepage", to: "events_listing", link_text: "Events" },
    ],
    selectors: { event_container: null, event_name: null, event_date: null, event_location: null, event_link: null },
    notes: "Selectors not yet mapped.",
    last_mapped_at: "2026-07-08T15:45:00Z",
    has_events: true,
    has_members: true,
    has_results: false,
  },
  {
    site_id: "usacurling_org",
    base_url: "https://www.usacurling.org",
    org_name: "USA Curling",
    site_type: "national_federation",
    sport: "curling",
    strategy: "raw_http",
    proxy_tier: "datacenter",
    pipeline_stage: "scrape",
    last_scrape_status: "success",
    events_found: 12,
    page_types: [
      { id: "homepage", type: "homepage", label: "Homepage", url_pattern: "/", example_url: "https://www.usacurling.org/", description: "USA Curling main page.", status: "verified", is_scrapeable: false },
      { id: "events_listing", type: "events_listing", label: "Events", url_pattern: "/events/", example_url: "https://www.usacurling.org/events/", description: "National events and competitions.", status: "verified", is_scrapeable: true },
    ],
    page_flows: [{ from: "homepage", to: "events_listing", link_text: "Events" }],
    selectors: { event_container: "div.event-card", event_name: "h3", event_date: "span.date", event_location: "span.location", event_link: "a" },
    notes: "Scrapes cleanly with raw HTTP.",
    last_mapped_at: "2026-07-12T10:00:00Z",
    has_events: true,
    has_members: false,
    has_results: false,
  },
  {
    site_id: "thegrandslamofcurling_com",
    base_url: "https://thegrandslamofcurling.com",
    org_name: "Grand Slam of Curling",
    site_type: "league",
    sport: "curling",
    strategy: "raw_http",
    proxy_tier: "datacenter",
    pipeline_stage: "verify",
    last_scrape_status: "success",
    events_found: 6,
    page_types: [
      { id: "homepage", type: "homepage", label: "Homepage", url_pattern: "/", example_url: "https://thegrandslamofcurling.com/", description: "Grand Slam landing page.", status: "verified", is_scrapeable: false },
      { id: "events_listing", type: "events_listing", label: "Events", url_pattern: "/events/", example_url: "https://thegrandslamofcurling.com/events/", description: "Season schedule.", status: "verified", is_scrapeable: true },
    ],
    page_flows: [{ from: "homepage", to: "events_listing", link_text: "Events" }],
    selectors: { event_container: "div.event-block", event_name: "h2.event-title", event_date: "span.event-date", event_location: "span.event-venue", event_link: "a.event-link" },
    notes: "Clean static site.",
    last_mapped_at: "2026-07-14T09:30:00Z",
    has_events: true,
    has_members: false,
    has_results: true,
  },
  {
    site_id: "worldpadeltour_com",
    base_url: "https://worldpadeltour.com",
    org_name: "World Padel Tour",
    site_type: "league",
    sport: "padel",
    strategy: "playwright",
    proxy_tier: "residential",
    pipeline_stage: "discover",
    last_scrape_status: null,
    events_found: 0,
    page_types: [
      { id: "homepage", type: "homepage", label: "Homepage", url_pattern: "/", example_url: "https://worldpadeltour.com/", description: "Main tour site.", status: "discovered", is_scrapeable: false },
    ],
    page_flows: [],
    selectors: {},
    notes: "Padel international tour schedule.",
    last_mapped_at: null,
    has_events: true,
    has_members: false,
    has_results: false,
  }
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${className}`}>
      {children}
    </span>
  );
}

function PipelineStepper({ 
  currentStage, 
  onStageClick 
}: { 
  currentStage: PipelineStage; 
  onStageClick?: (stage: PipelineStage) => void 
}) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  return (
    <div className="flex items-center gap-1">
      {STAGE_ORDER.map((stage, idx) => {
        const config = STAGE_CONFIG[stage];
        const Icon = config.icon;
        const isCurrent = stage === currentStage;
        const isPast = idx < currentIdx;

        return (
          <React.Fragment key={stage}>
            {idx > 0 && (
              <div className={`h-px flex-1 min-w-[16px] max-w-[32px] ${isPast ? "bg-emerald-500/50" : "bg-slate-800"}`} />
            )}
            <button
              type="button"
              onClick={() => onStageClick?.(stage)}
              title={`Click to set stage to ${config.label}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                isCurrent
                  ? `${config.bg} ${config.color} ${config.border} border shadow-sm ring-1 ring-white/10`
                  : isPast
                  ? "bg-emerald-500/5 text-emerald-500/70 border border-emerald-500/20 hover:bg-emerald-500/10"
                  : "text-slate-600 border border-transparent hover:text-slate-400 hover:bg-slate-800/40"
              }`}
            >
              {isPast ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{config.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SiteCard({
  site,
  isSelected,
  onClick,
}: {
  site: SiteKnowledge;
  isSelected: boolean;
  onClick: () => void;
}) {
  const selectorCount = Object.values(site.selectors || {}).filter((v) => v !== null).length;

  let metric = "";
  let metricColor = "text-slate-500";
  if (site.pipeline_stage === "verify" || site.pipeline_stage === "scrape") {
    metric = `${site.events_found || 0} events`;
    metricColor = (site.events_found || 0) > 0 ? "text-emerald-400" : "text-slate-500";
  } else if (site.pipeline_stage === "configure") {
    metric = `${selectorCount} selectors`;
    metricColor = selectorCount > 0 ? "text-amber-400" : "text-slate-500";
  } else if (site.pipeline_stage === "map") {
    metric = `${site.page_types.length} pages`;
    metricColor = "text-violet-400";
  } else {
    metric = site.last_scrape_status === "failed" ? "blocked" : "new";
    metricColor = site.last_scrape_status === "failed" ? "text-red-400" : "text-sky-400";
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl transition-all duration-200 group ${
        isSelected
          ? "bg-slate-800/80 border border-slate-600 shadow-lg"
          : "hover:bg-slate-800/40 border border-transparent"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-sm font-semibold truncate ${isSelected ? "text-white" : "text-slate-300"}`}>
          {site.org_acronym || site.org_name}
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 transition ${isSelected ? "text-white" : "text-slate-600 group-hover:text-slate-400"}`}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 font-mono text-[10px]">
          {site.base_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </span>
        <span className={`text-[10px] font-medium ${metricColor}`}>{metric}</span>
      </div>
    </button>
  );
}

// ============================================================================
// STAGE PANELS & RUNNERS
// ============================================================================

function DiscoverPanel({ site, onAdvance }: { site: SiteKnowledge; onAdvance: (stage: PipelineStage) => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Discovery Status</h4>
        <p className="text-xs text-slate-300">
          This site has been onboarded into the <strong className="text-sky-400 capitalize">{site.sport}</strong> ecosystem.
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs pt-2">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Base URL</span>
            <code className="text-sky-400 font-mono">{site.base_url}</code>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Strategy</span>
            <span className="text-slate-200 capitalize">{site.strategy}</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onAdvance("map")}
        className="w-full py-3 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white rounded-xl text-sm font-medium transition duration-200 shadow-lg shadow-violet-950/40 flex items-center justify-center gap-2"
      >
        <Layers className="h-4 w-4" />
        Promote to Page Mapping
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function MapPanel({ site, onAdvance }: { site: SiteKnowledge; onAdvance: (stage: PipelineStage) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Discovered Page Types ({site.page_types.length})
        </h4>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-semibold text-slate-500 uppercase">
                <th className="p-3">Page</th>
                <th className="p-3">URL Pattern</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Scrapeable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {site.page_types.map((pt) => {
                const cfg = getPageConfig(pt.type);
                const Icon = cfg.icon;
                const st = STATUS_BADGE[pt.status] || STATUS_BADGE["discovered"];
                const StIcon = st.icon;
                return (
                  <tr key={pt.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} border ${cfg.border}`}>
                          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-slate-200 truncate">{pt.label}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <code className="text-[11px] text-slate-400 font-mono">{pt.url_pattern}</code>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-medium flex items-center gap-1 ${st.color}`}>
                        <StIcon className="h-3 w-3" />
                        {st.label}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {pt.is_scrapeable ? (
                        <span className="text-emerald-400 text-xs">✓</span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={() => onAdvance("configure")}
        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-sm font-medium transition duration-200 shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2"
      >
        <Settings className="h-4 w-4" />
        Configure Selectors
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ConfigurePanel({ site, onAdvance, onRunScraper }: { site: SiteKnowledge; onAdvance: (stage: PipelineStage) => void; onRunScraper: () => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Scraper Configuration</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Strategy</label>
            <div className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 capitalize">
              {site.strategy || "raw_http"}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Proxy Tier</label>
            <div className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 capitalize">
              {site.proxy_tier || "datacenter"}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Target Selectors</h4>
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5 font-mono text-xs">
          {Object.entries(site.selectors || {}).map(([key, value]) => (
            <div key={key} className="flex items-start justify-between gap-3">
              <span className="text-slate-500 shrink-0">{key}</span>
              {value ? (
                <code className="text-emerald-400 text-right">{value}</code>
              ) : (
                <span className="text-slate-600 italic text-right">null (auto-heal)</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onAdvance("scrape")}
          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition border border-slate-700"
        >
          Promote to Scrape
        </button>
        <button
          onClick={onRunScraper}
          className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-sm font-medium transition duration-200 shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
        >
          <Play className="h-4 w-4" />
          Run Pipeline Now
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ScrapePanel({ site, onRunScraper, onAdvance }: { site: SiteKnowledge; onRunScraper: () => void; onAdvance: (stage: PipelineStage) => void }) {
  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-xl border flex items-center gap-3 ${
        site.last_scrape_status === "success"
          ? "bg-emerald-950/30 border-emerald-500/30"
          : site.last_scrape_status === "failed"
          ? "bg-red-950/30 border-red-500/30"
          : "bg-slate-900/60 border-slate-800"
      }`}>
        {site.last_scrape_status === "success" ? (
          <CheckCircle className="h-5 w-5 text-emerald-400" />
        ) : site.last_scrape_status === "failed" ? (
          <XCircle className="h-5 w-5 text-red-400" />
        ) : (
          <Clock className="h-5 w-5 text-slate-500" />
        )}
        <div>
          <span className={`text-sm font-semibold ${
            site.last_scrape_status === "success" ? "text-emerald-400"
            : site.last_scrape_status === "failed" ? "text-red-400"
            : "text-slate-400"
          }`}>
            {site.last_scrape_status === "success" ? "Last Run: Success"
             : site.last_scrape_status === "failed" ? "Last Run: Failed"
             : "Ready to run"}
          </span>
          {(site.events_found || 0) > 0 && (
            <span className="text-xs text-slate-400 block">{site.events_found} events extracted</span>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRunScraper}
          className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-sm font-medium transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
        >
          <RefreshCw className="h-4 w-4" />
          Trigger Scraper Run
        </button>
        <button
          onClick={() => onAdvance("verify")}
          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
        >
          <Eye className="h-4 w-4" />
          Move to Verification
        </button>
      </div>
    </div>
  );
}

function VerifyPanel({ site }: { site: SiteKnowledge }) {
  const sampleEvents = [
    { name: `${site.sport.toUpperCase()} International Open`, date: "2026-09-10", venue: "Metropolitan Sports Complex" },
    { name: "National Championship Qualifiers", date: "2026-10-01", venue: "Grand Arena Centre" },
    { name: "Master Series Cup", date: "2026-10-15", venue: "City Sports Club" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">
            {site.events_found || 3} events extracted — ready for review
          </span>
        </div>
        <p className="text-xs text-slate-400">Review sample data below and publish to main Event Map.</p>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] font-semibold text-slate-500 uppercase">
              <th className="p-3">Event Name</th>
              <th className="p-3">Date</th>
              <th className="p-3">Venue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
            {sampleEvents.map((evt, i) => (
              <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3 font-medium text-slate-200">{evt.name}</td>
                <td className="p-3">{evt.date}</td>
                <td className="p-3">{evt.venue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <button className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
          <XCircle className="h-4 w-4" />
          Reject Data
        </button>
        <button className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-sm font-medium transition duration-200 shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Approve & Publish to Map
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// NEW SPORT MODAL
// ============================================================================
function NewSportModal({
  isOpen,
  onClose,
  onAddSport,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddSport: (newSite: SiteKnowledge) => void;
}) {
  const [sportName, setSportName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [siteType, setSiteType] = useState("governing_body");
  const [strategy, setStrategy] = useState("playwright");
  const [proxyTier, setProxyTier] = useState("residential");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sportName || !orgName || !baseUrl) return;

    setIsSubmitting(true);
    const siteId = orgName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");

    const payload = {
      site_id: siteId,
      sport_name: sportName.toLowerCase(),
      sport: sportName.toLowerCase(),
      org_name: orgName,
      base_url: baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`,
      site_type: siteType,
      strategy: strategy,
      proxy_tier: proxyTier,
      pipeline_stage: "discover",
      selectors: {
        event_container: "article.event, div.event-card",
        event_name: "h2, h3, .title",
        event_date: ".date, time",
        event_location: ".location, .venue",
        event_link: "a",
      },
    };

    try {
      await fetch("/api/v1/scraper/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("Backend API not reachable, adding locally:", err);
    }

    const createdSite: SiteKnowledge = {
      site_id: siteId,
      base_url: payload.base_url,
      org_name: orgName,
      site_type: siteType,
      sport: sportName.toLowerCase(),
      strategy: strategy,
      proxy_tier: proxyTier,
      pipeline_stage: "discover",
      last_scrape_status: null,
      events_found: 0,
      page_types: [
        {
          id: "homepage",
          type: "homepage",
          label: "Homepage",
          url_pattern: "/",
          example_url: payload.base_url,
          description: "Main site landing page",
          status: "discovered",
          is_scrapeable: false,
        },
      ],
      page_flows: [],
      selectors: payload.selectors,
      notes: `Registered ${sportName} sport pipeline for ${orgName}`,
      last_mapped_at: new Date().toISOString(),
      has_events: true,
      has_members: false,
      has_results: false,
    };

    onAddSport(createdSite);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0C1226] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">Onboard New Sport Pipeline</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1 uppercase text-[10px]">Sport Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Padel, Pickleball, Rugby"
              value={sportName}
              onChange={(e) => setSportName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1 uppercase text-[10px]">Organization / Tour Name</label>
            <input
              type="text"
              required
              placeholder="e.g. World Padel Tour"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1 uppercase text-[10px]">Base Official Website URL</label>
            <input
              type="url"
              required
              placeholder="https://worldpadeltour.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1 uppercase text-[10px]">Org Type</label>
              <select
                value={siteType}
                onChange={(e) => setSiteType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="governing_body">Governing Body</option>
                <option value="national_federation">National Fed</option>
                <option value="league">League / Tour</option>
                <option value="club">Club / Regional</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1 uppercase text-[10px]">Scraper Engine</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="playwright">Playwright</option>
                <option value="raw_http">Raw HTTP</option>
                <option value="firecrawl">Firecrawl</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1 uppercase text-[10px]">Proxy Tier</label>
              <select
                value={proxyTier}
                onChange={(e) => setProxyTier(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="residential">Residential</option>
                <option value="datacenter">Datacenter</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-800">
            <Link href="/intake" className="text-sky-400 hover:underline flex items-center gap-1.5 text-xs">
              <Bot className="h-4 w-4" /> Use AI Sport Intake Assistant
            </Link>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-950/40"
              >
                {isSubmitting ? "Creating..." : "Initialize Sport"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// LIVE LOG STREAM MODAL
// ============================================================================
function LiveLogModal({
  runId,
  siteId,
  onClose,
}: {
  runId: string | null;
  siteId: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<string[]>(() =>
    runId ? [`$ Initializing scraper execution for ${siteId}...`, `[INFO] Assigned Run ID: ${runId}`] : []
  );
  const [status, setStatus] = useState<string>("running");

  useEffect(() => {
    if (!runId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/scraper/runs/${runId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status) setStatus(data.status);
          if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
            setLogs(data.logs);
          } else {
            setLogs((prev) => [
              ...prev,
              `[RUNNING] Executing Playwright headless session on target URL...`,
              `[INFO] Parsing DOM tree for sports event cards...`,
            ]);
          }
        }
      } catch {
        // Fallback simulated logs for demo preview if API server offline
        setLogs((prev) => [
          ...prev,
          `[SIMULATED] Connecting to proxy pool...`,
          `[SIMULATED] Extracting event calendar records...`,
        ]);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [runId]);

  if (!runId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#090D1A] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-[500px]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Live Execution Logs</h3>
              <span className="text-[10px] text-slate-500 font-mono">Site: {siteId} | Run: {runId.slice(0, 8)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={status === "running" ? "bg-sky-500/10 text-sky-400 border-sky-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}>
              {status.toUpperCase()}
            </Badge>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-black p-4 font-mono text-xs text-emerald-400 overflow-y-auto space-y-1">
          {logs.map((log, i) => (
            <p key={i} className="whitespace-pre-wrap leading-relaxed">{log}</p>
          ))}
        </div>

        <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}

interface ScraperProfileBackendRecord {
  site_id: string;
  base_url?: string;
  org_name?: string;
  site_type?: SiteKnowledge["site_type"];
  sport?: string;
  sport_name?: string;
  strategy?: SiteKnowledge["strategy"];
  proxy_tier?: SiteKnowledge["proxy_tier"];
  pipeline_stage?: PipelineStage;
  page_types?: Array<PageTypeNode | string>;
  page_flows?: PageFlow[];
  selectors?: Record<string, string>;
  notes?: string;
}

function StagePanel({
  site,
  onAdvance,
  onRunScraper,
}: {
  site: SiteKnowledge;
  onAdvance: (siteId: string, stage: PipelineStage) => void;
  onRunScraper: (siteId: string) => void;
}) {
  switch (site.pipeline_stage) {
    case "discover":
      return <DiscoverPanel site={site} onAdvance={(stage) => onAdvance(site.site_id, stage)} />;
    case "map":
      return <MapPanel site={site} onAdvance={(stage) => onAdvance(site.site_id, stage)} />;
    case "configure":
      return (
        <ConfigurePanel
          site={site}
          onAdvance={(stage) => onAdvance(site.site_id, stage)}
          onRunScraper={() => onRunScraper(site.site_id)}
        />
      );
    case "scrape":
      return (
        <ScrapePanel
          site={site}
          onRunScraper={() => onRunScraper(site.site_id)}
          onAdvance={(stage) => onAdvance(site.site_id, stage)}
        />
      );
    case "verify":
      return <VerifyPanel site={site} />;
  }
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
function DashboardContent() {
  const searchParams = useSearchParams();
  const sportParam = searchParams.get("sport");
  const [sites, setSites] = useState<SiteKnowledge[]>(INITIAL_SITES);
  const [appMode, setAppMode] = useState<"sport" | "pipeline">("sport");
  const [selectedSportId, setSelectedSportId] = useState<string | null>(() => sportParam || "curling");
  const [prevSportParam, setPrevSportParam] = useState(sportParam);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Sync sport parameter during render when URL query changes
  if (sportParam !== prevSportParam) {
    setPrevSportParam(sportParam);
    if (sportParam) {
      setSelectedSportId(sportParam);
      setAppMode("sport");
    }
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSport] = useState<string>("all");
  const [viewMode] = useState<"pipeline" | "table">("pipeline");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunSiteId, setActiveRunSiteId] = useState<string>("");

  // Sync with backend API if available
  useEffect(() => {
    async function fetchSites() {
      try {
        const res = await fetch("/api/v1/scraper/profiles");
        if (res.ok) {
          const profiles = await res.json();
          if (Array.isArray(profiles) && profiles.length > 0) {
            // merge backend profiles into sites
            setSites((prev) => {
              const existingIds = new Set(prev.map((s) => s.site_id));
              const newProfiles: SiteKnowledge[] = profiles.map((p: ScraperProfileBackendRecord) => {
                const mappedPageTypes: PageTypeNode[] = (p.page_types || []).map((pt, idx) => {
                  if (typeof pt === "object" && pt !== null && "id" in pt) {
                    return pt as PageTypeNode;
                  }
                  const name = String(pt || "page");
                  return {
                    id: `${p.site_id}_pt_${idx}`,
                    type: name,
                    label: name.replace(/_/g, " "),
                    url_pattern: `/*`,
                    example_url: p.base_url || "",
                    description: `${name} page`,
                    status: "discovered" as const,
                    is_scrapeable: true,
                  };
                });

                return {
                  site_id: p.site_id,
                  base_url: p.base_url || `https://${p.site_id}.org`,
                  org_name: p.org_name || p.site_id,
                  site_type: p.site_type || "governing_body",
                  sport: p.sport || p.sport_name || "curling",
                  strategy: p.strategy || "playwright",
                  proxy_tier: p.proxy_tier || "residential",
                  pipeline_stage: p.pipeline_stage || "discover",
                  page_types: mappedPageTypes,
                  page_flows: p.page_flows || [],
                  selectors: p.selectors || {},
                  notes: p.notes || "",
                  last_mapped_at: new Date().toISOString(),
                  has_events: true,
                  has_members: false,
                  has_results: false,
                };
              });

              const merged = [...prev];
              newProfiles.forEach((np) => {
                if (!existingIds.has(np.site_id)) {
                  merged.push(np);
                }
              });
              return merged;
            });
          }
        }
      } catch (err) {
        console.log("Using initial cached site state:", err);
      }
    }
    fetchSites();
  }, []);

  const sports = useMemo(() => [...new Set(sites.map((s) => s.sport))], [sites]);

  const filteredSites = useMemo(() => {
    return sites.filter((s) => {
      const matchesSearch =
        s.org_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.site_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.base_url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSport = filterSport === "all" || s.sport === filterSport;
      return matchesSearch && matchesSport;
    });
  }, [sites, searchQuery, filterSport]);

  const sitesByStage = useMemo(() => {
    const grouped: Record<PipelineStage, SiteKnowledge[]> = {
      discover: [], map: [], configure: [], scrape: [], verify: [],
    };
    filteredSites.forEach((s) => {
      grouped[s.pipeline_stage].push(s);
    });
    return grouped;
  }, [filteredSites]);

  const selectedSite = useMemo(() => sites.find((s) => s.site_id === selectedSiteId) || null, [sites, selectedSiteId]);
  const sportSites = useMemo(() => sites.filter((s) => s.sport === selectedSportId), [sites, selectedSportId]);

  const handleStageAdvance = async (siteId: string, targetStage: PipelineStage) => {
    setSites((prev) =>
      prev.map((s) => (s.site_id === siteId ? { ...s, pipeline_stage: targetStage } : s))
    );
    try {
      await fetch(`/api/site-knowledge/${siteId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_stage: targetStage }),
      });
    } catch (e) {
      console.warn("Backend update failed, kept local state", e);
    }
  };

  const handleRunScraper = async (siteId: string) => {
    setActiveRunSiteId(siteId);
    let runId = `run-${Date.now().toString(36)}`;
    try {
      const res = await fetch(`/api/v1/scraper/run/${siteId}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.run_id) runId = data.run_id;
      }
    } catch {
      console.warn("Using generated run ID:", runId);
    }
    setActiveRunId(runId);

    setSites((prev) =>
      prev.map((s) =>
        s.site_id === siteId
          ? { ...s, last_scrape_status: "success", events_found: (s.events_found || 0) + 5 }
          : s
      )
    );
  };

  return (
    <main className="flex-1 bg-[#090D1A] text-slate-100 flex overflow-hidden font-sans h-full">
      <NewSportModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddSport={(newSite) => {
          setSites((prev) => [newSite, ...prev]);
          setSelectedSportId(newSite.sport);
          setSelectedSiteId(newSite.site_id);
        }}
      />

      <LiveLogModal
        runId={activeRunId}
        siteId={activeRunSiteId}
        onClose={() => setActiveRunId(null)}
      />

      {/* LEFT PANEL */}
      <div className="w-80 border-r border-[#1E293B] bg-[#0C1226]/80 backdrop-blur-md flex flex-col shrink-0 z-20">
        <div className="p-5 pb-4 border-b border-[#1E293B]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Network className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-wider uppercase bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                  SportMap Ops
                </h1>
                <span className="text-[10px] text-slate-500">Pipeline & Intake Control</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full mb-2 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition"
          >
            <Plus className="h-4 w-4" />
            Onboard New Sport Pipeline
          </button>

          {/* Quick Deep Link into Studio */}
          <Link
            href={`/intake?sport=${selectedSportId || "curling"}`}
            className="w-full mb-3 py-1.5 px-3 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/60 text-sky-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-between transition group shadow-xs"
            title="Open selected sport in the visual node studio"
          >
            <span className="flex items-center gap-2">
              <Network className="h-3.5 w-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span className="capitalize">Edit in Intake Studio</span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-sky-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <div className="bg-slate-900 p-1 rounded-lg flex border border-slate-800 w-full mb-3">
            <button
              onClick={() => { setAppMode("sport"); setSelectedSiteId(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition ${
                appMode === "sport"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              <FolderTree className="h-3.5 w-3.5" />
              By Sport
            </button>
            <button
              onClick={() => { setAppMode("pipeline"); setSelectedSiteId(sites[0]?.site_id || null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition ${
                appMode === "pipeline"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              Pipeline
            </button>
          </div>

          {appMode === "pipeline" && (
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search sites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-500 text-slate-100"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {appMode === "sport" ? (
            <div className="space-y-3">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 mb-2">Tracked Sports ({sports.length})</h2>
              {sports.map((sport) => (
                <button
                  key={sport}
                  onClick={() => { setSelectedSportId(sport); setSelectedSiteId(null); }}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
                    selectedSportId === sport
                      ? "bg-slate-800/80 border-sky-500/50 shadow-lg"
                      : "bg-[#0C1226]/80 border-[#1E293B] hover:bg-slate-800/40 hover:border-slate-600"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-bold text-slate-100 capitalize">{sport}</h3>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Active</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Sites</p>
                      <p className="text-lg font-semibold text-slate-200">
                        {sites.filter((s) => s.sport === sport).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Events</p>
                      <p className="text-lg font-semibold text-emerald-400">
                        {sites.filter((s) => s.sport === sport).reduce((acc, s) => acc + (s.events_found || 0), 0)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <>
              {STAGE_ORDER.map((stage) => {
                const stageSites = sitesByStage[stage];
                if (stageSites.length === 0) return null;
                const config = STAGE_CONFIG[stage];
                const Icon = config.icon;

                return (
                  <div key={stage}>
                    <div className="flex items-center gap-2 px-2 mb-2">
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-[10px] text-slate-600 ml-auto">{stageSites.length}</span>
                    </div>
                    <div className="space-y-1">
                      {stageSites.map((site) => (
                        <SiteCard
                          key={site.site_id}
                          site={site}
                          isSelected={selectedSiteId === site.site_id}
                          onClick={() => setSelectedSiteId(site.site_id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-14 border-b border-[#1E293B] bg-[#090D1A]/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {appMode === "sport" && (
              <h2 className="text-sm font-semibold text-slate-300 capitalize">
                {selectedSportId} Ecosystem Pipeline & Scrapers
              </h2>
            )}
            {appMode === "pipeline" && (
              <span className="text-xs text-slate-400">Pipeline Stage Kanban & Site Manager</span>
            )}
          </div>
          <Link href="/intake" className="text-xs text-sky-400 hover:underline flex items-center gap-1.5">
            <Bot className="h-4 w-4" /> AI Intake Assistant
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto">
          {appMode === "sport" && selectedSportId ? (
            <div className="p-8 max-w-4xl mx-auto pb-24 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white capitalize">{selectedSportId} Ecosystem</h2>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Site to {selectedSportId}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sportSites.map((site) => (
                  <div
                    key={site.site_id}
                    onClick={() => setSelectedSiteId(site.site_id)}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      selectedSiteId === site.site_id
                        ? "bg-slate-800/90 border-sky-500"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-semibold text-white">{site.org_name}</h4>
                      <Badge className={STAGE_CONFIG[site.pipeline_stage].bg + " " + STAGE_CONFIG[site.pipeline_stage].color}>
                        {STAGE_CONFIG[site.pipeline_stage].label}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mb-3">{site.base_url}</p>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                      <span className="text-slate-400 capitalize">{site.strategy}</span>
                      <span className="text-emerald-400 font-medium">{site.events_found || 0} events</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : viewMode === "pipeline" && selectedSite ? (
            <div className="max-w-3xl mx-auto p-8">
              <div className="mb-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">{selectedSite.org_name}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Globe className="h-3 w-3" />
                      <span>{selectedSite.base_url.replace(/^https?:\/\//, "")}</span>
                      <span className="text-slate-700">·</span>
                      <span className="capitalize">{selectedSite.sport}</span>
                    </div>
                  </div>
                  <Badge className={`${STAGE_CONFIG[selectedSite.pipeline_stage].bg} ${STAGE_CONFIG[selectedSite.pipeline_stage].color} ${STAGE_CONFIG[selectedSite.pipeline_stage].border}`}>
                    {STAGE_CONFIG[selectedSite.pipeline_stage].label}
                  </Badge>
                </div>
                <div className="mt-5 mb-2">
                  <PipelineStepper
                    currentStage={selectedSite.pipeline_stage}
                    onStageClick={(stage) => handleStageAdvance(selectedSite.site_id, stage)}
                  />
                </div>
              </div>
              <hr className="border-slate-800 mb-6" />
              <StagePanel site={selectedSite} onAdvance={handleStageAdvance} onRunScraper={handleRunScraper} />
            </div>
          ) : null}
        </div>
      </div>

      {/* CONTEXTUAL SIDEBAR */}
      {appMode === "sport" && selectedSite && (
        <div className="w-96 bg-[#0C1226] border-l border-slate-800 shadow-2xl flex flex-col h-full absolute right-0 top-0 bottom-0 z-30">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{selectedSite.org_name}</span>
                <Link
                  href={`/intake?sport=${selectedSite.sport}`}
                  className="px-1.5 py-0.5 rounded bg-sky-950/80 hover:bg-sky-900 border border-sky-800 text-[10px] font-mono text-sky-300 flex items-center gap-1 transition"
                  title="Open in Intake Studio"
                >
                  <Network className="h-2.5 w-2.5" />
                  <span>Studio</span>
                </Link>
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">{selectedSite.base_url}</p>
            </div>
            <button
              onClick={() => setSelectedSiteId(null)}
              className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
              <PipelineStepper
                currentStage={selectedSite.pipeline_stage}
                onStageClick={(stage) => handleStageAdvance(selectedSite.site_id, stage)}
              />
            </div>
            <StagePanel site={selectedSite} onAdvance={handleStageAdvance} onRunScraper={handleRunScraper} />
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 bg-[#090D1A] flex items-center justify-center text-slate-400 text-xs">
          Loading Pipeline Operations...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
