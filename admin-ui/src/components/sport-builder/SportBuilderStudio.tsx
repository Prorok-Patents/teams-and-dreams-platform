"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import NodeCanvas, { NodeData, EdgeData } from "./NodeCanvas";
import NodeInspector from "./NodeInspector";
import FormBuilder from "./FormBuilder";
import SportSelectorModal from "./SportSelectorModal";
import NodeFilterBar, { FilterMode } from "./NodeFilterBar";
import {
  Network,
  Play,
  RefreshCw,
  Bot,
  Send,
  SlidersHorizontal,
  Sparkles,
  CheckCircle,
  AlertCircle,
  LayoutGrid
} from "lucide-react";

/** Stable-keyed log entry for React reconciliation */
interface LogEntry {
  id: string;
  text: string;
}

/** Minimal typed shape for useChat messages (SDK types are unstable in v7) */
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export default function SportBuilderStudio() {
  const [viewMode, setViewMode] = useState<"quick" | "canvas" | "form" | "split">("canvas");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Default Nodes State
  const [nodes, setNodes] = useState<NodeData[]>([
    {
      id: "sport_curling",
      type: "sport",
      label: "Curling",
      x: 100,
      y: 180,
      data: { category: "Winter Sports", wikipedia_url: "https://en.wikipedia.org/wiki/Curling" }
    },
    {
      id: "org_wcf",
      type: "organization",
      label: "World Curling",
      x: 420,
      y: 100,
      data: { acronym: "WCF", scope: "international", org_type: "governing_body", website_url: "https://worldcurling.org" }
    },
    {
      id: "org_curling_canada",
      type: "organization",
      label: "Curling Canada",
      x: 420,
      y: 260,
      data: { acronym: "CC", scope: "national", org_type: "federation", website_url: "https://curling.ca" }
    },
    {
      id: "comp_brier",
      type: "competition",
      label: "The Montana's Brier",
      x: 740,
      y: 260,
      data: { tier: 1, gender: "men", url: "https://curling.ca/brier" }
    },
    {
      id: "site_wcf_events",
      type: "web_source",
      label: "World Curling Events Calendar",
      x: 740,
      y: 100,
      data: { url: "https://worldcurling.org/events", antibot: "none" }
    }
  ]);

  // Default Connections
  const [edges, setEdges] = useState<EdgeData[]>([
    { id: "e1", source: "sport_curling", target: "org_wcf", label: "governed by" },
    { id: "e2", source: "sport_curling", target: "org_curling_canada", label: "governed by" },
    { id: "e3", source: "org_wcf", target: "site_wcf_events", label: "publishes" },
    { id: "e4", source: "org_curling_canada", target: "comp_brier", label: "sanctions" }
  ]);

  // Filter State
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(["sport", "organization", "competition", "web_source", "scraper_config"]));
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [filterMode, setFilterMode] = useState<FilterMode>("dim");
  const [currentSportBadge, setCurrentSportBadge] = useState<string>("Draft");

  const handleLoadSport = async (sportId: string, sportName: string) => {
    try {
      const res = await fetch(`/api/knowledge-graph/sports/${sportId}/graph`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load sport graph`);
      const data = await res.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawNodes = Array.isArray(data?.nodes) ? data.nodes : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawEdges = Array.isArray(data?.edges) ? data.edges : [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sanitizedNodes: NodeData[] = rawNodes.map((n: any) => ({
        id: String(n.id || `node_${crypto.randomUUID()}`),
        type: (["sport", "organization", "competition", "web_source", "scraper_config"].includes(n.type) ? n.type : "organization") as NodeData["type"],
        label: String(n.label || "Unnamed Node"),
        x: typeof n.x === "number" ? n.x : 200,
        y: typeof n.y === "number" ? n.y : 200,
        data: n.data && typeof n.data === "object" ? n.data : {},
        status: n.status || "idle"
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sanitizedEdges: EdgeData[] = rawEdges.map((e: any) => ({
        id: String(e.id || `edge_${crypto.randomUUID()}`),
        source: String(e.source || ""),
        target: String(e.target || ""),
        label: String(e.label || "connects")
      }));

      setNodes(sanitizedNodes);
      setEdges(sanitizedEdges);
      setCurrentSportBadge(sportName);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    } catch (err) {
      console.error("Error loading sport graph:", err);
    }
  };

  // Compute filtered nodes
  const filteredNodes = nodes.filter(n => {
    const matchType = selectedTypes.has(n.type);
    const matchStatus = selectedStatus === "all" || n.status === selectedStatus;
    const matchQuery = !filterQuery || 
      n.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
      n.id.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (n.data && JSON.stringify(n.data).toLowerCase().includes(filterQuery.toLowerCase()));
    return matchType && matchStatus && matchQuery;
  });

  const matchingNodeIds = new Set(filteredNodes.map(n => n.id));

  // If filterMode === "hide", we only pass the matching nodes/edges down to canvas and form.
  const displayNodes = filterMode === "hide" ? filteredNodes : nodes;
  const displayEdges = filterMode === "hide" 
    ? edges.filter(e => matchingNodeIds.has(e.source) && matchingNodeIds.has(e.target))
    : edges;

  // Execution & Logs
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryLog, setDiscoveryLog] = useState<LogEntry[]>([]);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; warnings: string[]; errors: string[] } | null>(null);

  // Interval Ref for status polling cleanup
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Counter ref for deterministic server-log IDs (append-only list, indices are stable)
  const logBatchRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Copilot Chat
  const [chatInput, setChatInput] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chat = (useChat as (...args: unknown[]) => Record<string, unknown>)({ api: "/api/chat" });
  const messages: ChatMessage[] = (Array.isArray(chat?.messages) ? chat.messages : []) as ChatMessage[];
  const chatStatus = String(chat?.status ?? "ready");
  const isLoading = chatStatus === "submitted" || chatStatus === "streaming";

  // Track processed tool call IDs to prevent duplicate graph additions
  const processedToolCallIdsRef = useRef<Set<string>>(new Set());

  // Automatically convert AI tool calls into visual graph nodes & edges
  useEffect(() => {
    if (!Array.isArray(chat?.messages)) return;
    for (const msg of chat.messages as any[]) {
      const parts = msg.parts || msg.toolInvocations || msg.toolCalls || [];
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        const toolCall = part.toolInvocation || part;
        const toolName = toolCall?.toolName || part?.toolName;
        const args = toolCall?.args;
        if (!toolName || !args) continue;

        const callId = String(toolCall.toolCallId || toolCall.id || JSON.stringify({ toolName, args }));
        if (processedToolCallIdsRef.current.has(callId)) continue;
        processedToolCallIdsRef.current.add(callId);

        if (toolName === 'submit_sport_info') {
          const sportName = String(args.sport_name || "New Sport");
          const wikiTitle = String(args.wiki_title || "");
          const orgs = Array.isArray(args.major_orgs) ? args.major_orgs : [];

          const sportNodeId = `sport_${crypto.randomUUID()}`;
          const newSportNode: NodeData = {
            id: sportNodeId,
            type: "sport",
            label: sportName,
            x: 150,
            y: 180,
            data: { wikipedia_url: wikiTitle ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}` : "" }
          };

          const newOrgNodes: NodeData[] = [];
          const newEdges: EdgeData[] = [];

          orgs.forEach((org: any, idx: number) => {
            const orgName = typeof org === 'string' ? org : String(org?.name || `Organization ${idx + 1}`);
            const orgId = `org_${crypto.randomUUID()}`;
            newOrgNodes.push({
              id: orgId,
              type: "organization",
              label: orgName,
              x: 450,
              y: 100 + idx * 140,
              data: typeof org === 'object' && org !== null ? org : {}
            });
            newEdges.push({
              id: `edge_${crypto.randomUUID()}`,
              source: sportNodeId,
              target: orgId,
              label: "governed by"
            });
          });

          setNodes(prev => [...prev, newSportNode, ...newOrgNodes]);
          setEdges(prev => [...prev, ...newEdges]);
          setSelectedNodeId(sportNodeId);
          setDiscoveryLog(prev => [...prev, {
            id: `ai_${crypto.randomUUID()}`,
            text: `🤖 Intake Copilot automatically created nodes for '${sportName}' (${newOrgNodes.length} Orgs)`
          }]);
        } else if (toolName === 'add_nodes_and_edges') {
          const rawNodes = Array.isArray(args.nodes) ? args.nodes : [];
          const rawEdges = Array.isArray(args.edges) ? args.edges : [];

          const labelToIdMap = new Map<string, string>();
          nodes.forEach(n => {
            labelToIdMap.set(n.label.toLowerCase(), n.id);
            labelToIdMap.set(n.id.toLowerCase(), n.id);
          });

          const createdNodes: NodeData[] = [];
          rawNodes.forEach((n: any, idx: number) => {
            const nodeId = `${n.type || "org"}_${crypto.randomUUID()}`;
            const label = String(n.label || `Node ${idx + 1}`);
            labelToIdMap.set(label.toLowerCase(), nodeId);
            labelToIdMap.set(nodeId.toLowerCase(), nodeId);

            createdNodes.push({
              id: nodeId,
              type: n.type || "organization",
              label,
              x: 350 + (idx % 3) * 240,
              y: 120 + Math.floor(idx / 3) * 160,
              data: typeof n.data === "object" && n.data !== null ? n.data : {}
            });
          });

          const createdEdges: EdgeData[] = [];
          rawEdges.forEach((e: any) => {
            const srcId = labelToIdMap.get(String(e.source_label || "").toLowerCase());
            const tgtId = labelToIdMap.get(String(e.target_label || "").toLowerCase());
            if (srcId && tgtId && srcId !== tgtId) {
              createdEdges.push({
                id: `edge_${crypto.randomUUID()}`,
                source: srcId,
                target: tgtId,
                label: String(e.label || "connects")
              });
            }
          });

          setNodes(prev => [...prev, ...createdNodes]);
          setEdges(prev => [...prev, ...createdEdges]);
          setDiscoveryLog(prev => [...prev, {
            id: `ai_${crypto.randomUUID()}`,
            text: `🤖 AI Assistant placed ${createdNodes.length} nodes & ${createdEdges.length} wires on the canvas.`
          }]);
        } else if (toolName === 'delete_nodes') {
          const targets = (Array.isArray(args.node_labels_or_ids) ? args.node_labels_or_ids : []).map((t: any) => String(t).toLowerCase());
          setNodes(prev => prev.filter(n => !targets.includes(n.id.toLowerCase()) && !targets.includes(n.label.toLowerCase())));
          setEdges(prev => prev.filter(e => {
            const srcNode = nodes.find(n => n.id === e.source);
            const tgtNode = nodes.find(n => n.id === e.target);
            const srcMatch = targets.includes(e.source.toLowerCase()) || (srcNode && targets.includes(srcNode.label.toLowerCase()));
            const tgtMatch = targets.includes(e.target.toLowerCase()) || (tgtNode && targets.includes(tgtNode.label.toLowerCase()));
            return !srcMatch && !tgtMatch;
          }));
          setDiscoveryLog(prev => [...prev, {
            id: `ai_${crypto.randomUUID()}`,
            text: `🤖 AI Assistant removed nodes matching: ${targets.join(", ")}`
          }]);
        } else if (toolName === 'update_node') {
          const target = String(args.target_label_or_id || "").toLowerCase();
          const newLabel = args.new_label;
          const dataUpdates = typeof args.data_updates === "object" && args.data_updates !== null ? args.data_updates : {};

          setNodes(prev => prev.map(n => {
            if (n.id.toLowerCase() === target || n.label.toLowerCase() === target) {
              return {
                ...n,
                label: newLabel ? String(newLabel) : n.label,
                data: { ...n.data, ...dataUpdates }
              };
            }
            return n;
          }));
          setDiscoveryLog(prev => [...prev, {
            id: `ai_${crypto.randomUUID()}`,
            text: `🤖 AI Assistant updated node '${args.target_label_or_id}'`
          }]);
        }
      }
    }
  }, [chat?.messages, nodes]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isLoading) return;
    setChatInput("");
    if (typeof chat?.sendMessage === "function") {
      (chat.sendMessage as (msg: { text: string }) => void)({ text });
    }
  };

  const handleAddNode = (type: NodeData["type"]) => {
    const id = `${type}_${crypto.randomUUID()}`;
    const labels = {
      sport: "New Sport",
      organization: "New Organization",
      competition: "New Competition",
      web_source: "New Web Source",
      scraper_config: "Scraper Strategy"
    };

    const newNode: NodeData = {
      id,
      type,
      label: labels[type],
      x: 400 + Math.random() * 100,
      y: 150 + Math.random() * 100,
      data: {}
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  const handleUpdateNode = (updatedNode: NodeData) => {
    setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
  };

  const handleValidateGraph = async () => {
    try {
      const res = await fetch("/api/v1/discovery/validate-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges })
      });
      if (res.ok) {
        const data = await res.json();
        setValidationResult(data);
      } else {
        setValidationResult({
          valid: false,
          warnings: [],
          errors: [`HTTP Error ${res.status}: ${res.statusText}`]
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Backend unreachable";
      setValidationResult({
        valid: false,
        warnings: [],
        errors: [`Connection failed: ${msg}`]
      });
    }
  };

  const handleRunPipeline = async () => {
    const sportNode = nodes.find(n => n.type === "sport");
    const sportName = sportNode?.label || "Curling";
    
    setIsDiscovering(true);
    logBatchRef.current += 1;
    setDiscoveryLog([{ id: `init_${logBatchRef.current}`, text: "Initiating Sport Intake Workflow..." }]);
    
    // Mark nodes as running
    setNodes(prev => prev.map(n => ({ ...n, status: "running" })));

    try {
      const res = await fetch("/api/v1/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport_name: sportName,
          wiki_title: sportNode?.data.wikipedia_url || null,
          graph_nodes: nodes.map(n => ({ id: n.id, type: n.type, label: n.label, data: n.data })),
          graph_edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
          force_rediscover: true
        })
      });

      if (!res.ok) throw new Error("Failed to trigger pipeline");
      const data = await res.json();
      setDiscoveryLog(prev => [...prev, { id: `job_${data.job_id}`, text: `Pipeline job active: ${data.job_id}` }]);

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      // Poll discovery status safely
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/v1/discovery/status/${data.job_id}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.logs && Array.isArray(statusData.logs)) {
              // Server logs are append-only; use batch + index for stable keys
              const batch = logBatchRef.current;
              setDiscoveryLog((statusData.logs as string[]).map((text: string, i: number) => ({
                id: `srv_${batch}_${i}`,
                text
              })));
            }
            if (statusData.status === "completed" || statusData.status === "failed") {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setIsDiscovering(false);
              setNodes(prev => prev.map(n => ({ ...n, status: statusData.status === "completed" ? "completed" : "failed" })));
            }
          }
        } catch {
          // ignore transient poll error
        }
      }, 2000);

    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Pipeline trigger error";
      setDiscoveryLog(prev => [...prev, { id: `err_${crypto.randomUUID()}`, text: `Error: ${errorMsg}` }]);
      setIsDiscovering(false);
      setNodes(prev => prev.map(n => ({ ...n, status: "failed" })));
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  return (
    <div className="flex-1 bg-[#070A14] text-slate-100 flex flex-col h-screen overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-[#1E293B] bg-[#0C1226]/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Network className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
              Sport Intake Studio
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-medium text-slate-300">
                {currentSportBadge}
              </span>
            </div>
          </div>
        </div>

        {/* Sport Selector */}
        <SportSelectorModal onSelectSport={handleLoadSport} />

        {/* View Mode Controls */}
        <div className="flex items-center bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setViewMode("canvas")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              viewMode === "canvas" ? "bg-sky-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Visual Canvas
          </button>
          <button
            onClick={() => setViewMode("form")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              viewMode === "form" ? "bg-sky-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Form View
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              viewMode === "split" ? "bg-sky-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Split View
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleValidateGraph}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition"
          >
            Validate Graph
          </button>

          <button
            onClick={handleRunPipeline}
            disabled={isDiscovering}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-600 hover:from-emerald-400 hover:to-sky-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-teal-500/20 flex items-center gap-2 disabled:opacity-50 transition"
          >
            {isDiscovering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {isDiscovering ? "Running Discovery..." : "Run Intake Pipeline"}
          </button>

          <Link href="/" className="text-xs text-sky-400 hover:underline ml-2">
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative flex-col">
        {/* Filter Bar */}
        <NodeFilterBar
          filterQuery={filterQuery}
          setFilterQuery={setFilterQuery}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          totalNodes={nodes.length}
          matchingNodes={filteredNodes.length}
        />

        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Side: Visual Canvas / Form Builder */}
          <div className="flex-1 flex overflow-hidden">
            {(viewMode === "canvas" || viewMode === "split") && (
              <NodeCanvas
                nodes={displayNodes}
                edges={displayEdges}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                onSelectNode={(id) => {
                  setSelectedNodeId(id);
                  if (id) setSelectedEdgeId(null);
                }}
                onSelectEdge={(id) => {
                  setSelectedEdgeId(id);
                  if (id) setSelectedNodeId(null);
                }}
                onUpdateNodes={setNodes}
                onUpdateEdges={setEdges}
                onAddNode={handleAddNode}
                isDiscovering={isDiscovering}
                matchingNodeIds={filterMode === "dim" ? matchingNodeIds : undefined}
              />
            )}

            {(viewMode === "form" || viewMode === "split") && (
              <FormBuilder
                nodes={displayNodes}
                edges={displayEdges}
                onUpdateNodes={setNodes}
                onUpdateEdges={setEdges}
              />
            )}
          </div>

        {/* Node Inspector Drawer */}
        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdateNode={handleUpdateNode}
          />
        )}

        {/* Right Side: Copilot Chat & Execution Logs Panel */}
        <div className="w-80 border-l border-[#1E293B] bg-[#0C1226]/80 backdrop-blur-md flex flex-col shrink-0">
          {/* Header */}
          <div className="h-12 px-4 border-b border-[#1E293B] flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-indigo-400" /> Intake Assistant
            </span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.length === 0 && (
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 space-y-2">
                <p className="font-medium text-slate-300">Intake Copilot ready!</p>
                <p>You can type natural instructions like:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                  <li>"Add World Curling and Curling Canada to the graph"</li>
                  <li>"Set website for Brier to curling.ca"</li>
                  <li>"Run intake for Disc Golf"</li>
                </ul>
              </div>
            )}

            {messages.map((msg) => {
              const getMessageText = (m: any): string => {
                if (typeof m.content === "string" && m.content.trim()) return m.content;
                if (Array.isArray(m.parts)) {
                  const texts = m.parts
                    .filter((p: any) => p.type === "text" || (p.text && p.type !== "reasoning"))
                    .map((p: any) => p.text)
                    .filter(Boolean)
                    .join("\n");
                  if (texts.trim()) return texts;
                }
                if (typeof m.text === "string" && m.text.trim()) return m.text;
                return "";
              };

              const textContent = getMessageText(msg);
              if (!textContent) return null;

              return (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-xl max-w-[85%] ${
                    msg.role === 'user' ? 'bg-sky-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-200'
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{textContent}</p>
                  </div>
                </div>
              );
            })}

            {/* Live Pipeline Execution Log Stream */}
            {discoveryLog.length > 0 && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-sky-400 space-y-1 max-h-48 overflow-y-auto">
                <div className="text-[10px] text-slate-500 font-sans uppercase font-bold border-b border-slate-800 pb-1 mb-1">
                  Live Intake Pipeline Stream
                </div>
                {discoveryLog.map((entry) => (
                  <div key={entry.id}>&gt; {entry.text}</div>
                ))}
              </div>
            )}

            {/* Graph Validation Output */}
            {validationResult && (
              <div className={`p-3 rounded-xl border text-xs ${
                validationResult.valid ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-red-950/40 border-red-800 text-red-300'
              }`}>
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  {validationResult.valid ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {validationResult.valid ? "Graph Validation Passed" : "Validation Errors"}
                </div>
                {validationResult.warnings.map((w, i) => (
                  <div key={`warn_${i}`} className="text-[11px] opacity-80">• {w}</div>
                ))}
                {validationResult.errors.map((e, i) => (
                  <div key={`err_${i}`} className="text-[11px] font-mono text-red-400">• {e}</div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-[#1E293B] bg-[#070A14]">
            <form onSubmit={handleSendChat} className="relative flex items-center">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isLoading}
                placeholder="Ask intake copilot..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <button
                type="submit"
                disabled={isLoading || !chatInput.trim()}
                className="absolute right-2 p-1.5 bg-sky-500 text-white rounded-lg hover:bg-sky-400 disabled:opacity-50 transition"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
