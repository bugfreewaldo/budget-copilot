/**
 * LLM Service Abstraction
 *
 * Provider-agnostic wrappers for calling vision and text models.
 * Currently supports Claude (Anthropic) and OpenAI.
 *
 * This abstraction allows swapping providers without changing parser code.
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// Configuration
// ============================================================================

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

// ============================================================================
// Anthropic (Claude) Client
// ============================================================================

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

// ============================================================================
// Vision Model Calls
// ============================================================================

interface VisionModelInput {
  /** Base64-encoded image data */
  imageBase64: string;
  /** MIME type of the image */
  mimeType: string;
  /** System prompt with instructions */
  systemPrompt: string;
  /** User prompt/question about the image */
  userPrompt: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
}

interface VisionModelOutput {
  /** The model's text response */
  text: string;
  /** Token usage statistics */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Call a vision model to analyze an image
 * Uses Claude by default, with OpenAI as fallback
 */
export async function callVisionModel(
  input: VisionModelInput
): Promise<VisionModelOutput> {
  const config = getLLMConfig();

  if (config.provider === 'openai' && config.openaiKey) {
    return callOpenAIVision(input);
  }

  // Default to Claude
  return callClaudeVision(input);
}

/**
 * Call Claude's vision API
 */
async function callClaudeVision(
  input: VisionModelInput
): Promise<VisionModelOutput> {
  const client = getAnthropicClient();

  // Map common MIME types to Anthropic's expected format
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

  // Extract text from response
  const textContent = response.content.find((c) => c.type === 'text');
  const text = textContent && textContent.type === 'text' ? textContent.text : '';

  return {
    text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/**
 * Call OpenAI's vision API (GPT-4 Vision)
 */
async function callOpenAIVision(
  input: VisionModelInput
): Promise<VisionModelOutput> {
  const config = getLLMConfig();

  if (!config.openaiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  // Dynamic import to avoid loading OpenAI if not used
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

// ============================================================================
// Text Model Calls
// ============================================================================

interface TextModelInput {
  /** System prompt with instructions */
  systemPrompt: string;
  /** User message/prompt */
  userPrompt: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
}

interface TextModelOutput {
  /** The model's text response */
  text: string;
  /** Token usage statistics */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Call a text model for analysis
 * Uses Claude by default
 */
export async function callTextModel(
  input: TextModelInput
): Promise<TextModelOutput> {
  const config = getLLMConfig();

  if (config.provider === 'openai' && config.openaiKey) {
    return callOpenAIText(input);
  }

  return callClaudeText(input);
}

/**
 * Call Claude's text API
 */
async function callClaudeText(input: TextModelInput): Promise<TextModelOutput> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: input.maxTokens || 4096,
    system: input.systemPrompt,
    messages: [
      {
        role: 'user',
        content: input.userPrompt,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  const text = textContent && textContent.type === 'text' ? textContent.text : '';

  return {
    text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/**
 * Call OpenAI's text API
 */
async function callOpenAIText(input: TextModelInput): Promise<TextModelOutput> {
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
        content: input.userPrompt,
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map MIME types to Claude's expected format
 */
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
      // Default to JPEG for unknown types
      return 'image/jpeg';
  }
}

/**
 * Extract JSON from LLM response text
 * Handles responses that may include markdown code blocks
 */
export function extractJsonFromResponse(text: string): string {
  // Try to find JSON in markdown code blocks first
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Try to find JSON object directly
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // Return original text if no JSON found
  return text;
}

/**
 * Safely parse JSON from LLM response
 * Returns null if parsing fails
 */
export function safeParseJson<T>(text: string): T | null {
  try {
    const jsonStr = extractJsonFromResponse(text);
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}
