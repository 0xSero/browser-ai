// Browser Tools - All browser automation capabilities
export class BrowserTools {
  constructor() {
    this.tools = this.initializeTools();
    this.sessionTabs = [];
    this.sessionTabGroups = [];
    this.currentTabId = null;
  }

  initializeTools() {
    return {
      navigate: this.navigate.bind(this),
      click: this.click.bind(this),
      type: this.type.bind(this),
      pressKey: this.pressKey.bind(this),
      scroll: this.scroll.bind(this),
      screenshot: this.screenshot.bind(this),
      getContent: this.getContent.bind(this),
      openTab: this.openTab.bind(this),
      closeTab: this.closeTab.bind(this),
      switchTab: this.switchTab.bind(this),
      getTabs: this.getTabs.bind(this),
      groupTabs: this.groupTabs.bind(this),
      focusTab: this.focusTab.bind(this),
      describeSessionTabs: this.describeSessionTabs.bind(this)
    };
  }

  getToolDefinitions() {
    return [
      { name: 'navigate', description: 'Go to URL', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
      { name: 'click', description: 'Click element', input_schema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' }, timeoutMs: { type: 'number', minimum: 250 } }, required: [] } },
      { name: 'type', description: 'Type text into element', input_schema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } }, required: ['selector', 'text'] } },
      { name: 'pressKey', description: 'Press keyboard key', input_schema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
      { name: 'scroll', description: 'Scroll page', input_schema: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'] } }, required: ['direction'] } },
      { name: 'screenshot', description: 'Capture page', input_schema: { type: 'object', properties: {}, required: [] } },
      { name: 'getContent', description: 'Get page content', input_schema: { type: 'object', properties: { type: { type: 'string', enum: ['text', 'html', 'title', 'url', 'links'] } }, required: ['type'] } },
      { name: 'openTab', description: 'Open tab', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
      { name: 'closeTab', description: 'Close tab', input_schema: { type: 'object', properties: { tabId: { type: 'number' } }, required: [] } },
      { name: 'switchTab', description: 'Switch tab', input_schema: { type: 'object', properties: { tabId: { type: 'number' } }, required: ['tabId'] } },
      { name: 'getTabs', description: 'List tabs', input_schema: { type: 'object', properties: {}, required: [] } },
      { name: 'groupTabs', description: 'Group/ungroup tabs', input_schema: { type: 'object', properties: { tabIds: { type: 'array', items: { type: 'number' } }, title: { type: 'string' }, color: { type: 'string' }, ungroup: { type: 'boolean' } }, required: ['tabIds'] } },
      { name: 'focusTab', description: 'Set which tab future actions target', input_schema: { type: 'object', properties: { tabId: { type: 'number' }, titleContains: { type: 'string' }, urlContains: { type: 'string' }, direction: { type: 'string', enum: ['next', 'previous'] } }, required: [] } },
      { name: 'describeSessionTabs', description: 'List the tabs selected for this automation session', input_schema: { type: 'object', properties: {}, required: [] } }
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
    if (providedTabId) {
      this.currentTabId = providedTabId;
      return providedTabId;
    }

    if (this.currentTabId) {
      try {
        const tab = await chrome.tabs.get(this.currentTabId);
        return tab.id;
      } catch (error) {
        this.currentTabId = null;
      }
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTabId = tab?.id || null;
    return this.currentTabId;
  }

  async configureSessionTabs(tabs = [], options = {}) {
    this.sessionTabs = Array.isArray(tabs) ? tabs.filter(tab => typeof tab.id === 'number') : [];
    this.currentTabId = this.sessionTabs[0]?.id || null;

    await this.clearSessionTabGroups();

    if (!this.sessionTabs.length) {
      return;
    }

    const tabsByWindow = new Map();
    this.sessionTabs.forEach(tab => {
      const key = tab.windowId ?? 'unknown';
      if (!tabsByWindow.has(key)) tabsByWindow.set(key, []);
      tabsByWindow.get(key).push(tab.id);
    });

    for (const [windowKey, tabIds] of tabsByWindow.entries()) {
      if (windowKey === 'unknown' || !tabIds.length) continue;
      try {
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, {
          title: options.title || 'Browser AI',
          color: options.color || 'blue'
        });
        this.sessionTabGroups.push({ groupId, tabIds: [...tabIds] });
      } catch (error) {
        console.warn('Failed to group tabs for session:', error);
      }
    }
  }

  async clearSessionTabGroups() {
    if (!this.sessionTabGroups.length) return;
    for (const group of this.sessionTabGroups) {
      try {
        if (group.tabIds?.length) {
          await chrome.tabs.ungroup(group.tabIds);
        }
      } catch (error) {
        console.warn('Failed to ungroup tabs:', error);
      }
    }
    this.sessionTabGroups = [];
  }

  getSessionTabSummaries() {
    return this.sessionTabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      windowId: tab.windowId,
      groupId: tab.groupId
    }));
  }

