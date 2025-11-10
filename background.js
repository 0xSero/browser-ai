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

      // Process response
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Execute tools
        for (const toolCall of response.toolCalls) {
          await this.executeToolCall(toolCall);
        }

        // Get final response after tool execution
        const finalResponse = await this.aiProvider.continueConversation();
        this.sendToSidePanel({
          type: 'assistant_response',
          content: finalResponse.content,
          thinking: finalResponse.thinking
        });
      } else {
        // Direct text response
        this.sendToSidePanel({
          type: 'assistant_response',
          content: response.content,
          thinking: response.thinking
        });
      }
    } catch (error) {
      console.error('Error processing user message:', error);
      this.sendToSidePanel({
        type: 'error',
        message: 'Error: ' + error.message
      });
    }
  }

  async executeToolCall(toolCall) {
    try {
      this.sendToSidePanel({
        type: 'tool_execution',
        tool: toolCall.name,
        args: toolCall.args,
        result: null
      });

      const result = await this.browserTools.executeTool(toolCall.name, toolCall.args);

      // Send result back to AI provider
      if (this.aiProvider) {
        this.aiProvider.addToolResult(toolCall.id, result);
      }

      // Also send result to side panel for display
      this.sendToSidePanel({
        type: 'tool_execution',
        tool: toolCall.name,
        args: toolCall.args,
        result: result
      });

      return result;
    } catch (error) {
      console.error('Error executing tool:', error);
      const errorResult = { error: error.message };
      if (this.aiProvider) {
        this.aiProvider.addToolResult(toolCall.id, errorResult);
      }
      this.sendToSidePanel({
        type: 'tool_execution',
        tool: toolCall.name,
        args: toolCall.args,
        result: errorResult
      });
      throw error;
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
