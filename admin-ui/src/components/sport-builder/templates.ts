import { NodeData, EdgeData } from "./NodeCanvas";

export interface SportTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  badge: string;
  nodes: NodeData[];
  edges: EdgeData[];
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
        data: { acronym: "WCF", scope: "international", org_type: "governing_body", website_url: "https://worldcurling.org" },
        status: "completed"
      },
      {
        id: "org_curling_canada",
        type: "organization",
        label: "Curling Canada",
        x: 420,
        y: 280,
        data: { acronym: "CC", scope: "national", org_type: "federation", website_url: "https://curling.ca" },
        status: "completed"
      },
      {
        id: "site_wcf_events",
        type: "web_source",
        label: "World Curling Events Calendar",
        x: 780,
        y: 80,
        data: { url: "https://worldcurling.org/events", antibot: "none" },
        status: "idle"
      },
      {
        id: "comp_brier",
        type: "competition",
        label: "The Montana's Brier",
        x: 780,
        y: 240,
        data: { tier: 1, gender: "men", url: "https://curling.ca/brier" },
        status: "idle"
      },
      {
        id: "comp_scotties",
        type: "competition",
        label: "Scotties Tournament of Hearts",
        x: 780,
        y: 380,
        data: { tier: 1, gender: "women", url: "https://curling.ca/scotties" },
        status: "idle"
      },
      {
        id: "cfg_curling_crawler",
        type: "scraper_config",
        label: "Curling Events Scraper",
        x: 1120,
        y: 80,
        data: { depth: 2, use_healer: true },
        status: "idle"
      }
    ],
    edges: [
      { id: "e1", source: "sport_curling", target: "org_wcf", label: "governed by" },
      { id: "e2", source: "sport_curling", target: "org_curling_canada", label: "governed by" },
      { id: "e3", source: "org_wcf", target: "site_wcf_events", label: "publishes" },
      { id: "e4", source: "org_curling_canada", target: "comp_brier", label: "sanctions" },
      { id: "e5", source: "org_curling_canada", target: "comp_scotties", label: "sanctions" },
      { id: "e6", source: "site_wcf_events", target: "cfg_curling_crawler", label: "scrapes" }
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
        data: { acronym: "PDGA", scope: "international", org_type: "governing_body", website_url: "https://pdga.com" },
        status: "idle"
      },
      {
        id: "org_dgpt",
        type: "organization",
        label: "Disc Golf Pro Tour",
        x: 420,
        y: 300,
        data: { acronym: "DGPT", scope: "international", org_type: "league", website_url: "https://dgpt.com" },
        status: "idle"
      },
      {
        id: "comp_pdga_worlds",
        type: "competition",
        label: "PDGA World Championships",
        x: 780,
        y: 100,
        data: { tier: 1, gender: "mixed", url: "https://pdga.com/worlds" },
        status: "idle"
      },
      {
        id: "comp_usdc",
        type: "competition",
        label: "United States Disc Golf Championship (USDGC)",
        x: 780,
        y: 240,
        data: { tier: 1, gender: "mixed", url: "https://usdgc.com" },
        status: "idle"
      },
      {
        id: "site_pdga_events",
        type: "web_source",
        label: "PDGA Sanctioned Events Directory",
        x: 780,
        y: 380,
        data: { url: "https://pdga.com/tour/events", antibot: "none" },
        status: "idle"
      },
      {
        id: "cfg_pdga_scraper",
        type: "scraper_config",
        label: "PDGA Tour Feed Strategy",
        x: 1120,
        y: 380,
        data: { depth: 3, use_healer: true },
        status: "idle"
      }
    ],
    edges: [
      { id: "edg_1", source: "sport_disc_golf", target: "org_pdga", label: "governed by" },
      { id: "edg_2", source: "sport_disc_golf", target: "org_dgpt", label: "governed by" },
      { id: "edg_3", source: "org_pdga", target: "comp_pdga_worlds", label: "organizes" },
      { id: "edg_4", source: "org_pdga", target: "comp_usdc", label: "sanctions" },
      { id: "edg_5", source: "org_pdga", target: "site_pdga_events", label: "publishes" },
      { id: "edg_6", source: "site_pdga_events", target: "cfg_pdga_scraper", label: "scrapes" }
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
        data: { acronym: "USAP", scope: "national", org_type: "governing_body", website_url: "https://usapickleball.org" },
        status: "idle"
      },
      {
        id: "org_ppa",
        type: "organization",
        label: "PPA Tour (Carvana PPA Tour)",
        x: 420,
        y: 260,
        data: { acronym: "PPA", scope: "international", org_type: "league", website_url: "https://ppatour.com" },
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
        id: "site_ppa_schedule",
        type: "web_source",
        label: "PPA Tour Official Tournaments Schedule",
        x: 780,
        y: 260,
        data: { url: "https://ppatour.com/tournaments", antibot: "cloud-flare" },
        status: "idle"
      },
      {
        id: "cfg_stealth_scraper",
        type: "scraper_config",
        label: "Cloudflare Stealth Crawl Engine",
        x: 1120,
        y: 260,
        data: { depth: 2, use_healer: true },
        status: "idle"
      }
    ],
    edges: [
      { id: "ep1", source: "sport_pickleball", target: "org_usap", label: "governed by" },
      { id: "ep2", source: "sport_pickleball", target: "org_ppa", label: "governed by" },
      { id: "ep3", source: "org_usap", target: "comp_ppa_nationals", label: "sanctions" },
      { id: "ep4", source: "org_ppa", target: "site_ppa_schedule", label: "publishes" },
      { id: "ep5", source: "site_ppa_schedule", target: "cfg_stealth_scraper", label: "scrapes" }
    ]
  },
  {
    id: "spikeball",
    name: "Roundnet / Spikeball",
    category: "Team / Action Sports",
    description: "USA Roundnet and European Roundnet Association with Tour Series events.",
    badge: "Action",
    nodes: [
      {
        id: "sport_roundnet",
        type: "sport",
        label: "Roundnet",
        x: 80,
        y: 180,
        data: { category: "Action Sports", wikipedia_url: "https://en.wikipedia.org/wiki/Roundnet" },
        status: "idle"
      },
      {
        id: "org_usar",
        type: "organization",
        label: "USA Roundnet",
        x: 420,
        y: 120,
        data: { acronym: "USAR", scope: "national", org_type: "governing_body", website_url: "https://usaroundnet.org" },
        status: "idle"
      },
      {
        id: "comp_usar_nationals",
        type: "competition",
        label: "USA Roundnet National Championship",
        x: 780,
        y: 120,
        data: { tier: 1, gender: "mixed", url: "https://usaroundnet.org/nationals" },
        status: "idle"
      },
      {
        id: "site_roundnet_calendar",
        type: "web_source",
        label: "USA Roundnet Tour Schedule",
        x: 780,
        y: 280,
        data: { url: "https://usaroundnet.org/events", antibot: "none" },
        status: "idle"
      }
    ],
    edges: [
      { id: "er1", source: "sport_roundnet", target: "org_usar", label: "governed by" },
      { id: "er2", source: "org_usar", target: "comp_usar_nationals", label: "sanctions" },
      { id: "er3", source: "org_usar", target: "site_roundnet_calendar", label: "publishes" }
    ]
  },
  {
    id: "blank",
    name: "Blank Canvas",
    category: "Custom",
    description: "Clean canvas with a single unconfigured Sport Root node.",
    badge: "Clean Slate",
    nodes: [
      {
        id: "sport_root",
        type: "sport",
        label: "New Sport",
        x: 150,
        y: 200,
        data: { category: "General", wikipedia_url: "" },
        status: "idle"
      }
    ],
    edges: []
  }
];
