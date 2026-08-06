"use client";

import React, { useState } from "react";
import { NodeData } from "./NodeCanvas";
import { X, Sliders, Info, Pin, PinOff } from "lucide-react";

interface NodeInspectorProps {
  node: NodeData | null;
  onClose: () => void;
  onUpdateNode: (updatedNode: NodeData) => void;
}

export default function NodeInspector({ node, onClose, onUpdateNode }: NodeInspectorProps) {
  const [isPinned, setIsPinned] = useState(true);

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

  const parseNumberInput = (val: string, fallback: number) => {
    if (!val || isNaN(Number(val))) return fallback;
    return Number(val);
  };

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

  return (
    <div className="w-80 bg-[#0C1226]/95 border-l border-[#1E293B] flex flex-col h-full z-30 shadow-2xl backdrop-blur-md transition-all duration-300">
      {/* Drawer Header */}
      <div className="h-12 px-4 border-b border-[#1E293B] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold uppercase tracking-wider">
          <Sliders className="h-3.5 w-3.5 text-sky-400" /> Node Inspector
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? "Inspector is Pinned (Will stay open)" : "Pin Inspector open"}
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

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node Type Badge */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-mono mb-0.5">Node Type</span>
            <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">{node.type}</span>
          </div>
          {isPinned && (
            <span className="text-[10px] bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded-full font-mono">
              Pinned
            </span>
          )}
        </div>

        {/* Common Label Field */}
        <div>
          <label className="text-xs text-slate-400 block mb-1 font-medium">Title / Name</label>
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
              <label className="text-xs text-slate-400 block mb-1">Wikipedia URL</label>
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
              <label className="text-xs text-slate-400 block mb-1">Website URL</label>
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
                <option value="men">Men's</option>
                <option value="women">Women's</option>
                <option value="mixed">Mixed / Open</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Website URL</label>
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

        {node.type === "web_source" && (
          <>
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-mono font-bold">Target URL / Domain</label>
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

        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
          <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <span>Edits made in the inspector are synchronized across the graph and intake pipeline API payload in real time.</span>
        </div>
      </div>
    </div>
  );
}
