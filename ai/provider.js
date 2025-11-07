// AI Provider - Handles OpenAI and Anthropic API calls
export class AIProvider {
  constructor(settings) {
    this.provider = settings.provider;
    this.apiKey = settings.apiKey;
    this.model = settings.model;
    this.customEndpoint = settings.customEndpoint;
    this.systemPrompt = settings.systemPrompt;
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

When using tools, be precise and explain what you're doing. Always verify success after performing actions.`;
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
    const message = data.choices[0].message;

    // Add assistant message to history
    this.messages.push(message);

    // Check for tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      return {
        content: message.content || '',
        toolCalls: message.tool_calls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments)
        }))
      };
    }

    return {
      content: message.content,
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

    // Check for tool use
    const toolUseBlocks = data.content.filter(block => block.type === 'tool_use');

    if (toolUseBlocks.length > 0) {
      const textBlock = data.content.find(block => block.type === 'text');
      return {
        content: textBlock ? textBlock.text : '',
        toolCalls: toolUseBlocks.map(block => ({
          id: block.id,
          name: block.name,
          args: block.input
        }))
      };
    }

    const textBlock = data.content.find(block => block.type === 'text');
    return {
      content: textBlock ? textBlock.text : '',
      toolCalls: []
    };
  }

  addToolResult(toolCallId, result) {
    if (this.provider === 'anthropic') {
      // Anthropic format
      this.messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolCallId,
          content: JSON.stringify(result)
        }]
      });
    } else {
      // OpenAI format
      this.messages.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: JSON.stringify(result)
      });
    }
  }

  async continueConversation() {
    // Continue conversation after tool execution
    if (this.provider === 'anthropic') {
      return await this.callAnthropic([]);
    } else {
      return await this.callOpenAI([]);
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
