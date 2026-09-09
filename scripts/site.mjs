#!/usr/bin/env node
/* =============================================================================
   BUKALEMUN — scripts/site.mjs
   Assembles the publishable site into _site/ (exactly what the Pages workflow
   uploads) and optionally serves it. Having one script own the layout means the
   GitHub Pages build, the Cloudflare tunnel and local preview can never drift.

   node scripts/site.mjs           build _site/
   node scripts/site.mjs --serve   build, then serve on $PORT (default 4321)
   ========================================================================== */

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, '_site');

/* --------------------------------------------------------------- build --- */

export function assemble() {
  if (!existsSync(join(root, 'dist', 'bukalemun.css'))) {
    throw new Error('dist/ is missing — run `npm run build` first.');
  }
  rmSync(site, { recursive: true, force: true });
  mkdirSync(join(site, 'dist'), { recursive: true });
  cpSync(join(root, 'dist'), join(site, 'dist'), { recursive: true });

  // The docs live at both / and /docs/, so neither URL can 404. The root copy
  // sits one level higher than the source file, so its ../dist/ links have to
  // be flattened.
  cpSync(join(root, 'docs'), join(site, 'docs'), { recursive: true });
  cpSync(join(root, 'docs'), site, { recursive: true });

  // Demo pages ship with the site — they are the living documentation.
  // demos/*.html reference ../dist/, which resolves to _site/dist/ here.
  cpSync(join(root, 'demos'), join(site, 'demos'), { recursive: true });

  // dist/ filenames are stable on purpose — CDN consumers pin them — so the
  // demo pages fingerprint their own asset URLs instead. Without this, an edge
  // can serve a fresh stylesheet against a stale script after a deploy.
  const fingerprint = (file) =>
    createHash('sha256').update(readFileSync(join(site, 'dist', file))).digest('hex').slice(0, 10);

  const stamps = {
    'bukalemun.css': fingerprint('bukalemun.css'),
    'bukalemun.js': fingerprint('bukalemun.js'),
    'bukalemun.base.min.css': fingerprint('bukalemun.base.min.css'),
    'bukalemun.min.js': fingerprint('bukalemun.min.js'),
    'no-flash.js': fingerprint('no-flash.js')
  };
  // Skins are fetched one at a time from a `{skin}` template, so they share
  // one stamp: the hash of the bundle that contains all of them, which moves
  // whenever any skin does.
  const skinStamp = fingerprint('bukalemun.min.css');

  const version = (html, prefix) => {
    let out = html;
    for (const [file, hash] of Object.entries(stamps)) {
      out = out.replaceAll(`${prefix}${file}"`, `${prefix}${file}?v=${hash}"`);
    }
    out = out.replaceAll(`${prefix}styles/{skin}.min.css"`, `${prefix}styles/{skin}.min.css?v=${skinStamp}"`);
    for (const m of out.matchAll(new RegExp(`${prefix.replaceAll('.', '\\.')}styles/([a-z0-9]+)\\.min\\.css"`, 'g'))) {
      out = out.replaceAll(m[0], `${prefix}styles/${m[1]}.min.css?v=${fingerprint(`styles/${m[1]}.min.css`)}"`);
    }
    return out;
  };

  const indexPath = join(site, 'index.html');
  const html = version(readFileSync(indexPath, 'utf8')
    // The docs are served from both / and /docs/. The source is written for
    // /docs/, so the root copy has one directory level less to climb.
    .replaceAll('../dist/', 'dist/')
    .replaceAll('../demos/', 'demos/'), 'dist/');
  writeFileSync(indexPath, html);

  const docsIndex = join(site, 'docs', 'index.html');
  writeFileSync(docsIndex, version(readFileSync(docsIndex, 'utf8'), '../dist/'));

  // The playground is a docs page too, served at / and /docs/ like the index.
  const rootPlay = join(site, 'playground.html');
  writeFileSync(rootPlay, version(readFileSync(rootPlay, 'utf8')
    .replaceAll('../dist/', 'dist/')
    .replaceAll('../demos/', 'demos/'), 'dist/'));
  const docsPlay = join(site, 'docs', 'playground.html');
  writeFileSync(docsPlay, version(readFileSync(docsPlay, 'utf8'), '../dist/'));

  for (const f of readdirSync(join(site, 'demos')).filter((n) => n.endsWith('.html'))) {
    const p = join(site, 'demos', f);
    writeFileSync(p, version(readFileSync(p, 'utf8'), '../dist/'));
  }

  writeFileSync(join(site, '.nojekyll'), '');

  const required = [
    'index.html', 'assets/docs.js', 'assets/logo.svg', 'assets/favicon.svg',
    'dist/bukalemun.base.min.css', 'dist/no-flash.js', 'docs/index.html',
    'playground.html', 'docs/playground.html',
    'demos/index.html', 'demos/demo.css', 'demos/demo.js',
    'demos/landing.html', 'demos/dashboard.html', 'demos/docs.html',
    'demos/store.html', 'demos/app.html', 'demos/blog.html',
    'demos/portfolio.html', 'demos/settings.html', 'demos/chat.html',
    'demos/arcade.html'
  ];
  for (const f of required) {
    if (!existsSync(join(site, f))) throw new Error(`_site/${f} was not produced`);
  }
  if (!html.includes('href="dist/bukalemun.base.min.css?v=') || !html.includes('data-bk-skins="dist/styles/{skin}.min.css?v=')) {
    throw new Error('root index.html is missing its fingerprinted asset links');
  }
  if (/<link[^>]*href="dist\/bukalemun(\.min)?\.css/.test(html)) {
    throw new Error('the docs must ship base + one skin, not the all-skins bundle');
  }
  // The /docs/ copy climbs one level to reach the demos; the root copy must not.
  if (html.includes('"../demos/')) {
    throw new Error('root index.html still points one directory up at the demos');
  }
  return site;
}

/* --------------------------------------------------------------- serve --- */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

export function serve(port) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const path = decodeURIComponent(url.pathname);
      const fingerprinted = url.searchParams.has('v');
      const target = join(site, normalize(path).replace(/^(\.\.[/\\])+/, ''));
      if (!target.startsWith(site)) { res.writeHead(403).end('Forbidden'); return; }
      const info = await stat(target);
      const file = info.isDirectory() ? join(target, 'index.html') : target;
      const body = await readFile(file);
      const ext = extname(file);
      res.writeHead(200, {
        'content-type': TYPES[ext] || 'application/octet-stream',
        // Filenames are not content-hashed, so a long TTL just means a stale
        // CDN edge after a deploy. Keep it short and let the origin decide.
        // A fingerprinted URL can be cached hard; a bare one must not be, or a
        // deploy leaves the edge serving mismatched files.
        'cache-control': ext === '.html'
          ? 'no-store'
          : fingerprinted ? 'public, max-age=31536000, immutable' : 'public, max-age=60, must-revalidate',
        'x-content-type-options': 'nosniff'
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
        .end('<!doctype html><meta charset="utf-8"><title>404</title><p>Not found. <a href="/">Bukalemun</a>');
    }
  }).listen(port, () => console.log(`\n  Bukalemun site → http://localhost:${port}/\n`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assemble();
  console.log(`  _site/ assembled`);
  if (process.argv.includes('--serve')) serve(Number(process.env.PORT || 4321));
}
