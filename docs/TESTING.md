# Testing Guide for Browser AI Agent

## Overview

This document provides comprehensive testing procedures for the Browser AI Agent extension.

## Test Suite Architecture

The extension includes three types of tests:

1. **Extension Validation** - Validates manifest, file structure, and configuration
2. **Unit Tests** - Tests individual components without Chrome APIs
3. **Integration Tests** - Tests the extension with real browser interactions

## Running Tests

### Quick Start

```bash
# Run all tests
npm test

# Run only validation
npm run validate

# Run only unit tests
npm run test:unit

# Check code
npm run lint
```

### Expected Output

When all tests pass, you should see:

```
✓ All tests passed!
Extension is ready to use.
```

## Extension Validation

### What It Tests

**Manifest Validation:**
- ✓ manifest_version is 3
- ✓ Required permissions declared
- ✓ Background service worker configured
- ✓ Side panel configured
- ✓ Host permissions include <all_urls>

**File Structure:**
- ✓ All required directories exist (sidepanel/, ai/, tools/, etc.)
- ✓ All required files exist
- ✓ JavaScript files have valid syntax
- ✓ Tool definitions are properly exported

**Configuration:**
- ✓ package.json is valid
- ✓ Required npm scripts exist
- ✓ Documentation files exist

### Running Validation

```bash
npm run validate
```

### Validation Output

```
╔════════════════════════════════════════╗
║  Browser AI Agent - Extension Validator  ║
╚════════════════════════════════════════╝

=== Validating Manifest ===
✓ manifest.json exists and is valid JSON
✓ manifest_version is 3
✓ name is present
[... more checks ...]

=== Validation Summary ===
Tests Passed: 34

✓ Extension validation passed!
Extension is ready to load in Chrome.
```

### What To Do If Validation Fails

1. **Read the error message carefully** - It will tell you exactly what's wrong
2. **Check file paths** - Ensure all files are in the correct location
3. **Verify manifest.json** - Ensure no syntax errors
4. **Check permissions** - Ensure all required permissions are declared

## Unit Tests

### What It Tests

**Tool Definitions:**
- ✓ All tools have required fields (name, description, input_schema)
- ✓ Required parameters are properly marked
- ✓ Schema structure is valid

**AI Provider Configuration:**
- ✓ OpenAI config validation
- ✓ Anthropic config validation
- ✓ Custom endpoint config validation

**Tool Schema Conversion:**
- ✓ Convert to OpenAI format
- ✓ Convert to Anthropic format

**Input Validation:**
- ✓ URL format validation
- ✓ CSS selector validation
- ✓ Tab group color validation

**Error Handling:**
- ✓ Missing required parameters throw errors
- ✓ Invalid selector formats detected

### Running Unit Tests

```bash
npm run test:unit
```

### Unit Test Output

```
╔════════════════════════════════════════╗
║       Unit Tests - Browser Tools       ║
╚════════════════════════════════════════╝

=== Testing Tool Definitions ===
✓ Tool definitions have required fields
✓ Required parameters are properly marked

[... more tests ...]

=== Unit Test Summary ===
Tests Passed: 12

✓ All unit tests passed!
```

### What To Do If Unit Tests Fail

1. **Check tool definitions** - Ensure all tools in browser-tools.js have valid schemas
2. **Verify schema structure** - input_schema must match OpenAI/Anthropic spec
3. **Check required fields** - All required parameters must be in the "required" array

## Integration Tests

Integration tests verify the extension works with real browser interactions.

### Test Page

Load `tests/integration/test-page.html` in your browser to access interactive test scenarios.

### Test Scenarios

#### 1. Navigation Tests
- Navigate to URLs
- Browser history (back/forward)
- Page refresh

**Example Commands:**
```
"Navigate to github.com"
"Go back to the previous page"
"Refresh this page"
```

#### 2. Form Interaction Tests
- Type into input fields
- Fill forms with multiple fields
- Click checkboxes
- Submit forms

**Example Commands:**
```
"Type 'John Doe' in the name field"
"Fill the email with test@example.com"
"Fill the form with name: Jane Smith, email: jane@test.com"
```

#### 3. Click and Interaction Tests
- Click buttons by selector
- Click elements by text
- Multiple clicks in sequence

**Example Commands:**
```
"Click the 'Click Me #2' button"
"Click all buttons on this page"
```

#### 4. Scroll Tests
- Scroll by pixels
- Scroll to top/bottom
- Smooth scrolling

**Example Commands:**
```
"Scroll down 300 pixels"
"Scroll to the bottom"
```

#### 5. Content Extraction Tests
- Get page text
- Extract HTML
- Get all links
- Take screenshots

**Example Commands:**
```
"Get all the text from this page"
"Get all links on this page"
"Take a screenshot"
```

#### 6. Tab Management Tests
- Open new tabs
- Close tabs
- Switch tabs
- List all tabs

**Example Commands:**
```
"Open github.com in a new tab"
"List all open tabs"
"Close tab 3"
```

#### 7. Tab Group Tests
- Create tab groups
- Set group title and color
- Ungroup tabs

**Example Commands:**
```
"Group tabs 2, 3, and 4 with title 'Test Group' in blue"
"Ungroup tabs 2 and 3"
```

#### 8. History Management Tests (NEW)
- Search browser history
- Get recent history
- Get visit counts
- Delete history items (with confirmation)

**Example Commands:**
```
"Search my history for 'github'"
"Show me my browsing history from the last 24 hours"
"How many times have I visited github.com?"
"Delete this URL from my history"
```

