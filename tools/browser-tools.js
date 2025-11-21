// Cross-browser compatibility
if (typeof browser === 'undefined') {
  var browser = chrome;
}

// Browser Automation Tools
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
      fillForm: this.fillForm.bind(this),
      waitForElement: this.waitForElement.bind(this),
      getAllTabs: this.getAllTabs.bind(this),
      goBack: this.goBack.bind(this),
      goForward: this.goForward.bind(this),
      refresh: this.refresh.bind(this),
      searchHistory: this.searchHistory.bind(this),
      getRecentHistory: this.getRecentHistory.bind(this),
      deleteHistoryItem: this.deleteHistoryItem.bind(this),
      deleteHistoryRange: this.deleteHistoryRange.bind(this),
      getVisitCount: this.getVisitCount.bind(this)
    };
  }

  getToolDefinitions() {
    // This function returns the schema for the tools, it does not need changes.
    // For brevity, its content is omitted here but remains in the actual file.
    return [
      { name: 'navigate', description: 'Navigate to a URL...', input_schema: { /*...*/ } },
      { name: 'click', description: 'Click on an element...', input_schema: { /*...*/ } },
      { name: 'type', description: 'Type text into an input field...', input_schema: { /*...*/ } },
      { name: 'scroll', description: 'Scroll the page...', input_schema: { /*...*/ } },
      { name: 'screenshot', description: 'Take a screenshot...', input_schema: { /*...*/ } },
      { name: 'getPageContent', description: 'Get content from the page...', input_schema: { /*...*/ } },
      { name: 'openTab', description: 'Open a new tab...', input_schema: { /*...*/ } },
      { name: 'closeTab', description: 'Close a tab...', input_schema: { /*...*/ } },
      { name: 'switchTab', description: 'Switch to a different tab...', input_schema: { /*...*/ } },
      { name: 'getAllTabs', description: 'Get info about all tabs...', input_schema: { /*...*/ } },
      { name: 'createTabGroup', description: 'Create a tab group...', input_schema: { /*...*/ } },
      { name: 'ungroupTabs', description: 'Remove tabs from a group...', input_schema: { /*...*/ } },
      { name: 'fillForm', description: 'Fill multiple form fields...', input_schema: { /*...*/ } },
      { name: 'waitForElement', description: 'Wait for an element...', input_schema: { /*...*/ } },
      { name: 'goBack', description: 'Navigate back...', input_schema: { /*...*/ } },
      { name: 'goForward', description: 'Navigate forward...', input_schema: { /*...*/ } },
      { name: 'refresh', description: 'Refresh the page...', input_schema: { /*...*/ } },
      { name: 'searchHistory', description: 'Search browser history...', input_schema: { /*...*/ } },
      { name: 'getRecentHistory', description: 'Get recent history...', input_schema: { /*...*/ } },
      { name: 'deleteHistoryItem', description: 'Delete a history item...', input_schema: { /*...*/ } },
      { name: 'deleteHistoryRange', description: 'Delete a history range...', input_schema: { /*...*/ } },
      { name: 'getVisitCount', description: 'Get visit count for a URL...', input_schema: { /*...*/ } }
    ];
  }

  async executeTool(toolName, args) {
    const tool = this.tools[toolName];
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    const finalArgs = args && typeof args === 'object' ? args : {};
    return await tool(finalArgs);
  }

  async getActiveTabId(providedTabId) {
    if (providedTabId) return providedTabId;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("No active tab found.");
    return tab.id;
  }

  // Tool implementations with full logic restored

  async navigate({ url, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await browser.tabs.update(targetTabId, { url });
    return { success: true, url, tabId: targetTabId };
  }

  async click({ selector, text, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    if ((!selector || typeof selector !== 'string') && (!text || typeof text !== 'string')) {
      return { success: false, error: 'Either selector or text must be provided' };
    }
    try {
      const [result] = await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (sel, txt) => {
          let element = null;
          if (txt) {
            const clickableElements = document.querySelectorAll('a, button, input[type="button"], input[type="submit"], [role="button"]');
            element = Array.from(clickableElements).find(el => el.textContent.trim().toLowerCase().includes(txt.toLowerCase()));
          } else {
            element = document.querySelector(sel);
          }
          if (element) {
            element.click();
            return { success: true, clicked: sel || txt };
          }
          return { success: false, error: 'Element not found' };
        },
        args: [selector, text]
      });
      return result.result;
    } catch (error) {
      return { success: false, error: `Execution failed: ${error.message}` };
    }
  }

  async type({ selector, text, clear = true, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    try {
      const [result] = await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (sel, txt, clr) => {
          const element = document.querySelector(sel);
          if (element) {
            element.focus();
            if (clr) element.value = '';
            element.value = txt;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
          }
          return { success: false, error: 'Element not found' };
        },
        args: [selector, text, clear]
      });
      return result.result;
    } catch (error) {
      return { success: false, error: `Execution failed: ${error.message}` };
    }
  }

  async scroll({ direction, amount = 500, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    try {
      const [result] = await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (dir, amt) => {
          let scrollOptions = { behavior: 'smooth' };
          switch (dir) {
            case 'up': window.scrollBy({ top: -amt, ...scrollOptions }); break;
            case 'down': window.scrollBy({ top: amt, ...scrollOptions }); break;
            case 'top': window.scrollTo({ top: 0, ...scrollOptions }); break;
            case 'bottom': window.scrollTo({ top: document.body.scrollHeight, ...scrollOptions }); break;
          }
          return { success: true, scrollY: window.scrollY };
        },
        args: [direction, amount]
      });
      return result.result;
    } catch (error) {
      return { success: false, error: `Execution failed: ${error.message}` };
    }
  }

  async screenshot({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    const dataUrl = await browser.tabs.captureVisibleTab(null, { format: 'png' });
    return { success: true, dataUrl, tabId: targetTabId };
  }

  async getPageContent({ type, selector, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    try {
      const [result] = await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (contentType, sel) => {
          const getContent = () => {
            switch (contentType) {
              case 'text': return sel ? document.querySelector(sel)?.innerText : document.body.innerText;
              case 'html': return sel ? document.querySelector(sel)?.innerHTML : document.documentElement.outerHTML;
              case 'title': return document.title;
              case 'url': return window.location.href;
              case 'links': return Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText || '', href: a.href || '' }));
              default: return null;
            }
          };
          const content = getContent();
          return { success: true, type: contentType, content };
        },
        args: [type, selector]
      });
      return result.result;
    } catch (error) {
      return { success: false, error: `Execution failed: ${error.message}` };
    }
  }

  async openTab({ url, active = true }) {
    const tab = await browser.tabs.create({ url, active });
    return { success: true, tabId: tab.id, url: tab.pendingUrl || tab.url };
  }

  async closeTab({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await browser.tabs.remove(targetTabId);
    return { success: true, tabId: targetTabId };
  }

  async switchTab({ tabId }) {
    await browser.tabs.update(tabId, { active: true });
    return { success: true, tabId };
  }

  async getAllTabs() {
    const tabs = await browser.tabs.query({});
    return {
      success: true,
      tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active, groupId: t.groupId }))
    };
  }

  async createTabGroup({ tabIds, title, color = 'grey' }) {
    if (!browser.tabs.group) return { success: false, error: 'Tab groups not supported' };
    const groupId = await browser.tabs.group({ tabIds });
    await browser.tabGroups.update(groupId, { title, color });
    return { success: true, groupId };
  }

  async ungroupTabs({ tabIds }) {
    if (!browser.tabs.ungroup) return { success: false, error: 'Tab groups not supported' };
    await browser.tabs.ungroup(tabIds);
    return { success: true };
  }

  async fillForm({ fields, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    try {
      const [result] = await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (fieldList) => {
          const results = [];
          for (const field of fieldList) {
            const element = document.querySelector(field.selector);
            if (element) {
              element.value = field.value;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              results.push({ selector: field.selector, success: true });
            } else {
              results.push({ selector: field.selector, success: false, error: 'Element not found' });
            }
          }
          return { success: true, results };
        },
        args: [fields]
      });
      return result.result;
    } catch (error) {
      return { success: false, error: `Execution failed: ${error.message}` };
    }
  }

  async waitForElement({ selector, timeout = 5000, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    try {
      const [result] = await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (sel, maxWait) => {
          return new Promise(resolve => {
            const startTime = Date.now();
            const interval = setInterval(() => {
              const element = document.querySelector(sel);
              if (element) {
                clearInterval(interval);
                resolve({ success: true, found: true });
              } else if (Date.now() - startTime > maxWait) {
                clearInterval(interval);
                resolve({ success: false, found: false, error: 'Timeout' });
              }
            }, 100);
          });
        },
        args: [selector, timeout]
      });
      return result.result;
    } catch (error) {
      return { success: false, error: `Execution failed: ${error.message}` };
    }
  }

  async goBack({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await browser.tabs.goBack(targetTabId);
    return { success: true };
  }

  async goForward({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await browser.tabs.goForward(targetTabId);
    return { success: true };
  }

  async refresh({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await browser.tabs.reload(targetTabId);
    return { success: true };
  }

  async searchHistory({ text, maxResults = 100 }) {
    const results = await browser.history.search({ text, maxResults });
    return { success: true, results };
  }

  async getRecentHistory({ maxResults = 50 }) {
    const results = await browser.history.search({ text: '', maxResults });
    return { success: true, results };
  }

  async deleteHistoryItem({ url }) {
    await browser.history.deleteUrl({ url });
    return { success: true };
  }

  async deleteHistoryRange({ startTime, endTime }) {
    await browser.history.deleteRange({ startTime, endTime });
    return { success: true };
  }

  async getVisitCount({ url }) {
    const visits = await browser.history.getVisits({ url });
    return { success: true, visitCount: visits.length, visits };
  }
}