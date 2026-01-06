# Parchi - Complete API Specification

## Overview

This document provides a comprehensive specification of all Chrome Extension APIs used, browser automation tools available, and implementation details for the Parchi extension.

## Chrome Extension APIs

### 1. Side Panel API (chrome.sidePanel)

**Purpose**: Display extension UI in browser's side panel

**Key Methods**:
- `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`
  - Opens side panel when extension icon is clicked

- `chrome.sidePanel.setOptions({ path, enabled, tabId })`
  - Configure panel for specific tabs

**Manifest Configuration**:
```json
{
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "sidepanel/panel.html"
  }
}
```

**Browser Support**: Chrome 114+

**Documentation**: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

---

### 2. Scripting API (chrome.scripting)

**Purpose**: Inject scripts and manipulate page DOM

**Key Methods**:

**executeScript**
```javascript
chrome.scripting.executeScript({
  target: { tabId: number, allFrames?: boolean },
  func: function,
  args?: any[],
  world?: 'ISOLATED' | 'MAIN'
})
```

**insertCSS / removeCSS**
```javascript
chrome.scripting.insertCSS({
  target: { tabId: number },
  css?: string,
  files?: string[]
})
```

**Manifest Configuration**:
```json
{
  "permissions": ["scripting"],
  "host_permissions": ["<all_urls>"]
}
```

**Execution Worlds**:
- `ISOLATED` (default): Isolated from page scripts, can access Chrome APIs
- `MAIN`: Shares execution context with page, cannot access Chrome APIs

**Documentation**: https://developer.chrome.com/docs/extensions/reference/api/scripting

---

### 3. Tabs API (chrome.tabs)

**Purpose**: Interact with browser's tab system

**Key Methods**:

**Query tabs**
```javascript
chrome.tabs.query({
  active?: boolean,
  currentWindow?: boolean,
  url?: string | string[]
})
```

**Create/Update/Remove tabs**
```javascript
chrome.tabs.create({ url, active, index, windowId })
chrome.tabs.update(tabId, { url, active, muted })
chrome.tabs.remove(tabId | tabIds[])
```

**Capture screenshot**
```javascript
chrome.tabs.captureVisibleTab(windowId?, {
  format?: 'png' | 'jpeg',
  quality?: number
})
```

**Group tabs**
```javascript
chrome.tabs.group({ tabIds })
chrome.tabs.ungroup(tabIds)
```

**Navigate history**
```javascript
chrome.tabs.goBack(tabId)
chrome.tabs.goForward(tabId)
chrome.tabs.reload(tabId, { bypassCache })
```

**Events**:
- `chrome.tabs.onCreated.addListener((tab) => {})`
- `chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {})`
- `chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {})`
- `chrome.tabs.onActivated.addListener((activeInfo) => {})`

**Manifest Configuration**:
```json
{
  "permissions": ["tabs"],
  "host_permissions": ["<all_urls>"]
}
```

**Documentation**: https://developer.chrome.com/docs/extensions/reference/api/tabs

---

### 4. Tab Groups API (chrome.tabGroups)

**Purpose**: Manage tab groups

**Key Methods**:

**Query groups**
```javascript
chrome.tabGroups.query({
  windowId?: number,
  title?: string,
  color?: string
})
```

**Update group**
```javascript
chrome.tabGroups.update(groupId, {
  title?: string,
  color?: 'grey' | 'blue' | 'red' | 'yellow' | 'green' |
          'pink' | 'purple' | 'cyan' | 'orange',
  collapsed?: boolean
})
```

**Events**:
- `chrome.tabGroups.onCreated.addListener((group) => {})`
- `chrome.tabGroups.onUpdated.addListener((group) => {})`
- `chrome.tabGroups.onRemoved.addListener((group) => {})`

**Tab Group Object**:
```javascript
{
  id: number,
  windowId: number,
  title?: string,
  color: string,
  collapsed: boolean
}
```

**Manifest Configuration**:
```json
{
  "permissions": ["tabGroups"]
}
```

**Documentation**: https://developer.chrome.com/docs/extensions/reference/api/tabGroups

---

### 5. Storage API (chrome.storage)

**Purpose**: Store extension data

**Storage Areas**:
- `chrome.storage.local` - Local storage (no sync)
- `chrome.storage.sync` - Synced across devices (limited space)
- `chrome.storage.session` - Session only (cleared on exit)

