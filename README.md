# Browser AI Agent

A powerful Chrome extension that enables AI models to interact with and control your browser through a comprehensive set of automation tools. Configure your preferred LLM provider (OpenAI, Anthropic, or any OpenAI-compatible API) and let AI assist with web browsing, form filling, testing, and automation tasks.

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

### Modern UI
- Side panel interface that opens on the right side of the browser
- Clean, intuitive chat interface
- Real-time status updates
- Tool execution visibility
- Easy configuration management

## Installation

### Prerequisites
- Google Chrome or any Chromium-based browser (Edge, Brave, etc.)
- An API key from OpenAI or Anthropic

### Install the Extension

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd browser-ai
   ```

2. **Create extension icons** (optional but recommended)

   The extension needs three icon files in the `icons/` directory:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)

   You can:
   - Create them using any image editor
   - Use an online icon generator
   - Skip this step (extension will work but won't show an icon)

   See `icons/README.md` for more details.

3. **Load the extension in Chrome**

   a. Open Chrome and navigate to `chrome://extensions/`

   b. Enable "Developer mode" (toggle in top right corner)

   c. Click "Load unpacked"

   d. Select the `browser-ai` directory

   e. The extension should now appear in your extensions list

4. **Pin the extension** (optional)

   Click the puzzle piece icon in Chrome's toolbar and pin the Browser AI Agent extension for easy access.

## Configuration

1. **Open the side panel**

   Click the Browser AI Agent icon in your Chrome toolbar

2. **Click the settings icon** (gear icon in the top right)

3. **Configure your AI provider**

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
   - Custom Endpoint: Your API endpoint URL (e.g., `https://api.example.com/v1`)

4. **Customize the system prompt** (optional)

   Modify the system prompt to change how the AI behaves. The default prompt explains available tools and encourages careful, descriptive actions.

5. **Save settings**

## Usage

### Basic Usage

Once configured, simply type your requests in the chat interface:

- "Take a screenshot of this page"
- "Navigate to google.com and search for 'AI news'"
- "Find all the links on this page"
- "Fill out the form with name: John Doe, email: john@example.com"
- "Open the first 3 article links in new tabs and group them"
- "Scroll down and click the 'Load More' button"

### Advanced Examples

**Web Scraping:**
```
"Extract all product names and prices from this page"
```

**Form Automation:**
```
"Fill out the contact form:
Name: Jane Smith
Email: jane@example.com
Message: I'm interested in your services"
```

**Multi-Tab Workflow:**
```
"Open tabs for github.com, stackoverflow.com, and reddit.com,
then group them with the title 'Dev Sites' in blue"
```

**Page Analysis:**
```
"Scroll through this page and give me a summary of the main points"
```

## Architecture

### File Structure

```
browser-ai/
├── manifest.json              # Extension manifest (Manifest V3)
├── background.js              # Background service worker
├── content.js                 # Content script injected into pages
├── package.json               # Project metadata
├── sidepanel/
│   ├── panel.html            # Side panel UI
│   ├── panel.css             # Side panel styles
│   └── panel.js              # Side panel logic & UI controller
├── ai/
│   └── provider.js           # AI provider integration (OpenAI/Anthropic)
├── tools/
│   └── browser-tools.js      # Browser automation tool implementations
└── icons/
    ├── icon16.png            # Extension icon (16x16)
    ├── icon48.png            # Extension icon (48x48)
    ├── icon128.png           # Extension icon (128x128)
    └── README.md             # Icon creation guide
```

### How It Works

1. **User Input**: User types a message in the side panel
2. **Context Gathering**: Extension gathers current tab information
3. **AI Processing**: Message is sent to the configured AI provider with tool definitions
4. **Tool Execution**: If AI decides to use tools, they're executed via Chrome APIs
5. **Response**: Results are sent back to AI, which provides a natural language response
6. **Display**: Response is shown to user in the chat interface

### Communication Flow

```
Side Panel (UI) ←→ Background Worker ←→ AI Provider (OpenAI/Anthropic)
                          ↓
                   Browser Tools
                          ↓
                   Chrome APIs ←→ Content Script ←→ Web Page
```

## API Specification

### Tool Definitions

All tools follow a standard schema compatible with OpenAI's function calling and Anthropic's tool use APIs.

#### Navigation Tools

**navigate**
```javascript
{
  url: string,           // URL to navigate to
  tabId?: number        // Optional: specific tab ID
}
```

**goBack / goForward**
```javascript
{
  tabId?: number        // Optional: specific tab ID
}
```

**refresh**
```javascript
{
  tabId?: number        // Optional: specific tab ID
}
```

#### Content Tools

**getPageContent**
```javascript
{
  type: 'text' | 'html' | 'title' | 'url' | 'links',
  selector?: string,    // Optional: CSS selector for specific element
  tabId?: number
}
```

**screenshot**
```javascript
{
  tabId?: number        // Optional: specific tab ID
}
```

#### Interaction Tools

