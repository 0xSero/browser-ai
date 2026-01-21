import { generateText, stepCountIs, streamText } from "ai";
import {
  applyCompaction,
  buildCompactionSummaryMessage,
  shouldCompact,
} from "./ai/compaction.js";
import { normalizeConversationHistory } from "./ai/message-schema.js";
import type { Message } from "./ai/message-schema.js";
import { toModelMessages } from "./ai/model-convert.js";
import {
  buildToolSet,
  describeImageWithModel,
  resolveLanguageModel,
} from "./ai/sdk-client.js";
import { isValidFinalResponse } from "./ai/retry-engine.js";
import { BrowserTools } from "./tools/browser-tools.js";
import { RUNTIME_MESSAGE_SCHEMA_VERSION } from "./types/runtime-messages.js";

type RunMeta = {
  runId: string;
  turnId: string;
  sessionId: string;
};

class BackgroundService {
  browserTools: BrowserTools;
  currentSettings: Record<string, any> | null;
  subAgentCount: number;
  subAgentProfileCursor: number;

  constructor() {
    this.browserTools = new BrowserTools();
    this.currentSettings = null;
    this.subAgentCount = 0;
    this.subAgentProfileCursor = 0;
    this.init();
  }

  init() {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case "user_message":
          await this.processUserMessage(
            message.message,
            message.conversationHistory,
            message.selectedTabs || [],
            message.sessionId || `session-${Date.now()}`,
          );
          break;

        case "execute_tool": {
          const result = await this.browserTools.executeTool(
            message.tool,
            message.args,
          );
          sendResponse({ success: true, result });
          break;
        }

        default:
          console.warn("Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("Error handling message:", error);
      this.sendToSidePanel({
        type: "error",
        message: error.message,
      });
      sendResponse({ success: false, error: error.message });
    }
  }

