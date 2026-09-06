"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import NodeCanvas, { NodeData, EdgeData, WebSourceConfig } from "./NodeCanvas";
import NodeInspector from "./NodeInspector";
import FormBuilder from "./FormBuilder";
import SportSelectorModal from "./SportSelectorModal";
import NodeFilterBar, { FilterMode } from "./NodeFilterBar";
import ExportImportModal from "./ExportImportModal";
import DiagnosticsDrawer from "./DiagnosticsDrawer";
import { runGraphDiagnostics, DiagnosticItem } from "./graphDiagnostics";
import { SPORT_TEMPLATES, normalizeGraph } from "./templates";
import {
  Network,
  Play,
  RefreshCw,
  Bot,
  Send,
  SlidersHorizontal,
  Sparkles,
  LayoutGrid,
  Download,
  ShieldCheck,
  PanelRightClose,
  PanelRightOpen,
  Terminal,
  Paperclip,
  FileText,
  Loader2,
  X,
  Zap
} from "lucide-react";

/** Stable-keyed log entry for React reconciliation */
interface LogEntry {
  id: string;
  text: string;
}

/** Minimal typed shape for useChat messages */
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: unknown[];
  text?: string;
  [key: string]: unknown;
}

interface HistorySnapshot {
  nodes: NodeData[];
  edges: EdgeData[];
}

