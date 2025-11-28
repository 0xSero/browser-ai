// AI Provider - Handles OpenAI and Anthropic API calls
export class AIProvider {
  constructor(settings) {
    this.provider = settings.provider;
    this.apiKey = settings.apiKey;
    this.model = settings.model;
    this.customEndpoint = settings.customEndpoint;
    this.systemPrompt = settings.systemPrompt;
    this.sendScreenshotsAsImages = settings.sendScreenshotsAsImages !== undefined ? settings.sendScreenshotsAsImages : true;
    this.screenshotQuality = settings.screenshotQuality || 'high';
    this.showThinking = settings.showThinking !== undefined ? settings.showThinking : true;
    this.messages = [];
    this.streamEnabled = false;
    this.streamCallbacks = null;
  }

  async chat(conversationHistory, tools, context, options = {}) {
    // Build messages array with system prompt
    this.messages = [
      {
        role: 'system',
        content: this.enhanceSystemPrompt(this.systemPrompt, context)
      },
      ...conversationHistory
    ];

    // Store tools for later use in continueConversation
    this.availableTools = tools;
    this.streamEnabled = Boolean(options?.stream);
    this.streamCallbacks = options?.streamCallbacks || null;

    if (this.provider === 'anthropic') {
      return await this.callAnthropic(tools);
    } else {
      // OpenAI or compatible
      return await this.callOpenAI(tools, {
        stream: this.streamEnabled,
        streamCallbacks: this.streamCallbacks
      });
    }
  }

  enhanceSystemPrompt(basePrompt, context) {
    const tabsSection = Array.isArray(context.availableTabs) && context.availableTabs.length
      ? `Tabs selected (${context.availableTabs.length}). Use focusTab or switchTab before acting:\n${context.availableTabs.map(tab => `  - [${tab.id}] ${tab.title || 'Untitled'} - ${tab.url}`).join('\n')}`
      : 'No additional tabs selected; actions target the current tab.';

    return `${basePrompt}

Context:
- URL: ${context.currentUrl}
- Title: ${context.currentTitle}
- Tab ID: ${context.tabId}
${tabsSection ? `- ${tabsSection}` : ''}

Tool discipline:
1. Never invent or summarize page content you did not fetch with getPageContent.
2. After every scroll, navigation, or tab switch, run getPageContent for the new region before replying.
3. Chain tools until you have concrete evidence you can cite.
4. With multiple tabs, announce the active tab via focusTab/switchTab and use describeSessionTabs to recall IDs.
Example: to inspect a footer → scroll('bottom') then getPageContent({ type: 'text' }) for that section before summarizing.

Base every answer strictly on real tool output.`;
  }

