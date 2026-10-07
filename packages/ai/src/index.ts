import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

/**
 * Provider-agnostic AI layer. The provider and model are chosen by env:
 *   AI_PROVIDER=anthropic (only implementation today), AI_MODEL (default claude-opus-5-5), AI_API_KEY.
 * Interactive features use low effort for latency; refusals fall back server-side ("default" routing).
 */

export class AiUnavailableError extends Error {}

export interface StructuredRequest<S extends z.ZodType> {
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
}

export interface LlmProvider {
  readonly name: string;
  structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>>;
}

class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
  }

  async structured<S extends z.ZodType>({
    system,
    prompt,
    schema,
    maxTokens = 4000,
  }: StructuredRequest<S>): Promise<z.infer<S>> {
    const res = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    if (res.stop_reason === 'refusal') throw new AiUnavailableError('The AI declined this request');
    if (res.parsed_output == null)
      throw new AiUnavailableError('The AI returned an unexpected format');
    return res.parsed_output as z.infer<S>;
  }
}

let provider: LlmProvider | null | undefined;

/** The configured provider, or null when AI isn't configured (features then report "AI unavailable"). */
export function llm(): LlmProvider | null {
  if (provider !== undefined) return provider;
  const key = process.env.AI_API_KEY?.trim();
  const kind = (process.env.AI_PROVIDER ?? 'anthropic').trim();
  if (!key || kind !== 'anthropic') return (provider = null);
  return (provider = new AnthropicProvider(key, process.env.AI_MODEL?.trim() || 'claude-opus-5-5'));
}

// ── Catch Me Up ────────────────────────────────────────────────────────────

export const catchUpSchema = z.object({
  summary: z
    .array(z.string())
    .describe(
      'At most 5 short lines. Wrap the 1-3 most important words of each line in **double asterisks**.',
    ),
  decisions: z.array(z.object({ text: z.string(), ref: z.number().int() })),
  deadlines: z.array(z.object({ text: z.string(), when: z.string(), ref: z.number().int() })),
  mentions: z.array(z.object({ who: z.string(), text: z.string(), ref: z.number().int() })),
  actionItems: z
    .array(z.object({ text: z.string(), ref: z.number().int() }))
    .describe('At most 3 short to-dos'),
});
export type CatchUpRaw = z.infer<typeof catchUpSchema>;

export interface ChatLine {
  ref: number;
  author: string;
  text: string;
  at: string;
}

const CATCH_UP_SYSTEM = `You summarise busy group chats for someone who has been away.
Messages may be in English, Hindi, Kannada or Tamil (often mixed); always answer in the reader's language given below.
Every item must cite the [ref] number of the single message it comes from. Only include decisions the group actually agreed on,
deadlines with an explicit time or date, and @mentions of a person by name. Skip small talk. Never invent anything.`;

export async function catchMeUp(
  lines: ChatLine[],
  opts: { title: string; readerLang: string },
): Promise<CatchUpRaw> {
  const ai = llm();
  if (!ai) throw new AiUnavailableError('AI is not configured on this server');
  const transcript = lines.map((l) => `[${l.ref}] ${l.at} ${l.author}: ${l.text}`).join('\n');
  const out = await ai.structured({
    system: CATCH_UP_SYSTEM,
    prompt: `Chat: "${opts.title}". Reader's language: ${opts.readerLang}.\n\n<messages>\n${transcript}\n</messages>`,
    schema: catchUpSchema,
  });
  // Drop anything citing a message that wasn't in the window.
  const valid = new Set(lines.map((l) => l.ref));
  return {
    summary: out.summary.slice(0, 5),
    decisions: out.decisions.filter((d) => valid.has(d.ref)),
    deadlines: out.deadlines.filter((d) => valid.has(d.ref)),
    mentions: out.mentions.filter((d) => valid.has(d.ref)),
    actionItems: out.actionItems.filter((d) => valid.has(d.ref)).slice(0, 3),
  };
}
