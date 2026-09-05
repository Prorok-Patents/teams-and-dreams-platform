"use client";

import React, { useState, useMemo, useCallback } from "react";
import { NodeData, EdgeData, WebSourceConfig } from "./NodeCanvas";
import {
  Building2,
  Swords,
  Globe,
  Plus,
  Trash2,
  Trophy,
  Zap,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Compass
} from "lucide-react";

interface FormBuilderProps {
  nodes: NodeData[];
  edges: EdgeData[];
  onUpdateNodes: (nodes: NodeData[]) => void;
  onUpdateEdges: (edges: EdgeData[]) => void;
  onLocateOnCanvas?: (nodeId: string) => void;
}

const STANDARD_EDGE_LABELS = [
  "governed by",
  "sanctions",
  "publishes",
  "organizes",
  "operates",
  "connects",
  "scrapes"
];

export default function FormBuilder({
  nodes,
  edges,
  onUpdateNodes,
  onUpdateEdges,
  onLocateOnCanvas
}: FormBuilderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Collapsible section states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    sport: true,
    orgs: true,
    comps: true,
    sites: true,
    scrapers: true,
    wires: true
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const sportNode = nodes.find(n => n.type === "sport");
  const orgNodes = nodes.filter(n => n.type === "organization");
  const compNodes = nodes.filter(n => n.type === "competition");
  const siteNodes = nodes.filter(n => n.type === "web_source");
  const scraperNodes = nodes.filter(n => n.type === "scraper_config");

  // Filtering
  const filterMatch = useCallback((item: NodeData) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      JSON.stringify(item.data).toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredOrgs = useMemo(() => orgNodes.filter(filterMatch), [orgNodes, filterMatch]);
  const filteredComps = useMemo(() => compNodes.filter(filterMatch), [compNodes, filterMatch]);
  const filteredSites = useMemo(() => siteNodes.filter(filterMatch), [siteNodes, filterMatch]);
  const filteredScrapers = useMemo(() => scraperNodes.filter(filterMatch), [scraperNodes, filterMatch]);

  const [newEdgeSource, setNewEdgeSource] = useState<string>("");
  const [newEdgeTarget, setNewEdgeTarget] = useState<string>("");
  const [newEdgeLabel, setNewEdgeLabel] = useState<string>("connects");

  const updateSportField = (field: string, value: unknown) => {
    if (!sportNode) return;
    const updated = nodes.map(n => {
      if (n.id === sportNode.id) {
        if (field === "label") return { ...n, label: String(value) };
        return { ...n, data: { ...n.data, [field]: value } };
      }
      return n;
    });
    onUpdateNodes(updated);
  };

  const addOrg = () => {
    const id = `org_${crypto.randomUUID()}`;
    const newOrg: NodeData = {
      id,
      type: "organization",
      label: "New Organization",
      x: 380 + orgNodes.length * 30,
      y: 120 + orgNodes.length * 80,
      data: { acronym: "", scope: "national", org_type: "governing_body" }
    };
    const newNodes = [...nodes, newOrg];
    const newEdges = [...edges];
    if (sportNode) {
      newEdges.push({
        id: `edge_${crypto.randomUUID()}`,
        source: sportNode.id,
        target: id,
        label: "governed by"
      });
    }
    onUpdateNodes(newNodes);
    onUpdateEdges(newEdges);
  };

  const addCompetition = () => {
    const id = `comp_${crypto.randomUUID()}`;
    const newComp: NodeData = {
      id,
      type: "competition",
      label: "New Competition",
      x: 740 + compNodes.length * 30,
      y: 160 + compNodes.length * 70,
      data: { tier: 1, gender: "mixed", url: "" }
    };
    onUpdateNodes([...nodes, newComp]);
  };

  const addWebSource = () => {
    const id = `site_${crypto.randomUUID()}`;
    const newSite: NodeData = {
      id,
      type: "web_source",
      label: "New Web Source",
      x: 740 + siteNodes.length * 30,
      y: 100 + siteNodes.length * 60,
      data: { url: "", antibot: "none" }
    };
    onUpdateNodes([...nodes, newSite]);
  };

  const addScraperConfig = () => {
    const id = `cfg_${crypto.randomUUID()}`;
    const newCfg: NodeData = {
      id,
      type: "scraper_config",
      label: "Scraper Strategy",
      x: 1080,
      y: 180 + scraperNodes.length * 80,
      data: { depth: 2, use_healer: true }
    };
    onUpdateNodes([...nodes, newCfg]);
  };

  const removeNode = (id: string) => {
    onUpdateNodes(nodes.filter(n => n.id !== id));
    onUpdateEdges(edges.filter(e => e.source !== id && e.target !== id));
  };

  const updateNodeData = (id: string, field: string, value: unknown) => {
    onUpdateNodes(
      nodes.map(n => {
        if (n.id !== id) return n;
        if (field === "label") return { ...n, label: String(value) };
        return { ...n, data: { ...n.data, [field]: value } };
      })
    );
  };

  const handleAddOrgSource = (orgId: string) => {
    const org = nodes.find(n => n.id === orgId);
    if (!org) return;
    const currentSources: WebSourceConfig[] = Array.isArray(org.data.sources) ? [...(org.data.sources as WebSourceConfig[])] : [];
    currentSources.push({
      id: `src_${crypto.randomUUID().slice(0, 8)}`,
      label: `Target Source ${currentSources.length + 1}`,
      url: "",
      antibot: "none",
      depth: 2,
      use_healer: true
    });
    updateNodeData(orgId, "sources", currentSources);
  };

  const handleUpdateOrgSource = (orgId: string, srcIndex: number, field: keyof WebSourceConfig, val: unknown) => {
    const org = nodes.find(n => n.id === orgId);
    if (!org) return;
    const currentSources: WebSourceConfig[] = Array.isArray(org.data.sources) ? [...(org.data.sources as WebSourceConfig[])] : [];
    currentSources[srcIndex] = { ...currentSources[srcIndex], [field]: val };
    updateNodeData(orgId, "sources", currentSources);
  };

  const handleRemoveOrgSource = (orgId: string, srcIndex: number) => {
    const org = nodes.find(n => n.id === orgId);
    if (!org) return;
    const currentSources: WebSourceConfig[] = Array.isArray(org.data.sources) ? [...(org.data.sources as WebSourceConfig[])] : [];
    currentSources.splice(srcIndex, 1);
    updateNodeData(orgId, "sources", currentSources);
  };

  const handleAddEdge = () => {
    if (!newEdgeSource || !newEdgeTarget || newEdgeSource === newEdgeTarget) return;
    const exists = edges.some(e => e.source === newEdgeSource && e.target === newEdgeTarget);
    if (exists) return;

    const newEdge: EdgeData = {
      id: `edge_${crypto.randomUUID()}`,
      source: newEdgeSource,
      target: newEdgeTarget,
      label: newEdgeLabel || "connects"
    };

    onUpdateEdges([...edges, newEdge]);
    setNewEdgeSource("");
    setNewEdgeTarget("");
  };

  const handleRemoveEdge = (edgeId: string) => {
    onUpdateEdges(edges.filter(e => e.id !== edgeId));
  };

  const handleUpdateEdgeLabel = (edgeId: string, label: string) => {
    onUpdateEdges(edges.map(e => (e.id === edgeId ? { ...e, label } : e)));
  };

  // 1-Click Auto-connect helper: Connect any unconnected orgs to Sport root
  const handleAutoConnectOrgs = () => {
    if (!sportNode) return;
    const existingTargets = new Set(edges.filter(e => e.source === sportNode.id).map(e => e.target));
    const newEdgesToAdd: EdgeData[] = [];

    orgNodes.forEach(org => {
      if (!existingTargets.has(org.id)) {
        newEdgesToAdd.push({
          id: `edge_${crypto.randomUUID()}`,
          source: sportNode.id,
          target: org.id,
          label: "governed by"
        });
      }
    });

    if (newEdgesToAdd.length > 0) {
      onUpdateEdges([...edges, ...newEdgesToAdd]);
    }
  };

  return (
    <div className="flex-1 bg-[#070A14] flex flex-col overflow-hidden">
      {/* Search Header for Form View */}
      <div className="p-4 border-b border-[#1E293B] bg-[#0C1226]/80 flex items-center justify-between shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search across all form entries..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {sportNode && orgNodes.length > 0 && (
            <button
              onClick={handleAutoConnectOrgs}
              className="px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Link any unconnected organizations to the Sport root"
            >
              <LinkIcon className="h-3 w-3" /> Auto-Link Orgs to Sport
            </button>
          )}
        </div>
      </div>

      {/* Main Form Scrollable Content */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-6xl mx-auto w-full">
        {/* Sport Root Identity */}
        <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl overflow-hidden">
          <div
            onClick={() => toggleSection("sport")}
            className="p-4 border-b border-[#1E293B] flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Sport Root Identity
                </h3>
                <p className="text-xs text-slate-400">Primary sport classification and Wikipedia reference anchor.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sportNode && onLocateOnCanvas && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLocateOnCanvas(sportNode.id);
                  }}
                  className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition"
                  title="Locate on Canvas"
                >
                  <Compass className="h-4 w-4" />
                </button>
              )}
              {openSections.sport ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </div>

          {openSections.sport && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Sport Name</label>
                <input
                  type="text"
                  value={sportNode?.label || ""}
                  onChange={e => updateSportField("label", e.target.value)}
                  placeholder="e.g. Curling"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Category</label>
                <input
                  type="text"
                  value={String(sportNode?.data.category || "")}
                  onChange={e => updateSportField("category", e.target.value)}
                  placeholder="e.g. Winter Sports"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Wikipedia URL / Slug</label>
                <input
                  type="text"
                  value={String(sportNode?.data.wikipedia_url || "")}
                  onChange={e => updateSportField("wikipedia_url", e.target.value)}
                  placeholder="https://en.wikipedia.org/wiki/Curling"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
        </section>

        {/* Organizations Section */}
        <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl overflow-hidden">
          <div
            onClick={() => toggleSection("orgs")}
            className="p-4 border-b border-[#1E293B] flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Governing Bodies & Organizations ({filteredOrgs.length})
                </h3>
                <p className="text-xs text-slate-400">International federations, leagues, and associations.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addOrg();
                }}
                className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Add Organization
              </button>
              {openSections.orgs ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </div>

          {openSections.orgs && (
            <div className="p-5 space-y-3">
              {filteredOrgs.length === 0 && (
                <div className="p-6 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500 space-y-2">
                  <p>No organizations listed yet.</p>
                  <button
                    onClick={addOrg}
                    className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add First Organization
                  </button>
                </div>
              )}

              {filteredOrgs.map((org) => (
                <div
                  key={org.id}
                  className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2.5">
                      <input
                        type="text"
                        value={org.label}
                        onChange={e => updateNodeData(org.id, "label", e.target.value)}
                        placeholder="Organization Name"
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                      />
                      <input
                        type="text"
                        value={String(org.data.acronym || "")}
                        onChange={e => updateNodeData(org.id, "acronym", e.target.value)}
                        placeholder="Acronym (e.g. WCF)"
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                      />
                      <select
                        value={String(org.data.scope || "international")}
                        onChange={e => updateNodeData(org.id, "scope", e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                      >
                        <option value="international">International</option>
                        <option value="national">National</option>
                        <option value="regional">Regional</option>
                      </select>
                      <input
                        type="text"
                        value={String(org.data.website_url || "")}
                        onChange={e => updateNodeData(org.id, "website_url", e.target.value)}
                        placeholder="Official Website URL"
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      {onLocateOnCanvas && (
                        <button
                          onClick={() => onLocateOnCanvas(org.id)}
                          className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition"
                          title="Locate on Canvas"
                        >
                          <Compass className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => removeNode(org.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                        title="Delete Organization"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Embedded Web Sources & Scrapers */}
                  {(() => {
                    const orgSources = Array.isArray(org.data.sources) ? (org.data.sources as WebSourceConfig[]) : [];
                    return (
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Globe className="h-3 w-3 text-sky-400" /> Embedded Scraper Sources ({orgSources.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddOrgSource(org.id)}
                            className="px-2 py-0.5 bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 rounded text-[10px] font-medium flex items-center gap-1 transition"
                          >
                            <Plus className="h-2.5 w-2.5" /> Add Source
                          </button>
                        </div>

                        {orgSources.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic py-0.5">
                            No scraper endpoints attached. Click &quot;Add Source&quot; to configure a calendar URL.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {orgSources.map((src: WebSourceConfig, sIdx: number) => (
                              <div key={src.id || sIdx} className="bg-slate-950/80 border border-slate-800/90 p-2 rounded-lg flex flex-col md:flex-row items-center gap-2 text-xs">
                                <input
                                  type="text"
                                  value={src.label || ""}
                                  onChange={e => handleUpdateOrgSource(org.id, sIdx, "label", e.target.value)}
                                  placeholder="Source Title"
                                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs w-full md:w-36"
                                />
                                <input
                                  type="text"
                                  value={src.url || ""}
                                  onChange={e => handleUpdateOrgSource(org.id, sIdx, "url", e.target.value)}
                                  placeholder="https://..."
                                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono flex-1"
                                />
                                <select
                                  value={src.antibot || "none"}
                                  onChange={e => handleUpdateOrgSource(org.id, sIdx, "antibot", e.target.value)}
                                  className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-300 text-xs font-mono"
                                >
                                  <option value="none">Standard HTTP</option>
                                  <option value="cloud-flare">Cloudflare</option>
                                  <option value="playwright">Playwright</option>
                                </select>
                                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                  <span>Depth:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={src.depth ?? 2}
                                    onChange={e => handleUpdateOrgSource(org.id, sIdx, "depth", Number(e.target.value) || 2)}
                                    className="bg-slate-900 border border-slate-800 rounded px-1 py-1 text-slate-200 text-xs w-10 text-center"
                                  />
                                </div>
                                <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={src.use_healer !== false}
                                    onChange={e => handleUpdateOrgSource(org.id, sIdx, "use_healer", e.target.checked)}
                                    className="rounded accent-sky-500"
                                  />
                                  <span>Healer</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOrgSource(org.id, sIdx)}
                                  className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition ml-auto"
                                  title="Delete Source"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Competitions Section */}
        <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl overflow-hidden">
          <div
            onClick={() => toggleSection("comps")}
            className="p-4 border-b border-[#1E293B] flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Swords className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Competitions & Tournaments ({filteredComps.length})
                </h3>
                <p className="text-xs text-slate-400">Known championships, tour series, and premier events.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addCompetition();
                }}
                className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Add Competition
              </button>
              {openSections.comps ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </div>

          {openSections.comps && (
            <div className="p-5 space-y-3">
              {filteredComps.length === 0 && (
                <div className="p-6 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500 space-y-2">
                  <p>No competitions listed yet.</p>
                  <button
                    onClick={addCompetition}
                    className="px-3 py-1.5 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded-lg font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add First Competition
                  </button>
                </div>
              )}

              {filteredComps.map((comp) => (
                <div
                  key={comp.id}
                  className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-3 hover:border-slate-700 transition"
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2.5">
                    <input
                      type="text"
                      value={comp.label}
                      onChange={e => updateNodeData(comp.id, "label", e.target.value)}
                      placeholder="Competition Title"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    />
                    <select
                      value={Number(comp.data.tier || 1)}
                      onChange={e => updateNodeData(comp.id, "tier", Number(e.target.value))}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    >
                      <option value={1}>Tier 1 (World / Premier)</option>
                      <option value={2}>Tier 2 (National / Tour)</option>
                      <option value={3}>Tier 3 (Regional)</option>
                    </select>
                    <select
                      value={String(comp.data.gender || "mixed")}
                      onChange={e => updateNodeData(comp.id, "gender", e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    >
                      <option value="men">Men&apos;s</option>
                      <option value="women">Women&apos;s</option>
                      <option value="mixed">Mixed / Open</option>
                    </select>
                    <input
                      type="text"
                      value={String(comp.data.url || "")}
                      onChange={e => updateNodeData(comp.id, "url", e.target.value)}
                      placeholder="Competition URL"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    {onLocateOnCanvas && (
                      <button
                        onClick={() => onLocateOnCanvas(comp.id)}
                        className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition"
                        title="Locate on Canvas"
                      >
                        <Compass className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => removeNode(comp.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Web Sources Section */}
        <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl overflow-hidden">
          <div
            onClick={() => toggleSection("sites")}
            className="p-4 border-b border-[#1E293B] flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Standalone Web Sources ({filteredSites.length})
                </h3>
                <p className="text-xs text-slate-400">Web sources can be embedded directly inside each Organization above, or managed here as standalone nodes.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addWebSource();
                }}
                className="px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Add Web Source
              </button>
              {openSections.sites ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </div>

          {openSections.sites && (
            <div className="p-5 space-y-3">
              {filteredSites.length === 0 && (
                <div className="p-6 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500 space-y-2">
                  <p>No target web sources configured yet.</p>
                  <button
                    onClick={addWebSource}
                    className="px-3 py-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 rounded-lg font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add First Web Source
                  </button>
                </div>
              )}

              {filteredSites.map((site) => (
                <div
                  key={site.id}
                  className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-3 hover:border-slate-700 transition"
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      value={site.label}
                      onChange={e => updateNodeData(site.id, "label", e.target.value)}
                      placeholder="Source Title / Name"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    />
                    <input
                      type="text"
                      value={String(site.data.url || "")}
                      onChange={e => updateNodeData(site.id, "url", e.target.value)}
                      placeholder="https://events.officialsite.com"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                    />
                    <select
                      value={String(site.data.antibot || "none")}
                      onChange={e => updateNodeData(site.id, "antibot", e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                    >
                      <option value="none">Standard HTTP (Fast)</option>
                      <option value="cloud-flare">Cloudflare / Stealth</option>
                      <option value="playwright">Playwright Headless Chrome</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    {onLocateOnCanvas && (
                      <button
                        onClick={() => onLocateOnCanvas(site.id)}
                        className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition"
                        title="Locate on Canvas"
                      >
                        <Compass className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => removeNode(site.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Scraper Strategies Section */}
        <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl overflow-hidden">
          <div
            onClick={() => toggleSection("scrapers")}
            className="p-4 border-b border-[#1E293B] flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Standalone Scraper Strategies ({filteredScrapers.length})
                </h3>
                <p className="text-xs text-slate-400">Scraper strategies can be configured inside each Organization above, or managed here as standalone nodes.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addScraperConfig();
                }}
                className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Add Strategy
              </button>
              {openSections.scrapers ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </div>

          {openSections.scrapers && (
            <div className="p-5 space-y-3">
              {filteredScrapers.length === 0 && (
                <div className="p-6 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500 space-y-2">
                  <p>No scraper strategies configured yet.</p>
                  <button
                    onClick={addScraperConfig}
                    className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add First Strategy
                  </button>
                </div>
              )}

              {filteredScrapers.map((cfg) => (
                <div
                  key={cfg.id}
                  className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-3 hover:border-slate-700 transition"
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    <input
                      type="text"
                      value={cfg.label}
                      onChange={e => updateNodeData(cfg.id, "label", e.target.value)}
                      placeholder="Strategy Name"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 shrink-0">Crawl Depth:</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={Number(cfg.data.depth || 2)}
                        onChange={e => updateNodeData(cfg.id, "depth", Number(e.target.value))}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 w-20"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(cfg.data.use_healer ?? true)}
                        onChange={e => updateNodeData(cfg.id, "use_healer", e.target.checked)}
                        className="h-4 w-4 rounded accent-rose-500"
                      />
                      <span>LLM Auto-Healer</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-1">
                    {onLocateOnCanvas && (
                      <button
                        onClick={() => onLocateOnCanvas(cfg.id)}
                        className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition"
                        title="Locate on Canvas"
                      >
                        <Compass className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => removeNode(cfg.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Wires Section */}
        <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl overflow-hidden">
          <div
            onClick={() => toggleSection("wires")}
            className="p-4 border-b border-[#1E293B] flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <ArrowRight className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Graph Wires & Edge Paths ({edges.length})
                </h3>
                <p className="text-xs text-slate-400">Explicit relationship mappings between all nodes.</p>
              </div>
            </div>
            {openSections.wires ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>

          {openSections.wires && (
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                {edges.map((edge) => {
                  const sourceNode = nodes.find(n => n.id === edge.source);
                  const targetNode = nodes.find(n => n.id === edge.target);

                  return (
                    <div
                      key={edge.id}
                      className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-2 text-xs flex-1 truncate">
                        <span className="font-semibold text-slate-200 px-2.5 py-1 bg-slate-950 rounded border border-slate-800 truncate">
                          {sourceNode?.label || edge.source}
                        </span>

                        <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <select
                          value={edge.label || "connects"}
                          onChange={e => handleUpdateEdgeLabel(edge.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-sky-400 text-xs rounded px-2 py-1 font-mono"
                        >
                          {STANDARD_EDGE_LABELS.map(lbl => (
                            <option key={lbl} value={lbl}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />

                        <span className="font-semibold text-slate-200 px-2.5 py-1 bg-slate-950 rounded border border-slate-800 truncate">
                          {targetNode?.label || edge.target}
                        </span>
                      </div>

                      <button
                        onClick={() => handleRemoveEdge(edge.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add Edge Form */}
              <div className="pt-3 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Connect New Wire Path
                </span>
                <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
                  <select
                    value={newEdgeSource}
                    onChange={e => setNewEdgeSource(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="">-- Source Node --</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.label} ({n.type})
                      </option>
                    ))}
                  </select>

                  <select
                    value={newEdgeLabel}
                    onChange={e => setNewEdgeLabel(e.target.value)}
                    className="w-36 bg-slate-900 border border-slate-700 text-sky-400 text-xs rounded-xl px-2 py-2 font-mono"
                  >
                    {STANDARD_EDGE_LABELS.map(lbl => (
                      <option key={lbl} value={lbl}>
                        {lbl}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newEdgeTarget}
                    onChange={e => setNewEdgeTarget(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="">-- Target Node --</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.label} ({n.type})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleAddEdge}
                    disabled={!newEdgeSource || !newEdgeTarget || newEdgeSource === newEdgeTarget}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shrink-0"
                  >
                    <Plus className="h-4 w-4" /> Connect Wire
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
