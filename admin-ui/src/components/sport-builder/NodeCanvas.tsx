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
  Copy,
  Sparkles,
  Edit2,
  Check,
  ArrowLeftRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  LayoutGrid,
  Info,
  Compass,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  RotateCw,
  X,
  GripHorizontal,
  Magnet
} from "lucide-react";

export type NodeType = "sport" | "organization" | "competition" | "web_source" | "scraper_config";

export interface WebSourceConfig {
  id: string;
  label?: string;
  url: string;
  antibot?: "none" | "cloud-flare" | "playwright";
  depth?: number;
  use_healer?: boolean;
  status?: "idle" | "running" | "completed" | "failed";
}

export interface NodeData {
  id: string;
  type: NodeType;
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
  sourcePort?: "top" | "right" | "bottom" | "left";
  targetPort?: "top" | "right" | "bottom" | "left";
}

interface NodeCanvasProps {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onUpdateNodes: (nodes: NodeData[], addToHistory?: boolean) => void;
  onUpdateEdges: (edges: EdgeData[], addToHistory?: boolean) => void;
  onAddNode: (type: NodeData["type"]) => void;
  onDuplicateNode?: (nodeId: string) => void;
  isDiscovering?: boolean;
  matchingNodeIds?: Set<string>;
  orphanNodeIds?: Set<string>;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const nodeTypeConfig = {
  sport: {
    title: "Sport Root",
    color: "from-purple-500 to-indigo-600",
    borderColor: "border-purple-500/50",
    glowColor: "rgba(168, 85, 247, 0.4)",
    bgDark: "bg-purple-950/40",
    badgeBg: "bg-purple-900/60 text-purple-300",
    dotColor: "#a855f7",
    icon: Trophy
  },
  organization: {
    title: "Organization",
    color: "from-emerald-500 to-teal-600",
    borderColor: "border-emerald-500/50",
    glowColor: "rgba(16, 185, 129, 0.4)",
    bgDark: "bg-emerald-950/40",
    badgeBg: "bg-emerald-900/60 text-emerald-300",
    dotColor: "#10b981",
    icon: Building2
  },
  competition: {
    title: "Competition",
    color: "from-amber-500 to-orange-600",
    borderColor: "border-amber-500/50",
    glowColor: "rgba(245, 158, 11, 0.4)",
    bgDark: "bg-amber-950/40",
    badgeBg: "bg-amber-900/60 text-amber-300",
    dotColor: "#f59e0b",
    icon: Swords
  },
  web_source: {
    title: "Web Source",
    color: "from-sky-500 to-blue-600",
    borderColor: "border-sky-500/50",
    glowColor: "rgba(14, 165, 233, 0.4)",
    bgDark: "bg-sky-950/40",
    badgeBg: "bg-sky-900/60 text-sky-300",
    dotColor: "#0ea5e9",
    icon: Globe
  },
  scraper_config: {
    title: "Scraper Config",
    color: "from-rose-500 to-pink-600",
    borderColor: "border-rose-500/50",
    glowColor: "rgba(244, 63, 94, 0.4)",
    bgDark: "bg-rose-950/40",
    badgeBg: "bg-rose-900/60 text-rose-300",
    dotColor: "#f43f5e",
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

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;
const DEFAULT_NODE_WIDTH = 224;
const DEFAULT_NODE_HEIGHT = 92;

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
  onDuplicateNode,
  isDiscovering = false,
  matchingNodeIds,
  orphanNodeIds,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}: NodeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const isSpacePressedRef = useRef(false);

  // Zoom & Pan States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Grid Snapping
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const GRID_SNAP_SIZE = 20;

  // Node Drag & Hover States
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Drag interaction tracking refs (prevents excessive state updates and lag)
  const dragTargetRef = useRef<HTMLElement | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDragActiveRef = useRef<boolean>(false);
  const hasDraggedRef = useRef<boolean>(false);

  // Wire Connection States
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectingPort, setConnectingPort] = useState<"top" | "right" | "bottom" | "left">("right");
  const [hoveredTargetPort, setHoveredTargetPort] = useState<{ nodeId: string; port: "top" | "right" | "bottom" | "left" } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Edge Editing State
  const [editingEdgeLabelId, setEditingEdgeLabelId] = useState<string | null>(null);
  const [customEdgeLabel, setCustomEdgeLabel] = useState<string>("");

  // Mini-Map toggle
  const [showMiniMap, setShowMiniMap] = useState<boolean>(true);