#### 9. Dynamic Content Tests
- Wait for elements to appear
- Handle delayed content
- Timeouts

**Example Commands:**
```
"Click the 'Load Dynamic Content' button and wait for the content to appear"
"Wait for #dynamicContent to appear"
```

#### 10. Complex Workflow Tests
- Multi-step operations
- Chained commands
- Error recovery

**Example Commands:**
```
"Get my recent history from the last hour, find all GitHub links, and open them in new tabs"
"Fill out the form, click subscribe, and submit"
```

### Running Integration Tests

1. **Load the extension** in Chrome (chrome://extensions)
2. **Open test page**: `file:///path/to/browser-ai/tests/integration/test-page.html`
3. **Open side panel**: Click the extension icon
4. **Configure API**: Add your OpenAI or Anthropic API key
5. **Run test commands**: Type commands into the chat interface
6. **Verify results**: Check that actions are performed correctly

### Integration Test Checklist

- [ ] Navigation works correctly
- [ ] Forms can be filled
- [ ] Buttons can be clicked
- [ ] Page scrolls properly
- [ ] Content extraction works
- [ ] Tabs can be managed
- [ ] Tab groups work
- [ ] History search works
- [ ] Recent history retrieval works
- [ ] Visit counts are accurate
- [ ] Screenshots capture properly
- [ ] Dynamic content handling works
- [ ] Error messages are clear
- [ ] Complex workflows complete successfully

## Troubleshooting Test Failures

### Validation Failures

**"File not found" errors:**
- Ensure you're running tests from the project root
- Check that all files exist in the correct locations

**"Invalid JSON" errors:**
- Validate JSON files with a JSON linter
- Check for trailing commas, missing quotes

**"Export not found" errors:**
- Ensure modules export classes/functions properly
- Check import statements

### Unit Test Failures

**"Assertion failed" errors:**
- Read the specific assertion that failed
- Check the expected vs actual values
- Fix the code or test as appropriate

**"Schema validation" errors:**
- Ensure tool schemas match OpenAI/Anthropic format
- Verify all required fields are present
- Check data types (string, number, array, etc.)

### Integration Test Failures

**Extension won't load:**
- Run `npm run validate` to check for issues
- Check Chrome DevTools console for errors
- Reload the extension

**AI not responding:**
- Verify API key is correct
- Check network connection
- Check browser console for errors

**Tools not working:**
- Ensure page is fully loaded
- Check CSS selectors are correct
- Verify permissions are granted

**History tools not working:**
- Ensure history permission is in manifest.json
- Check that Chrome has history data
- Verify URLs are valid

## Continuous Testing

### Before Committing Code

Always run the full test suite before committing:

```bash
npm test
```

### Before Creating a Pull Request

1. Run full test suite
2. Test in actual Chrome browser
3. Load integration test page
4. Verify all examples work
5. Check documentation is updated

### After Making Changes

**If you modify:**

- **manifest.json** → Run validation
- **Tool definitions** → Run unit tests + validation
- **AI provider** → Run unit tests
- **Browser tools** → Run all tests + manual integration test
- **UI** → Manual testing in browser

## Test Coverage

### Current Test Coverage

- **34 validation tests** covering manifest, files, structure
- **12 unit tests** covering tools, schemas, validation
- **10 integration test scenarios** with multiple commands each

### Areas Covered

✓ Manifest structure and permissions
✓ File structure and required files
✓ JavaScript syntax
✓ Tool definitions and schemas
✓ AI provider configuration
✓ Input validation
✓ Error handling
✓ Browser API interactions
✓ Form interactions
✓ Tab management
✓ History management
✓ Content extraction
✓ Dynamic content handling

### Areas NOT Covered (Manual Testing Required)

- Actual API calls to OpenAI/Anthropic (requires API keys and costs money)
- Screenshot capture (requires real browser)
- Complex multi-tab workflows (requires real browser)
- Error recovery scenarios
- Rate limiting behavior
- Chrome Web Store submission

## Writing New Tests

### Adding a Unit Test

Edit `tests/unit/run-unit-tests.js`:

```javascript
runner.test('My new test', () => {
  // Test code here
  runner.assertTrue(condition, 'Error message');
  runner.assertEqual(actual, expected, 'Error message');
});
```

### Adding a Validation Test

Edit `tests/validate-extension.js`:

```javascript
this.test('My validation check', () => {
  // Validation code here
  if (!condition) {
    throw new Error('Validation failed');
  }
});
```

### Adding an Integration Test

Edit `tests/integration/test-page.html`:

```html
<div class="test-group">
  <h3>My New Test</h3>
  <!-- Test elements here -->

  <div class="command-example">
    "Test command to try"
  </div>
</div>
```

## Best Practices

1. **Run tests frequently** - Don't wait until the end
2. **Test one thing at a time** - Isolate changes
3. **Read error messages** - They tell you exactly what's wrong
4. **Use integration tests** - They catch real-world issues
5. **Update tests** - When adding features, add tests
6. **Document tests** - Make it clear what each test does

## Getting Help

If tests fail and you can't figure out why:

1. Read the error message carefully
2. Check the troubleshooting section above
3. Run tests individually to isolate the issue
4. Check the code that's being tested
5. Look at similar working tests
6. Ask for help with specific error messages

---

**Remember**: Tests are there to help you, not to be a burden. They catch issues early and make development faster in the long run.
