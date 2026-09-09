#!/usr/bin/env node
/* =============================================================================
   BUKALEMUN — scripts/check-links.mjs
   Walks every outbound link in the docs and the README and reports the ones
   that do not resolve. Deliberately *not* part of `npm test`: it needs the
   network, and a third party being down is not a reason to fail a build.

   Run: node scripts/check-links.mjs
   ========================================================================== */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Fenced blocks are examples, not links — an elided CDN path is not broken. */
const withoutCode = (md) => md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

const read = (rel, strip) => {
  const body = readFileSync(join(root, rel), 'utf8');
  return strip ? withoutCode(body) : body;
};

const sources = {
  'docs/index.html': read('docs/index.html', false),
  'README.md': read('README.md', true),
  'PROJECT.md': read('PROJECT.md', true),
  'CONTRIBUTING.md': read('CONTRIBUTING.md', true)
};

const external = new Map();   // url -> [where]
const local = new Map();

for (const [file, body] of Object.entries(sources)) {
  const urls = [
    ...[...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
    ...[...body.matchAll(/src="([^"]+)"/g)].map((m) => m[1]),
    ...[...body.matchAll(/srcset="([^"]+)"/g)].map((m) => m[1]),
    ...[...body.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1])
  ];
  for (const url of urls) {
    if (url.startsWith('#') || url.startsWith('data:') || url.startsWith('mailto:')) continue;
    const map = /^https?:\/\//.test(url) ? external : local;
    if (!map.has(url)) map.set(url, []);
    map.get(url).push(file);
  }
}

const problems = [];

// Local paths are resolved relative to the file that mentions them.
for (const [url, files] of local) {
  for (const file of files) {
    const base = file === 'docs/index.html' ? join(root, 'docs') : root;
    const target = join(base, url.split('?')[0].split('#')[0]);
    if (!existsSync(target)) problems.push({ url, file, status: 'missing on disk' });
  }
}

/**
 * Some hosts answer a scripted request with 403 whatever you send. npmjs.com is
 * one of them, so asking it whether a package exists is the wrong question —
 * the registry knows, and it will answer.
 */
function authoritativeUrl(url) {
  const npm = url.match(/^https:\/\/(?:www\.)?npmjs\.com\/package\/((?:@[^/]+\/)?[^/?#]+)/);
  if (npm) return `https://registry.npmjs.org/${npm[1]}`;
  return url;
}

const HEADERS = {
  'user-agent': 'bukalemun-link-check (+https://github.com/nickzsche/bukalemun)',
  accept: '*/*'
};

const results = await Promise.all([...external.keys()].map(async (url) => {
  const target = authoritativeUrl(url);
  try {
    let res = await fetch(target, { method: 'HEAD', redirect: 'follow', headers: HEADERS });
    // Plenty of hosts dislike HEAD; retry properly before calling it broken.
    if (res.status === 405 || res.status === 403 || res.status === 404) {
      res = await fetch(target, { method: 'GET', redirect: 'follow', headers: HEADERS });
    }
    return { url, status: res.status, via: target === url ? null : target };
  } catch (err) {
    return { url, status: 'unreachable: ' + err.message };
  }
}));

for (const r of results) {
  if (typeof r.status !== 'number' || r.status >= 400) {
    problems.push({
      url: r.url + (r.via ? `  (checked via ${r.via})` : ''),
      file: external.get(r.url).join(', '),
      status: r.status
    });
  }
}

console.log(`\n\x1b[1mLink check\x1b[0m — ${external.size} external, ${local.size} local\n`);
if (!problems.length) {
  console.log('\x1b[32m\x1b[1m  every link resolves\x1b[0m\n');
  process.exit(0);
}
for (const p of problems) {
  console.log(`\x1b[31m  ${String(p.status).padEnd(18)}\x1b[0m ${p.url}\n                     ${p.file}`);
}
console.log(`\n\x1b[31m\x1b[1m  ${problems.length} broken\x1b[0m\n`);
process.exit(1);
