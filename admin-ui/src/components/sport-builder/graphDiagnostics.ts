import { NodeData, EdgeData } from "./NodeCanvas";

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface DiagnosticItem {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  message: string;
  nodeId?: string;
  fixAction?: "connect_to_sport" | "delete_node" | "add_source";
}

export interface GraphDiagnosticReport {
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  items: DiagnosticItem[];
  orphanNodeIds: Set<string>;
}

export function runGraphDiagnostics(nodes: NodeData[], edges: EdgeData[]): GraphDiagnosticReport {
  const items: DiagnosticItem[] = [];
  const orphanNodeIds = new Set<string>();

  // 1. Sport Root Check
  const sportNodes = nodes.filter(n => n.type === "sport");
  if (sportNodes.length === 0) {
    items.push({
      id: "diag_no_sport",
      severity: "error",
      title: "Missing Sport Root",
      message: "The graph must contain at least one Sport Root node as the primary anchor."
    });
  } else if (sportNodes.length > 1) {
    items.push({
      id: "diag_multiple_sports",
      severity: "warning",
      title: "Multiple Sport Roots",
      message: `Found ${sportNodes.length} Sport Root nodes. It is recommended to keep one sport per intake graph.`
    });
  }

  // Build connection degree maps
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    outDegree.set(n.id, 0);
  });

  edges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1);
  });

  // 2. Orphan / Disconnected Nodes Check
  nodes.forEach(n => {
    const totalDeg = (inDegree.get(n.id) || 0) + (outDegree.get(n.id) || 0);
    if (totalDeg === 0) {
      orphanNodeIds.add(n.id);
      items.push({
        id: `diag_orphan_${n.id}`,
        severity: "warning",
        title: `Disconnected Node: "${n.label}"`,
        message: `Node "${n.label}" (${n.type}) is isolated with 0 wire connections.`,
        nodeId: n.id,
        fixAction: n.type === "organization" ? "connect_to_sport" : undefined
      });
    }
  });

  // 3. Web Sources & Scrapers Validation
  const webSourceNodes = nodes.filter(n => n.type === "web_source");
  const scraperConfigNodes = nodes.filter(n => n.type === "scraper_config");

  webSourceNodes.forEach(site => {
    const url = typeof site.data.url === "string" ? site.data.url.trim() : "";
    if (!url) {
      items.push({
        id: `diag_nourl_${site.id}`,
        severity: "warning",
        title: `Empty Target URL for "${site.label}"`,
        message: "Web Source has no target URL configured for crawling.",
        nodeId: site.id
      });
    } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
      items.push({
        id: `diag_badurl_${site.id}`,
        severity: "warning",
        title: `Invalid URL Format: "${site.label}"`,
        message: `URL "${url}" does not include http:// or https:// protocol.`,
        nodeId: site.id
      });
    }
  });

  scraperConfigNodes.forEach(scraper => {
    const connectedEdges = edges.filter(e => e.source === scraper.id || e.target === scraper.id);
    const hasWebSourceLink = connectedEdges.some(e => {
      const otherId = e.source === scraper.id ? e.target : e.source;
      const otherNode = nodes.find(n => n.id === otherId);
      return otherNode?.type === "web_source";
    });

    if (!hasWebSourceLink) {
      items.push({
        id: `diag_unlinked_scraper_${scraper.id}`,
        severity: "info",
        title: `Unlinked Scraper Strategy: "${scraper.label}"`,
        message: "Scraper strategy is not connected to any Web Source node.",
        nodeId: scraper.id
      });
    }
  });

  // 4. Organization checks
  const orgNodes = nodes.filter(n => n.type === "organization");
  if (sportNodes.length > 0 && orgNodes.length === 0) {
    items.push({
      id: "diag_no_orgs",
      severity: "info",
      title: "No Organizations Defined",
      message: "Adding governing bodies and federations improves competition discovery accuracy."
    });
  }

  // 5. Duplicate Label Check
  const labelCounts = new Map<string, number>();
  nodes.forEach(n => {
    const key = `${n.type}::${n.label.trim().toLowerCase()}`;
    labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
  });
  nodes.forEach(n => {
    const key = `${n.type}::${n.label.trim().toLowerCase()}`;
    if ((labelCounts.get(key) || 0) > 1) {
      items.push({
        id: `diag_dup_${n.id}`,
        severity: "info",
        title: `Duplicate Name: "${n.label}"`,
        message: `Multiple ${n.type} nodes share the exact label "${n.label}". Consider differentiating them.`,
        nodeId: n.id
      });
    }
  });

  const errorCount = items.filter(i => i.severity === "error").length;
  const warningCount = items.filter(i => i.severity === "warning").length;
  const infoCount = items.filter(i => i.severity === "info").length;

  return {
    isValid: errorCount === 0,
    errorCount,
    warningCount,
    infoCount,
    items,
    orphanNodeIds
  };
}
