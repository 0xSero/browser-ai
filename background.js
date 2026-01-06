// Background Service Worker
import { BrowserTools } from './tools/browser-tools.js';
import { AIProvider } from './ai/provider.js';
import { normalizeConversationHistory, toProviderMessages } from './ai/message-schema.js';

class BackgroundService {
  constructor() {
    this.browserTools = new BrowserTools();
    this.aiProvider = null;
    this.visionProvider = null;
    this.currentSettings = null;
    this.subAgentCount = 0;
    this.subAgentProfileCursor = 0;
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
          await this.processUserMessage(message.message, message.conversationHistory, message.selectedTabs || []);
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

  async processUserMessage(userMessage, conversationHistory, selectedTabs = []) {
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
        'showThinking',
        'streamResponses',
        'configs',
        'activeConfig',
        'useOrchestrator',
        'orchestratorProfile',
        'visionProfile',
        'visionBridge',
        'enableScreenshots',
        'temperature',
        'maxTokens',
        'timeout',
        'toolPermissions',
        'allowedDomains',
        'auxAgentProfiles'
      ]);

      if (settings.enableScreenshots === undefined) settings.enableScreenshots = false;
      if (settings.sendScreenshotsAsImages === undefined) settings.sendScreenshotsAsImages = false;
      if (settings.visionBridge === undefined) settings.visionBridge = true;
      if (!settings.toolPermissions) {
        settings.toolPermissions = {
          read: true,
          interact: true,
          navigate: true,
          tabs: true,
          screenshots: false
        };
      }
      if (settings.allowedDomains === undefined) settings.allowedDomains = '';
      if (!Array.isArray(settings.auxAgentProfiles)) settings.auxAgentProfiles = [];

      if (!settings.apiKey) {
        this.sendToSidePanel({
          type: 'error',
          message: 'Please configure your API key in settings'
        });
        return;
      }

      this.currentSettings = settings;
      this.subAgentCount = 0;
      this.subAgentProfileCursor = 0;

      try {
        await this.browserTools.configureSessionTabs(selectedTabs || [], {
          title: 'Browser AI',
          color: 'blue'
        });
      } catch (error) {
        console.warn('Failed to configure session tabs:', error);
      }

      // Resolve profiles
      const activeProfileName = settings.activeConfig || 'default';
      const orchestratorProfileName = settings.orchestratorProfile || activeProfileName;
      const visionProfileName = settings.visionProfile || null;
      const orchestratorEnabled = settings.useOrchestrator === true;
      const teamProfiles = this.resolveTeamProfiles(settings);

      const activeProfile = this.resolveProfile(settings, activeProfileName);
      const orchestratorProfile = orchestratorEnabled ? this.resolveProfile(settings, orchestratorProfileName) : activeProfile;
      const visionProfile = settings.visionBridge !== false
        ? this.resolveProfile(settings, visionProfileName || activeProfileName)
        : null;

      // Initialize AI providers
      this.aiProvider = new AIProvider({
        ...orchestratorProfile,
        sendScreenshotsAsImages: Boolean(settings.enableScreenshots && settings.sendScreenshotsAsImages)
      });

      this.visionProvider = (visionProfile && visionProfile.apiKey) ? new AIProvider({
        ...visionProfile,
        sendScreenshotsAsImages: true
      }) : null;

      // Get available tools
      const tools = this.getToolsForSession(settings, orchestratorEnabled, teamProfiles);

      // Get current tab info for context
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const sessionTabs = this.browserTools.getSessionTabSummaries();
      const workingTabId = this.browserTools.getCurrentSessionTabId() || activeTab?.id;
      const workingTab = sessionTabs.find(tab => tab.id === workingTabId);
      const context = {
        currentUrl: workingTab?.url || activeTab?.url || 'unknown',
        currentTitle: workingTab?.title || activeTab?.title || 'unknown',
        tabId: workingTabId,
        availableTabs: sessionTabs,
        orchestratorEnabled,
        teamProfiles
      };

      const normalizedHistory = normalizeConversationHistory(conversationHistory || []);
      const providerHistory = toProviderMessages(normalizedHistory);
      const compactedHistory = this.compactConversationHistory(providerHistory);