  async processUserMessage(
    userMessage: string,
    conversationHistory: Message[],
    selectedTabs: chrome.tabs.Tab[] = [],
    sessionId: string,
  ) {
    const runMeta: RunMeta = {
      runId: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      turnId: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId,
    };

    try {
      const settings = await chrome.storage.local.get([
        "provider",
        "apiKey",
        "model",
        "customEndpoint",
        "systemPrompt",
        "sendScreenshotsAsImages",
        "screenshotQuality",
        "showThinking",
        "streamResponses",
        "configs",
        "activeConfig",
        "useOrchestrator",
        "orchestratorProfile",
        "visionProfile",
        "visionBridge",
        "enableScreenshots",
        "temperature",
        "maxTokens",
        "timeout",
        "toolPermissions",
        "allowedDomains",
        "auxAgentProfiles",
      ]);

      if (settings.enableScreenshots === undefined)
        settings.enableScreenshots = false;
      if (settings.sendScreenshotsAsImages === undefined)
        settings.sendScreenshotsAsImages = false;
      if (settings.visionBridge === undefined) settings.visionBridge = true;
      if (!settings.toolPermissions) {
        settings.toolPermissions = {
          read: true,
          interact: true,
          navigate: true,
          tabs: true,
          screenshots: false,
        };
      }
      if (settings.allowedDomains === undefined) settings.allowedDomains = "";
      if (!Array.isArray(settings.auxAgentProfiles))
        settings.auxAgentProfiles = [];

      if (!settings.apiKey) {
        this.sendRuntime(runMeta, {
          type: "run_error",
          message: "Please configure your API key in settings",
        });
        return;
      }

      this.currentSettings = settings;
      this.subAgentCount = 0;
      this.subAgentProfileCursor = 0;

      try {
        await this.browserTools.configureSessionTabs(selectedTabs || [], {
          title: "Browser AI",
          color: "blue",
        });
      } catch (error) {
        console.warn("Failed to configure session tabs:", error);
      }

      const activeProfileName = settings.activeConfig || "default";
      const orchestratorProfileName =
        settings.orchestratorProfile || activeProfileName;
      const visionProfileName = settings.visionProfile || null;
      const orchestratorEnabled = settings.useOrchestrator === true;
      const teamProfiles = this.resolveTeamProfiles(settings);

      const activeProfile = this.resolveProfile(settings, activeProfileName);
      const orchestratorProfile = orchestratorEnabled
        ? this.resolveProfile(settings, orchestratorProfileName)
        : activeProfile;
      const visionProfile =
        settings.visionBridge !== false
          ? this.resolveProfile(
              settings,
              visionProfileName || activeProfileName,
            )
          : null;

      const tools = this.getToolsForSession(
        settings,
        orchestratorEnabled,
        teamProfiles,
      );

      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const sessionTabs = this.browserTools.getSessionTabSummaries();
      const sessionTabContext = sessionTabs
        .filter((tab) => typeof tab.id === "number")
        .map((tab) => ({
          id: tab.id as number,
          title: tab.title,
          url: tab.url,
        }));
      const workingTabId: number | null =
        this.browserTools.getCurrentSessionTabId() ?? activeTab?.id ?? null;
      const workingTab = sessionTabs.find((tab) => tab.id === workingTabId);
      const context = {
        currentUrl: workingTab?.url || activeTab?.url || "unknown",
        currentTitle: workingTab?.title || activeTab?.title || "unknown",
        tabId: workingTabId,
        availableTabs: sessionTabContext,
        orchestratorEnabled,
        teamProfiles,
      };

      const normalizedHistory = normalizeConversationHistory(
        conversationHistory || [],
      );
      const modelMessages = toModelMessages(normalizedHistory);
      const model = resolveLanguageModel(orchestratorProfile);

      const toolSet = buildToolSet(tools, async (toolName, args, options) =>
        this.executeToolByName(
          toolName,
          args,
          {
            runMeta,
            settings,
            visionProfile,
          },
          options.toolCallId,
        ),
      );

      const streamEnabled = settings.streamResponses !== false;
      if (streamEnabled) {
        this.sendRuntime(runMeta, { type: "assistant_stream_start" });
      }

      const result = streamText({
        model,
        system: this.enhanceSystemPrompt(
          orchestratorProfile.systemPrompt || "",
          context,
        ),
        messages: modelMessages,
        tools: toolSet,
        temperature: orchestratorProfile.temperature ?? 0.7,
        maxOutputTokens: orchestratorProfile.maxTokens ?? 2048,
        stopWhen: stepCountIs(8),
        onChunk: ({ chunk }) => {
          if (chunk.type === "reasoning-delta") {
            this.sendRuntime(runMeta, {
              type: "assistant_stream_delta",
              content: chunk.text || "",
              channel: "reasoning",
            });
          }
        },
      });

      if (streamEnabled) {
        try {
          for await (const textPart of result.textStream) {
            this.sendRuntime(runMeta, {
              type: "assistant_stream_delta",
              content: textPart || "",
              channel: "text",
            });
          }
        } finally {
          this.sendRuntime(runMeta, { type: "assistant_stream_stop" });
        }
      } else {
        await result.text;
      }

      const [text, reasoningText, totalUsage, steps] = await Promise.all([
        result.text,
        result.reasoningText,
        result.totalUsage,
        result.steps,
      ]);

      const toolResults = steps.flatMap((step) => step.toolResults || []);
      const hadToolCalls = toolResults.length > 0;
      
      // Allow empty text if tools were called (model communicated through actions)
      // But encourage actual summaries via system prompt
      const finalText = isValidFinalResponse(text, { allowEmpty: hadToolCalls })
        ? (text || (hadToolCalls ? "" : "Done."))
        : "I completed the requested actions but could not produce a final summary. Please try again.";
      const responseMessages: Message[] = [
        {
          role: "assistant",
          content: finalText,
          thinking: reasoningText || null,
        },
      ];
      if (toolResults.length > 0) {
        responseMessages.push({
          role: "tool",
          content: toolResults.map((resultItem) => ({
            type: "tool-result",
            toolCallId: resultItem.toolCallId,
            toolName: resultItem.toolName,
            output:
              resultItem.output && typeof resultItem.output === "object"
                ? { type: "json", value: resultItem.output }
                : { type: "text", value: String(resultItem.output ?? "") },
          })),
        });
      }

      this.sendRuntime(runMeta, {
        type: "assistant_final",
        content: finalText,
        thinking: reasoningText || null,
        usage: {
          inputTokens: totalUsage.inputTokens || 0,
          outputTokens: totalUsage.outputTokens || 0,
          totalTokens: totalUsage.totalTokens || 0,
        },
        responseMessages,
      });

      const nextHistory = normalizeConversationHistory([
        ...normalizedHistory,
        ...responseMessages,
      ]);
      const contextLimit =
        orchestratorProfile.contextLimit || settings.contextLimit || 200000;
      const compactionCheck = shouldCompact({
        messages: nextHistory,
        contextLimit,
      });

      if (compactionCheck.shouldCompact) {
        const preservedCount = Math.min(10, Math.floor(nextHistory.length / 2));
        const preserved = nextHistory.slice(-preservedCount);
        const trimmedCount = nextHistory.length - preservedCount;

        const summaryPrompt =
          "Summarize the conversation so far for the next model run. Include: user goals, key context, decisions, tool outputs, open tasks, and constraints. Use bullet points. Keep it between 1,000 and 2,000 tokens.";
        const summaryResult = await generateText({
          model,
          system: summaryPrompt,
          messages: toModelMessages(nextHistory),
          temperature: 0.2,
          maxOutputTokens: 1600,
        });

        const summaryMessage = buildCompactionSummaryMessage(
          summaryResult.text,
          trimmedCount,
        );
        const compaction = applyCompaction({
          summaryMessage,
          preserved,
          trimmedCount,
        });
        const newSessionId = `session-${Date.now()}`;

        this.sendRuntime(runMeta, {
          type: "context_compacted",
          summary: summaryResult.text,
          trimmedCount,
          preservedCount: compaction.preservedCount,
          newSessionId,
          contextMessages: compaction.compacted,
          contextUsage: {
            approxTokens: compactionCheck.approxTokens,
            contextLimit,
            percent: Math.round(compactionCheck.percent * 100),
          },
        });
      }
    } catch (error) {
      console.error("Error processing user message:", error);
      this.sendRuntime(runMeta, {
        type: "run_error",
        message: error.message || "Unknown error",
      });
    }
  }

