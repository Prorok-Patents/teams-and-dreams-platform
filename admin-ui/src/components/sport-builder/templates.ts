import { NodeData, EdgeData, WebSourceConfig } from "./NodeCanvas";

export interface SportTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  badge: string;
  nodes: NodeData[];
  edges: EdgeData[];
}

/**
 * Normalizes a graph by migrating any legacy standalone `web_source`
 * and `scraper_config` nodes into embedded `sources` inside their
 * parent Organization or Competition nodes.
 */
export function normalizeGraph(nodes: NodeData[], edges: EdgeData[]): { nodes: NodeData[]; edges: EdgeData[] } {
  const legacySourceIds = new Set<string>();
  const legacyScraperIds = new Set<string>();

  nodes.forEach(n => {
    if (n.type === "web_source") legacySourceIds.add(n.id);
    if (n.type === "scraper_config") legacyScraperIds.add(n.id);
  });

  if (legacySourceIds.size === 0 && legacyScraperIds.size === 0) {
    return { nodes, edges };
  }

  // Clone nodes to avoid mutating in place
  const updatedNodes = nodes.map(n => ({
    ...n,
    data: { ...n.data, sources: Array.isArray(n.data.sources) ? [...n.data.sources] : [] }
  }));

  legacySourceIds.forEach(sourceId => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode) return;

    // Find connected parent org or comp
    const parentEdge = edges.find(
      e => (e.target === sourceId || e.source === sourceId) &&
           !legacySourceIds.has(e.source === sourceId ? e.target : e.source) &&
           !legacyScraperIds.has(e.source === sourceId ? e.target : e.source)
    );
    const parentId = parentEdge ? (parentEdge.source === sourceId ? parentEdge.target : parentEdge.source) : null;
    const parentNode = updatedNodes.find(n => n.id === parentId);

    // Find connected scraper config
    const scraperEdge = edges.find(
      e => (e.source === sourceId && legacyScraperIds.has(e.target)) ||
           (e.target === sourceId && legacyScraperIds.has(e.source))
    );
    const scraperId = scraperEdge ? (scraperEdge.source === sourceId ? scraperEdge.target : scraperEdge.source) : null;
    const scraperNode = nodes.find(n => n.id === scraperId);

    const embeddedSource: WebSourceConfig = {
      id: sourceNode.id,
      label: sourceNode.label,
      url: typeof sourceNode.data.url === "string" ? sourceNode.data.url : "",
      antibot: typeof sourceNode.data.antibot === "string" ? (sourceNode.data.antibot as WebSourceConfig["antibot"]) : "none",
      depth: typeof scraperNode?.data?.depth === "number" ? scraperNode.data.depth : 2,
      use_healer: scraperNode?.data?.use_healer !== false,
      status: sourceNode.status || "idle"
    };

    if (parentNode) {
      const currentSources = (parentNode.data.sources as WebSourceConfig[]) || [];
      if (!currentSources.some(s => s.id === embeddedSource.id || (s.url && s.url === embeddedSource.url))) {
        currentSources.push(embeddedSource);
        parentNode.data.sources = currentSources;
      }
    }
  });

  // Filter out standalone web_source and scraper_config nodes
  const filteredNodes = updatedNodes.filter(
    n => n.type !== "web_source" && n.type !== "scraper_config"
  );

  // Filter out edges attached to legacy nodes
  const filteredEdges = edges.filter(
    e => !legacySourceIds.has(e.source) &&
         !legacySourceIds.has(e.target) &&
         !legacyScraperIds.has(e.source) &&
         !legacyScraperIds.has(e.target)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}

