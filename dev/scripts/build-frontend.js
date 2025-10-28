#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const glob = require('glob');

const srcRoot = path.join(__dirname, '../../src/frontend');
const publicRoot = path.join(__dirname, '../../src/public');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function globFiles(pattern) {
  return glob.sync(pattern, { nodir: true });
}

async function build() {
  // Clean public (except .keep)
  ensureDir(publicRoot);
  const keep = path.join(publicRoot, '.keep');
  for (const name of fs.readdirSync(publicRoot)) {
    const item = path.join(publicRoot, name);
    if (item !== keep) fs.rmSync(item, { recursive: true, force: true });
  }

  // Copy assets and HTML sources
  copyRecursive(path.join(srcRoot, 'css'), path.join(publicRoot, 'css'));
  copyRecursive(path.join(srcRoot, 'js'), path.join(publicRoot, 'js'));
  copyRecursive(path.join(srcRoot, 'i18n'), path.join(publicRoot, 'i18n'));
  copyRecursive(path.join(srcRoot, 'assets/img'), path.join(publicRoot, 'img'));
  copyRecursive(path.join(srcRoot, 'pages'), path.join(publicRoot));
  copyRecursive(path.join(srcRoot, 'assets/components'), path.join(publicRoot, 'components'));
  copyRecursive(path.join(srcRoot, 'assets/css'), path.join(publicRoot, 'css'));

  // Copy top-level assets (favicons, etc.)
  const faviconSvg = path.join(srcRoot, 'assets/img/favicon.svg');
  const faviconIco = path.join(srcRoot, 'assets/img/favicon.ico');
  if (fs.existsSync(faviconSvg)) fs.copyFileSync(faviconSvg, path.join(publicRoot, 'favicon.svg'));
  if (fs.existsSync(faviconIco)) fs.copyFileSync(faviconIco, path.join(publicRoot, 'favicon.ico'));

  // Minify/bundle JavaScript
  const jsEntries = globFiles(path.join(srcRoot, 'js/**/*.js'));
  if (jsEntries.length) {
    await esbuild.build({
      entryPoints: jsEntries,
      outdir: path.join(publicRoot, 'js'),
      outbase: path.join(srcRoot, 'js'),
      bundle: false,
      minify: true,
      sourcemap: false,
      platform: 'browser',
      target: ['es2018'],
      logLevel: 'silent',
      write: true,
      allowOverwrite: true
    });
  }

  // Minify CSS (core styles)
  const coreCssEntries = globFiles(path.join(srcRoot, 'css/**/*.css'));
  if (coreCssEntries.length) {
    await esbuild.build({
      entryPoints: coreCssEntries,
      outdir: path.join(publicRoot, 'css'),
      outbase: path.join(srcRoot, 'css'),
      bundle: false,
      minify: true,
      sourcemap: false,
      logLevel: 'silent',
      write: true,
      allowOverwrite: true
    });
  }

  // Minify CSS (component-specific overrides copied into css/)
  const componentCssEntries = globFiles(path.join(srcRoot, 'assets/css/**/*.css'));
  if (componentCssEntries.length) {
    await esbuild.build({
      entryPoints: componentCssEntries,
      outdir: path.join(publicRoot, 'css'),
      outbase: path.join(srcRoot, 'assets/css'),
      bundle: false,
      minify: true,
      sourcemap: false,
      logLevel: 'silent',
      write: true,
      allowOverwrite: true
    });
  }

  console.log('Frontend built into src/public/ (minified with esbuild)');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