**Methods**:
```javascript
chrome.storage.local.get(keys?)
chrome.storage.local.set({ key: value })
chrome.storage.local.remove(keys)
chrome.storage.local.clear()
```

**Events**:
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  // changes: { key: { oldValue, newValue } }
})
```

**Limits**:
- `local`: ~10MB per extension
- `sync`: 100KB total, 8KB per item
- `session`: 10MB per extension

**Manifest Configuration**:
```json
{
  "permissions": ["storage"]
}
```

**Documentation**: https://developer.chrome.com/docs/extensions/reference/api/storage

---

### 6. Runtime API (chrome.runtime)

**Purpose**: Extension lifecycle and messaging

**Message Passing**:
```javascript
// Send message
chrome.runtime.sendMessage({ type: 'action', data })

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle message
  sendResponse({ result });
  return true; // Keep channel open for async
})
```

**Get extension resources**:
```javascript
chrome.runtime.getURL('path/to/resource.html')
```

**Events**:
- `chrome.runtime.onInstalled` - Extension installed/updated
- `chrome.runtime.onStartup` - Browser starts
- `chrome.runtime.onSuspend` - Background script suspending

**Manifest Configuration**: No special permissions needed

**Documentation**: https://developer.chrome.com/docs/extensions/reference/api/runtime

---

### 7. Debugger API (chrome.debugger) - Reserved

**Status**: Not shipped in the current extension build. The manifest does not request the `debugger` permission, and no debugger tools are registered. This section is reserved for future CDP-based tooling.

---

## Browser Automation Tools

### Navigation Tools

#### navigate
**Description**: Navigate to a URL

**Parameters**:
```typescript
{
  url: string;          // URL to navigate to
  tabId?: number;       // Optional: specific tab
}
```

**Returns**:
```typescript
{
  success: boolean;
  url: string;
  tabId: number;
}
```

**Example**:
```javascript
await navigate({ url: 'https://google.com' })
```

---

#### goBack / goForward / refresh (Reserved)
**Status**: Not shipped in the current extension build. Navigation is available via `navigate` and `openTab` only.

---

### Content Extraction Tools

#### getPageContent
**Description**: Extract content from page

**Parameters**:
```typescript
{
  type: 'text' | 'html' | 'title' | 'url' | 'links';
  selector?: string;    // Optional: CSS selector
  tabId?: number;
}
```

**Returns**:
```typescript
{
  success: boolean;
  type: string;
  content: string | object[];
}
```

**Examples**:
```javascript
// Get all page text
await getPageContent({ type: 'text' })

// Get specific element HTML
await getPageContent({ type: 'html', selector: '#main' })

