// Content Script - Runs in the context of web pages
// This script can access the DOM and communicate with the background script

class ContentScriptHandler {
  constructor() {
    this.highlightedElements = new Set();
    this.init();
  }

  init() {
    // Listen for messages from background script
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    // Signal that content script is ready
    this.notifyReady();
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'highlight_element':
          this.highlightElement(message.selector);
          sendResponse({ success: true });
          break;

        case 'unhighlight_all':
          this.unhighlightAll();
          sendResponse({ success: true });
          break;

        case 'get_element_info':
          const info = this.getElementInfo(message.selector);
          sendResponse({ success: true, info });
          break;

        case 'simulate_hover':
          this.simulateHover(message.selector);
          sendResponse({ success: true });
          break;

        case 'get_all_inputs':
          const inputs = this.getAllInputs();
          sendResponse({ success: true, inputs });
          break;

        case 'get_all_buttons':
          const buttons = this.getAllButtons();
          sendResponse({ success: true, buttons });
          break;

        case 'get_visible_text':
          const text = this.getVisibleText();
          sendResponse({ success: true, text });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  notifyReady() {
    browser.runtime.sendMessage({
      type: 'content_script_ready',
      url: window.location.href
    }).catch(() => {
      // Extension context may not be ready yet
    });
  }

  highlightElement(selector) {
    const element = document.querySelector(selector);
    if (!element) return;

    // Add highlight style
    const originalOutline = element.style.outline;
    const originalOutlineOffset = element.style.outlineOffset;

    element.style.outline = '3px solid #4f46e5';
    element.style.outlineOffset = '2px';

    this.highlightedElements.add({
      element,
      originalOutline,
      originalOutlineOffset
    });

    // Auto-remove after 3 seconds
    setTimeout(() => {
      element.style.outline = originalOutline;
      element.style.outlineOffset = originalOutlineOffset;
    }, 3000);
  }

  unhighlightAll() {
    this.highlightedElements.forEach(({ element, originalOutline, originalOutlineOffset }) => {
      element.style.outline = originalOutline;
      element.style.outlineOffset = originalOutlineOffset;
    });
    this.highlightedElements.clear();
  }

  getElementInfo(selector) {
    const element = document.querySelector(selector);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      textContent: element.textContent?.substring(0, 200),
      value: element.value,
      type: element.type,
      position: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      },
      visible: this.isElementVisible(element),
      attributes: Array.from(element.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {})
    };
  }

  isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           element.offsetParent !== null;
  }

  simulateHover(selector) {
    const element = document.querySelector(selector);
    if (!element) return;

    const mouseoverEvent = new MouseEvent('mouseover', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(mouseoverEvent);
  }

  getAllInputs() {
    const inputs = document.querySelectorAll('input, textarea, select');
    return Array.from(inputs).map((input, index) => {
      const label = this.findLabelForInput(input);
      return {
        index,
        tagName: input.tagName,
        type: input.type,
        id: input.id,
        name: input.name,
        placeholder: input.placeholder,
        value: input.value,
        label: label?.textContent?.trim(),
        selector: this.getOptimalSelector(input)
      };
    });
  }

  getAllButtons() {
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]');
    return Array.from(buttons).map((button, index) => ({
      index,
      tagName: button.tagName,
      text: button.textContent?.trim() || button.value,
      id: button.id,
      className: button.className,
      selector: this.getOptimalSelector(button)
    }));
  }

  findLabelForInput(input) {
    // Try to find associated label
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label;
    }

    // Check if input is inside a label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel;

    // Check previous sibling
    const prevSibling = input.previousElementSibling;
    if (prevSibling && prevSibling.tagName === 'LABEL') {
      return prevSibling;
    }

    return null;
  }

  getOptimalSelector(element) {
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }

    // Try name attribute
    if (element.name) {
      return `[name="${element.name}"]`;
    }

    // Try data attributes
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-') && attr.value) {
        return `[${attr.name}="${attr.value}"]`;
      }
    }

    // Fall back to nth-child selector
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element) + 1;
      return `${element.tagName.toLowerCase()}:nth-child(${index})`;
    }

    return element.tagName.toLowerCase();
  }

  getVisibleText() {
    // Get all text nodes that are actually visible
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const style = window.getComputedStyle(parent);
          if (style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.opacity === '0') {
            return NodeFilter.FILTER_REJECT;
          }

          // Filter out script and style tags
          if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
            return NodeFilter.FILTER_REJECT;
          }

          const text = node.textContent.trim();
          return text.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const textParts = [];
    let node;
    while (node = walker.nextNode()) {
      textParts.push(node.textContent.trim());
    }

    return textParts.join(' ').substring(0, 10000); // Limit to 10KB
  }
}

// Initialize content script
const contentScriptHandler = new ContentScriptHandler();
