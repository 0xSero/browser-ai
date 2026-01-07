#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (error) {
  console.error('Playwright is not installed. Run: npm install');
  process.exit(1);
}

const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  error: '\x1b[31m',
  warning: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(message, type = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const extensionPath = repoRoot;
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parchi-e2e-'));

const timeoutMs = Number(process.env.E2E_TIMEOUT || 20000);
const slowMo = Number(process.env.E2E_SLOWMO || 0);
const headless = process.env.E2E_HEADLESS === 'true';
if (headless) {
  log('Extensions are not supported in headless mode; tests may fail.', 'warning');
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

async function getExtensionId(context) {
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: timeoutMs });
  }
  const url = new URL(worker.url());
  return url.host;
}

async function seedAccessState(worker) {
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      authState: {
        status: 'signed_in',
        email: 'qa@parchi.dev',
        accessToken: 'test-token'
      },
      entitlement: {
        active: true,
        plan: 'pro',
        renewsAt: ''
      }
    });
  });
}

test('Side panel loads and shows ready state', async ({ panel }) => {
  await panel.waitForSelector('text=Parchi', { timeout: timeoutMs });
  await panel.waitForFunction(() => {
    const el = document.querySelector('#statusText');
    return el && el.textContent && el.textContent.includes('Ready');
  }, { timeout: timeoutMs });
});

test('Settings panel toggles custom endpoint field', async ({ panel }) => {
  await panel.click('#settingsBtn');
  await panel.waitForSelector('#settingsPanel', { state: 'visible', timeout: timeoutMs });
  await panel.selectOption('#provider', 'custom');
  await panel.waitForSelector('#customEndpointGroup', { state: 'visible', timeout: timeoutMs });
  await panel.click('#settingsBtn');
  await panel.waitForSelector('#chatInterface', { state: 'visible', timeout: timeoutMs });
});

test('Tab selector lists integration test page', async ({ panel, context }) => {
  const testPagePath = path.join(repoRoot, 'tests/integration/test-page.html');
  const testPageUrl = `file://${testPagePath}`;
  const testPage = await context.newPage();
  await testPage.goto(testPageUrl);

  await panel.click('#tabSelectorBtn');
  await panel.waitForSelector('#tabSelector', { state: 'visible', timeout: timeoutMs });
  await panel.waitForSelector('.tab-item-title', { timeout: timeoutMs });
  const titles = await panel.$$eval('.tab-item-title', nodes =>
    nodes.map(node => (node.textContent || '').trim())
  );
  assert(
    titles.some(title => title.includes('Integration Test Page')),
    'Expected integration test page in tab selector.'
  );
});

async function run() {
  log('╔════════════════════════════════════════╗', 'info');
  log('║          Parchi - E2E Tests           ║', 'info');
  log('╚════════════════════════════════════════╝', 'info');

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      slowMo,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--allow-file-access-from-files',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    });

    const extensionId = await getExtensionId(context);
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: timeoutMs });
    await seedAccessState(worker);

    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/panel.html`, {
      waitUntil: 'domcontentloaded'
    });

    let passed = 0;
    for (const t of tests) {
      try {
        await t.fn({ panel, context });
        passed += 1;
        log(`✓ ${t.name}`, 'success');
      } catch (error) {
        log(`✗ ${t.name}: ${error.message}`, 'error');
      }
    }

    log('\n' + '═'.repeat(40), 'info');
    if (passed === tests.length) {
      log('✓ All E2E tests passed!', 'success');
      process.exitCode = 0;
    } else {
      log(`✗ ${tests.length - passed} E2E tests failed`, 'error');
      process.exitCode = 1;
    }
  } catch (error) {
    log(`✗ E2E harness failed: ${error.message}`, 'error');
    process.exitCode = 1;
  } finally {
    if (context) {
      await context.close();
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (error) {
      log(`Warning: failed to remove temp profile: ${error.message}`, 'warning');
    }
  }
}

run();