  getCurrentSessionTabId() {
    return this.currentTabId;
  }

  // Tool implementations

  async navigate({ url, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await chrome.tabs.update(targetTabId, { url });
    return { success: true, url, tabId: targetTabId };
  }

  async click({ selector, text, tabId, timeoutMs = 2500 }) {
    const targetTabId = await this.getActiveTabId(tabId);

    if ((!selector || typeof selector !== 'string') && (!text || typeof text !== 'string')) {
      return {
        success: false,
        error: 'Either selector or text must be provided as a non-empty string',
        selector,
        text
      };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: async (sel, txt, waitMs) => {
          const timeout = typeof waitMs === 'number' ? waitMs : 2500;
          const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

          const searchableSelectors = ['button', 'a', 'input[type="button"]', 'input[type="submit"]', '[role="button"]', '[role="menuitem"]', '[role="tab"]', '[onclick]', '[tabindex="0"]', 'summary'];

          const findByText = () => {
            const clickableElements = document.querySelectorAll(searchableSelectors.join(','));

            const normalized = txt.toLowerCase();

            const attemptMatch = (elements, exact = false) => {
              for (const el of elements) {
                const elementText = el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '';
                if (!elementText) continue;
                const candidate = exact ? elementText.toLowerCase() === normalized : elementText.toLowerCase().includes(normalized);
                if (candidate) return el;
              }
              return null;
            };

            const exactMatch = attemptMatch(clickableElements, true);
            if (exactMatch) return exactMatch;

            const partialMatch = attemptMatch(clickableElements, false);
            if (partialMatch) return partialMatch;

            // Final fallback: tree walker to find elements with matching visible text
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
              acceptNode(node) {
                if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
                const content = node.textContent?.trim();
                if (!content) return NodeFilter.FILTER_SKIP;
                if (!content.toLowerCase().includes(normalized)) return NodeFilter.FILTER_SKIP;
                const style = window.getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                  return NodeFilter.FILTER_SKIP;
                }
                return NodeFilter.FILTER_ACCEPT;
              }
            });
            while (walker.nextNode()) {
              if (walker.currentNode instanceof HTMLElement) {
                return walker.currentNode;
              }
            }
            return null;
          };

          const findBySelector = () => {
            if (!sel) return null;
            return document.querySelector(sel);
          };

          const locateElement = async () => {
            const end = Date.now() + timeout;
            while (Date.now() < end) {
              const el = txt ? findByText() : findBySelector();
              if (el) return el;
              await sleep(120);
            }
            return null;
          };

          const element = await locateElement();

          if (!element) {
            const sample = Array.from(document.querySelectorAll(searchableSelectors.join(','))).slice(0, 10).map(el => ({
              tagName: el.tagName,
              text: (el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '').substring(0, 50),
              id: el.id || '',
              className: el.className || ''
            }));
            return {
              success: false,
              error: txt ? `No clickable element found with text: "${txt}"` : 'Element not found',
              selector: sel,
              text: txt,
              found: false,
              suggestions: sample
            };
          }

          try { element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); } catch {}

          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const isDisplayed = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          const hasSize = rect.width > 0 && rect.height > 0;
          const inViewport = rect.bottom > 0 && rect.right > 0 && rect.top < (window.innerHeight || document.documentElement.clientHeight) && rect.left < (window.innerWidth || document.documentElement.clientWidth);
          const isClickable = isDisplayed && hasSize && element.offsetParent !== null;

          if (!isClickable) {
            return {
              success: false,
              error: 'Element exists but is not visible or clickable',
              selector: sel,
              text: txt,
              found: true,
              element: {
                tagName: element.tagName,
                text: element.textContent?.substring(0, 50) || '',
                id: element.id || '',
                className: element.className || ''
              }
            };
          }