export default function SportBuilderStudio() {
  const searchParams = useSearchParams();
  const sportParam = searchParams.get("sport");
  const drawerParam = searchParams.get("drawer");
  const modalParam = searchParams.get("modal");

  const [viewMode, setViewMode] = useState<"canvas" | "form" | "split">("canvas");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Initial Nodes & Edges (matched from sportParam or Curling default)
  const [nodes, setNodes] = useState<NodeData[]>(() => {
    const initialTmpl = (sportParam && SPORT_TEMPLATES.find(
      t => t.id.toLowerCase() === sportParam.toLowerCase() ||
           t.name.toLowerCase().includes(sportParam.toLowerCase())
    )) || SPORT_TEMPLATES[0];
    return normalizeGraph(initialTmpl.nodes, initialTmpl.edges).nodes;
  });

  const [edges, setEdges] = useState<EdgeData[]>(() => {
    const initialTmpl = (sportParam && SPORT_TEMPLATES.find(
      t => t.id.toLowerCase() === sportParam.toLowerCase() ||
           t.name.toLowerCase().includes(sportParam.toLowerCase())
    )) || SPORT_TEMPLATES[0];
    return normalizeGraph(initialTmpl.nodes, initialTmpl.edges).edges;
  });

  const [currentSportBadge, setCurrentSportBadge] = useState<string>(() => {
    const initialTmpl = (sportParam && SPORT_TEMPLATES.find(
      t => t.id.toLowerCase() === sportParam.toLowerCase() ||
           t.name.toLowerCase().includes(sportParam.toLowerCase())
    )) || SPORT_TEMPLATES[0];
    return initialTmpl.name.split(" ")[0];
  });

  // Undo / Redo History Stack
  const [history, setHistory] = useState<HistorySnapshot[]>(() => [
    { nodes, edges }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = useCallback((newNodes: NodeData[], newEdges: EdgeData[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, { nodes: newNodes, edges: newEdges }];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleUpdateNodes = useCallback((newNodes: NodeData[], addToHistory = true) => {
    setNodes(newNodes);
    if (addToHistory) {
      pushHistory(newNodes, edges);
    }
  }, [edges, pushHistory]);

  const handleUpdateEdges = useCallback((newEdges: EdgeData[], addToHistory = true) => {
    setEdges(newEdges);
    if (addToHistory) {
      pushHistory(nodes, newEdges);
    }
  }, [nodes, pushHistory]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setNodes(prev.nodes);
      setEdges(prev.edges);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setNodes(next.nodes);
      setEdges(next.edges);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [history, historyIndex]);

  // Modals & Panels State (initialized with query param support)
  const [isExportImportOpen, setIsExportImportOpen] = useState(() => modalParam === "export");
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(() => drawerParam === "diagnostics");
  const [isAssistantExpanded, setIsAssistantExpanded] = useState(() => drawerParam !== "collapsed");
  const [assistantTab, setAssistantTab] = useState<"chat" | "logs">("chat");

  // Adjust state during render when URL query params change (React 19 recommended pattern)
  const [prevSportParam, setPrevSportParam] = useState(sportParam);
  if (sportParam !== prevSportParam) {
    setPrevSportParam(sportParam);
    if (sportParam) {
      const match = SPORT_TEMPLATES.find(
        t => t.id.toLowerCase() === sportParam.toLowerCase() ||
             t.name.toLowerCase().includes(sportParam.toLowerCase())
      );
      if (match) {
        const normalized = normalizeGraph(match.nodes, match.edges);
        setNodes(normalized.nodes);
        setEdges(normalized.edges);
        setCurrentSportBadge(match.name.split(" ")[0]);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setHistory([{ nodes: normalized.nodes, edges: normalized.edges }]);
        setHistoryIndex(0);
      }
    }
  }

  const [prevDrawerParam, setPrevDrawerParam] = useState(drawerParam);
  if (drawerParam !== prevDrawerParam) {
    setPrevDrawerParam(drawerParam);
    if (drawerParam === "copilot") {
      setIsAssistantExpanded(true);
      setAssistantTab("chat");
    } else if (drawerParam === "diagnostics") {
      setIsDiagnosticsOpen(true);
    }
  }

  const [prevModalParam, setPrevModalParam] = useState(modalParam);
  if (modalParam !== prevModalParam) {
    setPrevModalParam(modalParam);
    if (modalParam === "export") {
      setIsExportImportOpen(true);
    }
  }

  // Filter State
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(["sport", "organization", "competition", "web_source", "scraper_config"])
  );
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [filterMode, setFilterMode] = useState<FilterMode>("dim");
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);

  // Real-time Graph Diagnostics
  const diagnosticReport = useMemo(() => runGraphDiagnostics(nodes, edges), [nodes, edges]);

  // Filter Nodes & Edges
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      const matchType = selectedTypes.has(n.type);
      const matchStatus = selectedStatus === "all" || n.status === selectedStatus;
      const matchOrphan = !showOrphansOnly || diagnosticReport.orphanNodeIds.has(n.id);
      const matchQuery =
        !filterQuery ||
        n.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
        n.id.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (n.data && JSON.stringify(n.data).toLowerCase().includes(filterQuery.toLowerCase()));
      return matchType && matchStatus && matchOrphan && matchQuery;
    });
  }, [nodes, selectedTypes, selectedStatus, showOrphansOnly, filterQuery, diagnosticReport.orphanNodeIds]);

  const matchingNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const displayNodes = filterMode === "hide" ? filteredNodes : nodes;
  const displayEdges =
    filterMode === "hide"
      ? edges.filter(e => matchingNodeIds.has(e.source) && matchingNodeIds.has(e.target))
      : edges;

  // Pipeline Execution State
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryLog, setDiscoveryLog] = useState<LogEntry[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logBatchRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Template / Sport Loaders
  const handleLoadTemplate = useCallback((templateId: string) => {
    const tmpl = SPORT_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return;
    const normalized = normalizeGraph(tmpl.nodes, tmpl.edges);
    setNodes(normalized.nodes);
    setEdges(normalized.edges);
    setCurrentSportBadge(tmpl.name.split(" ")[0]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    pushHistory(normalized.nodes, normalized.edges);
  }, [pushHistory]);

  const handleLoadSport = async (sportId: string, sportName: string) => {
    try {
      const res = await fetch(`/api/knowledge-graph/sports/${sportId}/graph`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load sport graph`);
      const data = await res.json();

      const rawNodes = Array.isArray(data?.nodes) ? (data.nodes as Record<string, unknown>[]) : [];
      const rawEdges = Array.isArray(data?.edges) ? (data.edges as Record<string, unknown>[]) : [];

      const sanitizedNodes: NodeData[] = rawNodes.map(n => ({
        id: String(n.id || `node_${crypto.randomUUID()}`),
        type: (typeof n.type === "string" && ["sport", "organization", "competition", "web_source", "scraper_config"].includes(n.type)
          ? n.type
          : "organization") as NodeData["type"],
        label: String(n.label || "Unnamed Node"),
        x: typeof n.x === "number" ? n.x : 200,
        y: typeof n.y === "number" ? n.y : 200,
        data: n.data && typeof n.data === "object" ? (n.data as Record<string, unknown>) : {},
        status: (n.status as NodeData["status"]) || "idle"
      }));

      const sanitizedEdges: EdgeData[] = rawEdges.map(e => ({
        id: String(e.id || `edge_${crypto.randomUUID()}`),
        source: String(e.source || ""),
        target: String(e.target || ""),
        label: String(e.label || "connects")
      }));

      const normalized = normalizeGraph(sanitizedNodes, sanitizedEdges);
      setNodes(normalized.nodes);
      setEdges(normalized.edges);
      setCurrentSportBadge(sportName);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      pushHistory(normalized.nodes, normalized.edges);
    } catch (err) {
      console.error("Error loading sport graph:", err);
    }
  };

  const handleImportGraph = (importedNodes: NodeData[], importedEdges: EdgeData[], importedSportName?: string) => {
    const normalized = normalizeGraph(importedNodes, importedEdges);
    setNodes(normalized.nodes);
    setEdges(normalized.edges);
    if (importedSportName) setCurrentSportBadge(importedSportName);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    pushHistory(normalized.nodes, normalized.edges);
  };

  // Node Actions
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
      x: 350 + Math.random() * 120,
      y: 150 + Math.random() * 120,
      data: {}
    };

    const updated = [...nodes, newNode];
    setNodes(updated);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    pushHistory(updated, edges);
  };

  const handleDuplicateNode = (nodeId: string) => {
    const target = nodes.find(n => n.id === nodeId);
    if (!target) return;
    const newNode: NodeData = {
      ...target,
      id: `${target.type}_${crypto.randomUUID()}`,
      label: `${target.label} (Copy)`,
      x: target.x + 50,
      y: target.y + 50,
      data: { ...target.data }
    };
    const updated = [...nodes, newNode];
    setNodes(updated);
    setSelectedNodeId(newNode.id);
    pushHistory(updated, edges);
  };

  const handleDeleteNode = (nodeId: string) => {
    const updatedNodes = nodes.filter(n => n.id !== nodeId);
    const updatedEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    pushHistory(updatedNodes, updatedEdges);
  };

  const handleUpdateNode = (updatedNode: NodeData) => {
    const updated = nodes.map(n => (n.id === updatedNode.id ? updatedNode : n));
    setNodes(updated);
    pushHistory(updated, edges);
  };

  // Diagnostics Auto-Fix
  const handleAutoFix = (item: DiagnosticItem) => {
    if (item.fixAction === "connect_to_sport" && item.nodeId) {
      const sportNode = nodes.find(n => n.type === "sport");
      if (sportNode) {
        const newEdge: EdgeData = {
          id: `edge_${crypto.randomUUID()}`,
          source: sportNode.id,
          target: item.nodeId,
          label: "governed by"
        };
        const updatedEdges = [...edges, newEdge];
        setEdges(updatedEdges);
        pushHistory(nodes, updatedEdges);
      }
    }
  };

  // Run Intake Pipeline
  const handleRunPipeline = async () => {
    const sportNode = nodes.find(n => n.type === "sport");
    const sportName = sportNode?.label || currentSportBadge || "Curling";

    setIsDiscovering(true);
    logBatchRef.current += 1;
    setDiscoveryLog([{ id: `init_${logBatchRef.current}`, text: "Initiating Sport Intake Workflow..." }]);
    setAssistantTab("logs");

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

      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/v1/discovery/status/${data.job_id}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.logs && Array.isArray(statusData.logs)) {
              const batch = logBatchRef.current;
              setDiscoveryLog(
                (statusData.logs as string[]).map((text: string, i: number) => ({
                  id: `srv_${batch}_${i}`,
                  text
                }))
              );
            }
            if (statusData.status === "completed" || statusData.status === "failed") {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setIsDiscovering(false);
              setNodes(prev =>
                prev.map(n => ({ ...n, status: statusData.status === "completed" ? "completed" : "failed" }))
              );
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

  // Copilot Chat
  const [chatInput, setChatInput] = useState("");
  const chat = (useChat as (...args: unknown[]) => Record<string, unknown>)({ api: "/api/chat" });
  const messages: ChatMessage[] = (Array.isArray(chat?.messages) ? chat.messages : []) as ChatMessage[];
  const chatStatus = String(chat?.status ?? "ready");
  const isLoading = chatStatus === "submitted" || chatStatus === "streaming";
  const processedToolCallIdsRef = useRef<Set<string>>(new Set());

  // Automatically convert AI tool calls into visual graph nodes & edges
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!Array.isArray(chat?.messages)) return;
    for (const rawMsg of chat.messages) {
      const msg = rawMsg as Record<string, unknown>;
      const parts = (msg.parts || msg.toolInvocations || msg.toolCalls || []) as Record<string, unknown>[];
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        const toolCall = (part.toolInvocation || part) as Record<string, unknown>;
        const toolName = String(toolCall?.toolName || part?.toolName || "");
        const args = toolCall?.args as Record<string, unknown> | undefined;
        if (!toolName || !args) continue;

        const callId = String(toolCall.toolCallId || toolCall.id || JSON.stringify({ toolName, args }));
        if (processedToolCallIdsRef.current.has(callId)) continue;
        processedToolCallIdsRef.current.add(callId);

        if (toolName === "submit_sport_info") {
          const sportName = String(args.sport_name || "New Sport");
          const wikiTitle = String(args.wiki_title || "");
          const orgs = Array.isArray(args.major_orgs) ? (args.major_orgs as (string | Record<string, unknown>)[]) : [];

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

          orgs.forEach((org, idx) => {
            const orgName = typeof org === "string" ? org : String(org?.name || `Organization ${idx + 1}`);
            const orgId = `org_${crypto.randomUUID()}`;
            const orgData: Record<string, unknown> = typeof org === "object" && org !== null ? { ...org } : {};

            const sources: WebSourceConfig[] = Array.isArray(orgData.sources) ? [...(orgData.sources as WebSourceConfig[])] : [];
            if (sources.length === 0 && orgData.website_url && typeof orgData.website_url === "string") {
              sources.push({
                id: `src_${crypto.randomUUID().slice(0, 8)}`,
                label: `${orgName} Official Web`,
                url: orgData.website_url,
                antibot: "none",
                depth: 2,
                use_healer: true,
                status: "idle"
              });
            }
            orgData.sources = sources;

            newOrgNodes.push({
              id: orgId,
              type: "organization",
              label: orgName,
              x: 450,
              y: 100 + idx * 140,
              data: orgData
            });
            newEdges.push({
              id: `edge_${crypto.randomUUID()}`,
              source: sportNodeId,
              target: orgId,
              label: "governed by"
            });
          });

          const nextNodes = [...nodes, newSportNode, ...newOrgNodes];
          const nextEdges = [...edges, ...newEdges];
          setNodes(nextNodes);
          setEdges(nextEdges);
          pushHistory(nextNodes, nextEdges);
          setSelectedNodeId(sportNodeId);
        } else if (toolName === "add_nodes_and_edges") {
          const rawNodes = Array.isArray(args.nodes) ? (args.nodes as Record<string, unknown>[]) : [];
          const rawEdges = Array.isArray(args.edges) ? (args.edges as Record<string, unknown>[]) : [];

          const labelToIdMap = new Map<string, string>();
          nodes.forEach(n => {
            labelToIdMap.set(n.label.toLowerCase(), n.id);
            labelToIdMap.set(n.id.toLowerCase(), n.id);
          });

          const createdNodes: NodeData[] = [];
          rawNodes.forEach((n, idx) => {
            const nodeType = (typeof n.type === "string" && ["sport", "organization", "competition", "web_source", "scraper_config"].includes(n.type)
              ? n.type
              : "organization") as NodeData["type"];
            const nodeId = `${nodeType}_${crypto.randomUUID()}`;
            const label = String(n.label || `Node ${idx + 1}`);
            labelToIdMap.set(label.toLowerCase(), nodeId);
            labelToIdMap.set(nodeId.toLowerCase(), nodeId);

            const nodeData: Record<string, unknown> = typeof n.data === "object" && n.data !== null ? { ...n.data } : {};
            if (Array.isArray(nodeData.sources)) {
              nodeData.sources = (nodeData.sources as Record<string, unknown>[]).map((s, sIdx: number) => ({
                id: typeof s.id === "string" ? s.id : `src_${crypto.randomUUID().slice(0, 8)}`,
                label: typeof s.label === "string" ? s.label : `Source ${sIdx + 1}`,
                url: typeof s.url === "string" ? s.url : "",
                antibot: typeof s.antibot === "string" && ["none", "cloud-flare", "playwright"].includes(s.antibot) ? (s.antibot as WebSourceConfig["antibot"]) : "none",
                depth: typeof s.depth === "number" ? s.depth : 2,
                use_healer: s.use_healer !== false,
                status: "idle"
              }));
            } else if (nodeData.website_url && typeof nodeData.website_url === "string" && (nodeType === "organization" || nodeType === "competition")) {
              nodeData.sources = [{
                id: `src_${crypto.randomUUID().slice(0, 8)}`,
                label: `${label} Calendar/Events`,
                url: nodeData.website_url,
                antibot: "none",
                depth: 2,
                use_healer: true,
                status: "idle"
              }];
            }

            createdNodes.push({
              id: nodeId,
              type: nodeType,
              label,
              x: 350 + (idx % 3) * 240,
              y: 120 + Math.floor(idx / 3) * 160,
              data: nodeData
            });
          });

          const createdEdges: EdgeData[] = [];
          rawEdges.forEach(e => {
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

          const nextNodes = [...nodes, ...createdNodes];
          const nextEdges = [...edges, ...createdEdges];
          setNodes(nextNodes);
          setEdges(nextEdges);
          pushHistory(nextNodes, nextEdges);
        } else if (toolName === "delete_nodes") {
          const rawTargets = Array.isArray(args.node_labels_or_ids) ? (args.node_labels_or_ids as string[]) : [];
          const targets = rawTargets.map(t => String(t).toLowerCase());
          const nextNodes = nodes.filter(
            n => !targets.includes(n.id.toLowerCase()) && !targets.includes(n.label.toLowerCase())
          );
          const nextEdges = edges.filter(e => {
            const srcNode = nodes.find(n => n.id === e.source);
            const tgtNode = nodes.find(n => n.id === e.target);
            const srcMatch =
              targets.includes(e.source.toLowerCase()) ||
              (srcNode && targets.includes(srcNode.label.toLowerCase()));
            const tgtMatch =
              targets.includes(e.target.toLowerCase()) ||
              (tgtNode && targets.includes(tgtNode.label.toLowerCase()));
            return !srcMatch && !tgtMatch;
          });
          setNodes(nextNodes);
          setEdges(nextEdges);
          pushHistory(nextNodes, nextEdges);
        }
      }
    }
  }, [chat?.messages, nodes, edges, pushHistory]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Document Ingestion State
  const [attachedDoc, setAttachedDoc] = useState<{
    name: string;
    size: number;
    text: string;
    pageCount?: number;
  } | null>(null);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-document", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to parse document");
      }

      const data = await res.json();
      setAttachedDoc({
        name: data.filename || file.name,
        size: file.size,
        text: data.text || "",
        pageCount: data.pageCount
      });
      setAssistantTab("chat");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error parsing document: ${msg}`);
    } finally {
      setIsParsingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSendChat = (textToSend?: string) => {
    let text = (textToSend || chatInput).trim();
    if ((!text && !attachedDoc) || isLoading) return;

    if (attachedDoc) {
      const docHeader = `[Attached Document: "${attachedDoc.name}" (${attachedDoc.pageCount ? `${attachedDoc.pageCount} pages, ` : ''}${Math.round(attachedDoc.text.length / 1000)}k chars)]\n${attachedDoc.text}\n\n`;
      text = text ? `${docHeader}User Instructions: ${text}` : `${docHeader}Please ingest this document and construct the sport, organizations, competitions, and embedded scraper source nodes on the canvas.`;
      setAttachedDoc(null);
    }

    setChatInput("");
    if (typeof chat?.sendMessage === "function") {
      (chat.sendMessage as (msg: { text: string }) => void)({ text });
    } else if (typeof chat?.append === "function") {
      (chat.append as (msg: { role: string; content: string }) => void)({ role: "user", content: text });
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  return (
    <div className="flex-1 bg-[#070A14] text-slate-100 flex flex-col h-full overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-14 border-b border-[#1E293B] bg-[#0C1226]/90 backdrop-blur-md px-5 flex items-center justify-between shrink-0 z-30">
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

        {/* Center Actions: Sport Selector & View Modes */}
        <div className="flex items-center gap-3">
          <SportSelectorModal
            currentSportName={currentSportBadge}
            onSelectSport={handleLoadSport}
            onSelectTemplate={handleLoadTemplate}
          />

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 p-1 rounded-xl shadow-inner">
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
        </div>

        {/* Right Actions: Diagnostics, Export, Run, Links */}
        <div className="flex items-center gap-2.5">
          {/* Diagnostics Button */}
          <button
            onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition flex items-center gap-1.5 ${
              diagnosticReport.isValid
                ? diagnosticReport.warningCount === 0
                  ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                  : "bg-amber-950/60 border-amber-800 text-amber-300 hover:bg-amber-900/60"
                : "bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/60"
            }`}
            title="Inspect graph diagnostics and validation"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Diagnostics</span>
            {!diagnosticReport.isValid ? (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            ) : diagnosticReport.warningCount > 0 ? (
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            ) : null}
          </button>

          {/* Export / Import Button */}
          <button
            onClick={() => setIsExportImportOpen(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium rounded-xl transition flex items-center gap-1.5"
            title="Export or Import graph schema"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export / Import</span>
          </button>

          {/* Run Intake Pipeline */}
          <button
            onClick={handleRunPipeline}
            disabled={isDiscovering}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-600 hover:from-emerald-400 hover:to-sky-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-teal-500/20 flex items-center gap-2 disabled:opacity-50 transition"
          >
            {isDiscovering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {isDiscovering ? "Running Discovery..." : "Run Intake Pipeline"}
          </button>

          {/* Assistant Toggle */}
          <button
            onClick={() => setIsAssistantExpanded(!isAssistantExpanded)}
            title={isAssistantExpanded ? "Collapse Assistant" : "Expand Assistant"}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl border border-slate-800 transition"
          >
            {isAssistantExpanded ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>

          <Link
            href={`/?sport=${currentSportBadge.toLowerCase()}`}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-xs font-medium text-emerald-300 hover:text-white flex items-center gap-1.5 transition ml-1 shadow-xs"
            title="Open sport in Pipeline Operations"
          >
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Pipeline Ops</span>
          </Link>
        </div>
      </header>

      {/* Main Studio Body */}
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
          nodes={nodes}
          orphanCount={diagnosticReport.orphanNodeIds.size}
          showOrphansOnly={showOrphansOnly}
          setShowOrphansOnly={setShowOrphansOnly}
        />

        <div className="flex-1 flex overflow-hidden relative">
          {/* Canvas / Form Workspace Area */}
          <div className="flex-1 flex overflow-hidden">
            {(viewMode === "canvas" || viewMode === "split") && (
              <NodeCanvas
                nodes={displayNodes}
                edges={displayEdges}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                onSelectNode={id => {
                  setSelectedNodeId(id);
                  if (id) setSelectedEdgeId(null);
                }}
                onSelectEdge={id => {
                  setSelectedEdgeId(id);
                  if (id) setSelectedNodeId(null);
                }}
                onUpdateNodes={handleUpdateNodes}
                onUpdateEdges={handleUpdateEdges}
                onAddNode={handleAddNode}
                onDuplicateNode={handleDuplicateNode}
                isDiscovering={isDiscovering}
                matchingNodeIds={filterMode === "dim" ? matchingNodeIds : undefined}
                orphanNodeIds={diagnosticReport.orphanNodeIds}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
              />
            )}

            {(viewMode === "form" || viewMode === "split") && (
              <FormBuilder
                nodes={displayNodes}
                edges={displayEdges}
                onUpdateNodes={handleUpdateNodes}
                onUpdateEdges={handleUpdateEdges}
                onLocateOnCanvas={nodeId => {
                  setSelectedNodeId(nodeId);
                  setViewMode("canvas");
                }}
              />
            )}
          </div>

          {/* Node Inspector Drawer */}
          {selectedNode && (
            <NodeInspector
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              onClose={() => setSelectedNodeId(null)}
              onUpdateNode={handleUpdateNode}
              onUpdateEdges={handleUpdateEdges}
              onSelectNode={id => setSelectedNodeId(id)}
              onDuplicateNode={handleDuplicateNode}
              onDeleteNode={handleDeleteNode}
              onCenterNode={id => setSelectedNodeId(id)}
            />
          )}

          {/* Right Assistant / Live Logs Panel */}
          {isAssistantExpanded && (
            <div className="w-84 border-l border-[#1E293B] bg-[#0C1226]/90 backdrop-blur-md flex flex-col shrink-0">
              {/* Tabs: AI Copilot vs. Live Stream */}
              <div className="h-12 px-3 border-b border-[#1E293B] flex items-center justify-between shrink-0 bg-slate-950/40">
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setAssistantTab("chat")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                      assistantTab === "chat" ? "bg-slate-800 text-sky-400 shadow-sm" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Bot className="h-3.5 w-3.5" /> Copilot
                  </button>
                  <button
                    onClick={() => setAssistantTab("logs")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                      assistantTab === "logs" ? "bg-slate-800 text-emerald-400 shadow-sm" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Terminal className="h-3.5 w-3.5" /> Logs {discoveryLog.length > 0 && `(${discoveryLog.length})`}
                  </button>
                </div>
                <button
                  onClick={() => setIsAssistantExpanded(false)}
                  className="p-1 text-slate-500 hover:text-slate-300 rounded"
                  title="Collapse Panel"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Tab 1: AI Copilot */}
              {assistantTab === "chat" && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                    {messages.length === 0 && (
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400 space-y-2.5">
                        <div className="flex items-center gap-2 font-semibold text-slate-200">
                          <Bot className="h-4 w-4 text-indigo-400" /> Intake Copilot Ready
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Ask me to research, build, or modify any sport graph structure with live canvas controls:
                        </p>
                        <div className="space-y-1.5 pt-1">
                          <button
                            onClick={() => handleSendChat("Add World Curling and Curling Canada to the graph")}
                            className="w-full text-left p-2 rounded-lg bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-sky-300 text-[11px] transition"
                          >
                            ⚡ &quot;Add World Curling &amp; Curling Canada&quot;
                          </button>
                          <button
                            onClick={() => handleSendChat("Add Disc Golf with PDGA and DGPT leagues")}
                            className="w-full text-left p-2 rounded-lg bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-sky-300 text-[11px] transition"
                          >
                            ⚡ &quot;Add Disc Golf with PDGA &amp; DGPT&quot;
                          </button>
                          <button
                            onClick={() => handleSendChat("Add web calendar source for events")}
                            className="w-full text-left p-2 rounded-lg bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-sky-300 text-[11px] transition"
                          >
                            ⚡ &quot;Add web calendar source for events&quot;
                          </button>
                        </div>
                      </div>
                    )}

                    {messages.map(msg => {
                      const getMessageText = (m: unknown): string => {
                        if (!m || typeof m !== "object") return "";
                        const rec = m as Record<string, unknown>;
                        if (typeof rec.content === "string" && rec.content.trim()) return rec.content;
                        if (Array.isArray(rec.parts)) {
                          const texts = (rec.parts as Record<string, unknown>[])
                            .filter(p => p && (p.type === "text" || (p.text && p.type !== "reasoning")))
                            .map(p => String(p.text || ""))
                            .filter(Boolean)
                            .join("\n");
                          if (texts.trim()) return texts;
                        }
                        if (typeof rec.text === "string" && rec.text.trim()) return rec.text;
                        return "";
                      };

                      const textContent = getMessageText(msg);
                      if (!textContent) return null;

                      return (
                        <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`p-3 rounded-2xl max-w-[88%] ${
                              msg.role === "user"
                                ? "bg-sky-600 text-white shadow-md"
                                : "bg-slate-900 border border-slate-800 text-slate-200"
                            }`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{textContent}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chat Input */}
                  <div className="p-3 border-t border-[#1E293B] bg-[#070A14]">
                    {attachedDoc && (
                      <div className="mb-2 p-2 rounded-xl bg-sky-950/60 border border-sky-800 flex items-center justify-between gap-2 text-xs animate-in fade-in">
                        <div className="flex items-center gap-2 text-sky-200 truncate font-mono text-[11px]">
                          <FileText className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                          <span className="truncate">{attachedDoc.name}</span>
                          <span className="text-[10px] text-sky-400/70 shrink-0">
                            ({attachedDoc.pageCount ? `${attachedDoc.pageCount} pgs` : `${Math.round(attachedDoc.size / 1024)} KB`})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachedDoc(null)}
                          className="p-0.5 text-slate-400 hover:text-white rounded"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        handleSendChat();
                      }}
                      className="relative flex items-center gap-1.5"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.csv,.md,.json"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || isParsingDoc}
                        title="Upload PDF, TXT, CSV, or MD document"
                        className="p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-900 border border-slate-800 rounded-xl transition shrink-0"
                      >
                        {isParsingDoc ? (
                          <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                        ) : (
                          <Paperclip className="h-4 w-4" />
                        )}
                      </button>

                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          disabled={isLoading}
                          placeholder={attachedDoc ? "Add instruction (or press Enter)..." : "Instruct Copilot or paste list..."}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        <button
                          type="submit"
                          disabled={isLoading || (!chatInput.trim() && !attachedDoc)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-sky-500 text-white rounded-lg hover:bg-sky-400 disabled:opacity-50 transition"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Tab 2: Live Pipeline Logs */}
              {assistantTab === "logs" && (
                <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-semibold text-slate-300 text-xs">Pipeline Execution Stream</span>
                    <button
                      onClick={() => setDiscoveryLog([])}
                      className="text-[10px] text-slate-500 hover:text-slate-300"
                    >
                      Clear Logs
                    </button>
                  </div>

                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-sky-400 overflow-y-auto space-y-1">
                    {discoveryLog.length === 0 ? (
                      <div className="text-slate-600 text-center py-8 font-sans">
                        No active pipeline running. Click &quot;Run Intake Pipeline&quot; to initiate discovery.
                      </div>
                    ) : (
                      discoveryLog.map(entry => (
                        <div key={entry.id} className="leading-relaxed break-words">
                          &gt; {entry.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Diagnostics Drawer */}
      <DiagnosticsDrawer
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        report={diagnosticReport}
        onSelectNode={nodeId => {
          setSelectedNodeId(nodeId);
          setIsDiagnosticsOpen(false);
        }}
        onAutoFix={handleAutoFix}
      />

      {/* Export / Import Modal */}
      <ExportImportModal
        isOpen={isExportImportOpen}
        onClose={() => setIsExportImportOpen(false)}
        nodes={nodes}
        edges={edges}
        sportName={currentSportBadge}
        onImportGraph={handleImportGraph}
      />
    </div>
  );
}
