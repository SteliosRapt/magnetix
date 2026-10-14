#!/usr/bin/env node
// Builds the single-file app: src/index.html with every src/styles/*.css and
// src/js/*.js inlined (in filename order) at the @styles / @scripts markers.
//
//   node build.mjs           build once → dist/magnetix.html (regenerates brand/*.svg first)
//   node build.mjs --watch   rebuild whenever something in src/ changes
//
// The JS files are not separate modules: they are concatenated into one
// <script type="module"> and share a single scope, so the numeric prefixes
// define the order they run in.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const out = join(root, 'dist', 'magnetix.html');

const concat = dir => readdirSync(join(src, dir)).filter(f => !f.startsWith('.')).sort()
  .map(f => readFileSync(join(src, dir, f), 'utf8')).join('');

function inline(html, marker, body) {
  const at = html.indexOf(marker + '\n');
  if (at < 0) throw new Error(`marker ${marker} missing from src/index.html`);
  return html.slice(0, at) + body + html.slice(at + marker.length + 1);
}

// <!-- @svg path --> inlines an SVG file; /* @datauri path */ becomes a data: URI of it (paths from the repo root)
const includes = html => html
  .replace(/<!-- @svg (\S+) -->/g, (_, p) => readFileSync(join(root, p), 'utf8').trim())
  .replace(/\/\* @datauri (\S+) \*\//g, (_, p) => 'data:image/svg+xml,' + encodeURIComponent(readFileSync(join(root, p), 'utf8').trim()));

function build() {
  let html = includes(readFileSync(join(src, 'index.html'), 'utf8'));
  html = inline(html, '/* @styles */', concat('styles'));
  html = inline(html, '/* @scripts */', concat('js'));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`built ${out.slice(root.length + 1)} (${(html.length / 1024).toFixed(0)} KB)`);
}

execFileSync(process.execPath, [join(root, 'brand', 'logo.mjs')], { stdio: 'inherit' });
build();
if (process.argv.includes('--watch')) {
  let t = 0;
  watch(src, { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(() => { try { build() } catch (e) { console.error(e.message) } }, 50);
  });
  console.log('watching src/ …');
}
