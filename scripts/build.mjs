import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

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
  entries.forEach((entry) => {
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

const run = async () => {
  cleanDir(distDir);
  cleanDir(serverDistDir);

  execSync('tsc -p tsconfig.json --noEmit', { stdio: 'inherit' });
  execSync('tsc -p server/tsconfig.json', { stdio: 'inherit' });

  // Build background and sidepanel as ESM (they support modules)
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'background.ts'), path.join(rootDir, 'sidepanel', 'panel.ts')],
    outdir: distDir,
    outbase: rootDir,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'info',
  });

  // Build content script as IIFE (content scripts don't support ESM)
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'content.ts')],
    outdir: distDir,
    outbase: rootDir,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'info',
  });

  await esbuild.build({
    entryPoints: [
      path.join(rootDir, 'tests', 'run-tests.ts'),
      path.join(rootDir, 'tests', 'validate-extension.ts'),
      path.join(rootDir, 'tests', 'unit', 'run-unit-tests.ts'),
      path.join(rootDir, 'tests', 'e2e', 'run-e2e.ts'),
    ],
    outdir: distDir,
    outbase: rootDir,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'info',
    external: ['chromium-bidi/lib/cjs/bidiMapper/BidiMapper', 'chromium-bidi/lib/cjs/cdp/CdpConnection'],
  });

  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifestDest = path.join(distDir, 'manifest.json');
  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  ensureDir(path.dirname(manifestDest));
  fs.writeFileSync(manifestDest, JSON.stringify(manifestData, null, 2));
  copyFile(path.join(rootDir, 'sidepanel', 'panel.html'), path.join(distDir, 'sidepanel', 'panel.html'));
  copyFile(path.join(rootDir, 'sidepanel', 'panel.css'), path.join(distDir, 'sidepanel', 'panel.css'));
  copyDirFiltered(path.join(rootDir, 'sidepanel', 'styles'), path.join(distDir, 'sidepanel', 'styles'));
  copyDirFiltered(path.join(rootDir, 'sidepanel', 'templates'), path.join(distDir, 'sidepanel', 'templates'));
  copyDirFiltered(path.join(rootDir, 'icons'), path.join(distDir, 'icons'));

  copyDirFiltered(path.join(rootDir, 'server', 'public'), path.join(serverDistDir, 'public'), (srcPath) => {
    return !srcPath.endsWith('.ts');
  });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
