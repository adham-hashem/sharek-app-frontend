// Generates a public-static-only service worker after Expo's web export.
// Never cache Supabase/API responses or any private user data.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Run expo export --platform web first');
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, item.name);
    if (item.isDirectory()) walk(absolute);
    else files.push('/' + path.relative(root, absolute).split(path.sep).join('/'));
  }
}
walk(root);
const quran = files.filter(file => /^\/assets\/assets\/quran\/pages-\d{3}-\d{3}\.[a-f0-9]+\.zip$/.test(file)).sort();
if (quran.length !== 31) throw new Error(`Expected 31 Quran archive assets, got ${quran.length}`);
const core = files.filter(file => !quran.includes(file) && !file.endsWith('/metadata.json') && !file.endsWith('/sharek-sw.js')).sort();
const revision = crypto.createHash('sha256').update([...core, ...quran].join('\n')).digest('hex').slice(0, 12);
const script = `
const CORE = ${JSON.stringify(core)};
const QURAN = ${JSON.stringify(quran)};
const CORE_CACHE = 'sharek-static-${revision}';
const QURAN_CACHE = 'sharek-quran-${revision}';
const staticPaths = new Set([...CORE, ...QURAN]);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CORE_CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('sharek-static-') && key !== CORE_CACHE).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CORE_CACHE)).match('/index.html')));
    return;
  }
  if (!staticPaths.has(url.pathname)) return;
  event.respondWith(caches.match(request).then(async hit => {
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(QURAN.includes(url.pathname) ? QURAN_CACHE : CORE_CACHE);
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }));
});
self.addEventListener('message', event => {
  const port = event.ports[0];
  if (!port || !['STATUS_QURAN', 'CACHE_QURAN'].includes(event.data?.type)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(QURAN_CACHE);
    let done = 0;
    for (const url of QURAN) {
      if (!(await cache.match(url))) {
        if (event.data.type === 'CACHE_QURAN') {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (!response.ok) throw new Error('Download failed');
            await cache.put(url, response);
          } catch {
            port.postMessage({ type: 'error', done, total: QURAN.length });
            return;
          }
        }
      }
      if (await cache.match(url)) done++;
      port.postMessage({ type: 'progress', done, total: QURAN.length });
    }
    if (done === QURAN.length) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith('sharek-quran-') && key !== QURAN_CACHE).map(key => caches.delete(key)));
    }
    port.postMessage({ type: 'complete', done, total: QURAN.length });
  })());
});
`;
fs.writeFileSync(path.join(root, 'sharek-sw.js'), script);
console.log(`Offline web assets: ${core.length} shell, ${quran.length} Quran archives (revision ${revision})`);
