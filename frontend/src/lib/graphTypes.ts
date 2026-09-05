export type NodeType = 
  | 'sport'
  | 'organization'
  | 'competition'
  | 'venue'
  | 'event'
  | 'web_source'
  | 'scraper_config'
  | 'group';

export type RelationshipType = 
  | 'governed_by'
  | 'sanctions'
  | 'organizes'
  | 'operates'
  | 'hosted_at'
  | 'scrapes'
  | 'discovered_by'
  | 'custom';

export interface NodeData {
  label: string;
  category?: string;      // sport
  org_type?: string;      // organization
  scope?: string;         // organization
  tier?: number;          // competition
  capacity?: number;      // venue
  status?: string;        // event, scraper_config
  url?: string;           // org, comp, web_source
  [key: string]: any;
}

export interface ResearchNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  parentId?: string;      // for groups
  extent?: 'parent';      // for groups
}

export interface ResearchEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  data?: {
    relationshipType: RelationshipType;
    customLabel?: string;
  };
}

export interface GraphState {
  nodes: ResearchNode[];
  edges: ResearchEdge[];
  history: {
    past: { nodes: ResearchNode[]; edges: ResearchEdge[] }[];
    future: { nodes: ResearchNode[]; edges: ResearchEdge[] }[];
  };
}
