const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'dist');
const worker = fs.readFileSync(path.join(root, 'sharek-sw.js'), 'utf8');
const core = JSON.parse(worker.match(/const CORE = (\[[^;]*\]);/)?.[1] ?? 'null');
const quran = JSON.parse(worker.match(/const QURAN = (\[[^;]*\]);/)?.[1] ?? 'null');
if (!Array.isArray(core) || !Array.isArray(quran) || quran.length !== 31) throw new Error('Offline manifest is incomplete');
for (const url of [...core, ...quran]) {
  if (!url.startsWith('/') || url.includes('..') || !fs.existsSync(path.join(root, url.slice(1)))) {
    throw new Error(`Missing public asset: ${url}`);
  }
  if (/supabase|\/api\/|\/v1\/|auth-callback/i.test(url)) {
    throw new Error(`Sensitive path must not be cached: ${url}`);
  }
}
console.log(`Verified offline manifest: ${core.length} static shell assets and ${quran.length} Mushaf archives.`);
