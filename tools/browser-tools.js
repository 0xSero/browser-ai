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
      fillForm: this.fillForm.bind(this),
      waitForElement: this.waitForElement.bind(this),
      getAllTabs: this.getAllTabs.bind(this),
      goBack: this.goBack.bind(this),
      goForward: this.goForward.bind(this),
      refresh: this.refresh.bind(this),
      // History management
      searchHistory: this.searchHistory.bind(this),
      getRecentHistory: this.getRecentHistory.bind(this),
      deleteHistoryItem: this.deleteHistoryItem.bind(this),
      deleteHistoryRange: this.deleteHistoryRange.bind(this),
      getVisitCount: this.getVisitCount.bind(this)
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
        description: 'Click on an element on the page using a CSS selector or text content',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the element to click. If not provided, text must be provided.' },
            text: { type: 'string', description: 'Text content to search for in clickable elements (buttons, links, etc.). If provided, this will be used instead of selector.' },
            tabId: { type: 'number', description: 'Optional tab ID' }
          },
          required: []
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
      },
      {
        name: 'searchHistory',
        description: 'Search browser history for URLs matching a text query',
        input_schema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Search query text' },
            maxResults: { type: 'number', description: 'Maximum number of results (default: 100)' },
            startTime: { type: 'number', description: 'Optional start time in milliseconds since epoch' },
            endTime: { type: 'number', description: 'Optional end time in milliseconds since epoch' }
          },
          required: ['text']
        }
      },
      {
        name: 'getRecentHistory',
        description: 'Get recently visited pages from browser history',
        input_schema: {
          type: 'object',
          properties: {
            maxResults: { type: 'number', description: 'Maximum number of results (default: 50)' },
            hoursAgo: { type: 'number', description: 'Number of hours to look back (default: 24)' }
          },
          required: []
        }
      },
      {
        name: 'deleteHistoryItem',
        description: 'Delete a specific URL from browser history',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to delete from history' }
          },
          required: ['url']
        }
      },
      {
        name: 'deleteHistoryRange',
        description: 'Delete all history items within a time range',
        input_schema: {
          type: 'object',
          properties: {
            startTime: { type: 'number', description: 'Start time in milliseconds since epoch' },
            endTime: { type: 'number', description: 'End time in milliseconds since epoch' }
          },
          required: ['startTime', 'endTime']
        }
      },
      {
        name: 'getVisitCount',
        description: 'Get the number of times a URL has been visited',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to check visit count' }
          },
          required: ['url']
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

  async click({ selector, text, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);

    // Validate that at least one of selector or text is provided
    if ((!selector || typeof selector !== 'string') && (!text || typeof text !== 'string')) {
      return {
        success: false,
        error: 'Either selector or text must be provided as a non-empty string',
        selector: selector,
        text: text
      };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (sel, txt) => {
          try {
            let element = null;

            // If text is provided, search for elements by text content
            if (txt) {
              // Search in clickable elements first (buttons, links, inputs)
              const clickableSelectors = ['button', 'a', 'input[type="button"]', 'input[type="submit"]', '[role="button"]', '[onclick]'];
              const clickableElements = document.querySelectorAll(clickableSelectors.join(','));

              // Find exact match first
              for (const el of clickableElements) {
                const elementText = el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '';
                if (elementText.toLowerCase() === txt.toLowerCase()) {
                  element = el;
                  break;
                }
              }

              // If no exact match, find partial match
              if (!element) {
                for (const el of clickableElements) {
                  const elementText = el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '';
                  if (elementText.toLowerCase().includes(txt.toLowerCase())) {
                    element = el;
                    break;
                  }
                }
              }

              if (!element) {
                // Get suggestions
                const suggestions = Array.from(clickableElements).slice(0, 10).map(el => ({
                  tagName: el.tagName,
                  text: (el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '').substring(0, 50),
                  id: el.id || '',
                  className: el.className || ''
                }));

                return {
                  success: false,
                  error: `No clickable element found with text: "${txt}"`,
                  text: txt,
                  found: false,
                  suggestions: suggestions
                };
              }
            } else if (sel) {
              // Use CSS selector
              element = document.querySelector(sel);
              if (!element) {
                // Try to find similar elements for debugging
                const allElements = document.querySelectorAll('*');
                const matching = Array.from(allElements).filter(el =>
                  el.textContent && el.textContent.includes(sel.replace(/['"]/g, ''))
                );
                return {
                  success: false,
                  error: 'Element not found',
                  selector: sel,
                  found: false,
                  suggestions: matching.slice(0, 5).map(el => ({
                    tagName: el.tagName,
                    text: el.textContent?.substring(0, 50) || '',
                    id: el.id || '',
                    className: el.className || ''
                  }))
                };
              }
            }

            // Bring into view for visible feedback
            try { element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); } catch {}

            // Determine visibility and viewport intersection
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

            // Add a temporary highlight for feedback
            const prevOutline = element.style.outline;
            const prevOffset = element.style.outlineOffset;
            element.style.outline = '2px solid #22c55e';
            element.style.outlineOffset = '2px';
            setTimeout(() => { element.style.outline = prevOutline; element.style.outlineOffset = prevOffset; }, 700);

            // Try standard click first
            let clickedVia = 'element.click';
            try {
              element.click();
            } catch (e) {
              // Fallback to event sequence at element center
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
          } catch (error) {
            return { success: false, error: error.message, selector: sel, text: txt };
          }
        },
        // Ensure undefined values are not passed to Chrome (they're unserializable)
        args: [selector ?? null, text ?? null]
      });

      // Safely access result
      if (result && result[0] && result[0].result) {
        return result[0].result;
      } else {
        return {
          success: false,
          error: 'Script execution failed or returned no result',
          selector: selector,
          text: text
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Execution failed: ${error.message}`,
        selector: selector,
        text: text
      };
    }
  }

  async type({ selector, text, clear = true, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);

    // Validate parameters
    if (!selector || typeof selector !== 'string') {
      return {
        success: false,
        error: 'Invalid selector: must be a non-empty string',
        selector: selector
      };
    }

    if (typeof text !== 'string') {
      return {
        success: false,
        error: 'Invalid text: must be a string',
        selector: selector,
        text: text
      };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (sel, txt, clr) => {
          try {
            const element = document.querySelector(sel);
            if (!element) {
              return { success: false, error: 'Element not found', selector: sel };
            }

            element.focus();
            if (clr) element.value = '';
            element.value = txt;

            // Trigger input event
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            return { success: true, selector: sel, text: txt };
          } catch (error) {
            return { success: false, error: error.message, selector: sel };
          }
        },
        args: [selector ?? null, text ?? null, clear ?? true]
      });

      // Safely access result
      if (result && result[0] && result[0].result) {
        return result[0].result;
      } else {
        return {
          success: false,
          error: 'Script execution failed or returned no result',
          selector: selector
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Execution failed: ${error.message}`,
        selector: selector
      };
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

  async getPageContent({ type, selector, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);

    // Validate parameters
    if (!type || typeof type !== 'string') {
      return {
        success: false,
        error: 'Invalid type: must be a non-empty string',
        type: type
      };
    }

    const validTypes = ['text', 'html', 'title', 'url', 'links'];
    if (!validTypes.includes(type)) {
      return {
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        type: type
      };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (contentType, sel) => {
          try {
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
                    text: a.innerText || '',
                    href: a.href || ''
                  }));
                default:
                  return null;
              }
            };

            const content = getContent();
            return { success: true, type: contentType, content };
          } catch (error) {
            return { success: false, error: error.message, type: contentType };
          }
        },
        args: [type ?? null, selector ?? null]
      });

      // Safely access result
      if (result && result[0] && result[0].result) {
        return result[0].result;
      } else {
        return {
          success: false,
          error: 'Script execution failed or returned no result',
          type: type
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Execution failed: ${error.message}`,
        type: type
      };
    }
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

    // Validate parameters
    if (!Array.isArray(fields) || fields.length === 0) {
      return {
        success: false,
        error: 'Invalid fields: must be a non-empty array',
        fields: fields
      };
    }

    // Validate each field
    for (const field of fields) {
      if (!field.selector || typeof field.selector !== 'string') {
        return {
          success: false,
          error: 'Each field must have a valid selector string',
          field: field
        };
      }
      if (typeof field.value !== 'string') {
        return {
          success: false,
          error: `Each field must have a valid string value for selector: ${field.selector}`,
          field: field
        };
      }
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (fieldList) => {
          try {
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
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        args: [fields ?? []]
      });

      // Safely access result
      if (result && result[0] && result[0].result) {
        return result[0].result;
      } else {
        return {
          success: false,
          error: 'Script execution failed or returned no result',
          fields: fields
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Execution failed: ${error.message}`,
        fields: fields
      };
    }
  }

  async waitForElement({ selector, timeout = 5000, tabId }) {
    const targetTabId = await this.getActiveTabId(tabId);

    // Validate parameters
    if (!selector || typeof selector !== 'string') {
      return {
        success: false,
        error: 'Invalid selector: must be a non-empty string',
        selector: selector
      };
    }

    if (!timeout || typeof timeout !== 'number' || timeout <= 0) {
      return {
        success: false,
        error: 'Invalid timeout: must be a positive number',
        timeout: timeout
      };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: async (sel, maxWait) => {
          try {
            const startTime = Date.now();
            while (Date.now() - startTime < maxWait) {
              const element = document.querySelector(sel);
              if (element) {
                return { success: true, selector: sel, found: true };
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            return { success: false, selector: sel, found: false, error: 'Timeout waiting for element' };
          } catch (error) {
            return { success: false, error: error.message, selector: sel };
          }
        },
        args: [selector ?? null, timeout ?? 5000]
      });

      // Safely access result
      if (result && result[0] && result[0].result) {
        return result[0].result;
      } else {
        return {
          success: false,
          error: 'Script execution failed or returned no result',
          selector: selector
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Execution failed: ${error.message}`,
        selector: selector
      };
    }
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

  // History Management Methods

  async searchHistory({ text, maxResults = 100, startTime, endTime }) {
    const query = {
      text,
      maxResults
    };

    if (startTime) query.startTime = startTime;
    if (endTime) query.endTime = endTime;

    const results = await chrome.history.search(query);

    return {
      success: true,
      count: results.length,
      results: results.map(item => ({
        url: item.url,
        title: item.title,
        lastVisitTime: item.lastVisitTime,
        visitCount: item.visitCount,
        typedCount: item.typedCount
      }))
    };
  }

  async getRecentHistory({ maxResults = 50, hoursAgo = 24 }) {
    const endTime = Date.now();
    const startTime = endTime - (hoursAgo * 60 * 60 * 1000);

    const results = await chrome.history.search({
      text: '',
      startTime,
      endTime,
      maxResults
    });

    // Sort by most recent first
    results.sort((a, b) => b.lastVisitTime - a.lastVisitTime);

    return {
      success: true,
      count: results.length,
      timeRange: {
        from: new Date(startTime).toISOString(),
        to: new Date(endTime).toISOString()
      },
      results: results.map(item => ({
        url: item.url,
        title: item.title,
        lastVisitTime: item.lastVisitTime,
        visitCount: item.visitCount,
        lastVisitDate: new Date(item.lastVisitTime).toISOString()
      }))
    };
  }

  async deleteHistoryItem({ url }) {
    // First check if URL exists in history
    const results = await chrome.history.search({ text: url, maxResults: 1 });

    if (results.length === 0) {
      return {
        success: false,
        error: 'URL not found in history',
        url
      };
    }

    // Delete all visits to this URL
    await chrome.history.deleteUrl({ url });

    return {
      success: true,
      url,
      message: 'URL deleted from history'
    };
  }

  async deleteHistoryRange({ startTime, endTime }) {
    // Validate time range
    if (startTime >= endTime) {
      return {
        success: false,
        error: 'startTime must be before endTime'
      };
    }

    // Get count before deletion (for reporting)
    const beforeResults = await chrome.history.search({
      text: '',
      startTime,
      endTime,
      maxResults: 10000
    });

    // Delete the range
    await chrome.history.deleteRange({
      startTime,
      endTime
    });

    return {
      success: true,
      deletedCount: beforeResults.length,
      timeRange: {
        from: new Date(startTime).toISOString(),
        to: new Date(endTime).toISOString()
      },
      message: `Deleted ${beforeResults.length} history items`
    };
  }

  async getVisitCount({ url }) {
    const results = await chrome.history.search({
      text: url,
      maxResults: 1
    });

    if (results.length === 0) {
      return {
        success: true,
        url,
        visitCount: 0,
        found: false,
        message: 'URL not found in history'
      };
    }

    const item = results[0];

    // Get detailed visits
    const visits = await chrome.history.getVisits({ url });

    return {
      success: true,
      url,
      visitCount: item.visitCount,
      typedCount: item.typedCount,
      lastVisitTime: item.lastVisitTime,
      lastVisitDate: new Date(item.lastVisitTime).toISOString(),
      found: true,
      visits: visits.slice(0, 10).map(visit => ({
        visitTime: visit.visitTime,
        visitDate: new Date(visit.visitTime).toISOString(),
        transition: visit.transition
      }))
    };
  }
}
