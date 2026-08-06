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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages = rawMessages.map((m: any) => ({
      role: m.role || 'user',
      content: typeof m.content === 'string' ? m.content : (m.parts ? m.parts.map((p: any) => p.text || '').join('') : String(m.content || ''))
    }));

    const result = streamText({
      model: openrouter('z-ai/glm-5.2'),
      system: `You are a helpful AI assistant integrated directly into the Sport Intake Node Builder studio.
You have FULL LIVE CONTROL over the node graph canvas. You can build, modify, extend, and delete nodes and wires on the visual canvas using your tools!

Your capabilities:
1. Gather sport info & submit finalized sport graphs using \`submit_sport_info\`.
2. Add custom nodes and connecting wires using \`add_nodes_and_edges\`. Node types can be: "sport", "organization", "competition", "web_source", or "scraper_config".
3. Update metadata on existing nodes using \`update_node\`.
4. Remove unwanted nodes using \`delete_nodes\`.

Whenever the user asks you to add, modify, connect, or build nodes or sports on the map, use the appropriate tool immediately. Be concise, friendly, and helpful.`,
      messages,
      tools: {
        submit_sport_info: tool({
          description: 'Submit gathered sport information to auto-build a full sport root + governing bodies graph structure. Call this when confirming a sport profile.',
          inputSchema: z.object({
            sport_name: z.string().describe('The official name of the sport'),
            wiki_title: z.string().optional().describe('The exact Wikipedia page title for the sport, if known.'),
            major_orgs: z.array(
              z.union([
                z.string(),
                z.object({
                  name: z.string().describe('Name of the organization'),
                  acronym: z.string().optional().describe('Acronym or abbreviation'),
                  scope: z.string().optional().describe('Scope: global, continental, national, regional'),
                  org_type: z.string().optional().describe('Type: governing_body, league_operator, national_federation'),
                  website_url: z.string().optional().describe('Official website URL if known'),
                })
              ])
            ).optional().describe('A list of major governing bodies or organizations for the sport.'),
          }),
        }),

        add_nodes_and_edges: tool({
          description: 'Add custom nodes and connecting wire edges directly onto the visual node canvas.',
          inputSchema: z.object({
            nodes: z.array(
              z.object({
                type: z.enum(['sport', 'organization', 'competition', 'web_source', 'scraper_config']),
                label: z.string().describe('The display title of the node'),
                data: z.record(z.string(), z.unknown()).optional().describe('Optional fields: website_url, url, acronym, tier, scope, category, etc.')
              })
            ).describe('List of new nodes to place on the canvas'),
            edges: z.array(
              z.object({
                source_label: z.string().describe('Label or ID of the source node'),
                target_label: z.string().describe('Label or ID of the target node'),
                label: z.string().optional().describe('Relationship label: governed by, sanctions, publishes, organizes, operates, connects, scrapes')
              })
            ).optional().describe('List of wire edges connecting nodes')
          })
        }),

        update_node: tool({
          description: 'Update properties or label of an existing node on the canvas.',
          inputSchema: z.object({
            target_label_or_id: z.string().describe('Label or ID of the node to update'),
            new_label: z.string().optional().describe('New display label if changing title'),
            data_updates: z.record(z.string(), z.unknown()).optional().describe('Fields to update in node.data (acronym, website_url, url, tier, etc.)')
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
