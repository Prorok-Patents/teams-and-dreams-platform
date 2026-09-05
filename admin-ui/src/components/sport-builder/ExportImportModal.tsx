"use client";

import React, { useState } from "react";
import { NodeData, EdgeData, WebSourceConfig } from "./NodeCanvas";
import { normalizeGraph } from "./templates";
import {
  Download,
  Upload,
  Copy,
  Check,
  FileCode,
  X,
  FileText,
  AlertCircle
} from "lucide-react";

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NodeData[];
  edges: EdgeData[];
  sportName: string;
  onImportGraph: (nodes: NodeData[], edges: EdgeData[], sportName?: string) => void;
}

export default function ExportImportModal({
  isOpen,
  onClose,
  nodes,
  edges,
  sportName,
  onImportGraph
}: ExportImportModalProps) {
  const [tab, setTab] = useState<"export" | "import">("export");
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const graphPayload = {
    sportName,
    exportedAt: new Date().toISOString(),
    nodes,
    edges
  };

  const jsonString = JSON.stringify(graphPayload, null, 2);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // ignore
    }
  };

  const generateMarkdownSummary = () => {
    const sportNode = nodes.find(n => n.type === "sport");
    const orgs = nodes.filter(n => n.type === "organization");
    const comps = nodes.filter(n => n.type === "competition");
    const sites = nodes.filter(n => n.type === "web_source");

    let md = `# Sport Intake Graph: ${sportNode?.label || sportName}\n\n`;
    md += `**Total Nodes:** ${nodes.length} | **Wires:** ${edges.length}\n\n`;

    md += `## Organizations (${orgs.length})\n`;
    orgs.forEach(o => {
      md += `- **${o.label}** (${o.data.acronym || "No acronym"}) - Scope: ${o.data.scope || "N/A"} - Web: ${o.data.website_url || "N/A"}\n`;
      const sources = Array.isArray(o.data.sources) ? (o.data.sources as WebSourceConfig[]) : [];
      if (sources.length > 0) {
        sources.forEach(s => {
          md += `  * 🌐 ${s.label || "Source"}: ${s.url} (Anti-Bot: ${s.antibot || "none"}, Depth: ${s.depth || 2}, Healer: ${s.use_healer !== false ? "ON" : "OFF"})\n`;
        });
      }
    });

    md += `\n## Competitions (${comps.length})\n`;
    comps.forEach(c => {
      md += `- **${c.label}** (Tier ${c.data.tier || 1}) - URL: ${c.data.url || "N/A"}\n`;
      const sources = Array.isArray(c.data.sources) ? (c.data.sources as WebSourceConfig[]) : [];
      if (sources.length > 0) {
        sources.forEach(s => {
          md += `  * 🌐 ${s.label || "Source"}: ${s.url} (Anti-Bot: ${s.antibot || "none"}, Depth: ${s.depth || 2}, Healer: ${s.use_healer !== false ? "ON" : "OFF"})\n`;
        });
      }
    });

    if (sites.length > 0) {
      md += `\n## Legacy Web Crawl Nodes (${sites.length})\n`;
      sites.forEach(s => {
        md += `- **${s.label}** - URL: ${s.data.url || "N/A"} (Anti-Bot: ${s.data.antibot || "none"})\n`;
      });
    }

    md += `\n## Relationship Paths (${edges.length})\n`;
    edges.forEach(e => {
      const src = nodes.find(n => n.id === e.source)?.label || e.source;
      const tgt = nodes.find(n => n.id === e.target)?.label || e.target;
      md += `- [${src}] --(${e.label || "connects"})--> [${tgt}]\n`;
    });

    return md;
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(generateMarkdownSummary());
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sport-intake-${sportName.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    try {
      setImportError(null);
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error("Invalid payload: Must contain 'nodes' and 'edges' arrays.");
      }
      const normalized = normalizeGraph(parsed.nodes, parsed.edges);
      onImportGraph(normalized.nodes, normalized.edges, parsed.sportName);
      onClose();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Failed to parse JSON file.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result;
      if (typeof content === "string") {
        setImportText(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#0C1226] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2 font-semibold text-slate-100 text-sm">
            <FileCode className="h-4 w-4 text-sky-400" /> Export & Import Graph Schema
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 text-xs">
          <button
            onClick={() => setTab("export")}
            className={`flex-1 py-2.5 font-medium transition flex items-center justify-center gap-1.5 ${
              tab === "export"
                ? "text-sky-400 border-b-2 border-sky-500 bg-slate-900/80"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Download className="h-3.5 w-3.5" /> Export Schema
          </button>
          <button
            onClick={() => setTab("import")}
            className={`flex-1 py-2.5 font-medium transition flex items-center justify-center gap-1.5 ${
              tab === "import"
                ? "text-sky-400 border-b-2 border-sky-500 bg-slate-900/80"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="h-3.5 w-3.5" /> Import JSON
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {tab === "export" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadJson}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" /> Download JSON File
                </button>
                <button
                  onClick={handleCopyJson}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl font-medium flex items-center gap-1.5 transition"
                >
                  {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedJson ? "Copied JSON!" : "Copy JSON"}
                </button>
                <button
                  onClick={handleCopyMarkdown}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl font-medium flex items-center gap-1.5 transition"
                >
                  {copiedMd ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <FileText className="h-3.5 w-3.5" />}
                  {copiedMd ? "Copied Markdown!" : "Copy Markdown Summary"}
                </button>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[11px]">JSON Payload Preview</label>
                <textarea
                  readOnly
                  value={jsonString}
                  rows={10}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-sky-300 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 block mb-1">Upload JSON File or Paste Payload</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer mb-2"
                />
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder="Paste exported JSON here..."
                  rows={10}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              {importError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <button
                onClick={handleImportSubmit}
                disabled={!importText.trim()}
                className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl disabled:opacity-40 transition shadow-lg shadow-emerald-500/20"
              >
                Apply & Replace Graph Canvas
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
