type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

type SessionTabSummary = {
  id: number;
  title?: string;
  url?: string;
};

type GroupOptions = {
  title?: string;
  color?: chrome.tabGroups.ColorEnum;
};

// Maximum number of tabs allowed per session to prevent runaway tab creation
const MAX_SESSION_TABS = 5;

export class BrowserTools {
  tools: Record<string, true>;
  private sessionTabs: Map<number, SessionTabSummary>;
  private currentSessionTabId: number | null;
  private sessionTabGroupId: number | null;

  constructor() {
    this.sessionTabs = new Map();
    this.currentSessionTabId = null;
    this.sessionTabGroupId = null;
    this.tools = {
      navigate: true,
      openTab: true,
      click: true,
      type: true,
      pressKey: true,
      scroll: true,
      getContent: true,
      screenshot: true,
      getTabs: true,
      closeTab: true,
      switchTab: true,
      focusTab: true,
      groupTabs: true,
      describeSessionTabs: true,
    };
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'navigate',
        description: 'Navigate the current tab to a URL.',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Absolute URL to visit.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
          required: ['url'],
        },
      },
      {
        name: 'openTab',
        description: `Open a new tab with a URL. Limited to ${MAX_SESSION_TABS} tabs per session - prefer navigating existing tabs over opening new ones.`,
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Absolute URL to open.' },
          },
          required: ['url'],
        },
      },
      {
        name: 'click',
        description: 'Click an element by CSS selector.',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector to click.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'type',
        description: 'Type text into an input or textarea.',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the input.' },
            text: { type: 'string', description: 'Text to enter.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'pressKey',
        description: 'Press a key in the page.',
        input_schema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Keyboard key (e.g., Enter, ArrowDown).' },
            selector: { type: 'string', description: 'Optional selector to target.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
          required: ['key'],
        },
      },
      {
        name: 'scroll',
        description: 'Scroll the page.',
        input_schema: {
          type: 'object',
          properties: {
            direction: { type: 'string', description: 'up, down, top, or bottom.' },
            amount: { type: 'number', description: 'Scroll amount in pixels.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
        },
      },
      {
        name: 'getContent',
        description: 'Extract page content.',
        input_schema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'text, html, title, url, or links.' },
            selector: { type: 'string', description: 'Optional selector to scope content.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
        },
      },
      {
        name: 'screenshot',
        description: 'Capture a screenshot of the current tab.',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
        },
      },
      {
        name: 'getTabs',
        description: 'List tabs in the current window.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'closeTab',
        description: 'Close a tab by id.',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab id to close.' },
          },
          required: ['tabId'],
        },
      },
      {
        name: 'switchTab',
        description: 'Activate a tab by id.',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab id to activate.' },
          },
          required: ['tabId'],
        },
      },
      {
        name: 'focusTab',
        description: 'Focus a tab by id.',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab id to focus.' },
          },
          required: ['tabId'],
        },
      },
      {
        name: 'groupTabs',
        description: 'Group tabs together with an optional name and color.',
        input_schema: {
          type: 'object',
          properties: {
            tabIds: { type: 'array', items: { type: 'number' }, description: 'Tabs to group.' },
            title: { type: 'string', description: 'Group title.' },
            color: { type: 'string', description: 'Group color name.' },
          },
        },
      },
      {
        name: 'describeSessionTabs',
        description: 'List tabs captured for this session.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  getSessionTabSummaries(): SessionTabSummary[] {
    return Array.from(this.sessionTabs.values());
  }

  getCurrentSessionTabId(): number | null {
    return this.currentSessionTabId;
  }

  async configureSessionTabs(tabs: chrome.tabs.Tab[], options: GroupOptions = {}) {
    this.sessionTabs.clear();
    this.sessionTabGroupId = null;
    tabs.forEach((tab) => {
      if (typeof tab.id !== 'number') return;
      this.sessionTabs.set(tab.id, { id: tab.id, title: tab.title, url: tab.url });
      if (!this.currentSessionTabId) {
        this.currentSessionTabId = tab.id;
      }
    });
    if (tabs.length > 0) {
      // Create session tab group with "Parchi" title and blue color
      await this.ensureSessionTabGroup({ title: options.title || 'Parchi', color: options.color || 'blue' });
    }
  }

  async ensureSessionTabGroup(options: GroupOptions = { title: 'Parchi', color: 'blue' }) {
    const sessionTabIds = Array.from(this.sessionTabs.keys());
    if (sessionTabIds.length === 0) return;

    try {
      if (this.sessionTabGroupId !== null) {
        // Add tabs to existing group
        await chrome.tabs.group({ groupId: this.sessionTabGroupId, tabIds: sessionTabIds });
      } else {
        // Create new group
        const groupId = await chrome.tabs.group({ tabIds: sessionTabIds });
        await chrome.tabGroups.update(groupId, {
          title: options.title || 'Parchi',
          color: options.color || 'blue',
          collapsed: false,
        });
        this.sessionTabGroupId = groupId;
      }
    } catch (error) {
      // Tab grouping may fail in some Chrome configurations, fail silently
      console.warn('Failed to group tabs:', error);
    }
  }

  async executeTool(toolName: string, args: Record<string, any> = {}) {
    try {
      switch (toolName) {
        case 'navigate':
          return await this.navigate(args);
        case 'openTab':
          return await this.openTab(args);
        case 'click':
          return await this.click(args);
        case 'type':
          return await this.type(args);
        case 'pressKey':
          return await this.pressKey(args);
        case 'scroll':
          return await this.scroll(args);
        case 'getContent':
          return await this.getContent(args);
        case 'screenshot':
          return await this.screenshot(args);
      case 'getTabs':
        return await this.getTabs();
      case 'closeTab':
        return await this.closeTab(args);
      case 'switchTab':
        return await this.focusTab(args);
      case 'focusTab':
        return await this.focusTab(args);
      case 'groupTabs':
        return await this.groupTabs(args);
      case 'describeSessionTabs':
        return {
          success: true,
          tabs: this.getSessionTabSummaries(),
          tabCount: this.sessionTabs.size,
          maxTabs: MAX_SESSION_TABS,
          canOpenMore: this.sessionTabs.size < MAX_SESSION_TABS,
        };
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      // Catch any unhandled errors in tool execution
      console.error(`Tool execution error (${toolName}):`, error);
      return {
        success: false,
        error: `Tool "${toolName}" failed: ${error?.message || String(error)}`,
        hint: 'Try a different approach or check the arguments.',
      };
    }
  }

  private async resolveTabId(args: Record<string, any> = {}) {
    if (typeof args.tabId === 'number') return args.tabId;
    if (this.currentSessionTabId) return this.currentSessionTabId;
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    return active?.id ?? null;
  }

  private async runInTab(tabId: number, func: (...args: any[]) => unknown, args: any[] = []): Promise<any> {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
    });
    return results?.[0]?.result ?? null;
  }

  private async navigate(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) return { success: false, error: 'No active tab.' };
    
    const url = args.url;
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Missing or invalid url parameter.' };
    }
    
    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('chrome://')) {
      return { 
        success: false, 
        error: `Invalid URL: "${url}". URLs must start with http://, https://, or chrome://`,
        hint: 'For Google searches, use: https://www.google.com/search?q=your+query',
      };
    }
    
    try {
      await chrome.tabs.update(tabId, { url });
      this.currentSessionTabId = tabId;
      return { success: true, tabId, url };
    } catch (error) {
      return { 
        success: false, 
        error: `Navigation failed: ${error?.message || String(error)}`,
      };
    }
  }

  private async openTab(args: Record<string, any>) {
    // Enforce tab limit to prevent runaway tab creation
    if (this.sessionTabs.size >= MAX_SESSION_TABS) {
      return {
        success: false,
        error: `Tab limit reached (max ${MAX_SESSION_TABS} tabs per session). Close existing tabs with closeTab or use navigate on current tab.`,
        hint: 'Use closeTab({ tabId: <id> }) to close a tab, or navigate({ url: "..." }) to reuse current tab.',
      };
    }
    
    // Validate URL
    const url = args.url;
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Missing or invalid url parameter.' };
    }
    
    // Check if it looks like a valid URL
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('chrome://')) {
      return { 
        success: false, 
        error: `Invalid URL: "${url}". URLs must start with http://, https://, or chrome://`,
        hint: 'Use navigate({ url: "https://google.com/search?q=..." }) for searches.',
      };
    }
    
    try {
      const tab = await chrome.tabs.create({ url, active: true });
      if (tab.id) {
        this.sessionTabs.set(tab.id, { id: tab.id, title: tab.title, url: tab.url });
        this.currentSessionTabId = tab.id;
        // Add new tab to session group
        await this.ensureSessionTabGroup();
      }
      return { success: true, tabId: tab.id, url };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to open tab: ${error?.message || String(error)}`,
        hint: 'Try using navigate() on current tab instead.',
      };
    }
  }

  private async focusTab(args: Record<string, any>) {
    const tabId = typeof args.tabId === 'number' ? args.tabId : null;
    if (!tabId) return { success: false, error: 'Missing tabId.' };
    await chrome.tabs.update(tabId, { active: true });
    this.currentSessionTabId = tabId;
    return { success: true, tabId };
  }

  private async closeTab(args: Record<string, any>) {
    const tabId = typeof args.tabId === 'number' ? args.tabId : null;
    if (!tabId) return { success: false, error: 'Missing tabId.' };
    await chrome.tabs.remove(tabId);
    this.sessionTabs.delete(tabId);
    if (this.currentSessionTabId === tabId) {
      this.currentSessionTabId = null;
    }
    return { success: true, tabId };
  }

  private async click(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) return { success: false, error: 'No active tab.' };
    const selector = String(args.selector || '');
    const result = await this.runInTab(
      tabId,
      (sel) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return { success: false, error: 'Element not found.' };
        el.click();
        return { success: true };
      },
      [selector],
    );
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async type(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) return { success: false, error: 'No active tab.' };
    const selector = String(args.selector || '');
    const text = String(args.text ?? '');
    const result = await this.runInTab(
      tabId,
      (sel, value) => {
        const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel);
        if (!el) return { success: false, error: 'Element not found.' };
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      },
      [selector, text],
    );
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async pressKey(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) return { success: false, error: 'No active tab.' };
    const key = String(args.key || '');
    const selector = args.selector ? String(args.selector) : '';
    const result = await this.runInTab(
      tabId,
      (k, sel) => {
        const target = sel ? document.querySelector<HTMLElement>(sel) : document.body;
        if (!target) return { success: false, error: 'Target not found.' };
        target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
        return { success: true };
      },
      [key, selector],
    );
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async scroll(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) return { success: false, error: 'No active tab.' };
    const direction = String(args.direction || 'down');
    const amount = typeof args.amount === 'number' ? args.amount : 600;
    const result = await this.runInTab(
      tabId,
      (dir, amt) => {
        if (dir === 'top') {
          window.scrollTo({ top: 0, behavior: 'instant' });
        } else if (dir === 'bottom') {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
        } else if (dir === 'up') {
          window.scrollBy({ top: -amt, behavior: 'instant' });
        } else {
          window.scrollBy({ top: amt, behavior: 'instant' });
        }
        return { success: true };
      },
      [direction, amount],
    );
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async getContent(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) return { success: false, error: 'No active tab.' };
    const type = String(args.type || args.mode || 'text');
    const selector = args.selector ? String(args.selector) : '';
    const maxChars = typeof args.maxChars === 'number' && args.maxChars > 0 ? args.maxChars : 8000;
    const result = await this.runInTab(
      tabId,
      (t, sel, limit) => {
        const base = sel ? document.querySelector<HTMLElement>(sel) : document.body;
        if (!base) return { success: false, error: 'Target not found.' };
        const normalizedType = ['text', 'html', 'title', 'url', 'links'].includes(t) ? t : 'text';
        const truncate = (value: string) => {
          const length = value.length;
          if (length <= limit) {
            return { content: value, truncated: false, contentLength: length };
          }
          return { content: value.slice(0, limit), truncated: true, contentLength: length };
        };
        if (normalizedType === 'html') {
          const result = truncate(base.innerHTML);
          return { success: true, ...result };
        }
        if (normalizedType === 'title') {
          const result = truncate(document.title || '');
          return { success: true, ...result };
        }
        if (normalizedType === 'url') {
          const result = truncate(window.location.href || '');
          return { success: true, ...result };
        }
        if (normalizedType === 'links') {
          const links = Array.from(base.querySelectorAll('a'))
            .slice(0, 200)
            .map((link) => ({
              text: link.textContent || '',
              href: link.href,
            }));
          const result = truncate(JSON.stringify(links));
          return { success: true, items: links.length, ...result };
        }
        const result = truncate(base.innerText || '');
        return { success: true, ...result };
      },
      [type, selector, maxChars],
    );
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async screenshot(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) return { success: false, error: 'No active tab.' };
    const tab = await chrome.tabs.get(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    return { success: true, dataUrl };
  }

  private async getTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return {
      success: true,
      tabs: tabs.map((tab) => ({ id: tab.id, title: tab.title, url: tab.url })),
    };
  }

  private async groupTabs(args: Record<string, any>) {
    const tabIds = Array.isArray(args.tabIds) ? args.tabIds.filter((id) => typeof id === 'number') : [];
    if (!tabIds.length) {
      return { success: false, error: 'No tab ids provided.' };
    }
    await this.groupTabsInternal(tabIds, { title: args.title, color: args.color });
    return { success: true, tabIds };
  }

  private async groupTabsInternal(tabIds: number[], options: GroupOptions) {
    if (!tabIds.length) return;
    const groupId = await chrome.tabs.group({ tabIds });
    if (options.title || options.color) {
      await chrome.tabGroups.update(groupId, {
        title: options.title,
        color: options.color,
      });
    }
  }
}