export const SPORT_TEMPLATES: SportTemplate[] = [
  {
    id: "curling",
    name: "Curling (Winter Olympic Standard)",
    category: "Winter Sports",
    description: "International governing body, national federations, premier tour, and web calendars.",
    badge: "Olympic",
    nodes: [
      {
        id: "sport_curling",
        type: "sport",
        label: "Curling",
        x: 80,
        y: 200,
        data: { category: "Winter Sports", wikipedia_url: "https://en.wikipedia.org/wiki/Curling" },
        status: "completed"
      },
      {
        id: "org_wcf",
        type: "organization",
        label: "World Curling Federation",
        x: 420,
        y: 100,
        data: {
          acronym: "WCF",
          scope: "international",
          org_type: "governing_body",
          website_url: "https://worldcurling.org",
          sources: [
            {
              id: "src_wcf_1",
              label: "World Curling Events Calendar",
              url: "https://worldcurling.org/events",
              antibot: "none",
              depth: 2,
              use_healer: true,
              status: "idle"
            }
          ]
        },
        status: "completed"
      },
      {
        id: "org_curling_canada",
        type: "organization",
        label: "Curling Canada",
        x: 420,
        y: 280,
        data: {
          acronym: "CC",
          scope: "national",
          org_type: "federation",
          website_url: "https://curling.ca",
          sources: [
            {
              id: "src_cc_1",
              label: "Championships & Tournaments",
              url: "https://curling.ca/championships",
              antibot: "none",
              depth: 2,
              use_healer: true,
              status: "idle"
            }
          ]
        },
        status: "completed"
      },
      {
        id: "comp_brier",
        type: "competition",
        label: "The Montana's Brier",
        x: 780,
        y: 200,
        data: {
          tier: 1,
          gender: "men",
          url: "https://curling.ca/brier",
          sources: [
            {
              id: "src_brier_1",
              label: "Brier Event Hub",
              url: "https://curling.ca/brier",
              antibot: "none",
              depth: 1,
              use_healer: true,
              status: "idle"
            }
          ]
        },
        status: "idle"
      },
      {
        id: "comp_scotties",
        type: "competition",
        label: "Scotties Tournament of Hearts",
        x: 780,
        y: 350,
        data: {
          tier: 1,
          gender: "women",
          url: "https://curling.ca/scotties",
          sources: [
            {
              id: "src_scotties_1",
              label: "Scotties Hub & Draws",
              url: "https://curling.ca/scotties",
              antibot: "none",
              depth: 1,
              use_healer: true,
              status: "idle"
            }
          ]
        },
        status: "idle"
      }
    ],
    edges: [
      { id: "e1", source: "sport_curling", target: "org_wcf", label: "governed by" },
      { id: "e2", source: "sport_curling", target: "org_curling_canada", label: "governed by" },
      { id: "e3", source: "org_curling_canada", target: "comp_brier", label: "sanctions" },
      { id: "e4", source: "org_curling_canada", target: "comp_scotties", label: "sanctions" }
    ]
  },
  {
    id: "disc_golf",
    name: "Disc Golf (PDGA Pro Tour)",
    category: "Outdoor / Flying Disc",
    description: "Professional Disc Golf Association structure with DGPT, Major Tournaments, and live scoring feeds.",
    badge: "Pro Tour",
    nodes: [
      {
        id: "sport_disc_golf",
        type: "sport",
        label: "Disc Golf",
        x: 80,
        y: 200,
        data: { category: "Disc Sports", wikipedia_url: "https://en.wikipedia.org/wiki/Disc_golf" },
        status: "idle"
      },
      {
        id: "org_pdga",
        type: "organization",
        label: "Professional Disc Golf Association",
        x: 420,
        y: 120,
        data: {
          acronym: "PDGA",
          scope: "international",
          org_type: "governing_body",
          website_url: "https://pdga.com",
          sources: [
            {
              id: "src_pdga_1",
              label: "PDGA Sanctioned Events Directory",
              url: "https://pdga.com/tour/events",
              antibot: "none",
              depth: 3,
              use_healer: true,
              status: "idle"
            }
          ]
        },
        status: "idle"
      },
      {
        id: "org_dgpt",
        type: "organization",
        label: "Disc Golf Pro Tour",
        x: 420,
        y: 300,
        data: {
          acronym: "DGPT",
          scope: "international",
          org_type: "league",
          website_url: "https://dgpt.com",
          sources: [
            {
              id: "src_dgpt_1",
              label: "DGPT Schedule & Live Scoring",
              url: "https://dgpt.com/schedule",
              antibot: "cloud-flare",
              depth: 2,
              use_healer: true,
              status: "idle"
            }
          ]
        },
        status: "idle"
      },
      {
        id: "comp_pdga_worlds",
        type: "competition",
        label: "PDGA World Championships",
        x: 780,
        y: 120,
        data: { tier: 1, gender: "mixed", url: "https://pdga.com/worlds" },
        status: "idle"
      },
      {
        id: "comp_usdc",
        type: "competition",
        label: "United States Disc Golf Championship (USDGC)",
        x: 780,
        y: 260,
        data: { tier: 1, gender: "mixed", url: "https://usdgc.com" },
        status: "idle"
      }
    ],
    edges: [
      { id: "edg_1", source: "sport_disc_golf", target: "org_pdga", label: "governed by" },
      { id: "edg_2", source: "sport_disc_golf", target: "org_dgpt", label: "governed by" },
      { id: "edg_3", source: "org_pdga", target: "comp_pdga_worlds", label: "organizes" },
      { id: "edg_4", source: "org_pdga", target: "comp_usdc", label: "sanctions" }
    ]
  },
  {
    id: "pickleball",
    name: "Pickleball (Dual Tour / Federation)",
    category: "Racquet / Paddle Sports",
    description: "USA Pickleball governing body with commercial tours (PPA Tour & Major League Pickleball).",
    badge: "Racquet",
    nodes: [
      {
        id: "sport_pickleball",
        type: "sport",
        label: "Pickleball",
        x: 80,
        y: 200,
        data: { category: "Racquet Sports", wikipedia_url: "https://en.wikipedia.org/wiki/Pickleball" },
        status: "idle"
      },
      {
        id: "org_usap",
        type: "organization",
        label: "USA Pickleball",
        x: 420,
        y: 100,
        data: {
          acronym: "USAP",
          scope: "national",
          org_type: "governing_body",
          website_url: "https://usapickleball.org",
          sources: [
            {
              id: "src_usap_1",
              label: "Sanctioned Tournaments Calendar",
              url: "https://usapickleball.org/events",
              antibot: "none",
              depth: 2,
              use_healer: true,
              status: "idle"
            }
          ]
        },
        status: "idle"
      },
      {
        id: "org_ppa",
        type: "organization",
        label: "PPA Tour (Carvana PPA Tour)",
        x: 420,
        y: 260,
        data: {
          acronym: "PPA",
          scope: "international",
          org_type: "league",
          website_url: "https://ppatour.com",
          sources: [
            {
              id: "src_ppa_1",
              label: "PPA Tour Schedule",
              url: "https://ppatour.com/tournaments",
              antibot: "playwright",
              depth: 2,
              use_healer: true,
              status: "idle"
            }
          ]
        },
        status: "idle"
      },
      {
        id: "comp_ppa_nationals",
        type: "competition",
        label: "USA Pickleball National Championships",
        x: 780,
        y: 100,
        data: { tier: 1, gender: "mixed", url: "https://usapickleball.org/nationals" },
        status: "idle"
      },
      {
        id: "comp_ppa_masters",
        type: "competition",
        label: "PPA The Masters",
        x: 780,
        y: 240,
        data: { tier: 1, gender: "mixed", url: "https://ppatour.com/masters" },
        status: "idle"
      }
    ],
    edges: [
      { id: "e_p1", source: "sport_pickleball", target: "org_usap", label: "governed by" },
      { id: "e_p2", source: "sport_pickleball", target: "org_ppa", label: "governed by" },
      { id: "e_p3", source: "org_usap", target: "comp_ppa_nationals", label: "sanctions" },
      { id: "e_p4", source: "org_ppa", target: "comp_ppa_masters", label: "organizes" }
    ]
  },
  {
    id: "roundnet",
    name: "Roundnet (Spikeball Community & Tour)",
    category: "Lawn / Beach / Ball",
    description: "USA Roundnet national association and Spikeball Tour Series.",
    badge: "Emerging",
    nodes: [
      {
        id: "sport_roundnet",
        type: "sport",
        label: "Roundnet",
        x: 80,
        y: 180,
        data: { category: "Lawn Sports", wikipedia_url: "https://en.wikipedia.org/wiki/Roundnet" },
        status: "idle"
      },
      {
        id: "org_usar",
        type: "organization",
        label: "USA Roundnet",
        x: 420,
        y: 120,
        data: {
          acronym: "USAR",
          scope: "national",
          org_type: "governing_body",
          website_url: "https://usaroundnet.org",
          sources: [
            {
              id: "src_usar_1",
              label: "Tournaments & Events Calendar",
              url: "https://usaroundnet.org/tournaments",
              antibot: "none",
              depth: 2,
              use_healer: true,
              status: "idle"
            }
          ]
        },
        status: "idle"
      },
      {
        id: "comp_tour_finals",
        type: "competition",
        label: "USA Roundnet National Championship",
        x: 780,
        y: 120,
        data: { tier: 1, gender: "mixed", url: "https://usaroundnet.org/nationals" },
        status: "idle"
      }
    ],
    edges: [
      { id: "e_r1", source: "sport_roundnet", target: "org_usar", label: "governed by" },
      { id: "e_r2", source: "org_usar", target: "comp_tour_finals", label: "organizes" }
    ]
  }
];
