import React, { useRef, useEffect, useCallback, useState } from 'react';
import { StyleSheet, View, Text, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { Navigation, MapPin } from 'lucide-react-native';
import { haversineKm, Coords } from '@/lib/location';

interface Props {
  requesterLat: number;
  requesterLng: number;
  helperLat: number | null;
  helperLng: number | null;
  userRole: 'helper' | 'requester';
  font: string;
  distLabel: string;
  helperLabel: string;
  requesterLabel: string;
}

const LIVE_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#FFF8F0;}
.sharek-marker{background:transparent !important;border:none !important;}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map', { zoomControl: false, attributionControl: false, zoomSnap: 0.5 }).setView([24.7136, 46.6753], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: true }).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);
var reqMarker = null, helpMarker = null, line = null;
var ready = false;

window.addEventListener('message', function(e) {
  var m = e.data || {};
  if (m.type === 'lm-update') window.doUpdate(m);
  if (m.type === 'lm-fit') window.fitBounds();
});

function makePin(emoji, color, label) {
  return L.divIcon({
    className: 'sharek-marker',
    html: '<div style="position:relative;">' +
      '<div style="width:40px;height:40px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">' + emoji + '</div>' +
      '<div style="position:absolute;top:44px;left:50%;transform:translateX(-50%);white-space:nowrap;background:white;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;color:' + color + ';box-shadow:0 1px 4px rgba(0,0,0,0.15);">' + label + '</div>' +
      '</div>',
    iconSize: [40, 56],
    iconAnchor: [20, 20]
  });
}

window.doUpdate = function(d) {
  var reqLatLng = [d.reqLat, d.reqLng];
  if (!reqMarker) {
    reqMarker = L.marker(reqLatLng, { icon: makePin('❤️', '#F7564C', d.reqLabel), zIndexOffset: 500 }).addTo(map);
  } else { reqMarker.setLatLng(reqLatLng); }

  if (d.helpLat != null && d.helpLng != null) {
    var helpLatLng = [d.helpLat, d.helpLng];
    if (!helpMarker) {
      helpMarker = L.marker(helpLatLng, { icon: makePin('🤝', '#2E9E5B', d.helpLabel), zIndexOffset: 600 }).addTo(map);
    } else { helpMarker.setLatLng(helpLatLng); }

    if (line) { map.removeLayer(line); }
    line = L.polyline([reqLatLng, helpLatLng], { color: '#2E9E5B', weight: 3, opacity: 0.5, dashArray: '8,8' }).addTo(map);
  }

  if (!ready) {
    ready = true;
    window.fitBounds();
  }
};

window.fitBounds = function() {
  var pts = [];
  if (reqMarker) pts.push(reqMarker.getLatLng());
  if (helpMarker) pts.push(helpMarker.getLatLng());
  if (pts.length >= 2) {
    map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15 });
  } else if (pts.length === 1) {
    map.setView(pts[0], 14);
  }
};

window.parent.postMessage({ type: 'lm-ready' }, '*');
</script>
</body>
</html>`;

export function LiveMatchMap({
  requesterLat, requesterLng, helperLat, helperLng, userRole, font, distLabel, helperLabel, requesterLabel,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (Platform.OS === 'web') {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(msg, '*');
      }
      return;
    }
    const type = msg.type;
    if (type === 'lm-update') {
      webViewRef.current?.injectJavaScript(`window.doUpdate(${JSON.stringify(msg)}); true;`);
    } else if (type === 'lm-fit') {
      webViewRef.current?.injectJavaScript(`window.fitBounds(); true;`);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    sendMessage({
      type: 'lm-update',
      reqLat: requesterLat,
      reqLng: requesterLng,
      helpLat: helperLat,
      helpLng: helperLng,
      reqLabel: requesterLabel,
      helpLabel: helperLabel,
    });
  }, [ready, requesterLat, requesterLng, helperLat, helperLng, requesterLabel, helperLabel, sendMessage]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'lm-ready') setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const dist = (helperLat != null && helperLng != null)
    ? haversineKm(
        { latitude: requesterLat, longitude: requesterLng },
        { latitude: helperLat, longitude: helperLng }
      )
    : null;

  const distText = dist === null ? '—'
    : dist < 1 ? `${Math.round(dist * 1000)} m`
    : `${dist.toFixed(1)} km`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Navigation size={16} color={colors.greenDark} />
        <Text style={[typography.small, { color: colors.greenDark, fontFamily: `${font}SemiBold` }]}>
          {distLabel}: {distText}
        </Text>
      </View>

      <View style={styles.mapWrap}>
        {Platform.OS === 'web' ? (
          React.createElement('iframe', {
            ref: (node: any) => { iframeRef.current = node; },
            title: 'SHARek live match map',
            srcDoc: LIVE_MAP_HTML,
            style: { border: 0, width: '100%', height: '100%', display: 'block' },
            onLoad: () => setReady(true),
            allow: 'geolocation',
          })
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: LIVE_MAP_HTML }}
            style={styles.map}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            onMessage={(e: any) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'lm-ready') setReady(true);
              } catch { /* ignore */ }
            }}
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.green} size="large" />
              </View>
            )}
          />
        )}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.coral }]} />
          <Text style={[typography.micro, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
            {requesterLabel}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.green }]} />
          <Text style={[typography.micro, { color: colors.brown, fontFamily: `${font}SemiBold` }]}>
            {helperLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  mapWrap: {
    width: '100%', height: 220, borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1.5, borderColor: colors.border,
  },
  map: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceAlt },
  legendRow: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.lg,
    marginTop: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
