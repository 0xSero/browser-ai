# Quick Start Guide

Get up and running with Parchi in 5 minutes.

## Step 1: Install Extension

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `browser-ai` folder

## Step 2: Add Icons (Optional)

Create three icon files in the `icons/` directory:
- icon16.png (16×16)
- icon48.png (48×48)
- icon128.png (128×128)

Or skip this - the extension works without icons.

## Step 3: Configure API

1. Click the extension icon in Chrome toolbar
2. Click the settings (⚙️) icon
3. Choose your provider:

**Option A: OpenAI**
- Provider: OpenAI
- API Key: `sk-...` (get from https://platform.openai.com/api-keys)
- Model: `gpt-4o` (recommended) or `gpt-4-turbo`

**Option B: Anthropic**
- Provider: Anthropic
- API Key: Get from https://console.anthropic.com/
- Model: `claude-3-5-sonnet-20241022` (recommended)

4. Click "Save Settings"

## Step 4: Start Using

Try these example commands:

**Basic Navigation:**
```
Navigate to github.com
```

**Content Extraction:**
```
Get all the links on this page
```

**Screenshots:**
```
Take a screenshot of this page
```

**Form Filling:**
```
Fill the email field with test@example.com
```

**Tab Management:**
```
Open twitter.com, reddit.com, and news.ycombinator.com in new tabs,
then group them with title "News" in blue
```

## Common Tasks

### Web Research
"Navigate to Google, search for 'Chromium Extension APIs', and open the first 3 results in new tabs"

### Form Testing
"Fill out the contact form with test data"

### Content Analysis
"Scroll through this article and summarize the main points"

### Tab Organization
"Group all my open GitHub tabs with title 'Code' in green"

## Troubleshooting

**Extension won't load?**
- Make sure Developer mode is enabled
- Check console for errors (F12)

**Side panel doesn't open?**
- Click the extension icon
- Try reloading the extension

**AI not responding?**
- Verify API key is correct
- Check browser console (F12) for errors
- Make sure model name is valid

**Tools not working?**
- Reload the page you're trying to interact with
- Check CSS selector is correct
- Some sites may block automation

## Next Steps

- Read the full [README.md](../README.md) for detailed documentation
- Check [API_SPECIFICATION.md](./API_SPECIFICATION.md) for all available tools
- Customize the system prompt to change AI behavior
- Experiment with complex multi-step workflows

## Tips

1. **Be specific with selectors** - Use browser DevTools to inspect elements
2. **Use waitForElement** - For dynamic content that loads after page
3. **Chain actions** - AI can perform multiple steps in sequence
4. **Test incrementally** - Start simple, then build complex workflows
5. **Check permissions** - Some sites restrict automation

## Example Workflows

### Data Extraction
```
Navigate to example.com/products
Scroll to bottom to load all products
Get all elements with class "product-name"
```

### Testing Forms
```
Navigate to the contact page
Fill name: John Doe
Fill email: john@test.com
Fill message: This is a test
Click the submit button
Take a screenshot of the result
```

### Research Assistant
```
Search for "machine learning papers 2024"
Open the first 5 results in new tabs
Group them with title "ML Papers"
For each tab, get the page title and first paragraph
```

---

**Need help?** Check the main README.md or open an issue on GitHub.
