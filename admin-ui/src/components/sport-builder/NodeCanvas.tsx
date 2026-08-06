"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  Trophy,
  Building2,
  Swords,
  Globe,
  Zap,
  Plus,
  Trash2,
  Sparkles,
  Edit2,
  Check,
  ArrowLeftRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  LayoutGrid,
  Info,
  Compass
} from "lucide-react";

export interface NodeData {
  id: string;
  type: "sport" | "organization" | "competition" | "web_source" | "scraper_config";
  label: string;
  x: number;
  y: number;
  data: Record<string, unknown>;
  status?: "idle" | "running" | "completed" | "failed";
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface NodeCanvasProps {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onUpdateNodes: (nodes: NodeData[]) => void;
  onUpdateEdges: (edges: EdgeData[]) => void;
  onAddNode: (type: NodeData["type"]) => void;
  isDiscovering?: boolean;
  matchingNodeIds?: Set<string>;
}

const nodeTypeConfig = {
  sport: {
    title: "Sport Root",
    color: "from-purple-500 to-indigo-600",
    borderColor: "border-purple-500/50",
    bgDark: "bg-purple-950/40",
    badgeBg: "bg-purple-900/60 text-purple-300",
    icon: Trophy
  },
  organization: {
    title: "Organization",
    color: "from-emerald-500 to-teal-600",
    borderColor: "border-emerald-500/50",
    bgDark: "bg-emerald-950/40",
    badgeBg: "bg-emerald-900/60 text-emerald-300",
    icon: Building2
  },
  competition: {
    title: "Competition",
    color: "from-amber-500 to-orange-600",
    borderColor: "border-amber-500/50",
    bgDark: "bg-amber-950/40",
    badgeBg: "bg-amber-900/60 text-amber-300",
    icon: Swords
  },
  web_source: {
    title: "Web Source",
    color: "from-sky-500 to-blue-600",
    borderColor: "border-sky-500/50",
    bgDark: "bg-sky-950/40",
    badgeBg: "bg-sky-900/60 text-sky-300",
    icon: Globe
  },
  scraper_config: {
    title: "Scraper Config",
    color: "from-rose-500 to-pink-600",
    borderColor: "border-rose-500/50",
    bgDark: "bg-rose-950/40",
    badgeBg: "bg-rose-900/60 text-rose-300",
    icon: Zap
  }
};

const STANDARD_EDGE_LABELS = [
  "governed by",
  "sanctions",
  "publishes",
  "organizes",
  "operates",
  "connects",
  "scrapes"
];

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;
/** Default node width fallback (w-56 = 14rem = 224px) */
const DEFAULT_NODE_WIDTH = 224;
/** Default node height fallback (approx card height) */
const DEFAULT_NODE_HEIGHT = 90;

export default function NodeCanvas({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onUpdateNodes,
  onUpdateEdges,
  onAddNode,
  isDiscovering = false,
  matchingNodeIds
}: NodeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const zoomRef = useRef(1);
  const isSpacePressedRef = useRef(false);

  // Zoom & Pan States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Drag & Hover States
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Wire Connection States
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectingPort, setConnectingPort] = useState<"top" | "right" | "bottom" | "left">("right");
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Edge Editing State
  const [editingEdgeLabelId, setEditingEdgeLabelId] = useState<string | null>(null);
  const [customEdgeLabel, setCustomEdgeLabel] = useState<string>("");

  // ── O(1) node lookup map ─────────────────────────────────────────────
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // ── Auto-expanding canvas dimensions ─────────────────────────────────
  const canvasWidth = useMemo(() => {
    const maxX = nodes.reduce((max, n) => Math.max(max, n.x + 400), 0);
    return Math.max(2500, maxX);
  }, [nodes]);

  const canvasHeight = useMemo(() => {
    const maxY = nodes.reduce((max, n) => Math.max(max, n.y + 300), 0);
    return Math.max(1800, maxY);
  }, [nodes]);

