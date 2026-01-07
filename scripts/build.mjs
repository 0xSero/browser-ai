import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const serverDistDir = path.join(rootDir, 'server', 'dist');

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const cleanDir = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
};

const copyFile = (src, dest) => {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
};

const copyDirFiltered = (src, dest, filter) => {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  entries.forEach(entry => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirFiltered(srcPath, destPath, filter);
      return;
    }
    if (filter && !filter(srcPath)) {
      return;
    }
    copyFile(srcPath, destPath);
  });
};

const run = () => {
  cleanDir(distDir);
  cleanDir(serverDistDir);

  execSync('tsc -p tsconfig.json', { stdio: 'inherit' });
  execSync('tsc -p server/tsconfig.json', { stdio: 'inherit' });

  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifestDest = path.join(distDir, 'manifest.json');
  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const accountApiBase = process.env.ACCOUNT_API_BASE ? process.env.ACCOUNT_API_BASE.trim() : '';
  const accountRequiredEnv = process.env.ACCOUNT_REQUIRED;
  const accountRequired = accountRequiredEnv === undefined ? undefined : accountRequiredEnv === 'true';
  if (accountApiBase || accountRequired !== undefined) {
    manifestData.parchi = { ...(manifestData.parchi || {}) };
    if (accountApiBase) {
      manifestData.parchi.accountApiBase = accountApiBase;
    }
    if (accountRequired !== undefined) {
      manifestData.parchi.requireAccount = accountRequired;
    }
  }
  ensureDir(path.dirname(manifestDest));
  fs.writeFileSync(manifestDest, JSON.stringify(manifestData, null, 2));
  copyFile(path.join(rootDir, 'sidepanel', 'panel.html'), path.join(distDir, 'sidepanel', 'panel.html'));
  copyFile(path.join(rootDir, 'sidepanel', 'panel.css'), path.join(distDir, 'sidepanel', 'panel.css'));
  copyDirFiltered(path.join(rootDir, 'icons'), path.join(distDir, 'icons'));

  copyDirFiltered(path.join(rootDir, 'server', 'public'), path.join(serverDistDir, 'public'), (srcPath) => {
    return !srcPath.endsWith('.ts');
  });
};

run();
