"use client";

import React, { useState } from "react";
import { NodeData, EdgeData, WebSourceConfig } from "./NodeCanvas";
import {
  X,
  Sliders,
  Pin,
  PinOff,
  Copy,
  Trash2,
  Code,
  AlertTriangle,
  ArrowRight,
  Plus,
  Compass,
  Globe,
  Zap
} from "lucide-react";

interface NodeInspectorProps {
  node: NodeData | null;
  nodes: NodeData[];
  edges: EdgeData[];
  onClose: () => void;
  onUpdateNode: (updatedNode: NodeData) => void;
  onUpdateEdges?: (edges: EdgeData[]) => void;
  onSelectNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onCenterNode?: (nodeId: string) => void;
}

export default function NodeInspector({
  node,
  nodes,
  edges,
  onClose,
  onUpdateNode,
  onUpdateEdges,
  onSelectNode,
  onDuplicateNode,
  onDeleteNode,
  onCenterNode
}: NodeInspectorProps) {
  const [isPinned, setIsPinned] = useState(true);
  const [activeTab, setActiveTab] = useState<"fields" | "wires" | "json">("fields");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // New custom metadata key/val state
  const [newMetaKey, setNewMetaKey] = useState("");
  const [newMetaVal, setNewMetaVal] = useState("");

  if (!node) return null;

  const handleChangeField = (field: string, value: unknown) => {
    if (field === "label") {
      onUpdateNode({
        ...node,
        label: String(value)
      });
    } else {
      onUpdateNode({
        ...node,
        data: {
          ...node.data,
          [field]: value
        }
      });
    }
  };

  const handleStatusChange = (status: NodeData["status"]) => {
    onUpdateNode({
      ...node,
      status
    });
  };

  const handleAddCustomMeta = () => {
    if (!newMetaKey.trim()) return;
    onUpdateNode({
      ...node,
      data: {
        ...node.data,
        [newMetaKey.trim()]: newMetaVal
      }
    });
    setNewMetaKey("");
    setNewMetaVal("");
  };

  const handleRemoveCustomMeta = (key: string) => {
    const updatedData = { ...node.data };
    delete updatedData[key];
    onUpdateNode({
      ...node,
      data: updatedData
    });
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      onUpdateNode({
        ...node,
        data: parsed
      });
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const parseNumberInput = (val: string, fallback: number) => {
    if (!val || isNaN(Number(val))) return fallback;
    return Number(val);
  };

  // Connected Wires
  const incomingEdges = edges.filter(e => e.target === node.id);
  const outgoingEdges = edges.filter(e => e.source === node.id);

  const handleDisconnectEdge = (edgeId: string) => {
    if (onUpdateEdges) {
      onUpdateEdges(edges.filter(e => e.id !== edgeId));
    }
  };

  // Values
  const categoryVal = typeof node.data.category === "string" ? node.data.category : "";
  const wikiVal = typeof node.data.wikipedia_url === "string" ? node.data.wikipedia_url : "";
  const acronymVal = typeof node.data.acronym === "string" ? node.data.acronym : "";
  const scopeVal = typeof node.data.scope === "string" ? node.data.scope : "international";
  const orgTypeVal = typeof node.data.org_type === "string" ? node.data.org_type : "governing_body";
  const websiteUrlVal = typeof node.data.website_url === "string" ? node.data.website_url : "";
  const tierVal = typeof node.data.tier === "number" ? node.data.tier : 1;
  const genderVal = typeof node.data.gender === "string" ? node.data.gender : "mixed";
  const compUrlVal = typeof node.data.url === "string" ? node.data.url : "";
  const antibotVal = typeof node.data.antibot === "string" ? node.data.antibot : "none";
  const depthVal = typeof node.data.depth === "number" ? node.data.depth : 2;
  const healerVal = typeof node.data.use_healer === "boolean" ? node.data.use_healer : true;

  // Embedded Web Sources list
  const sourcesVal: WebSourceConfig[] = Array.isArray(node.data.sources)
    ? (node.data.sources as WebSourceConfig[])
    : [];

  const handleAddSource = () => {
    const newSrc: WebSourceConfig = {
      id: `src_${crypto.randomUUID().slice(0, 8)}`,
      label: `Endpoint ${sourcesVal.length + 1}`,
      url: "",
      antibot: "none",
      depth: 2,
      use_healer: true,
      status: "idle"
    };
    handleChangeField("sources", [...sourcesVal, newSrc]);
  };

  const handleUpdateSource = (index: number, key: keyof WebSourceConfig, val: unknown) => {
    const updated = sourcesVal.map((s, i) => {
      if (i === index) {
        return { ...s, [key]: val };
      }
      return s;
    });
    handleChangeField("sources", updated);
  };

  const handleRemoveSource = (index: number) => {
    const updated = sourcesVal.filter((_, i) => i !== index);
    handleChangeField("sources", updated);
  };

  // Custom attributes (excluding common fields)
  const commonFields = new Set([
    "category",
    "wikipedia_url",
    "acronym",
    "scope",
    "org_type",
    "website_url",
    "tier",
    "gender",
    "url",
    "antibot",
    "depth",
    "use_healer",
    "sources"
  ]);

  const customEntries = Object.entries(node.data).filter(([k]) => !commonFields.has(k));

  return (
    <div className="w-84 bg-[#0C1226]/95 border-l border-[#1E293B] flex flex-col h-full z-30 shadow-2xl backdrop-blur-md transition-all duration-300">
      {/* Drawer Header */}
      <div className="h-12 px-4 border-b border-[#1E293B] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold uppercase tracking-wider">
          <Sliders className="h-3.5 w-3.5 text-sky-400" /> Node Inspector
        </div>
        <div className="flex items-center gap-1">
          {onCenterNode && (
            <button
              onClick={() => onCenterNode(node.id)}
              title="Center Canvas on this Node"
              className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <Compass className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? "Inspector is Pinned" : "Pin Inspector Open"}
            className={`p-1 rounded-lg transition flex items-center gap-1 text-[11px] ${
              isPinned ? "text-sky-400 bg-sky-950/60 border border-sky-800" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onClose}
            title="Close inspector (Esc)"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition flex items-center gap-1 text-[11px]"
          >
            <span className="text-[10px] text-slate-500 font-mono">Esc</span>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1E293B] bg-slate-950/60 px-3 pt-2 gap-1 text-xs">
        <button
          onClick={() => setActiveTab("fields")}
          className={`px-3 py-1.5 rounded-t-lg font-medium transition ${
            activeTab === "fields"
              ? "bg-[#0C1226] text-sky-400 border-t border-x border-[#1E293B]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Properties
        </button>
        <button
          onClick={() => setActiveTab("wires")}
          className={`px-3 py-1.5 rounded-t-lg font-medium transition flex items-center gap-1 ${
            activeTab === "wires"
              ? "bg-[#0C1226] text-sky-400 border-t border-x border-[#1E293B]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Wires ({incomingEdges.length + outgoingEdges.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("json");
            setJsonText(JSON.stringify(node.data, null, 2));
            setJsonError(null);
          }}
          className={`px-3 py-1.5 rounded-t-lg font-medium transition flex items-center gap-1 ${
            activeTab === "json"
              ? "bg-[#0C1226] text-sky-400 border-t border-x border-[#1E293B]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Code className="h-3 w-3" /> JSON
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node Identification Card */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-mono">Node Type</span>
              <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">{node.type}</span>
            </div>
            <select
              value={node.status || "idle"}
              onChange={e => handleStatusChange(e.target.value as NodeData["status"])}
              className="bg-slate-950 border border-slate-700 text-slate-300 text-[10px] rounded px-2 py-1 font-mono"
            >
              <option value="idle">Status: Idle</option>
              <option value="running">Status: Running</option>
              <option value="completed">Status: Completed</option>
              <option value="failed">Status: Failed</option>
            </select>
          </div>

          <div className="text-[10px] text-slate-500 font-mono truncate">
            ID: <span className="text-slate-400">{node.id}</span>
          </div>
        </div>

        {/* Tab 1: Structured Fields */}
        {activeTab === "fields" && (
          <div className="space-y-3.5">
            {/* Common Label Field */}
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Display Title / Name</label>
              <input
                type="text"
                value={node.label || ""}
                onChange={e => handleChangeField("label", e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Dynamic Fields by Node Type */}
            {node.type === "sport" && (
              <>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Category</label>
                  <input
                    type="text"
                    value={categoryVal}
                    onChange={e => handleChangeField("category", e.target.value)}
                    placeholder="e.g. Winter Sports, Team Sports"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Wikipedia URL / Slug</label>
                  <input
                    type="text"
                    value={wikiVal}
                    onChange={e => handleChangeField("wikipedia_url", e.target.value)}
                    placeholder="https://en.wikipedia.org/wiki/..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-[11px]"
                  />
                </div>
              </>
            )}

            {node.type === "organization" && (
              <>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Acronym</label>
                  <input
                    type="text"
                    value={acronymVal}
                    onChange={e => handleChangeField("acronym", e.target.value)}
                    placeholder="e.g. WCF, WTT"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Scope</label>
                  <select
                    value={scopeVal}
                    onChange={e => handleChangeField("scope", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="international">International</option>
                    <option value="national">National</option>
                    <option value="regional">Regional</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Organization Type</label>
                  <select
                    value={orgTypeVal}
                    onChange={e => handleChangeField("org_type", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="governing_body">Governing Body</option>
                    <option value="federation">National Federation</option>
                    <option value="league">Professional League</option>
                    <option value="association">Association</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Official Website URL</label>
                  <input
                    type="text"
                    value={websiteUrlVal}
                    onChange={e => handleChangeField("website_url", e.target.value)}
                    placeholder="https://official-org.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-[11px]"
                  />
                </div>
              </>
            )}

            {node.type === "competition" && (
              <>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Tier Level</label>
                  <select
                    value={tierVal}
                    onChange={e => handleChangeField("tier", parseNumberInput(e.target.value, 1))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value={1}>Tier 1 (World / Olympic / Premier)</option>
                    <option value={2}>Tier 2 (National / Tour)</option>
                    <option value={3}>Tier 3 (Regional / Circuit)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Gender Division</label>
                  <select
                    value={genderVal}
                    onChange={e => handleChangeField("gender", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="men">Men&apos;s</option>
                    <option value="women">Women&apos;s</option>
                    <option value="mixed">Mixed / Open</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Competition Website URL</label>
                  <input
                    type="text"
                    value={compUrlVal}
                    onChange={e => handleChangeField("url", e.target.value)}
                    placeholder="https://competition-site.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-[11px]"
                  />
                </div>
              </>
            )}

            {/* Embedded Web Sources & Scraper Strategies for Organization & Competition */}
            {(node.type === "organization" || node.type === "competition") && (
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                    <Globe className="h-3.5 w-3.5 text-sky-400" />
                    <span>Target Web Sources ({sourcesVal.length})</span>
                  </div>
                  <button
                    onClick={handleAddSource}
                    className="px-2 py-1 bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 rounded text-[10px] font-medium flex items-center gap-1 transition"
                  >
                    <Plus className="h-3 w-3" /> Add Source
                  </button>
                </div>

                {sourcesVal.length === 0 ? (
                  <div className="p-3 bg-slate-900/60 border border-dashed border-slate-800 rounded-xl text-center space-y-2 text-xs text-slate-500">
                    <p className="text-[11px]">No target calendar or event URLs attached yet.</p>
                    <button
                      onClick={handleAddSource}
                      className="px-2.5 py-1 bg-sky-900/40 hover:bg-sky-900/70 border border-sky-700/60 text-sky-300 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 transition"
                    >
                      <Plus className="h-3 w-3" /> Add Target URL &amp; Scraper
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sourcesVal.map((src, idx) => (
                      <div
                        key={src.id || idx}
                        className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <input
                            type="text"
                            value={src.label || ""}
                            onChange={e => handleUpdateSource(idx, "label", e.target.value)}
                            placeholder="e.g. Official Calendar"
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 font-medium w-full focus:outline-none focus:border-sky-500"
                          />
                          <button
                            onClick={() => handleRemoveSource(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                            title="Remove Source"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Target Scrape URL</label>
                          <input
                            type="text"
                            value={src.url || ""}
                            onChange={e => handleUpdateSource(idx, "url", e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Anti-Bot Level</label>
                            <select
                              value={src.antibot || "none"}
                              onChange={e => handleUpdateSource(idx, "antibot", e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-300 font-mono"
                            >
                              <option value="none">Standard HTTP</option>
                              <option value="cloud-flare">Cloudflare / Stealth</option>
                              <option value="playwright">Playwright Chrome</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Crawl Depth</label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={src.depth ?? 2}
                              onChange={e => handleUpdateSource(idx, "depth", parseNumberInput(e.target.value, 2))}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-300"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Zap className="h-3 w-3 text-rose-400" /> LLM Auto-Healer
                          </span>
                          <input
                            type="checkbox"
                            checked={src.use_healer !== false}
                            onChange={e => handleUpdateSource(idx, "use_healer", e.target.checked)}
                            className="h-3.5 w-3.5 rounded accent-sky-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {node.type === "web_source" && (
              <>
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-mono font-semibold">Target URL / Domain</label>
                  <input
                    type="text"
                    value={compUrlVal}
                    onChange={e => handleChangeField("url", e.target.value)}
                    placeholder="https://worldcurling.org/events"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Anti-Bot Protection Level</label>
                  <select
                    value={antibotVal}
                    onChange={e => handleChangeField("antibot", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  >
                    <option value="none">Standard HTTP (Fast)</option>
                    <option value="cloud-flare">Cloudflare / Stealth</option>
                    <option value="playwright">Playwright Headless Chrome</option>
                  </select>
                </div>
              </>
            )}

            {node.type === "scraper_config" && (
              <>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Crawl Depth Limit</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={depthVal}
                    onChange={e => handleChangeField("depth", parseNumberInput(e.target.value, 2))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-300">Enable LLM Auto-Healer</span>
                  <input
                    type="checkbox"
                    checked={healerVal}
                    onChange={e => handleChangeField("use_healer", e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-500"
                  />
                </div>
              </>
            )}

            {/* Custom Key-Value Attributes */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Custom Attributes
              </span>

              {customEntries.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800 text-xs">
                  <span className="font-mono text-sky-400 text-[11px] min-w-[70px] truncate">{k}:</span>
                  <span className="text-slate-300 text-[11px] flex-1 truncate">{String(v)}</span>
                  <button
                    onClick={() => handleRemoveCustomMeta(k)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder="key"
                  value={newMetaKey}
                  onChange={e => setNewMetaKey(e.target.value)}
                  className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 font-mono"
                />
                <input
                  type="text"
                  placeholder="value"
                  value={newMetaVal}
                  onChange={e => setNewMetaVal(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100"
                />
                <button
                  onClick={handleAddCustomMeta}
                  disabled={!newMetaKey.trim()}
                  className="p-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded transition"
                  title="Add Attribute"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Connected Wires */}
        {activeTab === "wires" && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-2 font-semibold">
                Incoming Wires ({incomingEdges.length})
              </span>
              {incomingEdges.length === 0 && (
                <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 text-slate-500 text-[11px]">
                  No incoming wires.
                </div>
              )}
              <div className="space-y-1.5">
                {incomingEdges.map(edge => {
                  const srcNode = nodes.find(n => n.id === edge.source);
                  return (
                    <div key={edge.id} className="p-2 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <button
                          onClick={() => onSelectNode?.(edge.source)}
                          className="font-medium text-sky-400 hover:underline truncate"
                        >
                          {srcNode?.label || edge.source}
                        </button>
                        <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                          {edge.label || "connects"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDisconnectEdge(edge.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                        title="Disconnect Wire"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-2 font-semibold">
                Outgoing Wires ({outgoingEdges.length})
              </span>
              {outgoingEdges.length === 0 && (
                <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 text-slate-500 text-[11px]">
                  No outgoing wires.
                </div>
              )}
              <div className="space-y-1.5">
                {outgoingEdges.map(edge => {
                  const tgtNode = nodes.find(n => n.id === edge.target);
                  return (
                    <div key={edge.id} className="p-2 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                          {edge.label || "connects"}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                        <button
                          onClick={() => onSelectNode?.(edge.target)}
                          className="font-medium text-sky-400 hover:underline truncate"
                        >
                          {tgtNode?.label || edge.target}
                        </button>
                      </div>
                      <button
                        onClick={() => handleDisconnectEdge(edge.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                        title="Disconnect Wire"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Raw JSON Editor */}
        {activeTab === "json" && (
          <div className="space-y-2">
            <textarea
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              rows={12}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-[11px] font-mono text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {jsonError && (
              <div className="p-2 bg-rose-950/50 border border-rose-800 rounded text-[11px] text-rose-300">
                {jsonError}
              </div>
            )}
            <button
              onClick={handleApplyJson}
              className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition"
            >
              Apply JSON Changes
            </button>
          </div>
        )}

        {/* Node Health Notice */}
        {incomingEdges.length + outgoingEdges.length === 0 && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <span>This node is currently isolated with 0 wire connections. Connect it to integrate into intake.</span>
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          {onDuplicateNode && (
            <button
              onClick={() => onDuplicateNode(node.id)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition"
            >
              <Copy className="h-3 w-3" /> Duplicate
            </button>
          )}

          {onDeleteNode && (
            <button
              onClick={() => onDeleteNode(node.id)}
              className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <Trash2 className="h-3 w-3" /> Delete Node
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
