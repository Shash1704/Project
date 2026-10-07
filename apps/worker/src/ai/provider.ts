/**
 * Provider-agnostic AI interface. The concrete provider and models are chosen by env
 * (AI_PROVIDER, AI_MODEL, EMBED_MODEL); implementations land in Phase 4.
 */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompleteOptions {
  maxTokens?: number;
  temperature?: number;
  /** Ask the provider for a JSON object response. */
  json?: boolean;
}

export interface LlmProvider {
  readonly name: string;
  complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<string>;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
