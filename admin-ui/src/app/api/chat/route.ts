import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';

// Use OpenRouter via the OpenAI provider interface
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

type ChatRole = 'user' | 'assistant' | 'system';

interface IncomingChatMessage {
  role?: string;
  content?: unknown;
  parts?: Array<{ text?: string }>;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawMessages: IncomingChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const messages: Array<{ role: ChatRole; content: string }> = rawMessages.map((m) => ({
      role: (m.role === 'assistant' || m.role === 'system' ? m.role : 'user') as ChatRole,
      content: typeof m.content === 'string' ? m.content : (Array.isArray(m.parts) ? m.parts.map((p) => p.text || '').join('') : String(m.content || ''))
    }));

    const result = streamText({
      model: openrouter('z-ai/glm-5.2'),
      system: `You are an expert AI sports data intake assistant integrated directly into the Sport Intake Node Builder studio.
You have FULL LIVE CONTROL over the node graph canvas. You can build, modify, extend, and delete nodes and wires on the visual canvas using your tools!

ARCHITECTURE GUIDELINES (EMBEDDED SCRAPING STYLE):
1. The canvas is a clean DOMAIN KNOWLEDGE GRAPH:
   - Primary node types: "sport" (root), "organization" (governing body/federation/league), "competition" (tournaments/championships).
   - Web Sources & Scraper Configurations are NOT standalone canvas nodes. Instead, they are EMBEDDED directly inside the "organization" or "competition" node in the "sources" list:
     sources: [
       {
         id: "src_1",
         label: "Events Calendar",
         url: "https://example.com/events",
         antibot: "none" | "cloud-flare" | "playwright",
         depth: 2,
         use_healer: true
       }
     ]
2. Document & List Ingestion:
   - When the user pastes lists of sports, leagues, organizations, or attaches parsed PDF/document text, immediately parse and extract the entities.
   - For each organization or competition discovered, extract their official website and calendar/events URLs, and attach them inside the node's "sources" array.
   - Generate clean hierarchical wires connecting:
     - Sport Root -> Organizations ("governed by")
     - Organizations -> Competitions ("sanctions" or "organizes")
3. Tools:
   - Call \`submit_sport_info\` to create or replace a full sport structure.
   - Call \`add_nodes_and_edges\` to add entities, embedded sources, and relationships.
   - Call \`update_node\` to add sources or modify entity fields.
   - Call \`delete_nodes\` to prune nodes.

Be concise, proactive, friendly, and structured. When building from a list or document, summarize the nodes created.`,
      messages,
      tools: {
        submit_sport_info: tool({
          description: 'Submit gathered sport information to auto-build a full sport root + governing bodies with embedded web sources.',
          inputSchema: z.object({
            sport_name: z.string().describe('The official name of the sport'),
            wiki_title: z.string().optional().describe('The exact Wikipedia page title for the sport, if known.'),
            major_orgs: z.array(
              z.union([
                z.string(),
                z.object({
                  name: z.string().describe('Name of the organization'),
                  acronym: z.string().optional().describe('Acronym or abbreviation'),
                  scope: z.string().optional().describe('Scope: international, national, regional'),
                  org_type: z.string().optional().describe('Type: governing_body, federation, league, association'),
                  website_url: z.string().optional().describe('Official website URL if known'),
                  sources: z.array(
                    z.object({
                      label: z.string().optional().describe('Source name, e.g. "Tournament Directory"'),
                      url: z.string().describe('Target event/calendar URL'),
                      antibot: z.enum(['none', 'cloud-flare', 'playwright']).optional().default('none'),
                      depth: z.number().optional().default(2),
                      use_healer: z.boolean().optional().default(true)
                    })
                  ).optional().describe('Embedded web calendar/event endpoints for scraping')
                })
              ])
            ).optional().describe('A list of major governing bodies or organizations for the sport.'),
          }),
        }),

        add_nodes_and_edges: tool({
          description: 'Add custom nodes and connecting wire edges onto the canvas with embedded scraping sources.',
          inputSchema: z.object({
            nodes: z.array(
              z.object({
                type: z.enum(['sport', 'organization', 'competition', 'web_source', 'scraper_config']).describe('Prefer "sport", "organization", or "competition" with embedded sources'),
                label: z.string().describe('The display title of the node'),
                data: z.record(z.string(), z.unknown()).optional().describe('Node data fields: acronym, scope, org_type, website_url, sources (list of web targets), tier, gender, category, etc.')
              })
            ).describe('List of new nodes to place on the canvas'),
            edges: z.array(
              z.object({
                source_label: z.string().describe('Label or ID of the source node'),
                target_label: z.string().describe('Label or ID of the target node'),
                label: z.string().optional().describe('Relationship label: governed by, sanctions, organizes, operates, connects')
              })
            ).optional().describe('List of wire edges connecting nodes')
          })
        }),

        update_node: tool({
          description: 'Update properties, sources, or label of an existing node on the canvas.',
          inputSchema: z.object({
            target_label_or_id: z.string().describe('Label or ID of the node to update'),
            new_label: z.string().optional().describe('New display label if changing title'),
            data_updates: z.record(z.string(), z.unknown()).optional().describe('Fields to update in node.data (acronym, website_url, sources, tier, etc.)')
          })
        }),

        delete_nodes: tool({
          description: 'Remove nodes from the canvas by their label or ID.',
          inputSchema: z.object({
            node_labels_or_ids: z.array(z.string()).describe('List of node titles or IDs to delete from the graph')
          })
        })
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : String(error);
    console.error('[API /api/chat error]:', error);
    return new Response(JSON.stringify({ error: err }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
