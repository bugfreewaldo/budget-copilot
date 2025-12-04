import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  CompletionOptions,
  CompletionResult,
  ChatOptions,
  ChatResult,
  Message,
} from '../provider';
import { ProviderNotConfiguredError } from '../provider';

/**
 * Claude (Anthropic) provider implementation
 */
export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude';
  private client: Anthropic | null = null;
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || null;

    if (this.apiKey) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured() || !this.client) {
      throw new ProviderNotConfiguredError(this.name, 'ANTHROPIC_API_KEY');
    }
  }

  async complete(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    this.ensureConfigured();

    const response = await this.client!.messages.create({
      model: options?.model || 'claude-3-5-sonnet-20241022',
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature,
      top_p: options?.topP,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('No text completion returned from Claude');
    }

    return {
      text: content.text,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
    };
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    this.ensureConfigured();

    // Claude API requires alternating user/assistant messages
    // and system prompt is separate
    const apiMessages: Anthropic.MessageParam[] = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const systemPrompt =
      options?.systemPrompt ||
      messages.find((m) => m.role === 'system')?.content;

    const response = await this.client!.messages.create({
      model: options?.model || 'claude-3-5-sonnet-20241022',
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature,
      top_p: options?.topP,
      system: systemPrompt,
      messages: apiMessages,
    });

    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('No text response returned from Claude');
    }

    return {
      message: {
        role: 'assistant',
        content: content.text,
      },
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
    };
  }
}

/**
 * Factory function to create a Claude provider
 */
export function createClaudeProvider(apiKey?: string): LLMProvider {
  return new ClaudeProvider(apiKey);
}
