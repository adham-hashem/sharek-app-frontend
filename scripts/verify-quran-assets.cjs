const fs = require('node:fs');
const path = require('node:path');
const { unzipSync } = require('fflate');

const root = path.resolve(__dirname, '..');
const archiveDir = path.join(root, 'assets', 'quran');
const indexSource = fs.readFileSync(path.join(root, 'lib', 'quranHizbIndex.ts'), 'utf8');
const indexJson = indexSource.match(/export const HIZB_STARTS:[^=]+= (\[[^;]+\]);/)?.[1];
if (!indexJson) throw new Error('Cannot read Hizb index');
const hizbs = JSON.parse(indexJson);
if (hizbs.length !== 60) throw new Error(`Expected 60 Hizbs, found ${hizbs.length}`);

const pages = new Map();
const seen = new Set();
const boundaryPages = new Set(hizbs.map(entry => entry.p));
const archiveFiles = fs.readdirSync(archiveDir).filter(name => name.endsWith('.zip')).sort();
if (archiveFiles.length !== 31) throw new Error(`Expected 31 archives, found ${archiveFiles.length}`);
for (const name of archiveFiles) {
  const entries = unzipSync(fs.readFileSync(path.join(archiveDir, name)));
  for (const [filename, bytes] of Object.entries(entries)) {
    if (!/^\d{3}\.svg$/.test(filename)) throw new Error(`Unexpected entry ${filename}`);
    const page = Number(filename.slice(0, 3));
    if (seen.has(page)) throw new Error(`Duplicate page ${page}`);
    const svg = Buffer.from(bytes).toString('utf8');
    if (!svg.includes('<svg') || !svg.includes('ayahPolygon')) throw new Error(`Invalid page ${page}`);
    seen.add(page);
    if (boundaryPages.has(page)) pages.set(page, svg);
  }
}
if (seen.size !== 604) throw new Error(`Expected 604 pages, found ${seen.size}`);
for (let page = 1; page <= 604; page++) if (!seen.has(page)) throw new Error(`Missing page ${page}`);
for (const entry of hizbs) {
  const svg = pages.get(entry.p);
  const matching = [...svg.matchAll(/<path class="ayahPolygon"[^>]*>/g)].some(([tag]) =>
    Number(tag.match(/surah="(\d+)"/)?.[1]) === entry.s &&
    Number(tag.match(/ayah="(\d+)"/)?.[1]) === entry.a);
  if (!matching) throw new Error(`Hizb ${entry.h} boundary ${entry.s}:${entry.a} missing on page ${entry.p}`);
}
console.log('Verified 604 bundled Mushaf pages and all 60 Hizb boundary verses.');