      // Call AI with tools
      const supportsStreaming = typeof this.aiProvider.supportsStreaming === 'function'
        ? this.aiProvider.supportsStreaming()
        : (settings.provider !== 'anthropic');
      const streamEnabled = supportsStreaming && settings.streamResponses !== false;
      const response = await this.aiProvider.chat(
        compactedHistory,
        tools,
        context,
        {
          stream: streamEnabled,
          streamCallbacks: streamEnabled ? {
            onStart: () => this.sendToSidePanel({ type: 'assistant_stream', status: 'start' }),
            onDelta: (payload) => this.sendToSidePanel({ type: 'assistant_stream', status: 'delta', content: payload?.content || '' }),
            onComplete: () => this.sendToSidePanel({ type: 'assistant_stream', status: 'stop' })
          } : null
        }
      );

      // Process response and handle tool execution loop
      let currentResponse = response;
      let toolIterations = 0;
      const maxIterations = 1000; // Safety limit to prevent infinite loops
      let followupAttempts = 0;
      const maxFollowups = 2;
      let apiRetryCount = 0;
      const maxApiRetries = 3;

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

          // Execute all tool calls (errors are caught and returned to AI, not thrown)
          const toolResults = [];
          for (const toolCall of currentResponse.toolCalls) {
            try {
              const result = await this.executeToolCall(toolCall, this.aiProvider, { silent: false, settings });
              toolResults.push({ id: toolCall.id, success: !result?.error, result });
            } catch (err) {
              console.error('Tool execution error (continuing):', err);
              // Still add the error result so the AI knows what happened
              this.aiProvider.addToolResult(toolCall.id, {
                success: false,
                error: err.message || 'Tool execution failed'
              });
              toolResults.push({ id: toolCall.id, success: false, error: err.message });
            }
          }

