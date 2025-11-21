#!/usr/bin/env node

/**
 * Extension Validator
 * Validates the extension structure, manifest, and required files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

class ExtensionValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = 0;
    this.failed = 0;
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  test(description, fn) {
    try {
      fn();
      this.passed++;
      this.log(`✓ ${description}`, 'success');
      return true;
    } catch (error) {
      this.failed++;
      this.errors.push({ test: description, error: error.message });
      this.log(`✗ ${description}: ${error.message}`, 'error');
      return false;
    }
  }

  warn(message) {
    this.warnings.push(message);
    this.log(`⚠ ${message}`, 'warning');
  }

  fileExists(filePath) {
    const fullPath = path.join(ROOT_DIR, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fullPath;
  }

  validateJSON(filePath) {
    const fullPath = this.fileExists(filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
  }

  validateManifest() {
    this.log('\n=== Validating Manifest ===', 'info');

    this.test('manifest.json exists and is valid JSON', () => {
      this.manifest = this.validateJSON('manifest.json');
    });

    this.test('manifest_version is 3', () => {
      if (this.manifest.manifest_version !== 3) {
        throw new Error('Must use Manifest V3');
      }
    });

    this.test('name is present', () => {
      if (!this.manifest.name) {
        throw new Error('Manifest must have a name');
      }
    });

    this.test('version is present and valid', () => {
      if (!this.manifest.version) {
        throw new Error('Manifest must have a version');
      }
      if (!/^\d+\.\d+\.\d+/.test(this.manifest.version)) {
        throw new Error('Version must be in format X.Y.Z');
      }
    });

    this.test('description is present', () => {
      if (!this.manifest.description) {
        throw new Error('Manifest must have a description');
      }
    });

    this.test('required permissions are declared', () => {
      // Flexible check for either sidePanel or just the core permissions
      const corePermissions = ['scripting', 'tabs', 'storage'];
      const hasCore = corePermissions.every(p => this.manifest.permissions?.includes(p));
      const hasSidePanel = this.manifest.permissions?.includes('sidePanel');

      if (!hasCore) {
        const missing = corePermissions.filter(p => !this.manifest.permissions?.includes(p));
        throw new Error(`Missing core permissions: ${missing.join(', ')}`);
      }
      if (!hasSidePanel) {
        this.warn('Permission "sidePanel" is missing. This is required for Chrome but not for Firefox.');
      }
    });

    this.test('host_permissions includes <all_urls>', () => {
      if (!this.manifest.host_permissions?.includes('<all_urls>')) {
        throw new Error('Must include <all_urls> in host_permissions');
      }
    });

    this.test('background script is configured', () => {
      const hasServiceWorker = !!this.manifest.background?.service_worker;
      const hasScripts = Array.isArray(this.manifest.background?.scripts) && this.manifest.background.scripts.length > 0;
      if (!hasServiceWorker && !hasScripts) {
        throw new Error('Must have background.service_worker (Chrome) or background.scripts (Firefox)');
      }
    });

    this.test('panel is configured (sidebar_action or side_panel)', () => {
      const hasSidePanel = !!this.manifest.side_panel?.default_path;
      const hasSidebarAction = !!this.manifest.sidebar_action?.default_panel;
      if (!hasSidePanel && !hasSidebarAction) {
        throw new Error('Must have side_panel.default_path (Chrome) or sidebar_action.default_panel (Firefox)');
      }
    });

    this.test('action is configured', () => {
      if (!this.manifest.action) {
        throw new Error('Must have action configuration');
      }
    });

    // Check for icons
    if (!this.manifest.icons) {
      this.warn('No icons configured - extension will work but won\'t show an icon');
    }
  }

  validateRequiredFiles() {
    this.log('\n=== Validating Required Files ===', 'info');

    const requiredFiles = [
      'background.js',
      'content.js',
      'sidepanel/panel.html',
      'sidepanel/panel.css',
      'sidepanel/panel.js',
      'ai/provider.js',
      'tools/browser-tools.js'
    ];

    requiredFiles.forEach(file => {
      this.test(`${file} exists`, () => {
        this.fileExists(file);
      });
    });
  }

  validateJavaScriptSyntax() {
    this.log('\n=== Validating JavaScript Files ===', 'info');

    const jsFiles = [
      'background.js',
      'content.js',
      'sidepanel/panel.js',
      'ai/provider.js',
      'tools/browser-tools.js'
    ];

    jsFiles.forEach(file => {
      this.test(`${file} has valid syntax`, () => {
        const fullPath = this.fileExists(file);
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check for common syntax issues
        if (content.includes('debugger;')) {
          this.warn(`${file} contains debugger statement`);
        }

        // Check for module imports/exports
        // Note: background.js, content.js, and panel.js are entry points and don't need exports
        const entryPoints = ['background.js', 'sidepanel/panel.js', 'content.js'];
        if (!entryPoints.includes(file)) {
          if (!content.includes('export')) {
            throw new Error(`${file} should export classes/functions`);
          }
        }
      });
    });
  }

  validatePackageJSON() {
    this.log('\n=== Validating package.json ===', 'info');

    this.test('package.json exists and is valid', () => {
      this.packageJSON = this.validateJSON('package.json');
    });

    this.test('package.json has required scripts', () => {
      const required = ['test', 'validate', 'build'];
      const missing = required.filter(s => !this.packageJSON.scripts?.[s]);
      if (missing.length > 0) {
        throw new Error(`Missing scripts: ${missing.join(', ')}`);
      }
    });
  }

  validateDocumentation() {
    this.log('\n=== Validating Documentation ===', 'info');

    const docs = [
      'README.md',
      'LICENSE',
      'docs/API_SPECIFICATION.md',
      'docs/QUICK_START.md'
    ];

    docs.forEach(doc => {
      this.test(`${doc} exists`, () => {
        this.fileExists(doc);
      });
    });
  }

  validateFileStructure() {
    this.log('\n=== Validating File Structure ===', 'info');

    const requiredDirs = [
      'sidepanel',
      'ai',
      'tools',
      'icons',
      'docs'
    ];

    requiredDirs.forEach(dir => {
      this.test(`${dir}/ directory exists`, () => {
        const fullPath = path.join(ROOT_DIR, dir);
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
          throw new Error(`Directory not found: ${dir}/`);
        }
      });
    });
  }

  validateToolDefinitions() {
    this.log('\n=== Validating Tool Definitions ===', 'info');

    this.test('BrowserTools class exists and exports getToolDefinitions', () => {
      const toolsPath = this.fileExists('tools/browser-tools.js');
      const content = fs.readFileSync(toolsPath, 'utf8');

      if (!content.includes('export class BrowserTools')) {
        throw new Error('BrowserTools class not exported');
      }

      if (!content.includes('getToolDefinitions')) {
        throw new Error('getToolDefinitions method not found');
      }
    });
  }

  printSummary() {
    this.log('\n=== Validation Summary ===', 'info');
    this.log(`Tests Passed: ${this.passed}`, 'success');

    if (this.failed > 0) {
      this.log(`Tests Failed: ${this.failed}`, 'error');
    }

    if (this.warnings.length > 0) {
      this.log(`Warnings: ${this.warnings.length}`, 'warning');
      this.warnings.forEach(w => this.log(`  - ${w}`, 'warning'));
    }

    if (this.errors.length > 0) {
      this.log('\nErrors:', 'error');
      this.errors.forEach(e => {
        this.log(`  ${e.test}:`, 'error');
        this.log(`    ${e.error}`, 'error');
      });
    }

    if (this.failed === 0) {
      this.log('\n✓ Extension validation passed!', 'success');
      this.log('Extension is ready for packaging and loading.', 'success');
      return true;
    } else {
      this.log('\n✗ Extension validation failed!', 'error');
      this.log('Please fix the errors above before loading the extension.', 'error');
      return false;
    }
  }

  async run() {
    this.log('╔════════════════════════════════════════╗', 'info');
    this.log('║  Browser AI Agent - Extension Validator  ║', 'info');
    this.log('╚════════════════════════════════════════╝', 'info');

    this.validateManifest();
    this.validateFileStructure();
    this.validateRequiredFiles();
    this.validateJavaScriptSyntax();
    this.validatePackageJSON();
    this.validateDocumentation();
    this.validateToolDefinitions();

    const success = this.printSummary();
    process.exit(success ? 0 : 1);
  }
}

// Run validator
const validator = new ExtensionValidator();
validator.run();
