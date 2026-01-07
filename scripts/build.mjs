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

  copyFile(path.join(rootDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
  copyFile(path.join(rootDir, 'sidepanel', 'panel.html'), path.join(distDir, 'sidepanel', 'panel.html'));
  copyFile(path.join(rootDir, 'sidepanel', 'panel.css'), path.join(distDir, 'sidepanel', 'panel.css'));
  copyDirFiltered(path.join(rootDir, 'icons'), path.join(distDir, 'icons'));

  copyDirFiltered(path.join(rootDir, 'server', 'public'), path.join(serverDistDir, 'public'), (srcPath) => {
    return !srcPath.endsWith('.ts');
  });
};

run();