          // Continue the conversation (AI will see tool results and decide next action)
          try {
            currentResponse = await this.aiProvider.continueConversation();
            apiRetryCount = 0; // Reset on success
          } catch (continueErr) {
            console.error('Error continuing conversation:', continueErr);
            apiRetryCount++;

            const isToolOrderingError = continueErr.message?.includes('tool call result') ||
              continueErr.message?.includes('tool_call_id');

            if (apiRetryCount < maxApiRetries) {
              // Silent retry with exponential backoff
              console.log(`API error, retry attempt ${apiRetryCount}/${maxApiRetries}`);
              await new Promise(r => setTimeout(r, 500 * apiRetryCount));

              // If tool ordering error persists, try to fix by force-clearing tool history
              if (isToolOrderingError && apiRetryCount >= 2) {
                console.warn('Force-clearing tool history due to persistent errors');
                this.aiProvider.clearToolHistory();
              }

              currentResponse = { content: '', toolCalls: [] };
              // Don't break - let the loop continue and try again
            } else {
              // All retries exhausted - show error but still don't terminate
              this.sendToSidePanel({
                type: 'error',
                message: 'API error after retries: ' + continueErr.message
              });

              // Force-clear tool history and try to get a final response
              if (isToolOrderingError) {
                console.warn('Final recovery: clearing all tool history');
                this.aiProvider.clearToolHistory();
              }

              currentResponse = { content: '', toolCalls: [] };
              // Don't break - try to get final response
            }
          }
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
        thinking: currentResponse.thinking,
        usage: currentResponse.usage
      });
    } catch (error) {
      console.error('Error processing user message:', error);
      this.sendToSidePanel({
        type: 'error',
        message: 'Error: ' + error.message
      });
    }
  }

  async executeToolCall(toolCall, provider = this.aiProvider, options = {}) {
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

      if (toolName === 'getPageContent') {
        toolName = 'getContent';
      }

      console.info('[Browser AI] Executing tool:', toolName || rawName, args);
      if (!options.silent) {
        this.sendToSidePanel({
          type: 'tool_execution',
          tool: toolName || rawName,
          id: toolCall.id,
          args,
          result: null
        });
      }

      if (toolName === 'spawn_subagent') {
        const result = await this.handleSpawnSubagent(toolCall);
        if (provider) provider.addToolResult(toolCall.id, result);
        if (!options.silent) {
          this.sendToSidePanel({
            type: 'tool_execution',
            tool: toolName,
            id: toolCall.id,
            args,
            result
          });
        }
        return result;
      }

      if (toolName === 'subagent_complete') {
        const result = { success: true, ack: true, details: args || {} };
        if (provider) provider.addToolResult(toolCall.id, result);
        if (!options.silent) {
          this.sendToSidePanel({
            type: 'tool_execution',
            tool: toolName,
            id: toolCall.id,
            args,
            result
          });
        }
        return result;
      }

      if (!toolName || !available.includes(toolName)) {
        throw new Error(`Unknown tool: ${toolName || ''}`);
      }

      const permissionCheck = await this.checkToolPermission(toolName, args);
      if (!permissionCheck.allowed) {
        const blocked = { success: false, error: permissionCheck.reason || 'Tool blocked by permissions.' };
        if (provider) provider.addToolResult(toolCall.id, blocked);
        if (!options.silent) {
          this.sendToSidePanel({
            type: 'tool_execution',
            tool: toolName || rawName,
            id: toolCall.id,
            args,
            result: blocked
          });
        }
        return blocked;
      }

      if (toolName === 'screenshot' && this.currentSettings && this.currentSettings.enableScreenshots === false) {
        const blocked = { success: false, error: 'Screenshots are disabled in settings.' };
        if (provider) provider.addToolResult(toolCall.id, blocked);
        if (!options.silent) {
          this.sendToSidePanel({
            type: 'tool_execution',
            tool: toolName,
            id: toolCall.id,
            args,
            result: blocked
          });
        }
        return blocked;
      }

      const result = await this.browserTools.executeTool(toolName, args);

      if (toolName === 'screenshot' && result?.success && result.dataUrl && this.currentSettings?.visionBridge && this.visionProvider) {
        try {
          const description = await this.visionProvider.describeImage(
            result.dataUrl,
            'Provide a concise description of this screenshot so a non-vision model can reason about it.'
          );
          result.visionDescription = description;
          result.message = 'Screenshot captured and described by vision model.';
          // Trim dataUrl when relaying as text to reduce payload
          if (!this.aiProvider?.sendScreenshotsAsImages) {
            delete result.dataUrl;
          }
        } catch (visionError) {
          result.visionError = visionError.message;
        }
      }

      // Ensure result is not null
      const finalResult = result || { error: 'No result returned' };

      // Send result back to AI provider
      if (provider) {
        provider.addToolResult(toolCall.id, finalResult);
      }

      // Also send result to side panel for display
      if (!options.silent) {
        this.sendToSidePanel({
          type: 'tool_execution',
          tool: toolName || rawName,
          id: toolCall.id,
          args,
          result: finalResult
        });
      }
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

  getToolPermissionCategory(toolName) {
    const mapping = {
      navigate: 'navigate',
      openTab: 'navigate',
      click: 'interact',
      type: 'interact',
      pressKey: 'interact',
      scroll: 'interact',
      getContent: 'read',
      screenshot: 'screenshots',
      getTabs: 'tabs',
      closeTab: 'tabs',
      switchTab: 'tabs',
      groupTabs: 'tabs',
      focusTab: 'tabs',
      describeSessionTabs: 'tabs'
    };
    return mapping[toolName] || null;
  }

  parseAllowedDomains(value = '') {
    return String(value)
      .split(/[\n,]/)
      .map(entry => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  isUrlAllowed(url, allowlist) {
    if (!allowlist.length) return true;
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return allowlist.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch (error) {
      return false;
    }
  }

  async resolveToolUrl(toolName, args) {
    if (args?.url) return args.url;
    const tabId = args?.tabId || this.browserTools.getCurrentSessionTabId();
    try {
      if (tabId) {
        const tab = await chrome.tabs.get(tabId);
        return tab?.url || '';
      }
    } catch (error) {
      console.warn('Failed to resolve tab URL for permissions:', error);
    }
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    return active?.url || '';
  }

  async checkToolPermission(toolName, args) {
    if (!this.currentSettings) return { allowed: true };
    const permissions = this.currentSettings.toolPermissions || {};
    const category = this.getToolPermissionCategory(toolName);
    if (category && permissions[category] === false) {
      return { allowed: false, reason: `Permission blocked: ${category}` };
    }

    if (category === 'tabs') return { allowed: true };

    const allowlist = this.parseAllowedDomains(this.currentSettings.allowedDomains || '');
    if (!allowlist.length) return { allowed: true };

    const targetUrl = await this.resolveToolUrl(toolName, args);
    if (!this.isUrlAllowed(targetUrl, allowlist)) {
      return { allowed: false, reason: 'Blocked by allowed domains list.' };
    }

    return { allowed: true };
  }

  sendToSidePanel(message) {
    // Send message to all side panels
    chrome.runtime.sendMessage(message).catch(err => {
      console.log('Side panel not open:', err);
    });
  }

  resolveProfile(settings, name = 'default') {
    const base = {
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      customEndpoint: settings.customEndpoint,
      systemPrompt: settings.systemPrompt,
      sendScreenshotsAsImages: settings.sendScreenshotsAsImages,
      screenshotQuality: settings.screenshotQuality,
      showThinking: settings.showThinking,
      streamResponses: settings.streamResponses,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      timeout: settings.timeout
    };
    const profile = (settings.configs && settings.configs[name]) ? settings.configs[name] : {};
    return { ...base, ...profile };
  }

  resolveTeamProfiles(settings) {
    const names = Array.isArray(settings.auxAgentProfiles) ? settings.auxAgentProfiles : [];
    const unique = Array.from(new Set(names)).filter(name => typeof name === 'string' && name.trim());
    return unique.map(name => {
      const profile = this.resolveProfile(settings, name);
      return {
        name,
        provider: profile.provider || '',
        model: profile.model || ''
      };
    });
  }

  getToolsForSession(settings, includeOrchestrator = false, teamProfiles = []) {
    let tools = this.browserTools.getToolDefinitions();
    if (settings && settings.enableScreenshots === false) {
      tools = tools.filter(tool => tool.name !== 'screenshot');
    }
    if (includeOrchestrator) {
      const teamNames = Array.isArray(teamProfiles) ? teamProfiles.map(profile => profile.name).filter(Boolean) : [];
      const profileSchema = {
        type: 'string',
        description: teamNames.length
          ? `Name of saved profile to use. Available: ${teamNames.join(', ')}`
          : 'Name of saved profile to use.'
      };
      if (teamNames.length) {
        profileSchema.enum = teamNames;
      }
      tools = tools.concat([
        {
          name: 'spawn_subagent',
          description: 'Start a focused sub-agent with its own goal, prompt, and optional profile override.',
          input_schema: {
            type: 'object',
            properties: {
              profile: profileSchema,
              prompt: { type: 'string', description: 'System prompt for the sub-agent' },
              tasks: { type: 'array', items: { type: 'string' }, description: 'Task list for the sub-agent' },
              goal: { type: 'string', description: 'Single goal string if tasks not provided' }
            }
          }
        },
        {
          name: 'subagent_complete',
          description: 'Sub-agent calls this when finished to return a summary payload.',
          input_schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              data: { type: 'object' }
            },
            required: ['summary']
          }
        }
      ]);
    }
    return tools;
  }

  compactConversationHistory(history = []) {
    const maxMessages = 12;
    const maxChars = 6000;
    const safeHistory = Array.isArray(history) ? [...history] : [];

    // Calculate total characters
    const totalChars = safeHistory.reduce((acc, msg) => {
      const content = msg?.content;
      if (typeof content === 'string') return acc + content.length;
      if (Array.isArray(content)) {
        return acc + content.reduce((sum, part) => {
          if (typeof part === 'string') return sum + part.length;
          if (part?.text) return sum + part.text.length;
          if (part?.content) return sum + JSON.stringify(part.content).length;
          return sum;
        }, 0);
      }
      return acc;
    }, 0);

    // If under limits, return as-is
    if (safeHistory.length <= maxMessages && totalChars <= maxChars) {
      return safeHistory;
    }

    // Keep the most recent messages
    const preserveCount = Math.min(8, Math.floor(safeHistory.length / 2));
    const preserved = safeHistory.slice(-preserveCount);
    const trimmed = safeHistory.slice(0, safeHistory.length - preserveCount);

    // Create compact summary of trimmed messages
    const summaryPieces = [];
    for (let i = 0; i < Math.min(trimmed.length, 8); i++) {
      const msg = trimmed[trimmed.length - 1 - i]; // Start from most recent trimmed
      const role = msg?.role || 'unknown';
      let preview = '';
      if (typeof msg?.content === 'string') {
        preview = msg.content.slice(0, 100);
      } else if (Array.isArray(msg?.content)) {
        const textPart = msg.content.find(p => p?.text || typeof p === 'string');
        preview = (textPart?.text || textPart || '').slice(0, 100);
      }
      if (preview) {
        summaryPieces.unshift(`${role}: ${preview}${preview.length >= 100 ? '...' : ''}`);
      }
    }

    const compactNote = {
      role: 'user',
      content: `[Context compacted: ${trimmed.length} earlier messages]\nRecent context:\n${summaryPieces.join('\n')}`
    };

    return [compactNote, ...preserved];
  }

  async handleSpawnSubagent(toolCall) {
    if (this.subAgentCount >= 10) {
      return { success: false, error: 'Sub-agent limit reached for this session (max 10).' };
    }
    this.subAgentCount += 1;
    const subagentId = `subagent-${Date.now()}-${this.subAgentCount}`;
    const args = toolCall?.args || {};
    let profileName = args.profile || args.config;
    if (!profileName) {
      const teamProfiles = Array.isArray(this.currentSettings?.auxAgentProfiles)
        ? this.currentSettings.auxAgentProfiles
        : [];
      if (teamProfiles.length) {
        profileName = teamProfiles[this.subAgentProfileCursor % teamProfiles.length];
        this.subAgentProfileCursor += 1;
      }
    }
    if (!profileName) {
      profileName = this.currentSettings?.activeConfig || 'default';
    }
    const profileSettings = this.resolveProfile(this.currentSettings || {}, profileName);

    // Notify UI about new subagent
    const subagentName = args.name || `Sub-Agent ${this.subAgentCount}`;
    this.sendToSidePanel({
      type: 'subagent_start',
      id: subagentId,
      name: subagentName,
      tasks: args.tasks || [args.goal || args.task || 'Task']
    });

    // Create custom system prompt for sub-agent
    const subAgentSystemPrompt = `${args.prompt || 'You are a focused sub-agent working under an orchestrator. Be concise and tool-driven.'}
Always cite evidence from tools. Finish by calling subagent_complete with a short summary and any structured findings.`;

    const subProvider = new AIProvider({
      ...profileSettings,
      systemPrompt: subAgentSystemPrompt,
      sendScreenshotsAsImages: Boolean((this.currentSettings?.enableScreenshots) && profileSettings.sendScreenshotsAsImages)
    });
    const tools = this.getToolsForSession(this.currentSettings || {}, false);
    const sessionTabs = this.browserTools.getSessionTabSummaries();
    const taskLines = Array.isArray(args.tasks)
      ? args.tasks.map((t, idx) => `${idx + 1}. ${t}`).join('\n')
      : (args.goal || args.task || args.prompt || '');

    // Don't include system message in history - it's passed via provider settings
    const subHistory = [
      {
        role: 'user',
        content: `Task group:\n${taskLines || 'Follow the provided prompt and complete the goal.'}`
      }
    ];

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const context = {
      currentUrl: activeTab?.url || 'unknown',
      currentTitle: activeTab?.title || 'unknown',
      tabId: this.browserTools.getCurrentSessionTabId() || activeTab?.id,
      availableTabs: sessionTabs
    };

    let response = await subProvider.chat(subHistory, tools, context, { stream: false });
    let iterations = 0;
    const maxIterations = 6;

    while (response.toolCalls && response.toolCalls.length > 0 && iterations < maxIterations) {
      for (const call of response.toolCalls) {
        await this.executeToolCall(call, subProvider, { silent: true, settings: this.currentSettings });
      }
      iterations += 1;
      response = await subProvider.continueConversation();
    }

    const summary = response.content || response.thinking || 'Sub-agent finished without a final summary.';

    // Notify UI about subagent completion
    this.sendToSidePanel({
      type: 'subagent_complete',
      id: subagentId,
      success: true,
      summary
    });

    return {
      success: true,
      source: 'subagent',
      id: subagentId,
      name: subagentName,
      summary,
      tasks: taskLines,
      iterations,
      transcriptLength: subProvider.messages.length
    };
  }
}

// Initialize background service
const backgroundService = new BackgroundService();