  async executeToolByName(
    toolName: string,
    args: Record<string, any>,
    options: {
      runMeta: RunMeta;
      settings: Record<string, any>;
      visionProfile?: Record<string, any> | null;
    },
    toolCallId?: string,
  ) {
    const callId =
      toolCallId ||
      `tool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sendStart = () =>
      this.sendRuntime(options.runMeta, {
        type: "tool_execution_start",
        tool: toolName,
        id: callId,
        args,
      });
    const sendResult = (result: unknown) =>
      this.sendRuntime(options.runMeta, {
        type: "tool_execution_result",
        tool: toolName,
        id: callId,
        args,
        result,
      });

    sendStart();

    if (toolName === "spawn_subagent") {
      const result = await this.handleSpawnSubagent(options.runMeta, args);
      sendResult(result);
      return result;
    }

    if (toolName === "subagent_complete") {
      const result = { success: true, ack: true, details: args || {} };
      sendResult(result);
      return result;
    }

    const available = this.browserTools?.tools
      ? Object.keys(this.browserTools.tools)
      : [];
    if (!available.includes(toolName)) {
      const errorResult = {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
      sendResult(errorResult);
      return errorResult;
    }

    const permissionCheck = await this.checkToolPermission(toolName, args);
    if (!permissionCheck.allowed) {
      const blocked = {
        success: false,
        error: permissionCheck.reason || "Tool blocked by permissions.",
        policy: permissionCheck.policy,
      };
      sendResult(blocked);
      return blocked;
    }

    if (
      toolName === "screenshot" &&
      this.currentSettings?.enableScreenshots === false
    ) {
      const blocked = {
        success: false,
        error: "Screenshots are disabled in settings.",
      };
      sendResult(blocked);
      return blocked;
    }

    let result: any;
    try {
      result = await this.browserTools.executeTool(toolName, args);
    } catch (error) {
      const errorResult = {
        success: false,
        error: error?.message || String(error) || "Tool execution failed",
      };
      sendResult(errorResult);
      return errorResult;
    }

    const finalResult = result || { error: "No result returned" };

    if (
      toolName === "screenshot" &&
      finalResult?.success &&
      finalResult.dataUrl &&
      this.currentSettings?.visionBridge &&
      options.visionProfile?.apiKey
    ) {
      try {
        const description = await describeImageWithModel({
          settings: {
            provider: options.visionProfile.provider,
            apiKey: options.visionProfile.apiKey,
            model: options.visionProfile.model,
            customEndpoint: options.visionProfile.customEndpoint,
          },
          dataUrl: finalResult.dataUrl,
          prompt:
            "Provide a concise description of this screenshot for a non-vision model.",
        });
        finalResult.visionDescription = description;
        finalResult.message =
          "Screenshot captured and described by vision model.";
        if (!this.currentSettings?.sendScreenshotsAsImages) {
          delete finalResult.dataUrl;
        }
      } catch (visionError) {
        finalResult.visionError = visionError.message;
      }
    }

    sendResult(finalResult);
    return finalResult;
  }

  getToolPermissionCategory(toolName) {
    const mapping = {
      navigate: "navigate",
      openTab: "navigate",
      click: "interact",
      type: "interact",
      pressKey: "interact",
      scroll: "interact",
      getContent: "read",
      screenshot: "screenshots",
      getTabs: "tabs",
      closeTab: "tabs",
      switchTab: "tabs",
      groupTabs: "tabs",
      focusTab: "tabs",
      describeSessionTabs: "tabs",
    };
    return mapping[toolName] || null;
  }

  parseAllowedDomains(value = "") {
    return String(value)
      .split(/[\n,]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  isUrlAllowed(url, allowlist) {
    if (!allowlist.length) return true;
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return allowlist.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
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
        return tab?.url || "";
      }
    } catch (error) {
      console.warn("Failed to resolve tab URL for permissions:", error);
    }
    const [active] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return active?.url || "";
  }

  async checkToolPermission(toolName, args) {
    if (!this.currentSettings) return { allowed: true };
    const permissions = this.currentSettings.toolPermissions || {};
    const category = this.getToolPermissionCategory(toolName);
    if (category && permissions[category] === false) {
      return {
        allowed: false,
        reason: `Permission blocked: ${category}`,
        policy: {
          type: "permission",
          category,
          reason: `Permission blocked: ${category}`,
        },
      };
    }

    if (category === "tabs") return { allowed: true };

    const allowlist = this.parseAllowedDomains(
      this.currentSettings.allowedDomains || "",
    );
    if (!allowlist.length) return { allowed: true };

    const targetUrl = await this.resolveToolUrl(toolName, args);
    if (!this.isUrlAllowed(targetUrl, allowlist)) {
      return {
        allowed: false,
        reason: "Blocked by allowed domains list.",
        policy: {
          type: "allowlist",
          domain: targetUrl,
          reason: "Blocked by allowed domains list.",
        },
      };
    }

    return { allowed: true };
  }

  sendRuntime(runMeta: RunMeta, payload: Record<string, unknown>) {
    this.sendToSidePanel({
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      runId: runMeta.runId,
      turnId: runMeta.turnId,
      sessionId: runMeta.sessionId,
      timestamp: Date.now(),
      ...payload,
    });
  }

  sendToSidePanel(message) {
    chrome.runtime.sendMessage(message).catch((err) => {
      console.log("Side panel not open:", err);
    });
  }

  enhanceSystemPrompt(basePrompt: string, context) {
    const tabsSection =
      Array.isArray(context.availableTabs) && context.availableTabs.length
        ? `Tabs selected (${context.availableTabs.length}). Use focusTab or switchTab before acting:\n${context.availableTabs
            .map(
              (tab) =>
                `  - [${tab.id}] ${tab.title || "Untitled"} - ${tab.url}`,
            )
            .join("\n")}`
        : "No additional tabs selected; actions target the current tab.";
    const teamProfiles = Array.isArray(context.teamProfiles)
      ? context.teamProfiles
      : [];
    const teamSection = teamProfiles.length
      ? `Team profiles available for sub-agents:\n${teamProfiles
          .map(
            (profile) =>
              `  - ${profile.name}: ${profile.provider || "provider"} · ${profile.model || "model"}`,
          )
          .join(
            "\n",
          )}\nUse spawn_subagent with a profile name to delegate parallel browser work.`
      : "";
    const orchestratorSection = context.orchestratorEnabled
      ? "Orchestrator mode is enabled."
      : "";

    return `${basePrompt}

Context:
- URL: ${context.currentUrl}
- Title: ${context.currentTitle}
- Tab ID: ${context.tabId}
${tabsSection ? `- ${tabsSection}` : ""}
${orchestratorSection ? `\n${orchestratorSection}` : ""}
${teamSection ? `\n${teamSection}` : ""}

Tool discipline:
1. Never invent or summarize page content you did not fetch with getContent.
2. After every scroll, navigation, or tab switch, run getContent for the new region before replying.
3. Chain tools until you have concrete evidence you can cite.
4. With multiple tabs, announce the active tab via focusTab/switchTab and use describeSessionTabs to recall IDs.

Safety:
- Do not install software, extensions, or change browser/system settings.
- Avoid destructive actions (deleting history, logging out, posting messages) unless the user explicitly asked.
- Stay within the provided tabs; do not open unknown or suspicious URLs.
- Prefer gentle edits: use type/focus tools instead of wholesale replacements when editing text areas.

Response format:
When you complete a task, ALWAYS provide a brief summary report with:
1. **Task**: What the user asked for (1 line)
2. **Actions**: Key steps you took (bullet points)
3. **Result**: What you found or accomplished

Keep it concise but informative. Never respond with just "Done." - the user needs to know what happened.

Base every answer strictly on real tool output.`;
  }

  resolveProfile(settings: Record<string, any>, name = "default") {
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
      timeout: settings.timeout,
      contextLimit: settings.contextLimit,
      enableScreenshots: settings.enableScreenshots,
    };
    const profile =
      settings.configs && settings.configs[name] ? settings.configs[name] : {};
    return { ...base, ...profile };
  }

  resolveTeamProfiles(settings: Record<string, any>) {
    const names = Array.isArray(settings.auxAgentProfiles)
      ? settings.auxAgentProfiles
      : [];
    const unique = Array.from(new Set(names)).filter(
      (name): name is string =>
        typeof name === "string" && name.trim().length > 0,
    );
    return unique.map((name) => {
      const profile = this.resolveProfile(settings, name);
      return {
        name,
        provider: profile.provider || "",
        model: profile.model || "",
      };
    });
  }

  getToolsForSession(
    settings: Record<string, any>,
    includeOrchestrator = false,
    teamProfiles: Array<{ name: string }> = [],
  ) {
    let tools = this.browserTools.getToolDefinitions();
    if (settings && settings.enableScreenshots === false) {
      tools = tools.filter((tool) => tool.name !== "screenshot");
    }
    if (includeOrchestrator) {
      const teamNames = Array.isArray(teamProfiles)
        ? teamProfiles.map((profile) => profile.name).filter(Boolean)
        : [];
      const profileSchema: {
        type: string;
        description: string;
        enum?: string[];
      } = {
        type: "string",
        description: teamNames.length
          ? `Name of saved profile to use. Available: ${teamNames.join(", ")}`
          : "Name of saved profile to use.",
      };
      if (teamNames.length) {
        profileSchema.enum = teamNames;
      }
      tools = tools.concat([
        {
          name: "spawn_subagent",
          description:
            "Start a focused sub-agent with its own goal, prompt, and optional profile override.",
          input_schema: {
            type: "object",
            properties: {
              profile: profileSchema,
              prompt: {
                type: "string",
                description: "System prompt for the sub-agent",
              },
              tasks: {
                type: "array",
                items: { type: "string" },
                description: "Task list for the sub-agent",
              },
              goal: {
                type: "string",
                description: "Single goal string if tasks not provided",
              },
            },
          },
        },
        {
          name: "subagent_complete",
          description:
            "Sub-agent calls this when finished to return a summary payload.",
          input_schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              data: { type: "object" },
            },
            required: ["summary"],
          },
        },
      ]);
    }
    return tools;
  }

  async handleSpawnSubagent(runMeta: RunMeta, args) {
    if (this.subAgentCount >= 10) {
      return {
        success: false,
        error: "Sub-agent limit reached for this session (max 10).",
      };
    }
    this.subAgentCount += 1;
    const subagentId = `subagent-${Date.now()}-${this.subAgentCount}`;
    let profileName = args.profile || args.config;
    if (!profileName) {
      const teamProfiles = Array.isArray(this.currentSettings?.auxAgentProfiles)
        ? this.currentSettings.auxAgentProfiles
        : [];
      if (teamProfiles.length) {
        profileName =
          teamProfiles[this.subAgentProfileCursor % teamProfiles.length];
        this.subAgentProfileCursor += 1;
      }
    }
    if (!profileName) {
      profileName = this.currentSettings?.activeConfig || "default";
    }
    const profileSettings = this.resolveProfile(
      this.currentSettings || {},
      profileName,
    );

    const subagentName = args.name || `Sub-Agent ${this.subAgentCount}`;
    this.sendRuntime(runMeta, {
      type: "subagent_start",
      id: subagentId,
      name: subagentName,
      tasks: args.tasks || [args.goal || args.task || "Task"],
    });

    const subAgentSystemPrompt = `${args.prompt || "You are a focused sub-agent working under an orchestrator. Be concise and tool-driven."}
Always cite evidence from tools. Finish by calling subagent_complete with a short summary and any structured findings.`;

    const tools = this.getToolsForSession(this.currentSettings || {}, false);
    const toolSet = buildToolSet(tools, async (toolName, toolArgs, options) =>
      this.executeToolByName(
        toolName,
        toolArgs,
        {
          runMeta,
          settings: this.currentSettings || {},
          visionProfile: null,
        },
        options.toolCallId,
      ),
    );

    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const sessionTabs = this.browserTools.getSessionTabSummaries();
    const sessionTabContext = sessionTabs
      .filter((tab) => typeof tab.id === "number")
      .map((tab) => ({ id: tab.id as number, title: tab.title, url: tab.url }));
    const taskLines = Array.isArray(args.tasks)
      ? args.tasks.map((t, idx) => `${idx + 1}. ${t}`).join("\n")
      : args.goal || args.task || args.prompt || "";

    const subHistory: Message[] = [
      {
        role: "user",
        content: `Task group:\n${taskLines || "Follow the provided prompt and complete the goal."}`,
      },
    ];

    const subModel = resolveLanguageModel(profileSettings);
    const result = streamText({
      model: subModel,
      system: subAgentSystemPrompt,
      messages: toModelMessages(subHistory),
      tools: toolSet,
      temperature: profileSettings.temperature ?? 0.4,
      maxOutputTokens: profileSettings.maxTokens ?? 1024,
      stopWhen: stepCountIs(6),
    });

    const summary =
      (await result.text) || "Sub-agent finished without a final summary.";

    this.sendRuntime(runMeta, {
      type: "subagent_complete",
      id: subagentId,
      success: true,
      summary,
    });

    return {
      success: true,
      source: "subagent",
      id: subagentId,
      name: subagentName,
      summary,
      tasks: taskLines,
    };
  }
}

const backgroundService = new BackgroundService();