  // ── Zoom helpers ─────────────────────────────────────────────────────
  const setZoomClamped = useCallback((val: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, val));
    zoomRef.current = clamped;
    setZoom(clamped);
  }, []);

  // Keyboard Space listener for Space+Drag Panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isSpacePressedRef.current && (e.target as HTMLElement)?.tagName !== "INPUT") {
        isSpacePressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpacePressedRef.current = false;
        setIsPanning(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Ctrl+Wheel zoom listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const currentZoom = zoomRef.current;
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom + delta));
        zoomRef.current = newZoom;
        setZoom(newZoom);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // ── Coordinate conversion (viewport → canvas-space with pan & zoom) ──
  const getCanvasPoint = useCallback((e: { clientX: number; clientY: number }) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoomRef.current,
      y: (e.clientY - rect.top - pan.y) / zoomRef.current
    };
  }, [pan.x, pan.y]);

  // ── Node ref setter ──────────────────────────────────────────────────
  const setNodeRef = useCallback((nodeId: string, el: HTMLDivElement | null) => {
    if (el) nodeRefsMap.current.set(nodeId, el);
    else nodeRefsMap.current.delete(nodeId);
  }, []);

  // ── Node Port Position Helper ─────────────────────────────────────────
  const getPortPosition = useCallback((nodeId: string, port: "top" | "right" | "bottom" | "left" = "right") => {
    const node = nodeMap.get(nodeId);
    if (!node) return { x: 0, y: 0 };

    const el = nodeRefsMap.current.get(nodeId);
    const w = el ? el.offsetWidth : DEFAULT_NODE_WIDTH;
    const h = el ? el.offsetHeight : DEFAULT_NODE_HEIGHT;

    switch (port) {
      case "top":
        return { x: node.x + w / 2, y: node.y };
      case "bottom":
        return { x: node.x + w / 2, y: node.y + h };
      case "left":
        return { x: node.x, y: node.y + h / 2 };
      case "right":
      default:
        return { x: node.x + w, y: node.y + h / 2 };
    }
  }, [nodeMap]);

  // ── Node center via actual DOM measurement ───────────────────────────
  const getNodeCenter = useCallback((nodeId: string) => {
    return getPortPosition(nodeId, "right");
  }, [getPortPosition]);

  // ── Global PointerUp & Escape Listener for Clean State Reset ─────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSelectNode(null);
        onSelectEdge(null);
        setEditingEdgeLabelId(null);
        setDraggingNodeId(null);
        setConnectingSourceId(null);
        setIsPanning(false);
      }
    };

    const handleWindowPointerUp = () => {
      setDraggingNodeId(null);
      setConnectingSourceId(null);
      setIsPanning(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [onSelectNode, onSelectEdge]);

  // ── Pointer handlers ─────────────────────────────────────────────────
  const handlePointerDownNode = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    // Persistent Selection: Select node and start dragging, do NOT toggle off on re-click!
    onSelectNode(nodeId);
    onSelectEdge(null);
    setDraggingNodeId(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      const pt = getCanvasPoint(e);
      setDragOffset({
        x: pt.x - node.x,
        y: pt.y - node.y
      });
    }
  };

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    // Middle-click (button === 1) or Space key held triggers canvas panning
    if (e.button === 1 || isSpacePressedRef.current || e.target === containerRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const pt = getCanvasPoint(e);
    setMousePos(pt);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (draggingNodeId) {
      const newNodes = nodes.map(n => {
        if (n.id === draggingNodeId) {
          return {
            ...n,
            x: Math.max(10, pt.x - dragOffset.x),
            y: Math.max(10, pt.y - dragOffset.y)
          };
        }
        return n;
      });
      onUpdateNodes(newNodes);
    }
  };

  const handlePointerUp = () => {
    setDraggingNodeId(null);
    setConnectingSourceId(null);
    setIsPanning(false);
  };

  const handleStartConnection = (e: React.PointerEvent, sourceId: string, port: "top" | "right" | "bottom" | "left" = "right") => {
    e.stopPropagation();
    setConnectingSourceId(sourceId);
    setConnectingPort(port);
  };

  const handleEndConnection = (e: React.PointerEvent, targetId: string) => {
    e.stopPropagation();
    if (connectingSourceId && connectingSourceId !== targetId) {
      const edgeExists = edges.some(edge => edge.source === connectingSourceId && edge.target === targetId);
      if (!edgeExists) {
        const newEdge: EdgeData = {
          id: `edge_${crypto.randomUUID()}`,
          source: connectingSourceId,
          target: targetId,
          label: "connects"
        };
        onUpdateEdges([...edges, newEdge]);
      }
    }
    setConnectingSourceId(null);
  };

  // ── Auto-Arrange Engine ──────────────────────────────────────────────
  const handleAutoArrange = useCallback(() => {
    const typeOrder: Record<string, number> = {
      sport: 0,
      organization: 1,
      competition: 2,
      web_source: 3,
      scraper_config: 4
    };

    const typeGroups: Record<number, NodeData[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    nodes.forEach(n => {
      const order = typeOrder[n.type] ?? 1;
      typeGroups[order].push(n);
    });

    const newNodes: NodeData[] = [];
    const colWidth = 340;
    const startX = 80;
    const startY = 100;
    const gapY = 160;

    Object.keys(typeGroups).forEach(groupKey => {
      const colIndex = Number(groupKey);
      const groupNodes = typeGroups[colIndex];
      groupNodes.forEach((node, idx) => {
        newNodes.push({
          ...node,
          x: startX + colIndex * colWidth,
          y: startY + idx * gapY
        });
      });
    });

    onUpdateNodes(newNodes);
  }, [nodes, onUpdateNodes]);

  // ── Fit View Engine ──────────────────────────────────────────────────
  const handleFitView = useCallback(() => {
    if (nodes.length === 0) {
      setPan({ x: 0, y: 0 });
      setZoomClamped(1);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + DEFAULT_NODE_WIDTH);
      maxY = Math.max(maxY, n.y + DEFAULT_NODE_HEIGHT);
    });

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth || 1000;
    const containerHeight = containerRef.current.clientHeight || 700;

    const scaleX = (containerWidth - 160) / graphWidth;
    const scaleY = (containerHeight - 160) / graphHeight;
    const newZoom = Math.min(1.2, Math.max(0.4, Math.min(scaleX, scaleY)));

    const newPanX = (containerWidth - graphWidth * newZoom) / 2 - minX * newZoom;
    const newPanY = (containerHeight - graphHeight * newZoom) / 2 - minY * newZoom;

    setZoomClamped(newZoom);
    setPan({ x: Math.max(-500, newPanX), y: Math.max(-500, newPanY) });
  }, [nodes, setZoomClamped]);

  // ── Node/Edge actions ────────────────────────────────────────────────
  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;
    const updatedNodes = nodes.filter(n => n.id !== selectedNodeId);
    const updatedEdges = edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);
    onUpdateNodes(updatedNodes);
    onUpdateEdges(updatedEdges);
    onSelectNode(null);
  };

  const handleDeleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    const updatedEdges = edges.filter(e => e.id !== selectedEdgeId);
    onUpdateEdges(updatedEdges);
    onSelectEdge(null);
    setEditingEdgeLabelId(null);
  };

  const handleReverseSelectedEdge = () => {
    if (!selectedEdgeId) return;
    const updatedEdges = edges.map(e =>
      e.id === selectedEdgeId
        ? { ...e, source: e.target, target: e.source }
        : e
    );
    onUpdateEdges(updatedEdges);
  };

  const handleUpdateEdgeLabel = (edgeId: string, label: string) => {
    const updatedEdges = edges.map(e => e.id === edgeId ? { ...e, label } : e);
    onUpdateEdges(updatedEdges);
    setEditingEdgeLabelId(null);
  };

  const hoveredNode = nodes.find(n => n.id === hoveredNodeId) || null;

  return (
    <div className="flex-1 flex flex-col bg-[#070A14] relative overflow-hidden select-none border-r border-[#1E293B]">
      {/* ── Canvas Toolbar Header ──────────────────────────────────── */}
      <div className="h-12 border-b border-[#1E293B] bg-[#0C1226]/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" /> Visual Canvas
          </span>

          <button
            onClick={() => onAddNode("organization")}
            className="px-2.5 py-1 text-xs bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-300 rounded-lg flex items-center gap-1 transition"
          >
            <Plus className="h-3 w-3" /> Org Node
          </button>
          <button
            onClick={() => onAddNode("competition")}
            className="px-2.5 py-1 text-xs bg-amber-950/70 hover:bg-amber-900 border border-amber-800/80 text-amber-300 rounded-lg flex items-center gap-1 transition"
          >
            <Plus className="h-3 w-3" /> Competition Node
          </button>
          <button
            onClick={() => onAddNode("web_source")}
            className="px-2.5 py-1 text-xs bg-sky-950/70 hover:bg-sky-900 border border-sky-800/80 text-sky-300 rounded-lg flex items-center gap-1 transition"
          >
            <Plus className="h-3 w-3" /> Web Source
          </button>
          <button
            onClick={() => onAddNode("scraper_config")}
            className="px-2.5 py-1 text-xs bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded-lg flex items-center gap-1 transition"
          >
            <Plus className="h-3 w-3" /> Scraper Config
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-Arrange Layout Button */}
          <button
            onClick={handleAutoArrange}
            title="Automatically align graph into organized columns"
            className="px-2.5 py-1 text-xs bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 rounded-lg flex items-center gap-1 transition"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Auto-Arrange
          </button>

          {/* Fit View Recenter Button */}
          <button
            onClick={handleFitView}
            title="Recenter and fit all nodes into view"
            className="px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg flex items-center gap-1 transition"
          >
            <Compass className="h-3.5 w-3.5" /> Fit View
          </button>

          {selectedNodeId && (
            <button
              onClick={handleDeleteSelectedNode}
              className="px-2.5 py-1 text-xs bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg flex items-center gap-1 transition"
            >
              <Trash2 className="h-3 w-3" /> Delete Node
            </button>
          )}

          {selectedEdgeId && (
            <>
              <button
                onClick={handleReverseSelectedEdge}
                className="px-2.5 py-1 text-xs bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 rounded-lg flex items-center gap-1 transition"
              >
                <ArrowLeftRight className="h-3 w-3" /> Reverse
              </button>
              <button
                onClick={handleDeleteSelectedEdge}
                className="px-2.5 py-1 text-xs bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg flex items-center gap-1 transition"
              >
                <Trash2 className="h-3 w-3" /> Delete Wire Edge
              </button>
            </>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2 ml-1">
            <button
              onClick={() => setZoomClamped(zoomRef.current - ZOOM_STEP)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-400 min-w-[3.5ch] text-center select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoomClamped(zoomRef.current + ZOOM_STEP)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setZoomClamped(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Reset view"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-mono px-2 py-1 bg-slate-900/60 rounded border border-slate-800">
            {nodes.length} Nodes • {edges.length} Wires
          </div>
        </div>
      </div>

      {/* ── Main Interactive Canvas ────────────────────────────────── */}
      <div
        ref={containerRef}
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={(e) => {
          if (e.target === containerRef.current) {
            onSelectNode(null);
            onSelectEdge(null);
            setEditingEdgeLabelId(null);
          }
        }}
        className={`flex-1 relative overflow-hidden select-none ${
          isPanning ? "cursor-grabbing" : isSpacePressedRef.current ? "cursor-grab" : "cursor-crosshair"
        }`}
        style={{
          backgroundImage: "radial-gradient(circle, #1e293b 1px, transparent 1px)",
          backgroundSize: "24px 24px"
        }}
      >
        {/* Transform Scale & Pan Layer */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position: "absolute",
            top: 0,
            left: 0,
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`
          }}
        >
          {/* SVG Connection Lines (z-0) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
              </marker>

              <marker
                id="arrowhead-selected"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
              </marker>
            </defs>

            {edges.map(edge => {
              const start = getNodeCenter(edge.source);
              const end = getNodeCenter(edge.target);

              const dx = end.x - start.x;
              const controlX1 = start.x + dx * 0.5;
              const controlY1 = start.y;
              const controlX2 = start.x + dx * 0.5;
              const controlY2 = end.y;

              const pathD = `M ${start.x} ${start.y} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${end.x} ${end.y}`;
              const isSelected = selectedEdgeId === edge.id;
              
              const isDimmed = matchingNodeIds !== undefined && (!matchingNodeIds.has(edge.source) || !matchingNodeIds.has(edge.target));

              return (
                <g key={edge.id}>
                  {/* Wide hit box */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(null);
                      onSelectEdge(edge.id);
                    }}
                  />

                  {/* Visible Edge Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isSelected ? "#38bdf8" : "#475569"}
                    strokeWidth={isSelected ? "3.5" : "2.5"}
                    markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                    className={`${isDiscovering ? "animate-pulse stroke-sky-400" : ""} transition-all duration-300 ${isDimmed ? "opacity-15" : "opacity-100"}`}
                  />
                </g>
              );
            })}

            {/* Active Wire Drag Line */}
            {connectingSourceId && (
              <path
                d={`M ${getPortPosition(connectingSourceId, connectingPort).x} ${getPortPosition(connectingSourceId, connectingPort).y} L ${mousePos.x} ${mousePos.y}`}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2.5"
                strokeDasharray="4 4"
              />
            )}
          </svg>

          {/* Edge Labels & Edit Popovers Overlay (z-5) */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
            {edges.map(edge => {
              const start = getNodeCenter(edge.source);
              const end = getNodeCenter(edge.target);
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;
              const isSelected = selectedEdgeId === edge.id;
              const isEditing = editingEdgeLabelId === edge.id;
              const isDimmed = matchingNodeIds !== undefined && (!matchingNodeIds.has(edge.source) || !matchingNodeIds.has(edge.target));

              return (
                <div
                  key={`label_${edge.id}`}
                  style={{
                    position: "absolute",
                    left: `${midX}px`,
                    top: `${midY}px`,
                    transform: "translate(-50%, -50%)"
                  }}
                  className={`pointer-events-auto flex items-center gap-1 transition-all duration-300 ${isDimmed ? "opacity-15 grayscale" : "opacity-100"}`}
                >
                  {!isEditing ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNode(null);
                        onSelectEdge(edge.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingEdgeLabelId(edge.id);
                        setCustomEdgeLabel(edge.label || "connects");
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono tracking-tight border transition flex items-center gap-1 shadow-sm ${
                        isSelected
                          ? "bg-sky-950 border-sky-400 text-sky-200 ring-2 ring-sky-400/40"
                          : "bg-slate-900/90 border-slate-700 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <span>{edge.label || "connects"}</span>
                      {isSelected && (
                        <Edit2
                          className="h-2.5 w-2.5 ml-0.5 text-sky-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEdgeLabelId(edge.id);
                            setCustomEdgeLabel(edge.label || "connects");
                          }}
                        />
                      )}
                    </button>
                  ) : (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="bg-slate-900 border border-sky-500 p-1.5 rounded-xl shadow-2xl flex items-center gap-1.5"
                      style={{ zIndex: 30 }}
                    >
                      <select
                        value={STANDARD_EDGE_LABELS.includes(customEdgeLabel) ? customEdgeLabel : "custom"}
                        onChange={(e) => {
                          if (e.target.value !== "custom") {
                            setCustomEdgeLabel(e.target.value);
                            handleUpdateEdgeLabel(edge.id, e.target.value);
                          }
                        }}
                        className="bg-slate-950 text-slate-200 border border-slate-700 rounded text-[11px] px-1.5 py-1"
                      >
                        {STANDARD_EDGE_LABELS.map(lbl => (
                          <option key={lbl} value={lbl}>{lbl}</option>
                        ))}
                        <option value="custom">Custom...</option>
                      </select>

                      <input
                        type="text"
                        value={customEdgeLabel}
                        onChange={(e) => setCustomEdgeLabel(e.target.value)}
                        placeholder="relationship..."
                        className="w-24 bg-slate-950 text-slate-100 border border-slate-700 rounded px-2 py-0.5 text-[11px]"
                      />

                      <button
                        onClick={() => handleUpdateEdgeLabel(edge.id, customEdgeLabel || "connects")}
                        className="p-1 bg-sky-600 hover:bg-sky-500 text-white rounded"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Nodes Layer (z-10) */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {nodes.map(node => {
              const cfg = nodeTypeConfig[node.type] || nodeTypeConfig.organization;
              const Icon = cfg.icon;
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const acronym = typeof node.data.acronym === "string" ? node.data.acronym : null;
              const scope = typeof node.data.scope === "string" ? node.data.scope : null;
              const url = typeof node.data.url === "string" ? node.data.url : null;
              const tier = typeof node.data.tier === "number" ? node.data.tier : null;
              const isDimmed = matchingNodeIds !== undefined && !matchingNodeIds.has(node.id);

              return (
                <div
                  key={node.id}
                  ref={(el) => setNodeRef(node.id, el)}
                  onPointerDown={e => handlePointerDownNode(e, node.id)}
                  onPointerUp={e => handleEndConnection(e, node.id)}
                  onPointerEnter={() => setHoveredNodeId(node.id)}
                  onPointerLeave={() => setHoveredNodeId(null)}
                  style={{
                    transform: `translate(${node.x}px, ${node.y}px)`
                  }}
                  className={`absolute w-56 p-3.5 rounded-2xl border backdrop-blur-xl shadow-xl pointer-events-auto transition-all duration-300 cursor-grab active:cursor-grabbing ${cfg.bgDark} ${cfg.borderColor} ${
                    isSelected ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-[#070A14] shadow-sky-500/20" : ""
                  } ${isHovered && !isSelected ? "border-sky-400/80 shadow-sky-500/10" : ""} ${
                    isDiscovering && node.status === "running" ? "animate-pulse ring-2 ring-emerald-400" : ""
                  } ${isDimmed ? "opacity-20 grayscale pointer-events-none" : "opacity-100"}`}
                >
                  {/* 4-Port Magnetic Anchor Points (visible on hover or select) */}
                  {(isHovered || isSelected) && (
                    <>
                      {/* Top Port */}
                      <button
                        onPointerDown={e => handleStartConnection(e, node.id, "top")}
                        title="Connect Top Port"
                        className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-slate-900 border-2 border-sky-400 hover:bg-sky-500 hover:scale-125 transition flex items-center justify-center text-[10px] text-white z-30 cursor-crosshair shadow-md"
                      >
                        +
                      </button>
                      {/* Bottom Port */}
                      <button
                        onPointerDown={e => handleStartConnection(e, node.id, "bottom")}
                        title="Connect Bottom Port"
                        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-slate-900 border-2 border-sky-400 hover:bg-sky-500 hover:scale-125 transition flex items-center justify-center text-[10px] text-white z-30 cursor-crosshair shadow-md"
                      >
                        +
                      </button>
                      {/* Left Port */}
                      <button
                        onPointerDown={e => handleStartConnection(e, node.id, "left")}
                        title="Connect Left Port"
                        className="absolute top-1/2 -left-2.5 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-900 border-2 border-sky-400 hover:bg-sky-500 hover:scale-125 transition flex items-center justify-center text-[10px] text-white z-30 cursor-crosshair shadow-md"
                      >
                        +
                      </button>
                      {/* Right Port */}
                      <button
                        onPointerDown={e => handleStartConnection(e, node.id, "right")}
                        title="Connect Right Port"
                        className="absolute top-1/2 -right-2.5 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-900 border-2 border-sky-400 hover:bg-sky-500 hover:scale-125 transition flex items-center justify-center text-[10px] text-white z-30 cursor-crosshair shadow-md"
                      >
                        +
                      </button>
                    </>
                  )}

                  {/* Node Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-xl bg-gradient-to-tr ${cfg.color} text-white shadow-md`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${cfg.badgeBg}`}>
                        {cfg.title}
                      </span>
                    </div>

                    {/* Primary connection handle */}
                    <button
                      onPointerDown={e => handleStartConnection(e, node.id, "right")}
                      title="Drag wire to connect to another node"
                      className="h-5 w-5 rounded-full bg-slate-800 hover:bg-sky-500 border border-slate-600 transition cursor-crosshair flex items-center justify-center text-xs text-slate-300 hover:text-white"
                    >
                      +
                    </button>
                  </div>

                  {/* Node Details */}
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-slate-100 truncate">{node.label}</div>
                    {acronym && (
                      <div className="text-xs font-mono text-sky-400">Acronym: {acronym}</div>
                    )}
                    {scope && (
                      <div className="text-[10px] text-slate-400 capitalize">Scope: {scope}</div>
                    )}
                    {url && (
                      <div className="text-[10px] text-slate-400 truncate font-mono">{url}</div>
                    )}
                    {tier !== null && (
                      <div className="text-[10px] text-amber-400">Tier {tier}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Hover Preview Card (When hovering a node that is NOT selected) */}
        {hoveredNode && hoveredNode.id !== selectedNodeId && (
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 24
            }}
            className="w-72 bg-slate-950/95 border border-sky-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-xs space-y-2 z-30 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-sky-400" />
                <span className="font-bold text-slate-100 truncate max-w-[170px]">{hoveredNode.label}</span>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase text-sky-400 px-2 py-0.5 bg-sky-950/80 rounded border border-sky-800">
                {hoveredNode.type}
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">ID:</span>
                <span className="font-mono text-slate-400 text-[10px]">{hoveredNode.id}</span>
              </div>
              {Boolean(hoveredNode.data.acronym) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Acronym:</span>
                  <span className="font-mono text-sky-300">{String(hoveredNode.data.acronym)}</span>
                </div>
              )}
              {Boolean(hoveredNode.data.scope) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Scope:</span>
                  <span className="capitalize text-slate-200">{String(hoveredNode.data.scope)}</span>
                </div>
              )}
              {Boolean(hoveredNode.data.wikipedia_url) && (
                <div className="truncate text-[10px] font-mono text-purple-300">
                  {String(hoveredNode.data.wikipedia_url)}
                </div>
              )}
              {Boolean(hoveredNode.data.url) && (
                <div className="truncate text-[10px] font-mono text-sky-300">
                  {String(hoveredNode.data.url)}
                </div>
              )}
              <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Wires connected:</span>
                <span className="font-bold text-slate-200">
                  {edges.filter(e => e.source === hoveredNode.id || e.target === hoveredNode.id).length}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 italic pt-1 text-center">
              Click node to open full Inspector
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
