// AI Provider - Handles OpenAI and Anthropic API calls
import type { ContentPart, Message, MessageContent, ToolCall, Usage } from './message-schema.js';

type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  parameters?: Record<string, unknown>;
};

type StreamCallbacks = {
  onStart?: () => void;
  onDelta?: (payload: { content?: string }) => void;
  onComplete?: () => void;
};

type ChatOptions = {
  stream?: boolean;
  streamCallbacks?: StreamCallbacks | null;
};

type ChatResponse = {
  content: string;
  thinking?: string | null;
  toolCalls?: ToolCall[];
  usage?: Usage | null;
};

type ModelContext = {
  currentUrl: string;
  currentTitle: string;
  tabId: number | null;
  availableTabs: Array<{ id: number; title?: string; url?: string }>;
  orchestratorEnabled?: boolean;
  teamProfiles?: Array<{ name: string; provider?: string; model?: string }>;
};

type OpenAIChatPayload = {
  model: string;
  messages: Message[];
  tools: Array<Record<string, unknown>>;
  tool_choice: string;
  temperature: number;
  max_tokens: number;
  stream?: boolean;
  stream_options?: { include_usage: boolean };
};

const isContentPartObject = (part: ContentPart): part is Exclude<ContentPart, string> => {
  return typeof part === 'object' && part !== null;
};

export class AIProvider {
  provider: string;
  apiKey: string;
  model: string;
  customEndpoint: string;
  systemPrompt: string;
  sendScreenshotsAsImages: boolean;
  screenshotQuality: string;
  showThinking: boolean;
  maxTokens: number;
  temperature: number;
  requestTimeout: number;
  messages: Message[];
  streamEnabled: boolean;
  streamCallbacks: StreamCallbacks | null;
  maxModelTokens: number;
  availableTools: ToolDefinition[];

  constructor(settings: Record<string, any>) {
    this.provider = settings.provider || 'openai';
    this.apiKey = settings.apiKey || '';
    this.model = settings.model || '';
    this.customEndpoint = settings.customEndpoint || '';
    this.systemPrompt = settings.systemPrompt || '';
    this.sendScreenshotsAsImages =
      settings.sendScreenshotsAsImages !== undefined ? settings.sendScreenshotsAsImages : false;
    this.screenshotQuality = settings.screenshotQuality || 'high';
    this.showThinking = settings.showThinking !== undefined ? settings.showThinking : true;
    this.maxTokens = settings.maxTokens || 2048;
    this.temperature = typeof settings.temperature === 'number' ? settings.temperature : 0.7;
    this.requestTimeout = settings.timeout || 30000;
    this.messages = [];
    this.streamEnabled = false;
    this.streamCallbacks = null;
    this.maxModelTokens = settings.maxTokens || 2048;
    this.availableTools = [];
  }

  async chat(
    conversationHistory: Message[],
    tools: ToolDefinition[],
    context: ModelContext,
    options: ChatOptions = {},
  ): Promise<ChatResponse> {
    // Build messages array with system prompt
    this.messages = [
      {
        role: 'system',
        content: this.enhanceSystemPrompt(this.systemPrompt, context),
      },
      ...conversationHistory,
    ];

    // Store tools for later use in continueConversation
    this.availableTools = tools;
    this.streamEnabled = Boolean(options?.stream);
    this.streamCallbacks = options?.streamCallbacks || null;

    if (this.provider === 'anthropic' || this.provider === 'kimi') {
      return await this.callAnthropic(tools);
    } else {
      // OpenAI or compatible
      return await this.callOpenAI(tools, {
        stream: this.streamEnabled,
        streamCallbacks: this.streamCallbacks,
      });
    }
  }

  enhanceSystemPrompt(basePrompt: string, context: ModelContext): string {
    const tabsSection =
      Array.isArray(context.availableTabs) && context.availableTabs.length
        ? `Tabs selected (${context.availableTabs.length}). Use focusTab or switchTab before acting:\n${context.availableTabs.map((tab) => `  - [${tab.id}] ${tab.title || 'Untitled'} - ${tab.url}`).join('\n')}`
        : 'No additional tabs selected; actions target the current tab.';
    const teamProfiles = Array.isArray(context.teamProfiles) ? context.teamProfiles : [];
    const teamSection = teamProfiles.length
      ? `Team profiles available for sub-agents:\n${teamProfiles.map((profile) => `  - ${profile.name}: ${profile.provider || 'provider'} · ${profile.model || 'model'}`).join('\n')}\nUse spawn_subagent with a profile name to delegate parallel browser work. Prefer spinning up 2 helpers for complex tasks.`
      : '';
    const orchestratorSection = context.orchestratorEnabled
      ? 'Orchestrator mode is enabled; you may delegate to sub-agents when useful.'
      : '';

    return `${basePrompt}

Context:
- URL: ${context.currentUrl}
- Title: ${context.currentTitle}
- Tab ID: ${context.tabId}
${tabsSection ? `- ${tabsSection}` : ''}
${orchestratorSection ? `\n${orchestratorSection}` : ''}
${teamSection ? `\n${teamSection}` : ''}

Tool discipline:
1. Never invent or summarize page content you did not fetch with getPageContent.
2. After every scroll, navigation, or tab switch, run getPageContent for the new region before replying.
3. Chain tools until you have concrete evidence you can cite.
4. With multiple tabs, announce the active tab via focusTab/switchTab and use describeSessionTabs to recall IDs.
Example: to inspect a footer → scroll('bottom') then getPageContent({ type: 'text' }) for that section before summarizing.

Safety:
- Do not install software, extensions, or change browser/system settings.
- Avoid destructive actions (deleting history, logging out, posting messages) unless the user explicitly asked.
- Stay within the provided tabs; do not open unknown or suspicious URLs. Ask for confirmation if unsure.
- Preserve existing user-created tab groups and content (e.g., docs, HackMD) — avoid overwriting without confirmation.
- Prefer gentle edits: use type/focus tools instead of wholesale replacements when editing text areas.
- Keep tool calls concise to prevent context overrun; prefer batching small actions.

Base every answer strictly on real tool output.`;
  }

  getRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
    if (this.provider === 'kimi') {
      headers['User-Agent'] = 'claude-code/1.0';
    }
    return headers;
  }

  getAnthropicHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (this.provider === 'kimi') {
      headers['User-Agent'] = 'claude-code/1.0';
    }
    return headers;
  }

  getOpenAIEndpoint(): string {
    if (this.provider === 'custom') {
      return (this.customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    }
    if (this.provider === 'kimi') {
      return (this.customEndpoint || 'https://api.kimi.com/coding/v1').replace(/\/+$/, '');
    }
    return 'https://api.openai.com/v1';
  }

  async callOpenAI(tools: ToolDefinition[], options: ChatOptions = {}): Promise<ChatResponse> {
    const endpoint = this.getOpenAIEndpoint();

    // Always sanitize messages to ensure tool calls have matching results
    // This helps with both native OpenAI and proxy endpoints (OpenRouter, etc.)
    let messages: Message[] = this.sanitizeForProxy(this.messages);

    const payload: OpenAIChatPayload = {
      model: this.model,
      messages: messages,
      tools: this.convertToolsToOpenAI(tools),
      tool_choice: 'auto',
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    };

    if (options.stream) {
      payload.stream = true;
      if (this.provider === 'openai') {
        payload.stream_options = { include_usage: true };
      }
    }

    let response;
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        response = await fetch(`${endpoint}/chat/completions`, {
          method: 'POST',
          headers: this.getRequestHeaders(),
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout ? AbortSignal.timeout(this.requestTimeout) : undefined,
        });

        if (response.ok) break;

        const errorText = await response.text();

        // Handle tool ordering errors (from OpenAI, Anthropic proxies, or any endpoint)
        const isToolOrderingError =
          errorText.includes('tool call result does not follow tool call') ||
          errorText.includes('tool_call_id') ||
          (errorText.includes('invalid_request_error') && errorText.includes('tool'));

        if (isToolOrderingError && retries < maxRetries) {
          console.warn(`Tool ordering error, attempt ${retries + 1}/${maxRetries}`, errorText.slice(0, 200));

          if (retries === 0) {
            // First retry: sanitize messages for Anthropic compatibility
            messages = this.sanitizeForProxy(this.messages);
          } else {
            // Second retry: aggressive cleanup - remove tool interactions
            console.warn('Aggressive cleanup for proxy endpoint...');
            messages = this.messages
              .map((msg) => {
                if (msg.role === 'assistant' && msg.tool_calls) {
                  // Keep only content, remove tool_calls
                  return { role: 'assistant', content: msg.content || '...' };
                }
                if (msg.role === 'tool') {
                  return null; // Remove tool result messages
                }
                return msg;
              })
              .filter((msg): msg is Message => Boolean(msg));
            messages = this.ensureAlternatingRoles(messages);
          }

          payload.messages = messages;
          retries++;
          continue;
        }

        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      } catch (err) {
        if (err.message?.includes('OpenAI API error') || retries >= maxRetries) throw err;
        retries++;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (options.stream) {
      return await this.handleOpenAIStream(response, options.streamCallbacks || undefined);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message || {};
    this.messages.push(message);

    // Extract usage from OpenAI response
    const usage = data.usage
      ? {
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        }
      : null;

    const result = this.formatOpenAIMessage(message, usage);
    // Capture reasoning_content from providers like Kimi
    if (message.reasoning_content && !result.thinking) {
      result.thinking = message.reasoning_content;
    }
    return result;
  }

  // Sanitize messages for proxy endpoints that might route to Anthropic
  sanitizeForProxy(messages: Message[]): Message[] {
    const result: Message[] = [];
    let i = 0;

    while (i < messages.length) {
      const msg = messages[i];
      if (!msg) {
        i++;
        continue;
      }

      // Handle assistant with tool_calls (OpenAI format)
      if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        result.push(msg);

        // Collect all following tool results
        const toolResults: Message[] = [];
        let j = i + 1;
        while (j < messages.length && messages[j]?.role === 'tool') {
          toolResults.push(messages[j]);
          j++;
        }

        // Ensure we have results for all tool calls
        const callIds = new Set((msg.tool_calls || []).map((tc) => tc.id));
        const resultIds = new Set(toolResults.map((tr) => tr.tool_call_id));

        for (const id of callIds) {
          if (!resultIds.has(id)) {
            // Add placeholder for missing result
            toolResults.push({
              role: 'tool',
              tool_call_id: id,
              content: 'Tool execution was skipped',
            });
          }
        }

        result.push(...toolResults);
        i = j;
        continue;
      }

      result.push(msg);
      i++;
    }

    return this.ensureAlternatingRolesOpenAI(result);
  }

  // Ensure proper message ordering for OpenAI format
  ensureAlternatingRolesOpenAI(messages: Message[]): Message[] {
    const result: Message[] = [];
    for (const msg of messages) {
      // Tool messages can follow assistant messages
      if (msg.role === 'tool') {
        result.push(msg);
        continue;
      }

      // For user/assistant, check alternation
      const last = result[result.length - 1];
      if (last && last.role === msg.role) {
        // Merge consecutive same-role messages
        if (typeof last.content === 'string' && typeof msg.content === 'string') {
          last.content += '\n' + msg.content;
        }
        continue;
      }

      result.push(msg);
    }
    return result;
  }

  getAnthropicEndpoint(): string {
    let defaultBase = 'https://api.anthropic.com';
    if (this.provider === 'kimi') {
      defaultBase = 'https://api.kimi.com/coding';
    }
    const rawBase = (this.customEndpoint || defaultBase).replace(/\/+$/, '');
    if (/\/v1\/messages$/i.test(rawBase)) return rawBase;
    if (/\/messages$/i.test(rawBase)) return rawBase;
    if (/\/v1$/i.test(rawBase)) return `${rawBase}/messages`;
    return `${rawBase}/v1/messages`;
  }

  async callAnthropic(tools: ToolDefinition[]): Promise<ChatResponse> {
    const endpoint = this.getAnthropicEndpoint();

    // Extract system message
    const systemMessage = this.messages.find((m) => m.role === 'system');
    let conversationMessages: Message[] = this.messages.filter((m) => m.role !== 'system');

    // Sanitize messages for Anthropic format
    conversationMessages = this.sanitizeAnthropicMessages(conversationMessages);

    const payload = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemMessage ? systemMessage.content : '',
      messages: conversationMessages,
      tools: this.convertToolsToAnthropic(tools),
    };

    let response;
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: this.getAnthropicHeaders(),
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout ? AbortSignal.timeout(this.requestTimeout) : undefined,
        });

        if (response.ok) break;

        const errorText = await response.text();

        // If it's a tool call ordering error, try re-sanitizing and retry
        if (errorText.includes('tool call result does not follow tool call') && retries < maxRetries) {
          console.warn(`Tool ordering error, attempt ${retries + 1}/${maxRetries}, re-sanitizing messages...`);

          if (retries === 0) {
            // First retry: re-sanitize normally
            conversationMessages = this.sanitizeAnthropicMessages(this.messages.filter((m) => m.role !== 'system'));
          } else {
            // Second retry: aggressive cleanup - strip all tool interactions, keep only text
            console.warn('Aggressive cleanup: stripping tool interactions...');
            conversationMessages = this.messages
              .filter((m) => m.role !== 'system')
              .map((msg) => {
                if (msg.role === 'assistant' && Array.isArray(msg.content)) {
                  const textContent = msg.content.filter((c) => isContentPartObject(c) && c.type === 'text');
                  if (textContent.length === 0) return null;
                  return { role: 'assistant', content: textContent };
                }
                if (msg.role === 'user' && Array.isArray(msg.content)) {
                  const nonToolContent = msg.content.filter((c) => !isContentPartObject(c) || c.type !== 'tool_result');
                  if (nonToolContent.length === 0) return null;
                  return { role: 'user', content: nonToolContent };
                }
                return msg;
              })
              .filter((msg): msg is Message => Boolean(msg));
            conversationMessages = this.ensureAlternatingRoles(conversationMessages);
          }

          payload.messages = conversationMessages;
          retries++;
          continue;
        }

        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      } catch (err) {
        if (retries >= maxRetries) throw err;
        retries++;
        await new Promise((r) => setTimeout(r, 1000)); // Wait 1s before retry
      }
    }

    const data = await response.json();

    // Add assistant message to history
    this.messages.push({
      role: 'assistant',
      content: data.content,
    });

    // Extract thinking (text before tool use)
    let thinking: string | null = null;
    let content = '';

    const contentBlocks: ContentPart[] = Array.isArray(data.content) ? data.content : [];
    const textBlock = contentBlocks.find((block) => isContentPartObject(block) && block.type === 'text');
    if (textBlock && isContentPartObject(textBlock)) {
      content = textBlock.text || '';
    }

    // Check for tool use
    const toolUseBlocks = contentBlocks.filter(
      (block): block is Exclude<ContentPart, string> => isContentPartObject(block) && block.type === 'tool_use',
    );

    if (toolUseBlocks.length > 0) {
      // Thinking is the text before tool use
      thinking = content;
      content = '';
    }

    // Extract usage info from Anthropic response
    const usage = data.usage
      ? {
          inputTokens: data.usage.input_tokens || 0,
          outputTokens: data.usage.output_tokens || 0,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        }
      : null;

    if (toolUseBlocks.length > 0) {
      return {
        content: content,
        thinking: thinking,
        usage: usage,
        toolCalls: toolUseBlocks.map((block) => ({
          id: String(block.id || this.createImplicitToolCallId()),
          name: String(block.name || ''),
          args: this.parseArgs(block.input),
        })),
      };
    }

    return {
      content: content,
      thinking: thinking,
      usage: usage,
      toolCalls: [],
    };
  }

  addToolResult(toolCallId: string, result: Record<string, any>) {
    if (this.provider === 'anthropic' || this.provider === 'kimi') {
      // Anthropic format - tool results must be in a user message
      // Check if we need to append to existing user message with tool_results
      const lastMsg = this.messages[this.messages.length - 1];
      const toolResultArray = lastMsg?.role === 'user' && Array.isArray(lastMsg.content) ? lastMsg.content : null;
      const isExistingToolResultMsg = Boolean(
        toolResultArray && toolResultArray.some((c) => isContentPartObject(c) && c.type === 'tool_result'),
      );

      let toolResultContent;
      if (this.shouldSendAsImage(result)) {
        const base64Data = result.dataUrl.split(',')[1];
        toolResultContent = {
          type: 'tool_result',
          tool_use_id: toolCallId,
          content: [
            { type: 'text', text: `Screenshot captured successfully from tab ${result.tabId}:` },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Data } },
          ],
        };
      } else {
        const resultToSend = { ...result };
        if (resultToSend.dataUrl) {
          delete resultToSend.dataUrl;
          resultToSend.message = 'Screenshot captured successfully. (Image data not included)';
        }
        toolResultContent = {
          type: 'tool_result',
          tool_use_id: toolCallId,
          content: JSON.stringify(resultToSend),
        };
      }

      // Append to existing tool_result message or create new one
      if (isExistingToolResultMsg && toolResultArray) {
        toolResultArray.push(toolResultContent);
      } else {
        this.messages.push({
          role: 'user',
          content: [toolResultContent],
        });
      }
    } else {
      // OpenAI format
      if (this.shouldSendAsImage(result)) {
        // For OpenAI, tool messages must be text-only, so send the tool result first
        this.messages.push({
          role: 'tool',
          tool_call_id: toolCallId,
          content: JSON.stringify({ success: true, tabId: result.tabId, message: 'Screenshot captured' }),
        });

        // Then send the image as a user message
        this.messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Here is the screenshot you requested:',
            },
            {
              type: 'image_url',
              image_url: {
                url: result.dataUrl,
              },
            },
          ],
        });
      } else {
        // Regular tool result
        // If result contains a large dataUrl that we're not sending as image, strip it
        const resultToSend = { ...result };
        if (resultToSend.dataUrl && !this.shouldSendAsImage(result)) {
          // Don't send massive base64 strings - just send a description
          delete resultToSend.dataUrl;
          resultToSend.message =
            'Screenshot captured successfully. (Image data not included - enable vision API to see screenshots)';
        }

        this.messages.push({
          role: 'tool',
          tool_call_id: toolCallId,
          content: JSON.stringify(resultToSend),
        });
      }
    }
  }

  requestFinalResponse(message: string | null = null) {
    const prompt =
      message ||
      'You must provide a final response that explicitly answers the user, referencing the data you collected for each task.';
    this.messages.push({
      role: 'user',
      content: prompt,
    });
  }

  shouldSendAsImage(result: Record<string, any>) {
    // Only send images if enabled AND we're using a provider that supports it
    if (
      !this.sendScreenshotsAsImages ||
      !result.success ||
      !result.dataUrl ||
      !result.dataUrl.startsWith('data:image/')
    ) {
      return false;
    }

    // Anthropic: all Claude models support vision with their format
    if (this.provider === 'anthropic' || this.provider === 'kimi') {
      return true;
    }

    // OpenAI and OpenAI-compatible endpoints: rely on the user toggle
    // If a custom endpoint cannot handle the multi-part payload, the user can
    // simply disable screenshot sending in settings.
    if (this.provider === 'openai' || this.provider === 'custom') {
      return true;
    }

    return false;
  }

  async continueConversation(): Promise<ChatResponse> {
    // Continue conversation after tool execution
    // Use the tools that were provided in the initial chat() call
    const tools = this.availableTools || [];

    if (this.provider === 'anthropic' || this.provider === 'kimi') {
      const response = await this.callAnthropic(tools);
      return {
        content: response.content,
        thinking: response.thinking,
        usage: response.usage,
        toolCalls: response.toolCalls || [],
      };
    } else {
      const response = await this.callOpenAI(tools, {
        stream: this.streamEnabled,
        streamCallbacks: this.streamCallbacks,
      });
      return {
        content: response.content,
        thinking: response.thinking,
        usage: response.usage,
        toolCalls: response.toolCalls || [],
      };
    }
  }

  convertToolsToOpenAI(tools: ToolDefinition[]): Array<Record<string, unknown>> {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema || tool.parameters,
      },
    }));
  }

  convertToolsToAnthropic(tools: ToolDefinition[]): Array<Record<string, unknown>> {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema || tool.parameters,
    }));
  }

  // Sanitize and fix message ordering for Anthropic
  sanitizeAnthropicMessages(messages: Message[]): Message[] {
    // Phase 1: Collect ALL tool_use IDs and ALL tool_result entries from the entire history
    const allToolResults = new Map<string, Exclude<ContentPart, string>>(); // tool_use_id -> tool_result content

    for (const msg of messages) {
      if (msg?.role === 'user' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (isContentPartObject(block) && block.type === 'tool_result' && block.tool_use_id) {
            allToolResults.set(String(block.tool_use_id), block);
          }
        }
      }
    }

    // Phase 2: Build clean message sequence
    const result: Message[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || !msg.role) continue;

      // Handle assistant messages with tool_use
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const toolUseBlocks = msg.content.filter(
          (c): c is Exclude<ContentPart, string> => isContentPartObject(c) && c.type === 'tool_use',
        );

        if (toolUseBlocks.length > 0) {
          // Add the assistant message
          result.push(msg);

          // Build tool_result array - match by ID, add placeholders for missing
          const toolResultsForThis: Exclude<ContentPart, string>[] = [];
          for (const toolUse of toolUseBlocks) {
            const matchingResult = allToolResults.get(String(toolUse.id || ''));
            if (matchingResult) {
              toolResultsForThis.push(matchingResult);
              allToolResults.delete(String(toolUse.id || '')); // Mark as used
            } else {
              // No matching result - add placeholder
              toolResultsForThis.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: 'Tool execution was skipped or failed',
              });
            }
          }

          // Add the tool results immediately after
          result.push({
            role: 'user',
            content: toolResultsForThis,
          });
          continue;
        }
      }

      // Handle regular user messages (skip tool_result-only messages, they're handled above)
      if (msg.role === 'user') {
        if (Array.isArray(msg.content)) {
          const nonToolContent = msg.content.filter((c) => !isContentPartObject(c) || c.type !== 'tool_result');
          if (nonToolContent.length === 0) continue; // Skip tool_result-only messages
          // Keep message but filter out tool_results
          result.push({ ...msg, content: nonToolContent });
        } else if (msg.content) {
          result.push(msg);
        } else {
          result.push({ ...msg, content: '.' });
        }
        continue;
      }

      // Regular assistant messages (no tool_use)
      result.push(msg);
    }

    // Phase 3: Ensure alternating user/assistant pattern
    return this.ensureAlternatingRoles(result);
  }

  // Ensure messages alternate between user and assistant
  ensureAlternatingRoles(messages: Message[]): Message[] {
    if (messages.length === 0) return messages;

    const result: Message[] = [];
    let lastRole: string | null = null;

    for (const msg of messages) {
      if (msg.role === lastRole) {
        // Same role twice - merge or skip
        if (msg.role === 'user') {
          // Merge user messages
          const lastMsg = result[result.length - 1];
          if (Array.isArray(lastMsg.content) && Array.isArray(msg.content)) {
            lastMsg.content.push(...msg.content);
          } else if (typeof lastMsg.content === 'string' && typeof msg.content === 'string') {
            lastMsg.content += '\n' + msg.content;
          }
          continue;
        }
        // Skip duplicate assistant messages
        continue;
      }

      result.push(msg);
      lastRole = msg.role;
    }

    return result;
  }

  supportsStreaming() {
    return this.provider !== 'anthropic';
  }

  // Force-clear tool-related messages from history (emergency recovery)
  clearToolHistory() {
    console.warn('Clearing tool history from conversation');
    this.messages = this.messages
      .map((msg) => {
        // For assistant messages, remove tool_calls (OpenAI format)
        if (msg.role === 'assistant') {
          if (msg.tool_calls) {
            return { role: 'assistant', content: msg.content || '...' };
          }
          // For Anthropic format, filter out tool_use blocks
          if (Array.isArray(msg.content)) {
            const textOnly = msg.content.filter((c) => isContentPartObject(c) && c.type === 'text');
            if (textOnly.length > 0) {
              return { role: 'assistant', content: textOnly };
            }
            return { role: 'assistant', content: [{ type: 'text', text: '...' }] };
          }
        }
        // Remove tool result messages entirely
        if (msg.role === 'tool') return null;
        // For user messages with tool_result, filter them out
        if (msg.role === 'user' && Array.isArray(msg.content)) {
          const nonTool = msg.content.filter((c) => !isContentPartObject(c) || c.type !== 'tool_result');
          if (nonTool.length === 0) return null;
          return { ...msg, content: nonTool };
        }
        return msg;
      })
      .filter((msg): msg is Message => Boolean(msg));

    // Ensure alternating roles after cleanup
    this.messages = this.ensureAlternatingRoles(this.messages);
  }

  async describeImage(
    dataUrl: string,
    prompt = 'Describe what is visible in this screenshot clearly and concisely.',
  ): Promise<string> {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('No valid image provided for vision description.');
    }
    const base64Data = dataUrl.split(',')[1];

    if (this.provider === 'anthropic' || this.provider === 'kimi') {
      const payload = {
        model: this.model,
        max_tokens: Math.min(this.maxTokens, 1024),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Data } },
            ],
          },
        ],
      };

      const response = await fetch(this.getAnthropicEndpoint(), {
        method: 'POST',
        headers: this.getAnthropicHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout ? AbortSignal.timeout(this.requestTimeout) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic vision error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const blocks: ContentPart[] = Array.isArray(data.content) ? data.content : [];
      const textBlock = blocks.find((block) => isContentPartObject(block) && block.type === 'text');
      return textBlock && isContentPartObject(textBlock)
        ? textBlock.text || 'No description returned.'
        : 'No description returned.';
    }

    // OpenAI or compatible vision
    const endpoint = this.getOpenAIEndpoint();

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: this.getRequestHeaders(),
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        max_tokens: Math.min(this.maxTokens, 800),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(this.requestTimeout) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI vision error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    return this.extractMessageText(message?.content) || 'No description returned.';
  }

  parseArgs(raw: unknown): Record<string, unknown> {
    try {
      if (raw == null) return {};
      if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
      if (Array.isArray(raw)) return { value: raw };
      if (typeof raw === 'string') {
        let str = raw.trim();
        str = str
          .replace(/<\|?begin[^>]*\|?>/gi, '')
          .replace(/<\|?end[^>]*\|?>/gi, '')
          .replace(/<[^>]+>/g, '');
        if (!str) return {};
        try {
          return JSON.parse(str);
        } catch {}
        const first = str.indexOf('{');
        const last = str.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
          const inner = str.slice(first, last + 1);
          try {
            return JSON.parse(inner);
          } catch {}
        }
      }
    } catch {}
    return {};
  }

  extractImplicitToolCallsFromText(text: string): ToolCall[] {
    if (!text || typeof text !== 'string') return [];
    const indicatorRegex = /(tool[_\s-]?call|tool[_\s-]?use|function[_\s-]?call|<\s*(?:tool|function)_call)/i;
    if (!indicatorRegex.test(text)) return [];

    const snippets: string[] = [];
    const codeBlockRegex = /```(?:json)?([\s\S]*?)```/gi;
    let match;
    while ((match = codeBlockRegex.exec(text))) {
      if (match[1]) {
        snippets.push(match[1]);
      }
    }

    const tagRegex = /<\s*(?:tool|function)_call[^>]*>([\s\S]*?)<\s*\/\s*(?:tool|function)_call>/gi;
    while ((match = tagRegex.exec(text))) {
      if (match[1]) {
        snippets.push(match[1]);
      }
    }

    if (!snippets.length) {
      snippets.push(text);
    }

    const results: ToolCall[] = [];
    for (const snippet of snippets) {
      const objects = this.extractJsonObjects(snippet);
      for (const obj of objects) {
        const normalized = this.normalizeImplicitToolCall(obj);
        if (Array.isArray(normalized)) {
          for (const item of normalized) {
            results.push(item);
          }
        } else if (normalized) {
          results.push(normalized);
        }
      }
      if (results.length) break;
    }
    return results;
  }

  extractJsonObjects(snippet: string): Array<Record<string, unknown>> {
    const objects: Array<Record<string, unknown>> = [];
    if (!snippet || typeof snippet !== 'string') return objects;
    const trimmed = snippet.trim();
    if (!trimmed) return objects;

    const direct = this.tryParseJson(trimmed);
    if (direct !== null) {
      if (Array.isArray(direct)) {
        direct.forEach((item) => {
          if (item && typeof item === 'object') objects.push(item as Record<string, unknown>);
        });
      } else {
        if (direct && typeof direct === 'object') objects.push(direct as Record<string, unknown>);
      }
      return objects;
    }

    const segments = this.extractJsonSegments(trimmed);
    for (const segment of segments) {
      const parsed = this.tryParseJson(segment);
      if (parsed !== null) {
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && typeof item === 'object') objects.push(item as Record<string, unknown>);
          });
        } else if (parsed && typeof parsed === 'object') {
          objects.push(parsed as Record<string, unknown>);
        }
      }
    }
    return objects;
  }

  tryParseJson(text: string): unknown {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  extractJsonSegments(text: string): string[] {
    const segments: string[] = [];
    if (!text) return segments;
    const stack: Array<'}' | ']'> = [];
    let startIndex = -1;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '{' || char === '[') {
        if (stack.length === 0) {
          startIndex = i;
        }
        stack.push(char === '{' ? '}' : ']');
      } else if (char === '}' || char === ']') {
        if (!stack.length) {
          startIndex = -1;
          continue;
        }
        const expected = stack.pop();
        if ((char === '}' && expected !== '}') || (char === ']' && expected !== ']')) {
          stack.length = 0;
          startIndex = -1;
          continue;
        }
        if (stack.length === 0 && startIndex !== -1) {
          segments.push(text.slice(startIndex, i + 1));
          startIndex = -1;
        }
      }
    }

    return segments;
  }

  normalizeImplicitToolCall(data: unknown): ToolCall[] | ToolCall | null {
    if (!data) return null;
    if (Array.isArray(data)) {
      const nestedResults: ToolCall[] = [];
      for (const item of data) {
        const normalized = this.normalizeImplicitToolCall(item);
        if (Array.isArray(normalized)) {
          nestedResults.push(...normalized);
        } else if (normalized) {
          nestedResults.push(normalized);
        }
      }
      return nestedResults.length ? nestedResults : null;
    }
    if (typeof data !== 'object') return null;

    const payload = data as Record<string, any>;
    const candidates: Array<Record<string, any>> = [payload];
    if (payload.tool && typeof payload.tool === 'object') {
      candidates.push(payload.tool);
    }
    if (payload.function && typeof payload.function === 'object') {
      candidates.push(payload.function);
    }
    if (Array.isArray(payload.toolCalls)) {
      candidates.push(...payload.toolCalls);
    }
    if (Array.isArray(payload.tool_calls)) {
      candidates.push(...payload.tool_calls);
    }
    if (Array.isArray(payload.actions)) {
      candidates.push(...payload.actions);
    }
    if (Array.isArray(payload.steps)) {
      candidates.push(...payload.steps);
    }

    const results: ToolCall[] = [];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const name = this.extractImplicitToolName(candidate);
      if (!name) continue;

      let argsSource =
        candidate.arguments ??
        candidate.args ??
        candidate.input ??
        candidate.parameters ??
        candidate.params ??
        candidate.payload ??
        candidate.data ??
        candidate.options;

      if (argsSource === undefined && candidate.function && typeof candidate.function === 'object') {
        argsSource =
          candidate.function.arguments ??
          candidate.function.args ??
          candidate.function.input ??
          candidate.function.parameters ??
          candidate.function.params;
      }

      if (argsSource === undefined && candidate.tool && typeof candidate.tool === 'object') {
        argsSource =
          candidate.tool.arguments ??
          candidate.tool.args ??
          candidate.tool.input ??
          candidate.tool.parameters ??
          candidate.tool.params;
      }

      const args = this.parseArgs(argsSource);
      results.push({
        id: this.createImplicitToolCallId(),
        name,
        args,
      });
    }

    return results.length ? results : null;
  }

  extractImplicitToolName(candidate: Record<string, any>): string {
    if (!candidate || typeof candidate !== 'object') return '';
    const possibleNames = [
      candidate.name,
      candidate.tool_name,
      candidate.tool,
      candidate.function_name,
      candidate.action,
      candidate.command,
    ];

    if (candidate.function && typeof candidate.function === 'object') {
      possibleNames.push(candidate.function.name, candidate.function.tool_name, candidate.function.action);
    }
    if (candidate.tool && typeof candidate.tool === 'object') {
      possibleNames.push(candidate.tool.name, candidate.tool.tool_name);
    }

    for (const value of possibleNames) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  createImplicitToolCallId(): string {
    return `implicit_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  formatOpenAIMessage(message: Message, usage: Usage | null = null): ChatResponse {
    const textContent = this.extractMessageText(message?.content);
    const toolCalls = this.extractToolCalls(message);

    if (toolCalls.length > 0) {
      return {
        content: '',
        thinking: textContent,
        usage: usage,
        toolCalls,
      };
    }

    return {
      content: textContent,
      thinking: null,
      usage: usage,
      toolCalls: [],
    };
  }

  extractMessageText(content: MessageContent | null | undefined): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (isContentPartObject(part) && 'text' in part) {
            return part.text || '';
          }
          return '';
        })
        .join('');
    }
    return '';
  }

  extractToolCalls(message: Message | null | undefined): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
      for (const tc of message.tool_calls) {
        const fn = tc['function'] || tc.function || tc.func || tc.tool || {};
        const name = fn && fn.name ? String(fn.name) : tc.name ? String(tc.name) : '';
        const argsRaw = fn && fn.arguments !== undefined ? fn.arguments : tc.arguments;
        const args = this.parseArgs(argsRaw);
        toolCalls.push({ id: tc.id || `call_${Date.now()}`, name, args });
      }
    } else if (message?.function_call) {
      const fc = message.function_call;
      const args = this.parseArgs(fc.arguments);
      toolCalls.push({ id: `call_${Date.now()}`, name: fc.name || '', args });
    } else if (Array.isArray(message?.content)) {
      for (const part of message.content) {
        if (isContentPartObject(part) && (part.type === 'tool_use' || part.type === 'tool_call')) {
          const args = this.parseArgs(part.input ?? part.arguments ?? part.args ?? part.parameters);
          toolCalls.push({
            id: part.id || part.tool_call_id || this.createImplicitToolCallId(),
            name: part.name || part.tool || '',
            args,
          });
        }
      }
      if (!toolCalls.length) {
        const fallback = this.extractImplicitToolCallsFromText(this.extractMessageText(message.content));
        if (fallback.length) {
          return fallback;
        }
      }
    } else {
      const fallback = this.extractImplicitToolCallsFromText(this.extractMessageText(message?.content));
      if (fallback.length) {
        return fallback;
      }
    }
    return toolCalls;
  }

  async handleOpenAIStream(response: Response, callbacks: StreamCallbacks = {}): Promise<ChatResponse> {
    if (!response.body) {
      throw new Error('Streaming response has no body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let aggregatedContent = '';
    let aggregatedReasoning = '';
    let streamUsage: Usage | null = null; // Track usage from streaming
    const toolCallMap = new Map<number, { id: string; type: string; function: { name: string; arguments: string } }>();
    const invoke = (name: keyof StreamCallbacks, payload?: { content?: string }) => {
      try {
        if (typeof callbacks?.[name] === 'function') {
          callbacks[name](payload as { content?: string });
        }
      } catch (error) {
        console.warn('Stream callback error:', error);
      }
    };

    invoke('onStart');

    const appendContent = (delta: string | ContentPart[] | undefined) => {
      if (!delta) return;
      if (Array.isArray(delta)) {
        for (const part of delta) {
          if (isContentPartObject(part) && part.text) {
            aggregatedContent += part.text;
          }
        }
      } else if (typeof delta === 'string') {
        aggregatedContent += delta;
      }
      invoke('onDelta', { content: aggregatedContent });
    };

    const captureToolCalls = (toolCallsDelta: Array<Record<string, any>>) => {
      if (!Array.isArray(toolCallsDelta)) return;
      for (const tc of toolCallsDelta) {
        const index = typeof tc.index === 'number' ? tc.index : toolCallMap.size;
        let entry = toolCallMap.get(index);
        if (!entry) {
          entry = {
            id: tc.id || `call_${Date.now()}_${index}`,
            type: 'function',
            function: { name: '', arguments: '' },
          };
          toolCallMap.set(index, entry);
        }
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.function.name = tc.function.name;
        if (tc.function?.arguments) entry.function.arguments += tc.function.arguments;
      }
    };

    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 2);
        if (chunk.startsWith('data:')) {
          const data = chunk.slice(5).trim();
          if (data === '[DONE]') {
            done = true;
            break;
          }
          if (!data) {
            boundary = buffer.indexOf('\n\n');
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            // Capture usage if present (sent with stream_options.include_usage)
            if (parsed.usage) {
              streamUsage = {
                inputTokens: parsed.usage.prompt_tokens || 0,
                outputTokens: parsed.usage.completion_tokens || 0,
                totalTokens: parsed.usage.total_tokens || 0,
              };
            }
            const choice = parsed?.choices?.[0];
            const delta = choice?.delta || {};
            if (delta.content) {
              appendContent(delta.content);
            }
            if (delta.reasoning_content) {
              aggregatedReasoning += delta.reasoning_content;
            }
            if (delta.tool_calls) {
              captureToolCalls(delta.tool_calls);
            }
          } catch (error) {
            console.warn('Failed to parse stream chunk:', error);
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }

    if (buffer.trim().length > 0) {
      const chunk = buffer.trim();
      if (chunk.startsWith('data:')) {
        const data = chunk.slice(5).trim();
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            // Capture usage if present
            if (parsed.usage) {
              streamUsage = {
                inputTokens: parsed.usage.prompt_tokens || 0,
                outputTokens: parsed.usage.completion_tokens || 0,
                totalTokens: parsed.usage.total_tokens || 0,
              };
            }
            const choice = parsed?.choices?.[0];
            const delta = choice?.delta || {};
            if (delta.content) {
              appendContent(delta.content);
            }
            if (delta.reasoning_content) {
              aggregatedReasoning += delta.reasoning_content;
            }
            if (delta.tool_calls) {
              captureToolCalls(delta.tool_calls);
            }
          } catch (error) {
            console.warn('Failed to parse trailing stream chunk:', error);
          }
        }
      }
    }

    invoke('onComplete');

    const finalToolCalls = Array.from(toolCallMap.values());
    const assistantMessage: Message = {
      role: 'assistant',
      content: aggregatedContent,
      tool_calls: finalToolCalls.length ? finalToolCalls : undefined,
    };

    this.messages.push(assistantMessage);
    const result = this.formatOpenAIMessage(assistantMessage, streamUsage);
    // Preserve reasoning_content from providers like Kimi that stream it separately
    if (aggregatedReasoning && !result.thinking) {
      result.thinking = aggregatedReasoning;
    }
    return result;
  }
}
