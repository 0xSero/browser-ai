# Browser AI Agent

[![Browser Support](https://img.shields.io/badge/support-Chrome%20%7C%20Firefox-green)](https://www.mozilla.org/firefox/)

A powerful browser extension that enables AI models to interact with and control your browser through a comprehensive set of automation tools. Configure your preferred LLM provider (OpenAI, Anthropic, or any OpenAI-compatible API) and let AI assist with web browsing, form filling, testing, and automation tasks.

This is a fork of the original [browser-ai](https://github.com/0xSero/browser-ai) repository, adapted to be fully compatible with both Google Chrome and Mozilla Firefox from a single codebase.

## Features

### AI Provider Support
- **OpenAI API**: GPT-4, GPT-4o, and other models
- **Anthropic API**: Claude 3.5 Sonnet, Claude 3 Opus, and other models
- **Custom Endpoints**: Any OpenAI-compatible API endpoint

### Browser Automation Tools

The AI has access to these powerful browser automation capabilities:

#### Page Navigation & Content
- `navigate` - Navigate to URLs
- `goBack` / `goForward` - Browser history navigation
- `refresh` - Reload pages
- `getPageContent` - Extract text, HTML, title, URL, or links from pages
- `screenshot` - Capture visible page area

#### Page Interaction
- `click` - Click elements using CSS selectors
- `type` - Type text into input fields
- `fillForm` - Fill multiple form fields at once
- `scroll` - Scroll up, down, to top, or to bottom
- `waitForElement` - Wait for elements to appear

#### Tab Management
- `openTab` - Open new tabs
- `closeTab` - Close tabs
- `switchTab` - Switch between tabs
- `getAllTabs` - Get information about all open tabs

#### Tab Groups
- `createTabGroup` - Group tabs with title and color
- `ungroupTabs` - Remove tabs from groups

#### History Management
- `searchHistory` - Search browser history for URLs matching text
- `getRecentHistory` - Get recently visited pages
- `deleteHistoryItem` - Delete specific URL from history
- `deleteHistoryRange` - Delete history within time range
- `getVisitCount` - Get visit count and details for a URL

### Modern UI
- Side panel interface that opens on the right side of the browser
- Clean, intuitive chat interface
- Real-time status updates
- Tool execution visibility
- Easy configuration management

## Installation

### Prerequisites
- **A modern browser:**
  - Google Chrome or any Chromium-based browser (Edge, Brave, etc.)
  - Mozilla Firefox (version 112+)
- An API key from OpenAI or Anthropic

### 1. Get the Code

Clone or download this repository:
```bash
git clone https://github.com/lsunay/browser-ai.git
cd browser-ai
```

### 2. Install Dependencies

This project uses `web-ext` for packaging the Firefox version. Install it via npm:
```bash
npm install
```

### 3. Load the Extension for Development

You can load the extension directly from the source code for testing.

**On Google Chrome:**
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right corner).
3. Click "Load unpacked".
4. Select the `browser-ai` directory.

**On Mozilla Firefox:**
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on...".
3. Select the `manifest.json` file from the `browser-ai` directory.

The extension should now appear in your extensions list.

## Development and Building

### Running Tests
The extension includes a validation suite to ensure reliability.
```bash
# Run all validation tests
npm test
```

### Building the Package for Firefox

To create a distributable `.zip` file for Firefox (e.g., for submission to the Mozilla Add-ons store), run the build command:
```bash
npm run build
```
The packaged extension will be created in the `web-ext-artifacts/` directory.

## Configuration

1. **Open the side panel** by clicking the Browser AI Agent icon in your browser's toolbar.
2. **Click the settings icon** (gear icon in the top right).
3. **Configure your AI provider:**

   **For OpenAI:**
   - Provider: OpenAI
   - API Key: Your OpenAI API key (starts with `sk-`)
   - Model: `gpt-4o` or `gpt-4-turbo` (recommended)

   **For Anthropic:**
   - Provider: Anthropic
   - API Key: Your Anthropic API key
   - Model: `claude-3-5-sonnet-20241022` (recommended)

   **For Custom/Compatible APIs:**
   - Provider: Custom (OpenAI Compatible)
   - API Key: Your API key
   - Model: Your model name
   - Custom Endpoint: Your API endpoint URL (e.g., `http://localhost:8080/v1/chat/completions`)

4. **Customize the system prompt** (optional).
5. **Save settings**.

## Usage

Once configured, simply type your requests in the chat interface:

- "Take a screenshot of this page"
- "Navigate to google.com and search for 'AI news'"
- "Find all the links on this page"
- "Fill out the form with name: John Doe, email: john@example.com"
- "Open the first 3 article links in new tabs and group them"
- "Scroll down and click the 'Load More' button"

## Architecture

### File Structure

```
browser-ai/
├── manifest.json              # Extension manifest (Manifest V3)
├── background.js              # Background service worker/script
├── content.js                 # Content script injected into pages
├── package.json               # Project metadata & scripts
├── sidepanel/
│   ├── panel.html            # Side panel UI
│   ├── panel.css             # Side panel styles
│   └── panel.js              # Side panel logic & UI controller
├── ai/
│   └── provider.js           # AI provider integration (OpenAI/Anthropic)
├── tools/
│   └── browser-tools.js      # Browser automation tool implementations
└── icons/
    └── ...                   # Extension icons
```

### How It Works

1. **User Input**: User types a message in the side panel.
2. **Context Gathering**: Extension gathers current tab information.
3. **AI Processing**: Message is sent to the configured AI provider with tool definitions.
4. **Tool Execution**: If AI decides to use tools, they're executed via Browser APIs.
5. **Response**: Results are sent back to AI, which provides a natural language response.
6. **Display**: Response is shown to user in the chat interface.

### Communication Flow

```
Side Panel (UI) ←→ Background Script ←→ AI Provider (OpenAI/Anthropic)
                          ↓
                   Browser Tools
                          ↓
                   Browser APIs ←→ Content Script ←→ Web Page
```

## API Specification

All tools follow a standard schema compatible with OpenAI's function calling and Anthropic's tool use APIs. See the original `README.md` for the full tool API specification.

## Browser APIs Used

This extension leverages the following WebExtensions APIs:

- **browser.sidePanel** / **browser.sidebarAction** - Side panel UI
- **browser.tabs** - Tab management
- **browser.tabGroups** - Tab grouping
- **browser.scripting** - Script injection and DOM manipulation
- **browser.storage** - Configuration persistence
- **browser.runtime** - Message passing
- **browser.history** - History access

## Security & Privacy

- **API keys are stored locally** in your browser's storage and never transmitted except to your configured AI provider.
- **All tool executions require explicit AI decision** - the AI must decide to use each tool.
- **No data collection** - this extension does not collect or transmit any user data except to your AI provider.
- **Open source** - all code is visible and auditable.

## Troubleshooting

### Extension won't load
- Make sure you're in Developer Mode (`chrome://extensions`) or have loaded it via `about:debugging` (Firefox).
- Check the browser console for errors.
- Verify all files are present in the directory.

### Side panel doesn't open
- Try clicking the extension icon.
- Check if the extension is enabled.
- Reload the extension from the browser's extension management page.

### AI not responding
- Verify your API key is correct.
- Check your internet connection.
- Open browser DevTools (F12) → Console tab to see errors.
- Verify the model name is correct for your provider.

## Testing

The extension includes a validation suite to ensure reliability and correctness.

### Running Validation

```bash
# Run all validation tests
npm test
```

## Limitations

- **Same-origin policy**: Some cross-origin interactions may be restricted.
- **Dynamic content**: Heavy JavaScript sites may require waiting for elements.
- **CAPTCHAs**: Cannot solve CAPTCHAs (by design).
- **isTrusted events**: Some sites detect simulated events.
- **Rate limits**: Subject to your AI provider's rate limits.

## Future Enhancements

- [ ] Visual element selection tool
- [ ] Recording and playback of action sequences
- [ ] Screenshot analysis with vision-capable models
- [ ] Bookmark management
- [ ] Custom tool creation interface

## License

MIT License - see LICENSE file for details.
