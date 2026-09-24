import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const TOTAL_ARCHIVES = 31;
export function useQuranWebOffline(enabled: boolean) {
  const supported = Platform.OS === 'web' && process.env.NODE_ENV === 'production'
    && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'caches' in window;
  const [readyCount, setReadyCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(false);

  const send = useCallback(async (type: 'STATUS_QURAN' | 'CACHE_QURAN') => {
    if (!supported) return;
    if (type === 'CACHE_QURAN') {
      setDownloading(true);
      setError(false);
      const persistRequest = navigator.storage?.persist?.();
      if (persistRequest) await persistRequest.catch(() => false);
    }
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Offline worker timed out')), 20000); }),
      ]).finally(() => { if (timer) clearTimeout(timer); });
      if (!registration.active) throw new Error('Offline worker is not active');
      const channel = new MessageChannel();
      channel.port1.onmessage = event => {
        const message = event.data as { type: string; done: number; total: number };
        setReadyCount(message.done);
        if (message.type === 'complete' || message.type === 'error') {
          setDownloading(false);
          setError(message.type === 'error');
          channel.port1.close();
        }
      };
      registration.active.postMessage({ type }, [channel.port2]);
    } catch {
      setDownloading(false);
      setError(true);
    }
  }, [supported]);

  useEffect(() => {
    if (!enabled || !supported) return;
    let active = true;
    navigator.serviceWorker.register('/sharek-sw.js', { scope: '/' }).then(() => {
      if (active) void send('STATUS_QURAN');
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [enabled, supported, send]);

  return {
    supported,
    ready: readyCount === TOTAL_ARCHIVES,
    readyCount,
    total: TOTAL_ARCHIVES,
    downloading,
    error,
    download: () => send('CACHE_QURAN'),
  };
}
