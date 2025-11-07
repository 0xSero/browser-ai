// Browser Tools - All browser automation capabilities
export class BrowserTools {
  constructor() {
    this.tools = this.initializeTools();
  }

  initializeTools() {
    return {
      navigate: this.navigate.bind(this),
      click: this.click.bind(this),
      type: this.type.bind(this),
      scroll: this.scroll.bind(this),
      screenshot: this.screenshot.bind(this),
      getPageContent: this.getPageContent.bind(this),
      openTab: this.openTab.bind(this),
      closeTab: this.closeTab.bind(this),
      switchTab: this.switchTab.bind(this),
      createTabGroup: this.createTabGroup.bind(this),
      ungroupTabs: this.ungroupTabs.bind(this),
      getElement: this.getElement.bind(this),
      fillForm: this.fillForm.bind(this),
      executeScript: this.executeScript.bind(this),
      waitForElement: this.waitForElement.bind(this),
      pressKey: this.pressKey.bind(this),
      getAllTabs: this.getAllTabs.bind(this),
      goBack: this.goBack.bind(this),
      goForward: this.goForward.bind(this),
      refresh: this.refresh.bind(this)
    };
  }

  getToolDefinitions() {
    return [
      {
        name: 'navigate',
        description: 'Navigate to a URL in the current tab or a specific tab',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to navigate to' },
            tabId: { type: 'number', description: 'Optional tab ID. If not provided, uses active tab' }
          },
          required: ['url']
        }
      },
      {
        name: 'click',
        description: 'Click on an element on the page using a CSS selector',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the element to click' },
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: ['selector']
        }
      },
      {
        name: 'type',
        description: 'Type text into an input field',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the input element' },
            text: { type: 'string', description: 'Text to type' },
            clear: { type: 'boolean', description: 'Clear existing text first (default: true)' },
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: ['selector', 'text']
        }
      },
      {
        name: 'scroll',
        description: 'Scroll the page',
        input_schema: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'], description: 'Scroll direction' },
            amount: { type: 'number', description: 'Amount to scroll in pixels (for up/down)' },
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: ['direction']
        }
      },
      {
        name: 'screenshot',
        description: 'Take a screenshot of the current visible area of the page',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: []
        }
      },
      {
        name: 'getPageContent',
        description: 'Get the text content, HTML, or specific information from the current page',
        input_schema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['text', 'html', 'title', 'url', 'links'], description: 'Type of content to get' },
            selector: { type: 'string', description: 'Optional CSS selector to get content from specific element' },
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: ['type']
        }
      },
      {
        name: 'openTab',
        description: 'Open a new tab with a URL',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to open' },
            active: { type: 'boolean', description: 'Whether to switch to the new tab (default: true)' }
          },
          required: ['url']
        }
      },
      {
        name: 'closeTab',
        description: 'Close a tab',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab ID to close. If not provided, closes current tab' }
          },
          required: []
        }
      },
      {
        name: 'switchTab',
        description: 'Switch to a different tab',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab ID to switch to' }
          },
          required: ['tabId']
        }
      },
      {
        name: 'getAllTabs',
        description: 'Get information about all open tabs',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'createTabGroup',
        description: 'Create a tab group with specified tabs',
        input_schema: {
          type: 'object',
          properties: {
            tabIds: { type: 'array', items: { type: 'number' }, description: 'Array of tab IDs to group' },
            title: { type: 'string', description: 'Title for the tab group' },
            color: { type: 'string', enum: ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'], description: 'Color for the tab group' }
          },
          required: ['tabIds']
        }
      },
      {
        name: 'ungroupTabs',
        description: 'Remove tabs from their group',
        input_schema: {
          type: 'object',
          properties: {
            tabIds: { type: 'array', items: { type: 'number' }, description: 'Array of tab IDs to ungroup' }
          },
          required: ['tabIds']
        }
      },
      {
        name: 'fillForm',
        description: 'Fill multiple form fields at once',
        input_schema: {
          type: 'object',
          properties: {
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  selector: { type: 'string' },
                  value: { type: 'string' }
                }
              },
              description: 'Array of field objects with selector and value'
            },
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: ['fields']
        }
      },
      {
        name: 'waitForElement',
        description: 'Wait for an element to appear on the page',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector to wait for' },
            timeout: { type: 'number', description: 'Timeout in milliseconds (default: 5000)' },
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: ['selector']
        }
      },
      {
        name: 'goBack',
        description: 'Navigate back in browser history',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: []
        }
      },
      {
        name: 'goForward',
        description: 'Navigate forward in browser history',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: []
        }
      },
      {
        name: 'refresh',
        description: 'Refresh the current page',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: []
        }
      }
    ];
  }

  async executeTool(toolName, args) {
    const tool = this.tools[toolName];
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    return await tool(args);
  }

  async getActiveTabId(providedTabId) {
    if (providedTabId) return providedTabId;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.id;
  }

  // Tool implementations

  async navigate({ url, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await chrome.tabs.update(targetTabId, { url });
    return { success: true, url, tabId: targetTabId };
  }

  async click({ selector, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (sel) => {
        const element = document.querySelector(sel);
        if (!element) return { success: false, error: 'Element not found' };
        element.click();
        return { success: true, selector: sel };
      },
      args: [selector]
    });
    return result[0].result;
  }

  async type({ selector, text, clear = true, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (sel, txt, clr) => {
        const element = document.querySelector(sel);
        if (!element) return { success: false, error: 'Element not found' };

        element.focus();
        if (clr) element.value = '';
        element.value = txt;

        // Trigger input event
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true, selector: sel, text: txt };
      },
      args: [selector, text, clear]
    });
    return result[0].result;
  }

  async scroll({ direction, amount = 500, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (dir, amt) => {
        let scrollOptions = { behavior: 'smooth' };
        switch (dir) {
          case 'up':
            window.scrollBy({ top: -amt, ...scrollOptions });
            break;
          case 'down':
            window.scrollBy({ top: amt, ...scrollOptions });
            break;
          case 'top':
            window.scrollTo({ top: 0, ...scrollOptions });
            break;
          case 'bottom':
            window.scrollTo({ top: document.body.scrollHeight, ...scrollOptions });
            break;
        }
        return { success: true, direction: dir, scrollY: window.scrollY };
      },
      args: [direction, amount]
    });
    return result[0].result;
  }

  async screenshot({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    return { success: true, dataUrl, tabId: targetTabId };
  }

  async getPageContent({ type, selector, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (contentType, sel) => {
        const getContent = () => {
          switch (contentType) {
            case 'text':
              return sel ? document.querySelector(sel)?.innerText : document.body.innerText;
            case 'html':
              return sel ? document.querySelector(sel)?.innerHTML : document.documentElement.outerHTML;
            case 'title':
              return document.title;
            case 'url':
              return window.location.href;
            case 'links':
              return Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.innerText,
                href: a.href
              }));
            default:
              return null;
          }
        };

        const content = getContent();
        return { success: true, type: contentType, content };
      },
      args: [type, selector]
    });
    return result[0].result;
  }

  async openTab({ url, active = true }) {
    const tab = await chrome.tabs.create({ url, active });
    return { success: true, tabId: tab.id, url: tab.url };
  }

  async closeTab({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await chrome.tabs.remove(targetTabId);
    return { success: true, tabId: targetTabId };
  }

  async switchTab({ tabId }) {
    await chrome.tabs.update(tabId, { active: true });
    return { success: true, tabId };
  }

  async getAllTabs() {
    const tabs = await chrome.tabs.query({});
    return {
      success: true,
      tabs: tabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        active: tab.active,
        groupId: tab.groupId
      }))
    };
  }

  async createTabGroup({ tabIds, title, color = 'grey' }) {
    const groupId = await chrome.tabs.group({ tabIds });
    if (title || color) {
      await chrome.tabGroups.update(groupId, {
        title: title || '',
        color: color
      });
    }
    return { success: true, groupId, tabIds };
  }

  async ungroupTabs({ tabIds }) {
    await chrome.tabs.ungroup(tabIds);
    return { success: true, tabIds };
  }

  async fillForm({ fields, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (fieldList) => {
        const results = [];
        for (const field of fieldList) {
          const element = document.querySelector(field.selector);
          if (element) {
            element.value = field.value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            results.push({ selector: field.selector, success: true });
          } else {
            results.push({ selector: field.selector, success: false, error: 'Element not found' });
          }
        }
        return { success: true, results };
      },
      args: [fields]
    });
    return result[0].result;
  }

  async waitForElement({ selector, timeout = 5000, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: async (sel, maxWait) => {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
          const element = document.querySelector(sel);
          if (element) {
            return { success: true, selector: sel, found: true };
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return { success: false, selector: sel, found: false, error: 'Timeout waiting for element' };
      },
      args: [selector, timeout]
    });
    return result[0].result;
  }

  async goBack({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: () => window.history.back()
    });
    return { success: true };
  }

  async goForward({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: () => window.history.forward()
    });
    return { success: true };
  }

  async refresh({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await chrome.tabs.reload(targetTabId);
    return { success: true, tabId: targetTabId };
  }
}
