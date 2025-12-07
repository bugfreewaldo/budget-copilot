/**
 * LLM Service for file parsing
 */

import Anthropic from '@anthropic-ai/sdk';

function getLLMConfig() {
  const provider = process.env.LLM_PROVIDER || 'claude';
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  return {
    provider,
    anthropicKey,
    openaiKey,
  };
}

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;

  const config = getLLMConfig();
  if (!config.anthropicKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  anthropicClient = new Anthropic({
    apiKey: config.anthropicKey,
  });

  return anthropicClient;
}

interface VisionModelInput {
  imageBase64: string;
  mimeType: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

interface VisionModelOutput {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function callVisionModel(
  input: VisionModelInput
): Promise<VisionModelOutput> {
  const config = getLLMConfig();

  if (config.provider === 'openai' && config.openaiKey) {
    return callOpenAIVision(input);
  }

  return callClaudeVision(input);
}

async function callClaudeVision(
  input: VisionModelInput
): Promise<VisionModelOutput> {
  const client = getAnthropicClient();

  const mediaType = mapMimeTypeForClaude(input.mimeType);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: input.maxTokens || 4096,
    system: input.systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: input.imageBase64,
            },
          },
          {
            type: 'text',
            text: input.userPrompt,
          },
        ],
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  const text =
    textContent && textContent.type === 'text' ? textContent.text : '';

  return {
    text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

async function callOpenAIVision(
  input: VisionModelInput
): Promise<VisionModelOutput> {
  const config = getLLMConfig();

  if (!config.openaiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: config.openaiKey });

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: input.maxTokens || 4096,
    messages: [
      {
        role: 'system',
        content: input.systemPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${input.mimeType};base64,${input.imageBase64}`,
            },
          },
          {
            type: 'text',
            text: input.userPrompt,
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content || '';

  return {
    text,
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : undefined,
  };
}

function mapMimeTypeForClaude(
  mimeType: string
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'image/jpeg';
    case 'image/png':
      return 'image/png';
    case 'image/gif':
      return 'image/gif';
    case 'image/webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

export function extractJsonFromResponse(text: string): string {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    return jsonBlockMatch[1].trim();
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return text;
}

export function safeParseJson<T>(text: string): T | null {
  try {
    const jsonStr = extractJsonFromResponse(text);
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}
