import OpenAI from 'openai';
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
 * OpenAI provider implementation
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private client: OpenAI | null = null;
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || null;

    if (this.apiKey) {
      this.client = new OpenAI({ apiKey: this.apiKey });
    }
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured() || !this.client) {
      throw new ProviderNotConfiguredError(this.name, 'OPENAI_API_KEY');
    }
  }

  async complete(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    this.ensureConfigured();

    const response = await this.client!.chat.completions.create({
      model: options?.model || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No completion returned from OpenAI');
    }

    return {
      text: choice.message.content || '',
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      model: response.model,
    };
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    this.ensureConfigured();

    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      })
    );

    // Add system prompt if provided
    if (options?.systemPrompt) {
      apiMessages.unshift({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    const response = await this.client!.chat.completions.create({
      model: options?.model || 'gpt-4-turbo-preview',
      messages: apiMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
    });

    const choice = response.choices[0];
    if (!choice || !choice.message) {
      throw new Error('No chat response returned from OpenAI');
    }

    return {
      message: {
        role: 'assistant',
        content: choice.message.content || '',
      },
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      model: response.model,
    };
  }
}

/**
 * Factory function to create an OpenAI provider
 */
export function createOpenAIProvider(apiKey?: string): LLMProvider {
  return new OpenAIProvider(apiKey);
}
