// Cross-browser compatibility
if (typeof browser === 'undefined') {
  var browser = chrome;
}

// Background Service Worker
import { BrowserTools } from './tools/browser-tools.js';
import { AIProvider } from './ai/provider.js';

class BackgroundService {
  constructor() {
    this.browserTools = new BrowserTools();
    this.aiProvider = null;
    this.init();
  }

  init() {
    // Open the sidebar when the action button is clicked
    browser.action.onClicked.addListener(() => {
      browser.sidebarAction.open();
    });

    // Listen for long-lived connections from side panel
    browser.runtime.onConnect.addListener((port) => {
      this.port = port;
      port.onMessage.addListener((message) => {
        this.handleMessage(message, port);
      });
    });

    // Listen for tab updates
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        // Notify side panel if needed
      }
    });
  }

  async handleMessage(message, port) {
    try {
      switch (message.type) {
        case 'user_message':
          await this.processUserMessage(message.message, message.conversationHistory, message.isInsight);
          break;
        // ... (rest of the switch case)
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendToSidePanel({
        type: 'error',
        message: error.message
      });
    }
  }

  async processUserMessage(userMessage, conversationHistory, isInsight = false) {
    try {
      let finalUserMessage = userMessage;
      let finalConversationHistory = [...conversationHistory];

      // Pre-fetch page content for Deep-Insight requests
      if (isInsight === true) {
        const pageContentResult = await this.tools.getPageContent({ type: 'text' });
        if (pageContentResult.success && pageContentResult.content) {
          finalUserMessage = `Based on the following content, please respond to this request: "${userMessage}"\n\n---\n\nPAGE CONTENT:\n${pageContentResult.content}`;
          finalConversationHistory.pop(); // Remove original short prompt
          finalConversationHistory.push({ role: 'user', content: finalUserMessage });
        }
      }

      // Get settings
      const settings = await browser.storage.local.get([
        'provider',
        'apiKey',
        'model',
        'customEndpoint',
        'systemPrompt',
        'showThinking'
      ]);

      if (!settings.apiKey) {
        this.sendToSidePanel({ type: 'error', message: 'Please configure your API key in settings' });
        return;
      }

      this.aiProvider = new AIProvider(settings);
      const tools = this.browserTools.getToolDefinitions();

      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      const context = {
        currentUrl: activeTab?.url || 'unknown',
        currentTitle: activeTab?.title || 'unknown',
        tabId: activeTab?.id
      };

      const response = await this.aiProvider.chat(
        finalConversationHistory,
        tools,
        context
      );

      let currentResponse = response;
      let toolIterations = 0;
      const maxIterations = 10;

      while (currentResponse.toolCalls && currentResponse.toolCalls.length > 0) {
        toolIterations++;
        if (toolIterations > maxIterations) {
          this.sendToSidePanel({ type: 'warning', message: 'Reached maximum tool execution limit.' });
          break;
        }
        for (const toolCall of currentResponse.toolCalls) {
          await this.executeToolCall(toolCall);
        }
        currentResponse = await this.aiProvider.continueConversation();
      }

      this.sendToSidePanel({
        type: 'assistant_response',
        content: currentResponse.content,
        thinking: currentResponse.thinking,
        isInsight: isInsight
      });
    } catch (error) {
      console.error('Error processing user message:', error);
      this.sendToSidePanel({ type: 'error', message: 'Error: ' + error.message });
    }
  }

  async executeToolCall(toolCall) {
    // Declare in outer scope so catch can reference them safely
    let rawName = '';
    let toolName = '';
    let args = {};
    try {
      // Normalize tool name and attempt a best-effort inference when missing
      rawName = (toolCall && typeof toolCall.name === 'string') ? toolCall.name.trim() : '';
      toolName = rawName;
      args = toolCall?.args || {};

      const available = this.browserTools?.tools ? Object.keys(this.browserTools.tools) : [];
      const known = new Set(available);
      if (!toolName || !known.has(toolName)) {
        // Heuristic inference for common shapes to keep UX flowing
        if (args && typeof args === 'object') {
          if ('type' in args && (args.type === 'text' || args.type === 'html' || args.type === 'title' || args.type === 'url' || args.type === 'links')) {
            toolName = 'getPageContent';
          } else if ('direction' in args) {
            toolName = 'scroll';
          } else if ('selector' in args && 'text' in args === false && 'fields' in args === false) {
            toolName = 'click';
          } else if ('url' in args && Object.keys(args).length === 1) {
            // Likely intent: retrieve current URL; run getPageContent with type 'url'
            toolName = 'getPageContent';
            args = { type: 'url' };
          }
        }
      }

      console.info('[Browser AI] Executing tool:', toolName || rawName, args);
      this.sendToSidePanel({
        type: 'tool_execution',
        tool: toolName || rawName,
        id: toolCall.id,
        args,
        result: null
      });

      if (!toolName || !available.includes(toolName)) {
        throw new Error(`Unknown tool: ${toolName || ''}`);
      }

      const result = await this.browserTools.executeTool(toolName, args);

      // Ensure result is not null
      const finalResult = result || { error: 'No result returned' };

      // Send result back to AI provider
      if (this.aiProvider) {
        this.aiProvider.addToolResult(toolCall.id, finalResult);
      }

      // Also send result to side panel for display
      this.sendToSidePanel({
        type: 'tool_execution',
        tool: toolName || rawName,
        id: toolCall.id,
        args,
        result: finalResult
      });
      console.info('[Browser AI] Tool result:', toolName || rawName, finalResult);

      return finalResult;
    } catch (error) {
      console.error('Error executing tool:', error);
      const errorResult = {
        success: false,
        error: error.message,
        details: 'Tool execution failed. The AI will be informed of this error.'
      };
      if (this.aiProvider) {
        this.aiProvider.addToolResult(toolCall.id, errorResult);
      }
      this.sendToSidePanel({
        type: 'tool_execution',
        tool: toolName || rawName,
        id: toolCall.id,
        args,
        result: errorResult
      });
      console.warn('[Browser AI] Tool error:', toolName || rawName, errorResult);
      // Don't throw - let the AI handle the error and potentially retry
      return errorResult;
    }
  }

  sendToSidePanel(message) {
    if (this.port) {
      try {
        this.port.postMessage(message);
      } catch (error) {
        console.error('Failed to send message to side panel:', error);
        if (error.message.includes('disconnected')) {
          this.port = null;
        }
      }
    } else {
      console.warn('Side panel port not connected. Message not sent:', message);
    }
  }
}

// Initialize background service
const backgroundService = new BackgroundService();
