import type { LLMProvider } from './provider';
import { createOpenAIProvider } from './adapters/openai';
import { createClaudeProvider } from './adapters/claude';

/**
 * Get an LLM provider based on environment configuration
 */
export function getProvider(
  preferredProvider?: 'openai' | 'claude'
): LLMProvider {
  const provider =
    preferredProvider ||
    (process.env.LLM_PROVIDER as 'openai' | 'claude') ||
    'openai';

  switch (provider) {
    case 'openai':
      return createOpenAIProvider();
    case 'claude':
      return createClaudeProvider();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