**click**
```javascript
{
  selector: string,     // CSS selector for element
  tabId?: number
}
```

**type**
```javascript
{
  selector: string,     // CSS selector for input element
  text: string,         // Text to type
  clear?: boolean,      // Clear existing text first (default: true)
  tabId?: number
}
```

**fillForm**
```javascript
{
  fields: Array<{
    selector: string,
    value: string
  }>,
  tabId?: number
}
```

**scroll**
```javascript
{
  direction: 'up' | 'down' | 'top' | 'bottom',
  amount?: number,      // Pixels to scroll (for up/down, default: 500)
  tabId?: number
}
```

**waitForElement**
```javascript
{
  selector: string,     // CSS selector to wait for
  timeout?: number,     // Milliseconds (default: 5000)
  tabId?: number
}
```

#### Tab Management Tools

**openTab**
```javascript
{
  url: string,
  active?: boolean      // Switch to new tab (default: true)
}
```

**closeTab**
```javascript
{
  tabId?: number        // Tab to close (default: current tab)
}
```

**switchTab**
```javascript
{
  tabId: number         // Tab ID to switch to
}
```

**getAllTabs**
```javascript
{} // No parameters
```

Returns:
```javascript
{
  success: true,
  tabs: Array<{
    id: number,
    title: string,
    url: string,
    active: boolean,
    groupId: number
  }>
}
```

#### Tab Group Tools

**createTabGroup**
```javascript
{
  tabIds: number[],     // Array of tab IDs to group
  title?: string,       // Group title
  color?: 'grey' | 'blue' | 'red' | 'yellow' | 'green' |
          'pink' | 'purple' | 'cyan' | 'orange'
}
```

**ungroupTabs**
```javascript
{
  tabIds: number[]      // Array of tab IDs to ungroup
}
```

## Chrome APIs Used

This extension leverages the following Chrome Extension APIs:

- **chrome.sidePanel** - Side panel UI
- **chrome.tabs** - Tab management
- **chrome.tabGroups** - Tab grouping
- **chrome.scripting** - Script injection and DOM manipulation
- **chrome.storage** - Configuration persistence
- **chrome.runtime** - Message passing
- **chrome.windows** - Window management (future)
- **chrome.bookmarks** - Bookmark access (future)
- **chrome.history** - History access (future)
- **chrome.debugger** - Advanced automation (future)

## Security & Privacy

- **API keys are stored locally** in Chrome's storage and never transmitted except to your configured AI provider
- **All tool executions require explicit AI decision** - the AI must decide to use each tool
- **Content script has limited permissions** - can only interact with page DOM
- **No data collection** - this extension does not collect or transmit any user data except to your AI provider
- **Open source** - all code is visible and auditable

## Troubleshooting

### Extension won't load
- Make sure you're in Developer Mode in chrome://extensions
- Check the console for errors
- Verify all files are present in the directory

### Side panel doesn't open
- Try clicking the extension icon
- Check if the extension is enabled
- Reload the extension from chrome://extensions

### AI not responding
- Verify your API key is correct
- Check your internet connection
- Open browser DevTools (F12) → Console tab to see errors
- Verify the model name is correct for your provider

### Tools not working
- Make sure you granted necessary permissions
- Try reloading the page you're trying to interact with
- Check the console for error messages
- Some websites may block automation attempts

### "Element not found" errors
- CSS selectors must be precise
- Use browser DevTools to inspect and test selectors
- Some elements may not be loaded yet - use waitForElement tool

## Limitations

- **Same-origin policy**: Some cross-origin interactions may be restricted
- **Dynamic content**: Heavy JavaScript sites may require waiting for elements
- **CAPTCHAs**: Cannot solve CAPTCHAs (by design)
- **isTrusted events**: Some sites detect simulated events
- **Rate limits**: Subject to your AI provider's rate limits
- **Chrome Web Store policies**: Not submitted to store (developer mode only)

## Future Enhancements

Potential features for future versions:

- [ ] Visual element selection tool
- [ ] Recording and playback of action sequences
- [ ] Multi-page workflows with state persistence
- [ ] Integration with Chrome DevTools Protocol for advanced debugging
- [ ] Screenshot analysis with vision-capable models
- [ ] Bookmark and history management
- [ ] Cookie and local storage manipulation
- [ ] Network request interception and modification
- [ ] Custom tool creation interface
- [ ] Export conversation history
- [ ] Workflow templates

## Contributing

Contributions are welcome! Areas for improvement:

- Better error handling and user feedback
- Additional browser automation tools
- UI/UX enhancements
- Performance optimizations
- Documentation improvements
- Testing framework

## License

MIT License - see LICENSE file for details

## Credits

Built using:
- Chrome Extension Manifest V3
- Chrome Side Panel API
- OpenAI API / Anthropic API
- Modern JavaScript (ES6+)

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Read the troubleshooting section

---

**Note**: This extension is for automation and productivity purposes. Always respect websites' terms of service and robots.txt policies. Use responsibly and ethically.
