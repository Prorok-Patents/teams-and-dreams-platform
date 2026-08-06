"use client";

import React, { useState } from "react";
import { NodeData, EdgeData } from "./NodeCanvas";
import { 
  Building2, 
  Swords, 
  Globe, 
  Plus, 
  Trash2, 
  Trophy, 
  Zap,
  ArrowRight
} from "lucide-react";

interface FormBuilderProps {
  nodes: NodeData[];
  edges: EdgeData[];
  onUpdateNodes: (nodes: NodeData[]) => void;
  onUpdateEdges: (edges: EdgeData[]) => void;
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

export default function FormBuilder({ nodes, edges, onUpdateNodes, onUpdateEdges }: FormBuilderProps) {
  const sportNode = nodes.find(n => n.type === "sport");
  const orgNodes = nodes.filter(n => n.type === "organization");
  const compNodes = nodes.filter(n => n.type === "competition");
  const siteNodes = nodes.filter(n => n.type === "web_source");
  const scraperNodes = nodes.filter(n => n.type === "scraper_config");

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
      x: 350 + (orgNodes.length * 40),
      y: 120 + (orgNodes.length * 80),
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
      x: 700 + (compNodes.length * 30),
      y: 200 + (compNodes.length * 60),
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
      x: 700 + (siteNodes.length * 30),
      y: 100 + (siteNodes.length * 60),
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
      x: 500,
      y: 350,
      data: { depth: 2, use_healer: true }
    };
    onUpdateNodes([...nodes, newCfg]);
  };

  const removeNode = (id: string) => {
    onUpdateNodes(nodes.filter(n => n.id !== id));
    onUpdateEdges(edges.filter(e => e.source !== id && e.target !== id));
  };

  const updateNodeData = (id: string, field: string, value: unknown) => {
    onUpdateNodes(nodes.map(n => {
      if (n.id === id) {
        if (field === "label") return { ...n, label: String(value) };
        return { ...n, data: { ...n.data, [field]: value } };
      }
      return n;
    }));
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
    onUpdateEdges(edges.map(e => e.id === edgeId ? { ...e, label } : e));
  };

  return (
    <div className="flex-1 bg-[#070A14] p-8 overflow-y-auto space-y-8">
      {/* Sport Root Identity */}
      <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-[#1E293B] pb-4">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Sport Root Identity</h3>
            <p className="text-xs text-slate-400">Primary classification and reference metadata.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">Sport Name</label>
            <input
              type="text"
              value={sportNode?.label || ""}
              onChange={e => updateSportField("label", e.target.value)}
              placeholder="e.g. Curling"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">Category</label>
            <input
              type="text"
              value={String(sportNode?.data.category || "")}
              onChange={e => updateSportField("category", e.target.value)}
              placeholder="e.g. Winter Sports"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">Wikipedia Title / URL</label>
            <input
              type="text"
              value={String(sportNode?.data.wikipedia_url || "")}
              onChange={e => updateSportField("wikipedia_url", e.target.value)}
              placeholder="https://en.wikipedia.org/wiki/Curling"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </section>

      {/* Organizations Section */}
      <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Governing Bodies & Organizations ({orgNodes.length})</h3>
              <p className="text-xs text-slate-400">Specify known federations, leagues, or international associations.</p>
            </div>
          </div>

          <button
            onClick={addOrg}
            className="px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium flex items-center gap-1.5 transition"
          >
            <Plus className="h-4 w-4" /> Add Organization
          </button>
        </div>

        <div className="space-y-3">
          {orgNodes.map((org) => (
            <div key={org.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-4">
              <div className="flex-1 grid grid-cols-4 gap-3">
                <input
                  type="text"
                  value={org.label}
                  onChange={e => updateNodeData(org.id, "label", e.target.value)}
                  placeholder="Organization Name"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                />
                <input
                  type="text"
                  value={String(org.data.acronym || "")}
                  onChange={e => updateNodeData(org.id, "acronym", e.target.value)}
                  placeholder="Acronym (e.g. WCF)"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                />
                <select
                  value={String(org.data.scope || "international")}
                  onChange={e => updateNodeData(org.id, "scope", e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                >
                  <option value="international">International</option>
                  <option value="national">National</option>
                  <option value="regional">Regional</option>
                </select>
                <input
                  type="text"
                  value={String(org.data.website_url || "")}
                  onChange={e => updateNodeData(org.id, "website_url", e.target.value)}
                  placeholder="Website URL"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                />
              </div>

              <button
                onClick={() => removeNode(org.id)}
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Competitions Section */}
      <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Swords className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Competitions & Leagues ({compNodes.length})</h3>
              <p className="text-xs text-slate-400">Known major events, leagues, or championship series.</p>
            </div>
          </div>

          <button
            onClick={addCompetition}
            className="px-3 py-2 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium flex items-center gap-1.5 transition"
          >
            <Plus className="h-4 w-4" /> Add Competition
          </button>
        </div>

        <div className="space-y-3">
          {compNodes.map((comp) => (
            <div key={comp.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-4">
              <div className="flex-1 grid grid-cols-4 gap-3">
                <input
                  type="text"
                  value={comp.label}
                  onChange={e => updateNodeData(comp.id, "label", e.target.value)}
                  placeholder="Competition Title"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                />
                <select
                  value={Number(comp.data.tier || 1)}
                  onChange={e => updateNodeData(comp.id, "tier", Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                >
                  <option value={1}>Tier 1 (World / Premier)</option>
                  <option value={2}>Tier 2 (National / Tour)</option>
                  <option value={3}>Tier 3 (Regional)</option>
                </select>
                <select
                  value={String(comp.data.gender || "mixed")}
                  onChange={e => updateNodeData(comp.id, "gender", e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                >
                  <option value="men">Men's</option>
                  <option value="women">Women's</option>
                  <option value="mixed">Mixed / Open</option>
                </select>
                <input
                  type="text"
                  value={String(comp.data.url || "")}
                  onChange={e => updateNodeData(comp.id, "url", e.target.value)}
                  placeholder="Competition URL"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                />
              </div>

              <button
                onClick={() => removeNode(comp.id)}
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Target Web Sources Section */}
      <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Target Crawl Websites & Sources ({siteNodes.length})</h3>
              <p className="text-xs text-slate-400 font-sans">Target calendar URLs or domain discovery targets.</p>
            </div>
          </div>

          <button
            onClick={addWebSource}
            className="px-3 py-2 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium flex items-center gap-1.5 transition"
          >
            <Plus className="h-4 w-4" /> Add Web Source
          </button>
        </div>

        <div className="space-y-3">
          {siteNodes.map((site) => (
            <div key={site.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-4">
              <div className="flex-1 grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={site.label}
                  onChange={e => updateNodeData(site.id, "label", e.target.value)}
                  placeholder="Site Name / Title"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                />
                <input
                  type="text"
                  value={String(site.data.url || "")}
                  onChange={e => updateNodeData(site.id, "url", e.target.value)}
                  placeholder="https://officialsite.com/events"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                />
                <select
                  value={String(site.data.antibot || "none")}
                  onChange={e => updateNodeData(site.id, "antibot", e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                >
                  <option value="none">Standard HTTP (Fast)</option>
                  <option value="cloud-flare font-mono">Cloudflare / Stealth</option>
                  <option value="playwright">Playwright Headless</option>
                </select>
              </div>
              <button
                onClick={() => removeNode(site.id)}
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Scraper Configs Section */}
      <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Scraper Strategies & Healers ({scraperNodes.length})</h3>
              <p className="text-xs text-slate-400">Automated crawling parameters and auto-healing rules.</p>
            </div>
          </div>

          <button
            onClick={addScraperConfig}
            className="px-3 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium flex items-center gap-1.5 transition"
          >
            <Plus className="h-4 w-4" /> Add Strategy
          </button>
        </div>

        <div className="space-y-3">
          {scraperNodes.map((cfg) => (
            <div key={cfg.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-4">
              <div className="flex-1 grid grid-cols-3 gap-3 items-center">
                <input
                  type="text"
                  value={cfg.label}
                  onChange={e => updateNodeData(cfg.id, "label", e.target.value)}
                  placeholder="Config Name"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 shrink-0">Crawl Depth:</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={Number(cfg.data.depth || 2)}
                    onChange={e => updateNodeData(cfg.id, "depth", Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 w-20"
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
              <button
                onClick={() => removeNode(cfg.id)}
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Graph Wire Connections Manager */}
      <section className="bg-[#0C1226]/80 border border-[#1E293B] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-[#1E293B] pb-4">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <ArrowRight className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Graph Wires & Edge Paths ({edges.length})</h3>
            <p className="text-xs text-slate-400">Explicit relationship mapping between nodes in the map.</p>
          </div>
        </div>

        {/* Existing Edges List */}
        <div className="space-y-2">
          {edges.map((edge) => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);

            return (
              <div key={edge.id} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs flex-1">
                  <span className="font-semibold text-slate-200 px-2.5 py-1 bg-slate-950 rounded border border-slate-800">
                    {sourceNode?.label || edge.source}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                    <select
                      value={edge.label || "connects"}
                      onChange={e => handleUpdateEdgeLabel(edge.id, e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-sky-400 text-xs rounded px-2 py-1 font-mono"
                    >
                      {STANDARD_EDGE_LABELS.map(lbl => (
                        <option key={lbl} value={lbl}>{lbl}</option>
                      ))}
                    </select>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                  </div>

                  <span className="font-semibold text-slate-200 px-2.5 py-1 bg-slate-950 rounded border border-slate-800">
                    {targetNode?.label || edge.target}
                  </span>
                </div>

                <button
                  onClick={() => handleRemoveEdge(edge.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add New Edge Form */}
        <div className="pt-2 border-t border-[#1E293B]">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Connect New Path Wire</h4>
          <div className="flex items-center gap-3">
            <select
              value={newEdgeSource}
              onChange={e => setNewEdgeSource(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
            >
              <option value="">-- Select Source Node --</option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.label} ({n.type})</option>
              ))}
            </select>

            <select
              value={newEdgeLabel}
              onChange={e => setNewEdgeLabel(e.target.value)}
              className="w-40 bg-slate-900 border border-slate-700 text-sky-400 text-xs rounded-xl px-3 py-2 font-mono"
            >
              {STANDARD_EDGE_LABELS.map(lbl => (
                <option key={lbl} value={lbl}>{lbl}</option>
              ))}
            </select>

            <select
              value={newEdgeTarget}
              onChange={e => setNewEdgeTarget(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
            >
              <option value="">-- Select Target Node --</option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.label} ({n.type})</option>
              ))}
            </select>

            <button
              onClick={handleAddEdge}
              disabled={!newEdgeSource || !newEdgeTarget || newEdgeSource === newEdgeTarget}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
            >
              <Plus className="h-4 w-4" /> Connect Wire
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
