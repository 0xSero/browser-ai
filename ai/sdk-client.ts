import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, jsonSchema, tool } from 'ai';

export type SDKModelSettings = {
  provider: string;
  apiKey: string;
  model: string;
  customEndpoint?: string;
};

export type ToolDefinition = {
  name: string;
  description?: string;
  input_schema?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export function resolveLanguageModel(settings: SDKModelSettings) {
  const provider = settings.provider || 'openai';
  const modelId = settings.model || 'gpt-4o';
  const apiKey = settings.apiKey || '';

  if (provider === 'anthropic') {
    const providerInstance = createAnthropic({ apiKey });
    return providerInstance(modelId);
  }

  if (provider === 'custom' || provider === 'kimi') {
    // Normalize the base URL
    // - Remove /chat/completions suffix if present (SDK will add it)
    // - Remove /messages suffix if present
    // - Remove trailing slashes
    const rawBase = settings.customEndpoint
      ? settings.customEndpoint
          .replace(/\/chat\/completions\/?$/i, '')
          .replace(/\/v1\/messages\/?$/i, '')
          .replace(/\/messages\/?$/i, '')
          .replace(/\/+$/, '')
      : '';

    let baseURL = rawBase;

    if (!baseURL) {
      if (provider === 'kimi') {
        baseURL = 'https://api.kimi.com/coding/v1';
      } else {
        throw new Error('Custom provider requires a customEndpoint to be configured');
      }
    }

    if (provider === 'kimi' && !/\/v1$/i.test(baseURL)) {
      baseURL = `${baseURL}/v1`;
    }

    const customProvider = createOpenAICompatible({
      name: provider,
      apiKey,
      baseURL,
    });
    return customProvider(modelId);
  }

  const providerInstance = createOpenAI({ apiKey });
  return providerInstance(modelId);
}

export function buildToolSet(
  tools: ToolDefinition[],
  execute: (toolName: string, args: Record<string, unknown>, options: { toolCallId: string }) => Promise<unknown>,
) {
  const entries = tools.map((definition) => {
    const schema = definition.input_schema || {
      type: 'object',
      properties: {},
    };
    return [
      definition.name,
      tool({
        description: definition.description,
        inputSchema: jsonSchema(schema),
        execute: async (args, options) =>
          execute(definition.name, args as Record<string, unknown>, {
            toolCallId: options.toolCallId,
          }),
      }),
    ] as const;
  });
  return Object.fromEntries(entries);
}

export async function describeImageWithModel({
  settings,
  dataUrl,
  prompt,
  maxTokens = 512,
}: {
  settings: SDKModelSettings;
  dataUrl: string;
  prompt: string;
  maxTokens?: number;
}) {
  const model = resolveLanguageModel(settings);
  const result = await generateText({
    model,
    maxOutputTokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', image: dataUrl },
        ],
      },
    ],
  });
  return result.text;
}
