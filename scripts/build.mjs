import { build } from 'vite';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

await build();
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
const assets = (await files('dist')).filter(f => !f.endsWith('sw.js')).map(f => '/' + path.relative('dist', f).replaceAll('\\', '/'));
const version = `geocoleta-demo-${Date.now()}`;
await writeFile('dist/sw.js', `
const CACHE = ${JSON.stringify(version)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('geocoleta-demo-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => event.request.mode === 'navigate' ? caches.match('/index.html') : Response.error())));
});
`);
console.log('Service worker generated: offline shell and fonts cached.');