          const highlight = document.createElement('div');
          highlight.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 3px solid #f97316;
            border-radius: 6px;
            background: rgba(249, 115, 22, 0.1);
            pointer-events: none;
            z-index: 999999;
            animation: ai-pulse 0.6s ease-out;
          `;
          const pulseStyle = document.createElement('style');
          pulseStyle.textContent = `
            @keyframes ai-pulse {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(1.05); opacity: 0; }
            }
          `;
          document.head.appendChild(pulseStyle);
          document.body.appendChild(highlight);
          setTimeout(() => { highlight.remove(); pulseStyle.remove(); }, 600);

          element.focus({ preventScroll: true });

          let clickedVia = 'element.click';
          try {
            element.click();
          } catch (e) {
            clickedVia = 'pointer-events';
            const cx = Math.max(1, Math.floor(rect.left + rect.width / 2));
            const cy = Math.max(1, Math.floor(rect.top + rect.height / 2));
            const opts = { view: window, bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 };
            try {
              element.dispatchEvent(new PointerEvent('pointerdown', opts));
            } catch {}
            try {
              element.dispatchEvent(new MouseEvent('mousedown', opts));
            } catch {}
            try {
              element.dispatchEvent(new PointerEvent('pointerup', opts));
            } catch {}
            try {
              element.dispatchEvent(new MouseEvent('mouseup', opts));
            } catch {}
            try {
              element.dispatchEvent(new MouseEvent('click', opts));
            } catch {}
          }

          return {
            success: true,
            selector: sel,
            text: txt,
            found: true,
            clickedVia,
            inViewport,
            element: {
              tagName: element.tagName,
              text: element.textContent?.substring(0, 50) || '',
              id: element.id || '',
              className: element.className || ''
            }
          };
        },
        args: [selector ?? null, text ?? null, timeoutMs ?? 2500]
      });

      const scriptResult = result?.[0]?.result;
      if (scriptResult) {
        return scriptResult;
      }
      return {
        success: false,
        error: 'Script execution failed or returned no result',
        selector,
        text
      };
    } catch (error) {
      return {
        success: false,
        error: `Execution failed: ${error.message}`,
        selector,
        text
      };
    }
  }

  async type({ selector, text, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);

    if (!selector || typeof selector !== 'string') {
      return { success: false, error: 'Invalid selector' };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (sel, txt) => {
          const element = document.querySelector(sel);
          if (!element) return { success: false, error: 'Element not found' };

          // Visual highlight
          const rect = element.getBoundingClientRect();
          const highlight = document.createElement('div');
          highlight.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 3px solid #f97316;
            border-radius: 6px;
            background: rgba(249, 115, 22, 0.1);
            pointer-events: none;
            z-index: 999999;
            transition: opacity 0.3s;
          `;
          document.body.appendChild(highlight);

          element.focus();
          element.value = '';
          element.value = txt;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));

          setTimeout(() => { highlight.style.opacity = '0'; }, 400);
          setTimeout(() => highlight.remove(), 700);

          return { success: true };
        },
        args: [selector, text ?? '']
      });
      return result?.[0]?.result || { success: false, error: 'Script failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async pressKey({ key, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);

    if (!key || typeof key !== 'string') {
      return { success: false, error: 'Invalid key' };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (k) => {
          const target = document.activeElement || document.body;

          // Map common key names
          const keyMap = {
            'Enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
            'Tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
            'Escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
            'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
            'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
            'Backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8 },
          };

          const keyInfo = keyMap[k] || { key: k, code: k, keyCode: 0 };
          const opts = {
            key: keyInfo.key,
            code: keyInfo.code,
            keyCode: keyInfo.keyCode,
            which: keyInfo.keyCode,
            bubbles: true,
            cancelable: true
          };

          // Dispatch keyboard events
          target.dispatchEvent(new KeyboardEvent('keydown', opts));
          target.dispatchEvent(new KeyboardEvent('keypress', opts));
          target.dispatchEvent(new KeyboardEvent('keyup', opts));

          // Special handling for Enter - try to submit form
          if (k === 'Enter') {
            const form = target.closest('form');
            if (form) {
              // Try submitting the form
              const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
              if (submitBtn) {
                submitBtn.click();
              } else {
                form.requestSubmit ? form.requestSubmit() : form.submit();
              }
              return { success: true, key: k, action: 'form_submitted' };
            }
          }

          return { success: true, key: k };
        },
        args: [key]
      });
      return result?.[0]?.result || { success: false, error: 'Script failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async scroll({ direction, amount = 500, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);

    // Validate parameters
    const validDirections = ['up', 'down', 'top', 'bottom'];
    if (!direction || !validDirections.includes(direction)) {
      return {
        success: false,
        error: `Invalid direction: must be one of ${validDirections.join(', ')}`,
        direction: direction
      };
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return {
        success: false,
        error: 'Invalid amount: must be a positive number',
        amount: amount
      };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (dir, amt) => {
          try {
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
          } catch (error) {
            return { success: false, error: error.message, direction: dir };
          }
        },
        args: [direction ?? null, amount ?? null]
      });

      // Safely access result
      if (result && result[0] && result[0].result) {
        return result[0].result;
      } else {
        return {
          success: false,
          error: 'Script execution failed or returned no result',
          direction: direction
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Execution failed: ${error.message}`,
        direction: direction
      };
    }
  }

  async screenshot({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    return { success: true, dataUrl, tabId: targetTabId };
  }

  async getContent({ type, selector, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (contentType, sel) => {
          switch (contentType) {
            case 'text': return { success: true, content: sel ? document.querySelector(sel)?.innerText : document.body.innerText };
            case 'html': return { success: true, content: sel ? document.querySelector(sel)?.innerHTML : document.documentElement.outerHTML };
            case 'title': return { success: true, content: document.title };
            case 'url': return { success: true, content: window.location.href };
            case 'links': return { success: true, content: Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText, href: a.href })) };
            default: return { success: false, error: 'Invalid type' };
          }
        },
        args: [type, selector ?? null]
      });
      return result?.[0]?.result || { success: false, error: 'Script failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async openTab({ url, active = true }) {
    const tab = await chrome.tabs.create({ url, active });
    if (active) {
      this.currentTabId = tab.id;
    }
    return { success: true, tabId: tab.id, url: tab.url };
  }

  async closeTab({ tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);
    await chrome.tabs.remove(targetTabId);
    return { success: true, tabId: targetTabId };
  }

  async switchTab({ tabId }) {
    await chrome.tabs.update(tabId, { active: true });
    this.currentTabId = tabId;
    return { success: true, tabId };
  }

  async focusTab({ tabId, titleContains, urlContains, direction }) {
    let targetId = tabId;

    if (!targetId && (titleContains || urlContains)) {
      const entries = this.sessionTabs;
      const term = (titleContains || urlContains || '').toLowerCase();
      const prop = titleContains ? 'title' : 'url';
      const candidate = entries.find(tab => (tab[prop] || '').toLowerCase().includes(term));
      if (candidate) targetId = candidate.id;
    }

    if (!targetId && direction && this.sessionTabs.length > 0) {
      const currentIndex = this.sessionTabs.findIndex(tab => tab.id === this.currentTabId);
      if (currentIndex !== -1) {
        if (direction === 'next') {
          targetId = this.sessionTabs[(currentIndex + 1) % this.sessionTabs.length].id;
        } else if (direction === 'previous') {
          targetId = this.sessionTabs[(currentIndex - 1 + this.sessionTabs.length) % this.sessionTabs.length].id;
        }
      }
    }

    if (!targetId) {
      return { success: false, error: 'No matching tab found. Provide a tabId or a title/url fragment.' };
    }

    try {
      const tab = await chrome.tabs.get(targetId);
      await chrome.tabs.update(targetId, { active: true });
      this.currentTabId = targetId;
      return { success: true, tabId: targetId, title: tab.title, url: tab.url };
    } catch (error) {
      return { success: false, error: error.message, tabId: targetId };
    }
  }

  async getTabs() {
    const tabs = await chrome.tabs.query({});
    return {
      success: true,
      tabs: tabs.map(tab => ({ id: tab.id, title: tab.title, url: tab.url, active: tab.active, groupId: tab.groupId }))
    };
  }

  describeSessionTabs() {
    return { success: true, tabs: this.getSessionTabSummaries() };
  }

  async groupTabs({ tabIds, title, color = 'grey', ungroup = false }) {
    if (ungroup) {
      await chrome.tabs.ungroup(tabIds);
      return { success: true, ungrouped: tabIds };
    }
    const groupId = await chrome.tabs.group({ tabIds });
    if (title || color) {
      await chrome.tabGroups.update(groupId, { title: title || '', color });
    }
    return { success: true, groupId, tabIds };
  }

}
