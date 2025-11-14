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
  }

  async chat(conversationHistory, tools, context) {
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

    if (this.provider === 'anthropic') {
      return await this.callAnthropic(tools);
    } else {
      // OpenAI or compatible
      return await this.callOpenAI(tools);
    }
  }

  enhanceSystemPrompt(basePrompt, context) {
    return `${basePrompt}

Current Context:
- URL: ${context.currentUrl}
- Page Title: ${context.currentTitle}
- Tab ID: ${context.tabId}

CRITICAL TOOL USAGE RULES - FOLLOW EXACTLY:
1. NEVER guess, assume, or make up information about page content
2. ALWAYS use getPageContent to extract actual text from the page
3. If you scroll, you MUST then call getPageContent to read what you scrolled to
4. Continue using tools in sequence until you have REAL data to answer with
5. Example workflow:
   - User: "what's in the footer?"
   - Step 1: Call scroll tool to go to footer
   - Step 2: Call getPageContent with type='text' to extract footer text
   - Step 3: NOW respond with the ACTUAL extracted content
6. Do NOT respond to questions about page content without first extracting that content using tools
7. A successful scroll does NOT mean you can see the content - you must extract it

These are MANDATORY rules. Violating them means giving wrong information to the user.`;
  }

  async callOpenAI(tools) {
    const endpoint = this.provider === 'custom'
      ? this.customEndpoint
      : 'https://api.openai.com/v1';

    const payload = {
      model: this.model,
      messages: this.messages,
      tools: this.convertToolsToOpenAI(tools),
      tool_choice: 'auto'
    };

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

    const data = await response.json();
    const message = data.choices?.[0]?.message || {};

    // Add assistant message to history
    this.messages.push(message);

    // Extract thinking (content before tool calls)
    let thinking = null;
    let content = message.content || '';

    // Check for tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Thinking is the content before the tool calls
      thinking = content;
      content = '';
    }

    // Parse tool calls (robust to provider variations)
    const toolCalls = [];
    const parseArgs = (raw) => {
      try {
        if (raw == null) return {};
        if (typeof raw === 'object') return raw;
        if (typeof raw === 'string') {
          let s = raw.trim();
          // Strip known sentinel tokens some providers inject
          s = s.replace(/<\|?begin[^>]*\|?>/gi, '')
               .replace(/<\|?end[^>]*\|?>/gi, '')
               .replace(/<[^>]+>/g, '');
          // If parsing fails, try extracting the first top-level {...}
          try { return s ? JSON.parse(s) : {}; } catch {}
          const first = s.indexOf('{');
          const last = s.lastIndexOf('}');
          if (first !== -1 && last !== -1 && last > first) {
            const inner = s.slice(first, last + 1);
            try { return JSON.parse(inner); } catch {}
          }
        }
      } catch {}
      return {};
    };
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      for (const tc of message.tool_calls) {
        const fn = tc["function"] || tc.function || tc.func || tc.tool || {};
        const name = (fn && fn.name) ? String(fn.name) : (tc.name ? String(tc.name) : '');
        const argsRaw = (fn && fn.arguments !== undefined) ? fn.arguments : tc.arguments;
        const args = parseArgs(argsRaw);
        toolCalls.push({ id: tc.id || `call_${Date.now()}`, name, args });
      }
    } else if (message.function_call) {
      // Older function_call shape fallback
      const fc = message.function_call;
      const args = parseArgs(fc.arguments);
      toolCalls.push({ id: `call_${Date.now()}`, name: fc.name || '', args });
    }

    if (toolCalls.length > 0) {
      return { content, thinking, toolCalls };
    }

    return {
      content: content,
      thinking: thinking,
      toolCalls: []
    };
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

  shouldSendAsImage(result) {
    // Only send images if enabled AND we're using a provider that supports it
    if (!this.sendScreenshotsAsImages || !result.success || !result.dataUrl || !result.dataUrl.startsWith('data:image/')) {
      return false;
    }

    // Anthropic: all Claude models support vision with their format
    if (this.provider === 'anthropic') {
      return true;
    }

    // OpenAI: only official endpoint supports vision API multi-part content
    // Custom endpoints often don't support the multi-part content array format even if they have vision models
    if (this.provider === 'openai' && !this.customEndpoint) {
      return true;
    }

    // For custom endpoints: disable image sending by default
    // The multi-part content format causes 422 errors on most custom endpoints
    // Even if the model supports vision, the API wrapper might not support the format
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
      const response = await this.callOpenAI(tools);
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
}