  async callOpenAI(tools, options = {}) {
    const endpoint = this.provider === 'custom'
      ? this.customEndpoint
      : 'https://api.openai.com/v1';

    const payload = {
      model: this.model,
      messages: this.messages,
      tools: this.convertToolsToOpenAI(tools),
      tool_choice: 'auto'
    };

    if (options.stream) {
      payload.stream = true;
      if (this.provider === 'openai') {
        payload.stream_options = { include_usage: true };
      }
    }

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    if (options.stream) {
      return await this.handleOpenAIStream(response, options.streamCallbacks);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message || {};
    this.messages.push(message);
    return this.formatOpenAIMessage(message);
  }

  async callAnthropic(tools) {
    const endpoint = 'https://api.anthropic.com/v1/messages';

    // Extract system message
    const systemMessage = this.messages.find(m => m.role === 'system');
    const conversationMessages = this.messages.filter(m => m.role !== 'system');

    const payload = {
      model: this.model,
      max_tokens: 4096,
      system: systemMessage ? systemMessage.content : '',
      messages: conversationMessages,
      tools: this.convertToolsToAnthropic(tools)
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Add assistant message to history
    this.messages.push({
      role: 'assistant',
      content: data.content
    });

    // Extract thinking (text before tool use)
    let thinking = null;
    let content = '';

    const textBlock = data.content.find(block => block.type === 'text');
    if (textBlock) {
      content = textBlock.text || '';
    }

    // Check for tool use
    const toolUseBlocks = data.content.filter(block => block.type === 'tool_use');

    if (toolUseBlocks.length > 0) {
      // Thinking is the text before tool use
      thinking = content;
      content = '';
    }

    if (toolUseBlocks.length > 0) {
      return {
        content: content,
        thinking: thinking,
        toolCalls: toolUseBlocks.map(block => ({
          id: block.id,
          name: block.name,
          args: block.input
        }))
      };
    }

    return {
      content: content,
      thinking: thinking,
      toolCalls: []
    };
  }

  addToolResult(toolCallId, result) {
    if (this.provider === 'anthropic') {
      // Anthropic format
      if (this.shouldSendAsImage(result)) {
        // For Anthropic, we can include the image directly in the tool_result content array
        const base64Data = result.dataUrl.split(',')[1];
        this.messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolCallId,
              content: [
                {
                  type: 'text',
                  text: `Screenshot captured successfully from tab ${result.tabId}:`
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: base64Data
                  }
                }
              ]
            }
          ]
        });
      } else {
        // Regular tool result
        // If result contains a large dataUrl, strip it to avoid sending massive data
        const resultToSend = { ...result };
        if (resultToSend.dataUrl) {
          delete resultToSend.dataUrl;
          resultToSend.message = 'Screenshot captured successfully. (Image data not included in this format)';
        }

        this.messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolCallId,
            content: JSON.stringify(resultToSend)
          }]
        });
      }
    } else {
      // OpenAI format
      if (this.shouldSendAsImage(result)) {
        // For OpenAI, tool messages must be text-only, so send the tool result first
        this.messages.push({
          role: 'tool',
          tool_call_id: toolCallId,
          content: JSON.stringify({ success: true, tabId: result.tabId, message: 'Screenshot captured' })
        });

        // Then send the image as a user message
        this.messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Here is the screenshot you requested:'
            },
            {
              type: 'image_url',
              image_url: {
                url: result.dataUrl
              }
            }
          ]
        });
      } else {
        // Regular tool result
        // If result contains a large dataUrl that we're not sending as image, strip it
        const resultToSend = { ...result };
        if (resultToSend.dataUrl && !this.shouldSendAsImage(result)) {
          // Don't send massive base64 strings - just send a description
          delete resultToSend.dataUrl;
          resultToSend.message = 'Screenshot captured successfully. (Image data not included - enable vision API to see screenshots)';
        }

        this.messages.push({
          role: 'tool',
          tool_call_id: toolCallId,
          content: JSON.stringify(resultToSend)
        });
      }
    }
  }

  requestFinalResponse(message = null) {
    const prompt = message || 'You must provide a final response that explicitly answers the user, referencing the data you collected for each task.';
    this.messages.push({
      role: 'user',
      content: prompt
    });
  }

  shouldSendAsImage(result) {
    // Only send images if enabled AND we're using a provider that supports it
    if (!this.sendScreenshotsAsImages || !result.success || !result.dataUrl || !result.dataUrl.startsWith('data:image/')) {
      return false;
    }

    // Anthropic: all Claude models support vision with their format
    if (this.provider === 'anthropic') {
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

  async continueConversation() {
    // Continue conversation after tool execution
    // Use the tools that were provided in the initial chat() call
    const tools = this.availableTools || [];

    if (this.provider === 'anthropic') {
      const response = await this.callAnthropic(tools);
      return {
        content: response.content,
        thinking: response.thinking,
        toolCalls: response.toolCalls || []
      };
    } else {
      const response = await this.callOpenAI(tools, {
        stream: this.streamEnabled,
        streamCallbacks: this.streamCallbacks
      });
      return {
        content: response.content,
        thinking: response.thinking,
        toolCalls: response.toolCalls || []
      };
    }
  }

  convertToolsToOpenAI(tools) {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema || tool.parameters
      }
    }));
  }

  convertToolsToAnthropic(tools) {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema || tool.parameters
    }));
  }

  supportsStreaming() {
    return this.provider !== 'anthropic';
  }

  parseArgs(raw) {
    try {
      if (raw == null) return {};
      if (typeof raw === 'object') return raw;
      if (typeof raw === 'string') {
        let str = raw.trim();
        str = str.replace(/<\|?begin[^>]*\|?>/gi, '')
                 .replace(/<\|?end[^>]*\|?>/gi, '')
                 .replace(/<[^>]+>/g, '');
        if (!str) return {};
        try { return JSON.parse(str); } catch {}
        const first = str.indexOf('{');
        const last = str.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
          const inner = str.slice(first, last + 1);
          try { return JSON.parse(inner); } catch {}
        }
      }
    } catch {}
    return {};
  }

  extractImplicitToolCallsFromText(text) {
    if (!text || typeof text !== 'string') return [];
    const indicatorRegex = /(tool[_\s-]?call|tool[_\s-]?use|function[_\s-]?call|<\s*(?:tool|function)_call)/i;
    if (!indicatorRegex.test(text)) return [];

    const snippets = [];
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

    const results = [];
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

  extractJsonObjects(snippet) {
    const objects = [];
    if (!snippet || typeof snippet !== 'string') return objects;
    const trimmed = snippet.trim();
    if (!trimmed) return objects;

    const direct = this.tryParseJson(trimmed);
    if (direct !== null) {
      if (Array.isArray(direct)) {
        direct.forEach(item => objects.push(item));
      } else {
        objects.push(direct);
      }
      return objects;
    }

    const segments = this.extractJsonSegments(trimmed);
    for (const segment of segments) {
      const parsed = this.tryParseJson(segment);
      if (parsed !== null) {
        if (Array.isArray(parsed)) {
          parsed.forEach(item => objects.push(item));
        } else {
          objects.push(parsed);
        }
      }
    }
    return objects;
  }

  tryParseJson(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  extractJsonSegments(text) {
    const segments = [];
    if (!text) return segments;
    const stack = [];
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

  normalizeImplicitToolCall(data) {
    if (!data) return null;
    if (Array.isArray(data)) {
      const nestedResults = [];
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

    const candidates = [data];
    if (data.tool && typeof data.tool === 'object') {
      candidates.push(data.tool);
    }
    if (data.function && typeof data.function === 'object') {
      candidates.push(data.function);
    }
    if (Array.isArray(data.toolCalls)) {
      candidates.push(...data.toolCalls);
    }
    if (Array.isArray(data.tool_calls)) {
      candidates.push(...data.tool_calls);
    }
    if (Array.isArray(data.actions)) {
      candidates.push(...data.actions);
    }
    if (Array.isArray(data.steps)) {
      candidates.push(...data.steps);
    }

    const results = [];
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
        args
      });
    }

    return results.length ? results : null;
  }

  extractImplicitToolName(candidate) {
    if (!candidate || typeof candidate !== 'object') return '';
    const possibleNames = [
      candidate.name,
      candidate.tool_name,
      candidate.tool,
      candidate.function_name,
      candidate.action,
      candidate.command
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

  createImplicitToolCallId() {
    return `implicit_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  formatOpenAIMessage(message) {
    const textContent = this.extractMessageText(message?.content);
    const toolCalls = this.extractToolCalls(message);

    if (toolCalls.length > 0) {
      return {
        content: '',
        thinking: textContent,
        toolCalls
      };
    }

    return {
      content: textContent,
      thinking: null,
      toolCalls: []
    };
  }

  extractMessageText(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return part.text || '';
        }
        return '';
      }).join('');
    }
    return '';
  }

  extractToolCalls(message) {
    const toolCalls = [];
    if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
      for (const tc of message.tool_calls) {
        const fn = tc["function"] || tc.function || tc.func || tc.tool || {};
        const name = (fn && fn.name) ? String(fn.name) : (tc.name ? String(tc.name) : '');
        const argsRaw = (fn && fn.arguments !== undefined) ? fn.arguments : tc.arguments;
        const args = this.parseArgs(argsRaw);
        toolCalls.push({ id: tc.id || `call_${Date.now()}`, name, args });
      }
    } else if (message?.function_call) {
      const fc = message.function_call;
      const args = this.parseArgs(fc.arguments);
      toolCalls.push({ id: `call_${Date.now()}`, name: fc.name || '', args });
    } else if (Array.isArray(message?.content)) {
      for (const part of message.content) {
        if (part && (part.type === 'tool_use' || part.type === 'tool_call')) {
          const args =
            this.parseArgs(part.input ?? part.arguments ?? part.args ?? part.parameters);
          toolCalls.push({
            id: part.id || part.tool_call_id || this.createImplicitToolCallId(),
            name: part.name || part.tool || '',
            args
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

  async handleOpenAIStream(response, callbacks = {}) {
    if (!response.body) {
      throw new Error('Streaming response has no body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let aggregatedContent = '';
    const toolCallMap = new Map();
    const invoke = (name, payload) => {
      try {
        if (typeof callbacks?.[name] === 'function') {
          callbacks[name](payload);
        }
      } catch (error) {
        console.warn('Stream callback error:', error);
      }
    };

    invoke('onStart');

    const appendContent = (delta) => {
      if (!delta) return;
      if (Array.isArray(delta)) {
        for (const part of delta) {
          if (part?.text) {
            aggregatedContent += part.text;
          }
        }
      } else if (typeof delta === 'string') {
        aggregatedContent += delta;
      }
      invoke('onDelta', { content: aggregatedContent });
    };

    const captureToolCalls = (toolCallsDelta) => {
      if (!Array.isArray(toolCallsDelta)) return;
      for (const tc of toolCallsDelta) {
        const index = typeof tc.index === 'number' ? tc.index : toolCallMap.size;
        let entry = toolCallMap.get(index);
        if (!entry) {
          entry = {
            id: tc.id || `call_${Date.now()}_${index}`,
            type: 'function',
            function: { name: '', arguments: '' }
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
            const choice = parsed?.choices?.[0];
            const delta = choice?.delta || {};
            if (delta.content) {
              appendContent(delta.content);
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
            const choice = parsed?.choices?.[0];
            const delta = choice?.delta || {};
            if (delta.content) {
              appendContent(delta.content);
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
    const assistantMessage = {
      role: 'assistant',
      content: aggregatedContent,
      tool_calls: finalToolCalls.length ? finalToolCalls : undefined
    };

    this.messages.push(assistantMessage);
    return this.formatOpenAIMessage(assistantMessage);
  }
}