  // ── O(1) node lookup map ─────────────────────────────────────────────
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // ── Auto-expanding canvas dimensions ─────────────────────────────────
  const canvasBounds = useMemo(() => {
    let minX = 0;
    let minY = 0;
    let maxX = 2500;
    let maxY = 1800;

    nodes.forEach(n => {
      minX = Math.min(minX, n.x - 200);
      minY = Math.min(minY, n.y - 200);
      maxX = Math.max(maxX, n.x + 500);
      maxY = Math.max(maxY, n.y + 400);
    });

    return {
      minX,
      minY,
      width: Math.max(3000, maxX - minX),
      height: Math.max(2200, maxY - minY)
    };
  }, [nodes]);

  // ── Zoom helpers ─────────────────────────────────────────────────────
  const setZoomClamped = useCallback((val: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, val));
    zoomRef.current = clamped;
    setZoom(clamped);
  }, []);

  // Keyboard listener for Shortcuts (Space Pan, Delete, Undo/Redo, Escape, Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused =
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA" ||
        (e.target as HTMLElement)?.tagName === "SELECT";

      // Space for panning
      if (e.code === "Space" && !isSpacePressedRef.current && !isInputFocused) {
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
      }

      if (isInputFocused) return;

      // Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) {
          e.preventDefault();
          onUpdateNodes(nodes.filter(n => n.id !== selectedNodeId));
          onUpdateEdges(edges.filter(edge => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
          onSelectNode(null);
        } else if (selectedEdgeId) {
          e.preventDefault();
          onUpdateEdges(edges.filter(edge => edge.id !== selectedEdgeId));
          onSelectEdge(null);
        }
      }

      // Undo (Ctrl+Z) / Redo (Ctrl+Y or Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        onRedo?.();
      }

      // Duplicate (Ctrl+D)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedNodeId) {
        e.preventDefault();
        if (onDuplicateNode) {
          onDuplicateNode(selectedNodeId);
        } else {
          const target = nodes.find(n => n.id === selectedNodeId);
          if (target) {
            const newNode: NodeData = {
              ...target,
              id: `${target.type}_${crypto.randomUUID()}`,
              label: `${target.label} (Copy)`,
              x: target.x + 50,
              y: target.y + 50
            };
            onUpdateNodes([...nodes, newNode]);
            onSelectNode(newNode.id);
          }
        }
      }

      // Escape
      if (e.key === "Escape") {
        onSelectNode(null);
        onSelectEdge(null);
        setEditingEdgeLabelId(null);
        setDraggingNodeId(null);
        setConnectingSourceId(null);
        setHoveredTargetPort(null);
        setIsPanning(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedNodeId, selectedEdgeId, nodes, edges, onUpdateNodes, onUpdateEdges, onSelectNode, onSelectEdge, onUndo, onRedo, onDuplicateNode]);

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

  // Container Size State for pure render access
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 1000, height: 700 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth || 1000,
          height: containerRef.current.clientHeight || 700
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Coordinate conversion (viewport → canvas-space with pan & zoom)
  const getCanvasPoint = useCallback((e: { clientX: number; clientY: number }) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoomRef.current,
      y: (e.clientY - rect.top - pan.y) / zoomRef.current
    };
  }, [pan.x, pan.y]);

  // Node Port Position Helper (pure, deterministic)
  const getPortPosition = useCallback((nodeId: string, port: "top" | "right" | "bottom" | "left" = "right") => {
    const node = nodeMap.get(nodeId);
    if (!node) return { x: 0, y: 0 };

    const w = DEFAULT_NODE_WIDTH;
    const h = DEFAULT_NODE_HEIGHT;

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

  // Intelligent smooth curved bezier calculation
  const calculatePortBezier = useCallback((
    start: { x: number; y: number },
    startPort: "top" | "right" | "bottom" | "left",
    end: { x: number; y: number },
    endPort: "top" | "right" | "bottom" | "left"
  ) => {
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const curveOffset = Math.max(40, Math.min(dist * 0.45, 180));

    const normals = {
      right: { dx: 1, dy: 0 },
      left: { dx: -1, dy: 0 },
      top: { dx: 0, dy: -1 },
      bottom: { dx: 0, dy: 1 }
    };

    const sNorm = normals[startPort];
    const tNorm = normals[endPort];

    const cp1 = {
      x: start.x + sNorm.dx * curveOffset,
      y: start.y + sNorm.dy * curveOffset
    };

    const cp2 = {
      x: end.x + tNorm.dx * curveOffset,
      y: end.y + tNorm.dy * curveOffset
    };

    return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
  }, []);

  // Global PointerUp & Window Listener
  useEffect(() => {
    const handleWindowPointerUp = () => {
      if (draggingNodeId && hasDraggedRef.current) {
        onUpdateNodes(nodes, true);
      }
      if (dragTargetRef.current && dragPointerIdRef.current !== null) {
        try {
          dragTargetRef.current.releasePointerCapture(dragPointerIdRef.current);
        } catch {
          // Ignore
        }
      }
      setDraggingNodeId(null);
      isDragActiveRef.current = false;
      hasDraggedRef.current = false;
      dragPointerIdRef.current = null;
      dragTargetRef.current = null;
      setConnectingSourceId(null);
      setHoveredTargetPort(null);
      setIsPanning(false);
    };

    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [draggingNodeId, nodes, onUpdateNodes]);

  // Pointer Handlers
  const handlePointerDownNode = (e: React.PointerEvent, nodeId: string) => {
    // Only primary button (left mouse click or primary touch/pen)
    if (e.button !== 0) return;

    // Do not initiate node dragging if interacting with embedded controls
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea") ||
      target.closest("a") ||
      target.closest(".node-port") ||
      target.closest("[data-no-drag]")
    ) {
      return;
    }

    e.stopPropagation();

    const currentTarget = e.currentTarget as HTMLElement;
    try {
      currentTarget.setPointerCapture(e.pointerId);
      dragTargetRef.current = currentTarget;
      dragPointerIdRef.current = e.pointerId;
    } catch {
      // Ignore if setPointerCapture is unsupported
    }

    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDragActiveRef.current = false;
    hasDraggedRef.current = false;

    const node = nodeMap.get(nodeId);
    if (node) {
      const pt = getCanvasPoint(e);
      setDragOffset({
        x: pt.x - node.x,
        y: pt.y - node.y
      });
    }

    setDraggingNodeId(nodeId);
    onSelectNode(nodeId);
    onSelectEdge(null);
  };

  const handlePointerUpNode = () => {
    if (draggingNodeId) {
      if (hasDraggedRef.current) {
        // Commit final state to undo/redo history once
        onUpdateNodes(nodes, true);
      }

      if (dragTargetRef.current && dragPointerIdRef.current !== null) {
        try {
          dragTargetRef.current.releasePointerCapture(dragPointerIdRef.current);
        } catch {
          // Ignore
        }
      }

      setDraggingNodeId(null);
      isDragActiveRef.current = false;
      hasDraggedRef.current = false;
      dragPointerIdRef.current = null;
      dragTargetRef.current = null;
    }
  };

  const handleContainerPointerDown = (e: React.PointerEvent) => {
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
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;

      // 3px deadzone threshold prevents accidental micro-drags when clicking just to select
      if (!isDragActiveRef.current && Math.hypot(dx, dy) >= 3) {
        isDragActiveRef.current = true;
        hasDraggedRef.current = true;
      }

      if (isDragActiveRef.current) {
        let rawX = pt.x - dragOffset.x;
        let rawY = pt.y - dragOffset.y;

        // Snap to grid if enabled or if Shift is held
        if (snapToGrid || e.shiftKey) {
          rawX = Math.round(rawX / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
          rawY = Math.round(rawY / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
        }

        const newX = Math.max(10, rawX);
        const newY = Math.max(10, rawY);

        const newNodes = nodes.map(n => {
          if (n.id === draggingNodeId) {
            return {
              ...n,
              x: newX,
              y: newY
            };
          }
          return n;
        });

        // Fast update without pushing a history snapshot on every pixel move
        onUpdateNodes(newNodes, false);
      }
    }
  };

  const handleStartConnection = (
    e: React.PointerEvent,
    sourceId: string,
    port: "top" | "right" | "bottom" | "left" = "right"
  ) => {
    e.stopPropagation();
    setConnectingSourceId(sourceId);
    setConnectingPort(port);
  };

  const handleEndConnection = (
    e: React.PointerEvent,
    targetId: string,
    targetPort: "top" | "right" | "bottom" | "left" = "left"
  ) => {
    e.stopPropagation();
    if (connectingSourceId && connectingSourceId !== targetId) {
      const edgeExists = edges.some(
        edge => edge.source === connectingSourceId && edge.target === targetId
      );
      if (!edgeExists) {
        const newEdge: EdgeData = {
          id: `edge_${crypto.randomUUID()}`,
          source: connectingSourceId,
          target: targetId,
          label: "connects",
          sourcePort: connectingPort,
          targetPort
        };
        onUpdateEdges([...edges, newEdge]);
      }
    }
    setConnectingSourceId(null);
    setHoveredTargetPort(null);
  };

  // Auto-Arrange Layout Engine
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
    const colWidth = 360;
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

  // Fit View Engine
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

  // Actions
  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;
    onUpdateNodes(nodes.filter(n => n.id !== selectedNodeId));
    onUpdateEdges(edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
    onSelectNode(null);
  };

  const handleDeleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    onUpdateEdges(edges.filter(e => e.id !== selectedEdgeId));
    onSelectEdge(null);
    setEditingEdgeLabelId(null);
  };

  const handleReverseSelectedEdge = () => {
    if (!selectedEdgeId) return;
    const updatedEdges = edges.map(e =>
      e.id === selectedEdgeId
        ? {
            ...e,
            source: e.target,
            target: e.source,
            sourcePort: e.targetPort || "right",
            targetPort: e.sourcePort || "left"
          }
        : e
    );
    onUpdateEdges(updatedEdges);
  };

  const handleUpdateEdgeLabel = (edgeId: string, label: string) => {
    const updatedEdges = edges.map(e => (e.id === edgeId ? { ...e, label } : e));
    onUpdateEdges(updatedEdges);
    setEditingEdgeLabelId(null);
  };

  const handleDuplicate = (nodeId: string) => {
    if (onDuplicateNode) {
      onDuplicateNode(nodeId);
      return;
    }
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newNode: NodeData = {
      ...node,
      id: `${node.type}_${crypto.randomUUID()}`,
      label: `${node.label} (Copy)`,
      x: node.x + 40,
      y: node.y + 40
    };
    onUpdateNodes([...nodes, newNode]);
    onSelectNode(newNode.id);
  };

  const hoveredNode = nodes.find(n => n.id === hoveredNodeId) || null;

  return (
    <div className="flex-1 flex flex-col bg-[#070A14] relative overflow-hidden select-none border-r border-[#1E293B]">
      {/* Canvas Top Toolbar Header */}
      <div className="h-12 border-b border-[#1E293B] bg-[#0C1226]/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" /> Canvas
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onAddNode("sport")}
              className="px-2.5 py-1 text-xs bg-purple-950/70 hover:bg-purple-900 border border-purple-800/80 text-purple-300 rounded-lg flex items-center gap-1 transition shadow-sm"
            >
              <Plus className="h-3 w-3" /> Sport
            </button>
            <button
              onClick={() => onAddNode("organization")}
              className="px-2.5 py-1 text-xs bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-300 rounded-lg flex items-center gap-1 transition shadow-sm"
            >
              <Plus className="h-3 w-3" /> Org
            </button>
            <button
              onClick={() => onAddNode("competition")}
              className="px-2.5 py-1 text-xs bg-amber-950/70 hover:bg-amber-900 border border-amber-800/80 text-amber-300 rounded-lg flex items-center gap-1 transition shadow-sm"
            >
              <Plus className="h-3 w-3" /> Comp
            </button>
          </div>

          {/* Undo / Redo buttons */}
          <div className="flex items-center border-l border-slate-800 pl-2 ml-1 gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded transition"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-Arrange Layout Button */}
          <button
            onClick={handleAutoArrange}
            title="Automatically align graph into organized columns"
            className="px-2.5 py-1 text-xs bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 rounded-lg flex items-center gap-1 transition shadow-sm"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Auto-Arrange
          </button>

          {/* Fit View Recenter Button */}
          <button
            onClick={handleFitView}
            title="Recenter and fit all nodes into view"
            className="px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg flex items-center gap-1 transition shadow-sm"
          >
            <Compass className="h-3.5 w-3.5" /> Fit View
          </button>

          {/* Grid Snap Toggle */}
          <button
            onClick={() => setSnapToGrid(prev => !prev)}
            title="Snap to 20px grid while dragging (or hold Shift)"
            className={`px-2.5 py-1 text-xs rounded-lg flex items-center gap-1.5 transition shadow-sm border ${
              snapToGrid
                ? "bg-sky-950/90 border-sky-500 text-sky-300 font-medium ring-1 ring-sky-500/40"
                : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Magnet className={`h-3.5 w-3.5 ${snapToGrid ? "text-sky-400" : "text-slate-400"}`} />
            <span>Snap {snapToGrid ? "20px" : "Off"}</span>
          </button>

          {/* Selection specific actions */}
          {selectedNodeId && (
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => handleDuplicate(selectedNodeId)}
                title="Duplicate Node (Ctrl+D)"
                className="px-2 py-1 text-[11px] text-sky-400 hover:bg-slate-800 rounded flex items-center gap-1 transition"
              >
                <Copy className="h-3 w-3" /> Duplicate
              </button>
              <button
                onClick={handleDeleteSelectedNode}
                title="Delete Node (Del)"
                className="px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-950/40 rounded flex items-center gap-1 transition"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          )}

          {selectedEdgeId && (
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg">
              <button
                onClick={handleReverseSelectedEdge}
                title="Reverse Wire Direction"
                className="px-2 py-1 text-[11px] text-indigo-300 hover:bg-slate-800 rounded flex items-center gap-1 transition"
              >
                <ArrowLeftRight className="h-3 w-3" /> Reverse
              </button>
              <button
                onClick={handleDeleteSelectedEdge}
                title="Delete Wire (Del)"
                className="px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-950/40 rounded flex items-center gap-1 transition"
              >
                <Trash2 className="h-3 w-3" /> Delete Wire
              </button>
            </div>
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
              title="Reset view (100%)"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-mono px-2 py-1 bg-slate-900/60 rounded border border-slate-800">
            {draggingNodeId ? (
              <span className="text-sky-400 font-semibold animate-pulse">
                Dragging • {snapToGrid ? "Snapped 20px" : "Hold Shift to snap"}
              </span>
            ) : (
              <span>{nodes.length} Nodes • {edges.length} Wires</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handlePointerMove}
        onClick={(e) => {
          if (e.target === containerRef.current) {
            onSelectNode(null);
            onSelectEdge(null);
            setEditingEdgeLabelId(null);
          }
        }}
        className={`flex-1 relative overflow-hidden select-none ${
          isPanning ? "cursor-grabbing" : isSpacePressed ? "cursor-grab" : "cursor-crosshair"
        }`}
        style={{
          backgroundColor: "#070A14",
          backgroundImage: "radial-gradient(circle, #1e293b 1px, transparent 1px)",
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`
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
            width: `${canvasBounds.width}px`,
            height: `${canvasBounds.height}px`
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

              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.6" />
              </filter>
            </defs>

            {edges.map(edge => {
              const srcPort = edge.sourcePort || "right";
              const tgtPort = edge.targetPort || "left";
              const start = getPortPosition(edge.source, srcPort);
              const end = getPortPosition(edge.target, tgtPort);

              const pathD = calculatePortBezier(start, srcPort, end, tgtPort);
              const isSelected = selectedEdgeId === edge.id;
              const isDimmed =
                matchingNodeIds !== undefined &&
                (!matchingNodeIds.has(edge.source) || !matchingNodeIds.has(edge.target));

              return (
                <g key={edge.id}>
                  {/* Wide invisible hit area for easy selection */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="20"
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(null);
                      onSelectEdge(edge.id);
                    }}
                  />

                  {/* Outer glow stroke when selected */}
                  {isSelected && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="8"
                      strokeOpacity="0.4"
                      filter="url(#glow)"
                    />
                  )}

                  {/* Main Visible Edge Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isSelected ? "#38bdf8" : "#475569"}
                    strokeWidth={isSelected ? "3.5" : "2.2"}
                    markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                    className={`${
                      isDiscovering ? "animate-pulse stroke-sky-400" : ""
                    } transition-[stroke,stroke-width,opacity] duration-150 ${isDimmed ? "opacity-15" : "opacity-100"}`}
                  />
                </g>
              );
            })}

            {/* Active Wire Drag Curve */}
            {connectingSourceId && (
              <g>
                <path
                  d={calculatePortBezier(
                    getPortPosition(connectingSourceId, connectingPort),
                    connectingPort,
                    mousePos,
                    hoveredTargetPort ? hoveredTargetPort.port : "left"
                  )}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  strokeDasharray="6 4"
                  filter="url(#glow)"
                  className="animate-pulse"
                />
              </g>
            )}
          </svg>

          {/* Edge Labels & Edit Popovers Overlay (z-5) */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
            {edges.map(edge => {
              const srcPort = edge.sourcePort || "right";
              const tgtPort = edge.targetPort || "left";
              const start = getPortPosition(edge.source, srcPort);
              const end = getPortPosition(edge.target, tgtPort);
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;
              const isSelected = selectedEdgeId === edge.id;
              const isEditing = editingEdgeLabelId === edge.id;
              const isDimmed =
                matchingNodeIds !== undefined &&
                (!matchingNodeIds.has(edge.source) || !matchingNodeIds.has(edge.target));

              return (
                <div
                  key={`label_${edge.id}`}
                  style={{
                    position: "absolute",
                    left: `${midX}px`,
                    top: `${midY}px`,
                    transform: "translate(-50%, -50%)"
                  }}
                  className={`pointer-events-auto flex items-center gap-1 transition-[opacity] duration-150 ${
                    isDimmed ? "opacity-15 grayscale" : "opacity-100"
                  }`}
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
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-tight border transition flex items-center gap-1 shadow-sm backdrop-blur-md ${
                        isSelected
                          ? "bg-sky-950 border-sky-400 text-sky-200 ring-2 ring-sky-400/40"
                          : "bg-slate-900/90 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
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
                          <option key={lbl} value={lbl}>
                            {lbl}
                          </option>
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
                      <button
                        onClick={() => setEditingEdgeLabelId(null)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X className="h-3 w-3" />
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
              const isThisNodeDragging = draggingNodeId === node.id;
              const isOrphan = orphanNodeIds?.has(node.id) ?? false;
              const acronym = typeof node.data.acronym === "string" ? node.data.acronym : null;
              const scope = typeof node.data.scope === "string" ? node.data.scope : null;
              const url = typeof node.data.url === "string" ? node.data.url : null;
              const tier = typeof node.data.tier === "number" ? node.data.tier : null;
              const isDimmed = matchingNodeIds !== undefined && !matchingNodeIds.has(node.id);

              return (
                <div
                  key={node.id}
                  onPointerDown={e => handlePointerDownNode(e, node.id)}
                  onPointerUp={handlePointerUpNode}
                  onPointerEnter={() => setHoveredNodeId(node.id)}
                  onPointerLeave={() => setHoveredNodeId(null)}
                  style={{
                    transform: `translate(${node.x}px, ${node.y}px)`
                  }}
                  className={`absolute w-56 p-3.5 rounded-2xl border backdrop-blur-xl pointer-events-auto select-none group ${
                    isThisNodeDragging
                      ? "z-40 scale-[1.03] shadow-2xl shadow-sky-500/30 ring-2 ring-sky-400 !transition-none cursor-grabbing"
                      : "transition-[border-color,box-shadow,background-color,opacity,filter] duration-150 cursor-grab active:cursor-grabbing shadow-xl"
                  } ${cfg.bgDark} ${cfg.borderColor} ${
                    isSelected && !isThisNodeDragging
                      ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-[#070A14] shadow-lg shadow-sky-500/20 scale-[1.01]"
                      : ""
                  } ${isHovered && !isSelected && !isThisNodeDragging ? "border-sky-400/80 shadow-md shadow-sky-500/10" : ""} ${
                    isDiscovering && node.status === "running"
                      ? "animate-pulse ring-2 ring-emerald-400 shadow-emerald-500/30"
                      : ""
                  } ${isOrphan && !isSelected ? "ring-1 ring-amber-500/60" : ""} ${
                    isDimmed ? "opacity-20 grayscale pointer-events-none" : "opacity-100"
                  }`}
                >
                  {/* Floating Quick Action Toolbar on Hover */}
                  {isHovered && !connectingSourceId && !isThisNodeDragging && (
                    <div
                      data-no-drag="true"
                      className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded-xl shadow-xl z-40 animate-in fade-in zoom-in-90 duration-150"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(node.id);
                        }}
                        title="Duplicate Node (Ctrl+D)"
                        className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectNode(node.id);
                        }}
                        title="Inspect Node Properties"
                        className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateNodes(nodes.filter(n => n.id !== node.id));
                          onUpdateEdges(edges.filter(edge => edge.source !== node.id && edge.target !== node.id));
                          if (selectedNodeId === node.id) onSelectNode(null);
                        }}
                        title="Delete Node (Del)"
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* 4 Cardinal Magnetic Connection Ports */}
                  {(isHovered || isSelected || connectingSourceId) && (
                    <>
                      {/* Top Port */}
                      <button
                        data-no-drag="true"
                        onPointerDown={e => handleStartConnection(e, node.id, "top")}
                        onPointerUp={e => handleEndConnection(e, node.id, "top")}
                        onPointerEnter={() => connectingSourceId && setHoveredTargetPort({ nodeId: node.id, port: "top" })}
                        onPointerLeave={() => setHoveredTargetPort(null)}
                        title="Connect Top Port"
                        className={`absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full border-2 transition flex items-center justify-center text-[10px] text-white z-30 cursor-crosshair shadow-md node-port ${
                          hoveredTargetPort?.nodeId === node.id && hoveredTargetPort?.port === "top"
                            ? "bg-sky-400 border-white scale-125 ring-2 ring-sky-300 animate-pulse"
                            : "bg-slate-900 border-sky-400 hover:bg-sky-500 hover:scale-125"
                        }`}
                      >
                        +
                      </button>

                      {/* Bottom Port */}
                      <button
                        data-no-drag="true"
                        onPointerDown={e => handleStartConnection(e, node.id, "bottom")}
                        onPointerUp={e => handleEndConnection(e, node.id, "bottom")}
                        onPointerEnter={() => connectingSourceId && setHoveredTargetPort({ nodeId: node.id, port: "bottom" })}
                        onPointerLeave={() => setHoveredTargetPort(null)}
                        title="Connect Bottom Port"
                        className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full border-2 transition flex items-center justify-center text-[10px] text-white z-30 cursor-crosshair shadow-md node-port ${
                          hoveredTargetPort?.nodeId === node.id && hoveredTargetPort?.port === "bottom"
                            ? "bg-sky-400 border-white scale-125 ring-2 ring-sky-300 animate-pulse"
                            : "bg-slate-900 border-sky-400 hover:bg-sky-500 hover:scale-125"
                        }`}
                      >
                        +
                      </button>

                      {/* Left Port */}
                      <button
                        data-no-drag="true"
                        onPointerDown={e => handleStartConnection(e, node.id, "left")}
                        onPointerUp={e => handleEndConnection(e, node.id, "left")}
                        onPointerEnter={() => connectingSourceId && setHoveredTargetPort({ nodeId: node.id, port: "left" })}
                        onPointerLeave={() => setHoveredTargetPort(null)}
                        title="Connect Left Port"
                        className={`absolute top-1/2 -left-2.5 -translate-y-1/2 h-5 w-5 rounded-full border-2 transition flex items-center justify-center text-[10px] text-white z-30 cursor-crosshair shadow-md node-port ${
                          hoveredTargetPort?.nodeId === node.id && hoveredTargetPort?.port === "left"
                            ? "bg-sky-400 border-white scale-125 ring-2 ring-sky-300 animate-pulse"
                            : "bg-slate-900 border-sky-400 hover:bg-sky-500 hover:scale-125"
                        }`}
                      >
                        +
                      </button>

                      {/* Right Port */}
                      <button
                        data-no-drag="true"
                        onPointerDown={e => handleStartConnection(e, node.id, "right")}
                        onPointerUp={e => handleEndConnection(e, node.id, "right")}
                        onPointerEnter={() => connectingSourceId && setHoveredTargetPort({ nodeId: node.id, port: "right" })}
                        onPointerLeave={() => setHoveredTargetPort(null)}
                        title="Connect Right Port"
                        className={`absolute top-1/2 -right-2.5 -translate-y-1/2 h-5 w-5 rounded-full border-2 transition flex items-center justify-center text-[10px] text-white z-30 cursor-crosshair shadow-md node-port ${
                          hoveredTargetPort?.nodeId === node.id && hoveredTargetPort?.port === "right"
                            ? "bg-sky-400 border-white scale-125 ring-2 ring-sky-300 animate-pulse"
                            : "bg-slate-900 border-sky-400 hover:bg-sky-500 hover:scale-125"
                        }`}
                      >
                        +
                      </button>
                    </>
                  )}

                  {/* Subtle Grip Drag Handle Bar */}
                  <div className="flex items-center justify-center -mt-1 mb-1.5 cursor-grab active:cursor-grabbing group/grip">
                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800/50 group-hover/grip:bg-sky-500/20 group-hover/grip:border-sky-500/40 border border-transparent transition-all">
                      <GripHorizontal className="h-3 w-3 text-slate-500 group-hover/grip:text-sky-400 transition-colors" />
                      <span className="text-[9px] text-slate-500 group-hover/grip:text-sky-300 font-mono tracking-tight hidden group-hover:inline transition-opacity">
                        drag
                      </span>
                    </div>
                  </div>

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

                    {/* Node Status Badge */}
                    <div className="flex items-center gap-1">
                      {node.status === "completed" && (
                        <span title="Intake Completed" className="flex items-center text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {node.status === "running" && (
                        <span title="Pipeline Processing" className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                      )}
                      {node.status === "failed" && (
                        <span title="Pipeline Failed" className="flex items-center text-rose-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {isOrphan && (
                        <span title="Orphan node: 0 wires connected" className="text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                        </span>
                      )}
                    </div>
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

                    {/* Embedded Sources & Scraper Badges */}
                    {(node.type === "organization" || node.type === "competition") && (() => {
                      const nodeSources = Array.isArray(node.data.sources) ? (node.data.sources as WebSourceConfig[]) : [];
                      const sourceCount = nodeSources.length;
                      const hasHealer = nodeSources.some(s => s.use_healer !== false);

                      return (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 mt-1 border-t border-slate-800/80 text-[10px]">
                          {sourceCount > 0 ? (
                            <span
                              title={`${sourceCount} target scraper source${sourceCount > 1 ? "s" : ""} configured`}
                              className="px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-800/80 text-sky-300 font-mono flex items-center gap-1"
                            >
                              <Globe className="h-2.5 w-2.5 text-sky-400" />
                              {sourceCount} {sourceCount === 1 ? "Source" : "Sources"}
                            </span>
                          ) : (
                            <span
                              title="Click to configure target event scraper URLs"
                              className="px-2 py-0.5 rounded-full bg-slate-900/60 border border-dashed border-slate-700 text-slate-400 font-mono flex items-center gap-1"
                            >
                              <Globe className="h-2.5 w-2.5 text-slate-500" />
                              0 Sources
                            </span>
                          )}

                          {hasHealer && sourceCount > 0 && (
                            <span
                              title="LLM Auto-Healer Enabled"
                              className="px-1.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-800/80 text-rose-300 font-mono flex items-center gap-1"
                            >
                              <Zap className="h-2.5 w-2.5 text-rose-400" />
                              Healer
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Mini-Map / Radar Navigator */}
        <div className="absolute bottom-4 right-4 z-30">
          {!showMiniMap ? (
            <button
              onClick={() => setShowMiniMap(true)}
              title="Show Graph Radar"
              className="p-2 bg-slate-900/90 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl shadow-xl transition backdrop-blur-md"
            >
              <MapPin className="h-4 w-4 text-sky-400" />
            </button>
          ) : (
            <div className="w-52 h-36 bg-slate-950/90 border border-slate-700/80 rounded-2xl p-2 shadow-2xl backdrop-blur-md flex flex-col relative">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] text-slate-400">
                <span className="font-mono uppercase flex items-center gap-1 font-semibold text-slate-300">
                  <Compass className="h-3 w-3 text-sky-400" /> Radar
                </span>
                <button
                  onClick={() => setShowMiniMap(false)}
                  className="p-0.5 text-slate-500 hover:text-white transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div
                className="flex-1 relative mt-1 bg-slate-900/60 rounded-lg overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = (e.clientX - rect.left) / rect.width;
                  const clickY = (e.clientY - rect.top) / rect.height;
                  const targetX = clickX * canvasBounds.width;
                  const targetY = clickY * canvasBounds.height;
                  const containerWidth = containerSize.width;
                  const containerHeight = containerSize.height;
                  setPan({
                    x: containerWidth / 2 - targetX * zoom,
                    y: containerHeight / 2 - targetY * zoom
                  });
                }}
              >
                {/* Scaled Mini Nodes */}
                {nodes.map(n => {
                  const xPct = (n.x / canvasBounds.width) * 100;
                  const yPct = (n.y / canvasBounds.height) * 100;
                  const cfg = nodeTypeConfig[n.type] || nodeTypeConfig.organization;
                  const isSel = selectedNodeId === n.id;

                  return (
                    <div
                      key={`mini_${n.id}`}
                      style={{
                        position: "absolute",
                        left: `${xPct}%`,
                        top: `${yPct}%`,
                        backgroundColor: cfg.dotColor
                      }}
                      className={`w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${
                        isSel ? "ring-2 ring-white scale-125" : "opacity-80"
                      }`}
                    />
                  );
                })}

                {/* Viewport Frame Indicator */}
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.max(0, (-pan.x / zoom / canvasBounds.width) * 100)}%`,
                    top: `${Math.max(0, (-pan.y / zoom / canvasBounds.height) * 100)}%`,
                    width: `${Math.min(100, ((containerSize.width / zoom) / canvasBounds.width) * 100)}%`,
                    height: `${Math.min(100, ((containerSize.height / zoom) / canvasBounds.height) * 100)}%`
                  }}
                  className="border border-sky-400/80 bg-sky-500/15 rounded pointer-events-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Floating Hover Preview Card */}
        {hoveredNode && hoveredNode.id !== selectedNodeId && (
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 24
            }}
            className="w-72 bg-slate-950/95 border border-sky-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-xs space-y-2 z-30 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150"
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
