import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { unzipSync, strFromU8 } from 'fflate';
import { Platform } from 'react-native';

export const QURAN_PAGE_COUNT = 604;
const PAGE_ARCHIVES = [
  require('../assets/quran/pages-001-020.zip'),
  require('../assets/quran/pages-021-040.zip'),
  require('../assets/quran/pages-041-060.zip'),
  require('../assets/quran/pages-061-080.zip'),
  require('../assets/quran/pages-081-100.zip'),
  require('../assets/quran/pages-101-120.zip'),
  require('../assets/quran/pages-121-140.zip'),
  require('../assets/quran/pages-141-160.zip'),
  require('../assets/quran/pages-161-180.zip'),
  require('../assets/quran/pages-181-200.zip'),
  require('../assets/quran/pages-201-220.zip'),
  require('../assets/quran/pages-221-240.zip'),
  require('../assets/quran/pages-241-260.zip'),
  require('../assets/quran/pages-261-280.zip'),
  require('../assets/quran/pages-281-300.zip'),
  require('../assets/quran/pages-301-320.zip'),
  require('../assets/quran/pages-321-340.zip'),
  require('../assets/quran/pages-341-360.zip'),
  require('../assets/quran/pages-361-380.zip'),
  require('../assets/quran/pages-381-400.zip'),
  require('../assets/quran/pages-401-420.zip'),
  require('../assets/quran/pages-421-440.zip'),
  require('../assets/quran/pages-441-460.zip'),
  require('../assets/quran/pages-461-480.zip'),
  require('../assets/quran/pages-481-500.zip'),
  require('../assets/quran/pages-501-520.zip'),
  require('../assets/quran/pages-521-540.zip'),
  require('../assets/quran/pages-541-560.zip'),
  require('../assets/quran/pages-561-580.zip'),
  require('../assets/quran/pages-581-600.zip'),
  require('../assets/quran/pages-601-604.zip'),
];
const cachedArchives = new Map<number, Record<string, Uint8Array<ArrayBufferLike>>>();
const pendingArchives = new Map<number, Promise<Record<string, Uint8Array<ArrayBufferLike>>>>();

async function loadArchive(index: number) {
  const cached = cachedArchives.get(index);
  if (cached) return cached;
  const pending = pendingArchives.get(index);
  if (pending) return pending;
  const load = (async () => {
    const asset = await Asset.fromModule(PAGE_ARCHIVES[index]).downloadAsync();
    const bytes = Platform.OS === 'web'
      ? new Uint8Array(await (await fetch(asset.uri)).arrayBuffer())
      : await new File(asset.localUri ?? asset.uri).bytes();
    const pages = unzipSync(bytes);
    cachedArchives.set(index, pages);
    // Keep only the current chunk resident on memory-limited phones.
    for (const key of cachedArchives.keys()) if (key !== index) cachedArchives.delete(key);
    return pages;
  })();
  pendingArchives.set(index, load);
  try { return await load; } finally { pendingArchives.delete(index); }
}

export async function getMushafPage(page: number): Promise<string> {
  if (!Number.isInteger(page) || page < 1 || page > QURAN_PAGE_COUNT) throw new Error('Invalid Mushaf page');
  const pages = await loadArchive(Math.floor((page - 1) / 20));
  const svg = pages[`${String(page).padStart(3, '0')}.svg`];
  if (!svg) throw new Error(`Missing Mushaf page ${page}`);
  return strFromU8(svg);
}
