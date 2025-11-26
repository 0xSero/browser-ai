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
    // Set up side panel behavior
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));

    // Listen for messages from side panel
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        // Notify side panel if needed
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'user_message':
          await this.processUserMessage(message.message, message.conversationHistory);
          break;

        case 'execute_tool':
          const result = await this.browserTools.executeTool(message.tool, message.args);
          sendResponse({ success: true, result });
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendToSidePanel({
        type: 'error',
        message: error.message
      });
      sendResponse({ success: false, error: error.message });
    }
  }

  async processUserMessage(userMessage, conversationHistory) {
    try {
      // Get settings
      const settings = await chrome.storage.local.get([
        'provider',
        'apiKey',
        'model',
        'customEndpoint',
        'systemPrompt',
        'sendScreenshotsAsImages',
        'screenshotQuality',
        'showThinking'
      ]);

      if (!settings.apiKey) {
        this.sendToSidePanel({
          type: 'error',
          message: 'Please configure your API key in settings'
        });
        return;
      }

      // Initialize AI provider
      this.aiProvider = new AIProvider(settings);

      // Get available tools
      const tools = this.browserTools.getToolDefinitions();

      // Get current tab info for context
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const context = {
        currentUrl: activeTab?.url || 'unknown',
        currentTitle: activeTab?.title || 'unknown',
        tabId: activeTab?.id
      };

      // Call AI with tools
      const response = await this.aiProvider.chat(
        conversationHistory,
        tools,
        context
      );

      // Process response and handle tool execution loop
      let currentResponse = response;
      let toolIterations = 0;
      const maxIterations = 10; // Safety limit to prevent infinite loops
      let followupAttempts = 0;
      const maxFollowups = 2;

      const hasUsableContent = (resp) =>
        resp && typeof resp.content === 'string' && resp.content.trim().length > 0;

      while (true) {
        // Execute tools until none remain
        while (currentResponse.toolCalls && currentResponse.toolCalls.length > 0) {
          toolIterations++;

          if (toolIterations > maxIterations) {
            console.warn('Reached maximum tool execution iterations');
            this.sendToSidePanel({
              type: 'warning',
              message: 'Reached maximum tool execution limit. Task may be incomplete.'
            });
            currentResponse.toolCalls = [];
            break;
          }

          for (const toolCall of currentResponse.toolCalls) {
            await this.executeToolCall(toolCall);
          }

          currentResponse = await this.aiProvider.continueConversation();
        }

        if (hasUsableContent(currentResponse) || followupAttempts >= maxFollowups) {
          if (!hasUsableContent(currentResponse)) {
            currentResponse.content = currentResponse.content && currentResponse.content.trim()
              ? currentResponse.content
              : 'I completed the requested actions but could not produce a final summary. Please try again.';
          }
          break;
        }

        // Ask the model to finish the task with a final summary before exiting
        this.aiProvider.requestFinalResponse(
          'The user is still waiting for the final answer summarizing the completed task list. Provide the findings now.'
        );
        followupAttempts++;
        currentResponse = await this.aiProvider.continueConversation();
      }

      // Send final response when no more tool calls
      this.sendToSidePanel({
        type: 'assistant_response',
        content: currentResponse.content,
        thinking: currentResponse.thinking
      });
    } catch (error) {
      console.error('Error processing user message:', error);
      this.sendToSidePanel({
        type: 'error',
        message: 'Error: ' + error.message
      });
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
    // Send message to all side panels
    chrome.runtime.sendMessage(message).catch(err => {
      console.log('Side panel not open:', err);
    });
  }
}

// Initialize background service
const backgroundService = new BackgroundService();