// Get all links
await getPageContent({ type: 'links' })
// Returns: [{ text: 'Link', href: 'https://...' }, ...]
```

---

#### screenshot
**Description**: Capture visible page area

**Parameters**:
```typescript
{
  tabId?: number;       // Optional: specific tab
}
```

**Returns**:
```typescript
{
  success: boolean;
  dataUrl: string;      // base64 PNG data URL
  tabId: number;
}
```

**Notes**:
- Captures only visible viewport
- Format: PNG
- Requires `activeTab` permission
- Some sites (chrome://, data:) may be restricted

---

### Page Interaction Tools

#### click
**Description**: Click an element

**Parameters**:
```typescript
{
  selector: string;     // CSS selector
  tabId?: number;
}
```

**Returns**:
```typescript
{
  success: boolean;
  selector?: string;
  error?: string;
}
```

**Example**:
```javascript
await click({ selector: 'button#submit' })
```

**Notes**:
- Uses `element.click()`
- Element must exist and be clickable
- Event has `isTrusted: false` (some sites may detect)

---

#### type
**Description**: Type text into input

**Parameters**:
```typescript
{
  selector: string;     // CSS selector for input
  text: string;         // Text to type
  clear?: boolean;      // Clear first (default: true)
  tabId?: number;
}
```

**Returns**:
```typescript
{
  success: boolean;
  selector?: string;
  text?: string;
  error?: string;
}
```

**Example**:
```javascript
await type({
  selector: 'input[name="email"]',
  text: 'user@example.com'
})
```

**Notes**:
- Triggers `input` and `change` events
- Works with `<input>`, `<textarea>`, content-editable
- Sets `.value` property directly

---

#### fillForm
**Description**: Fill multiple form fields

**Parameters**:
```typescript
{
  fields: Array<{
    selector: string;
    value: string;
  }>;
  tabId?: number;
}
```

**Returns**:
```typescript
{
  success: boolean;
  results: Array<{
    selector: string;
    success: boolean;
    error?: string;
  }>;
}
```

**Example**:
```javascript
await fillForm({
  fields: [
    { selector: '#name', value: 'John Doe' },
    { selector: '#email', value: 'john@example.com' },
    { selector: '#message', value: 'Hello!' }
  ]
})
```

---

#### scroll
**Description**: Scroll the page

**Parameters**:
```typescript
{
  direction: 'up' | 'down' | 'top' | 'bottom';
  amount?: number;      // Pixels (for up/down, default: 500)
  tabId?: number;
}
```

**Returns**:
```typescript
{
  success: boolean;
  direction: string;
  scrollY: number;      // Final scroll position
}
```

**Examples**:
```javascript
await scroll({ direction: 'down', amount: 1000 })
await scroll({ direction: 'top' })
```

---

#### waitForElement
**Description**: Wait for element to appear

**Parameters**:
```typescript
{
  selector: string;
  timeout?: number;     // Milliseconds (default: 5000)
  tabId?: number;
}
```

**Returns**:
```typescript
{
  success: boolean;
  selector: string;
  found: boolean;
  error?: string;
}
```

**Example**:
```javascript
await waitForElement({
  selector: '.dynamic-content',
  timeout: 10000
})
```

---

### Tab Management Tools

#### openTab
**Description**: Open new tab

**Parameters**:
```typescript
{
  url: string;
  active?: boolean;     // Switch to tab (default: true)
}
```

**Returns**:
```typescript
{
  success: boolean;
  tabId: number;
  url: string;
}
```

---

#### closeTab
**Description**: Close a tab

**Parameters**:
```typescript
{
  tabId?: number;       // Default: current tab
}
```

**Returns**:
```typescript
{
  success: boolean;
  tabId: number;
}
```

---

#### switchTab
**Description**: Switch to a tab

**Parameters**:
```typescript
{
  tabId: number;
}
```

**Returns**:
```typescript
{
  success: boolean;
  tabId: number;
}
```

---

#### getAllTabs
**Description**: Get all open tabs

**Parameters**: None

**Returns**:
```typescript
{
  success: boolean;
  tabs: Array<{
    id: number;
    title: string;
    url: string;
    active: boolean;
    groupId: number;
  }>;
}
```

---

### Tab Group Tools

#### createTabGroup
**Description**: Create tab group

**Parameters**:
```typescript
{
  tabIds: number[];
  title?: string;
  color?: 'grey' | 'blue' | 'red' | 'yellow' | 'green' |
          'pink' | 'purple' | 'cyan' | 'orange';
}
```

**Returns**:
```typescript
{
  success: boolean;
  groupId: number;
  tabIds: number[];
}
```

**Example**:
```javascript
await createTabGroup({
  tabIds: [123, 124, 125],
  title: 'Research',
  color: 'blue'
})
```

---

#### ungroupTabs
**Description**: Remove tabs from group

**Parameters**:
```typescript
{
  tabIds: number[];
}
```

**Returns**:
```typescript
{
  success: boolean;
  tabIds: number[];
}
```

---

### History Management Tools - Reserved

**Status**: Not shipped in the current extension build. Browser history tooling is disabled, and the manifest does not request the `history` permission. This section is reserved for future history automation APIs.

---

## AI Provider Integration

### OpenAI API Format

**Endpoint**: `https://api.openai.com/v1/chat/completions`

**Request**:
```json
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "tool_name",
        "description": "Tool description",
        "parameters": {
          "type": "object",
          "properties": { ... },
          "required": [ ... ]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

**Response with tool call**:
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "tool_name",
          "arguments": "{\"param\":\"value\"}"
        }
      }]
    }
  }]
}
```

**Tool result submission**:
```json
{
  "messages": [
    ...previous messages,
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "content": "{\"result\":\"success\"}"
    }
  ]
}
```

---

### Anthropic API Format

**Endpoint**: `https://api.anthropic.com/v1/messages`

**Headers**:
```
x-api-key: YOUR_API_KEY
anthropic-version: 2023-06-01
```

**Request**:
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 4096,
  "system": "System prompt...",
  "messages": [
    { "role": "user", "content": "..." }
  ],
  "tools": [
    {
      "name": "tool_name",
      "description": "Tool description",
      "input_schema": {
        "type": "object",
        "properties": { ... },
        "required": [ ... ]
      }
    }
  ]
}
```

**Response with tool use**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "I'll use the tool..."
    },
    {
      "type": "tool_use",
      "id": "toolu_abc123",
      "name": "tool_name",
      "input": { "param": "value" }
    }
  ]
}
```

