import { z } from 'zod';

/**
 * Provider-agnostic LLM interfaces
 */

export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  model?: string;
}

export interface CompletionResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface ChatOptions extends CompletionOptions {
  systemPrompt?: string;
}

export interface ChatResult {
  message: Message;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

/**
 * Base LLM provider interface that all adapters must implement
 */
export interface LLMProvider {
  /**
   * Provider name (e.g., 'openai', 'claude')
   */
  readonly name: string;

  /**
   * Generate a single completion from a prompt
   */
  complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;

  /**
   * Generate a chat completion from a list of messages
   */
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResult>;

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean;
}

/**
 * Error thrown when provider is not configured
 */
export class ProviderNotConfiguredError extends Error {
  constructor(providerName: string, missingConfig: string) {
    super(
      `Provider "${providerName}" is not configured. Missing: ${missingConfig}`
    );
    this.name = 'ProviderNotConfiguredError';
  }
}