**Tool result submission**:
```json
{
  "messages": [
    ...previous messages,
    {
      "role": "user",
      "content": [{
        "type": "tool_result",
        "tool_use_id": "toolu_abc123",
        "content": "{\"result\":\"success\"}"
      }]
    }
  ]
}
```

---

## Extension Architecture

### Message Flow

```
┌─────────────────┐
│   Side Panel    │
│   (panel.js)    │
└────────┬────────┘
         │ chrome.runtime.sendMessage()
         ↓
┌─────────────────┐
│   Background    │
│  Service Worker │
│ (background.js) │
└────────┬────────┘
         │
         ├─→ AI Provider (fetch)
         │   ↓
         │   Tool decisions
         │
         ├─→ BrowserTools.executeTool()
         │   │
         │   ├─→ chrome.tabs.*
         │   ├─→ chrome.scripting.executeScript()
         │   └─→ chrome.tabGroups.*
         │
         └─→ Content Script (if needed)
             │
            └─→ DOM manipulation
```

### Canonical Message Schema

Local message history uses a normalized structure to keep tool results and UI rendering consistent.

```typescript
type CanonicalMessage = {
  id: string;
  createdAt: string; // ISO timestamp
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<any>;
  toolCalls?: Array<{ id: string; name: string; args: object }>;
  toolCallId?: string; // for tool role
  name?: string;       // optional tool name
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};
```

Provider requests are derived from canonical messages by stripping metadata and serializing tool calls/results into the provider-specific formats.

### Storage Schema

**Configuration** (chrome.storage.local):
```json
{
  "provider": "openai" | "anthropic" | "custom",
  "apiKey": "sk-...",
  "model": "gpt-4o",
  "customEndpoint": "https://...",
  "systemPrompt": "You are..."
}
```

---

## Security Considerations

### API Key Security
- Keys stored in `chrome.storage.local`
- Never transmitted except to configured endpoint
- Not accessible from content scripts
- Cleared on extension uninstall

### Permissions
- `sidePanel` - Required to render the extension UI
- `activeTab` - Only current tab, only on user action
- `tabs` - Required for tab management (open/close/switch/query)
- `tabGroups` - Required to group/ungroup tabs
- `storage` - Persist settings and session history
- `host_permissions: <all_urls>` - Required for content injection
- `scripting` - Required for executeScript

### Content Security
- Content scripts run in isolated world
- Cannot access extension's API keys
- Limited to DOM manipulation
- Cannot make cross-origin requests

### Tool Execution Safety
- All tools require explicit AI decision
- No automatic/scheduled execution
- Tools validate inputs
- Errors are caught and reported

---

## Performance Considerations

### Script Injection
- Scripts executed on-demand
- No persistent content script overhead
- Functions serialized and sent to page

### Message Passing
- Async message passing
- Keep channel open with `return true`
- Handle disconnections gracefully

### Storage
- Use `chrome.storage.local` for fast access
- Batch reads/writes when possible
- Listen to storage changes for sync

### AI API Calls
- Conversation history sent each request
- Tool results embedded in conversation
- Consider token limits (varies by model)

---

## Browser Compatibility

| Feature | Chrome | Edge | Brave | Opera |
|---------|--------|------|-------|-------|
| Side Panel | 114+ | 114+ | 1.50+ | 100+ |
| Manifest V3 | 88+ | 88+ | 1.20+ | 74+ |
| Scripting API | 88+ | 88+ | 1.20+ | 74+ |
| Tab Groups | 88+ | 88+ | 1.20+ | 74+ |

**Note**: This extension is designed for Chromium-based browsers only. Firefox uses different APIs (WebExtensions).

---

## Error Codes & Handling

### Common Errors

**Element not found**
```json
{
  "success": false,
  "error": "Element not found"
}
```
- Verify selector is correct
- Use waitForElement for dynamic content
- Check if element is in iframe

**Permission denied**
```
Error: Cannot access chrome:// URLs
```
- Some URLs are restricted
- Requires `activeTab` permission
- Must be triggered by user action

**Tool execution timeout**
```json
{
  "success": false,
  "error": "Timeout waiting for element"
}
```
- Increase timeout parameter
- Check if page is fully loaded
- Verify element actually appears

---

This specification covers all major components, APIs, and tools in the Parchi extension. For implementation details, refer to the source code in each module.
