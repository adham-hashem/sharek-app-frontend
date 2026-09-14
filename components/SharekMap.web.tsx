import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LocateFixed } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { Coords } from '@/lib/location';
import { FoodDonation, MealRequest } from '@/lib/supabase';

type Props = {
  location: Coords | null;
  locating: boolean;
  requests: MealRequest[];
  donations: FoodDonation[];
  font: string;
  t: (key: string) => string;
  onSelect: (item: { type: 'request' | 'food'; id: string }) => void;
  onReady: () => void;
};

export function SharekMap({ location, locating, requests, donations, font, t, onSelect, onReady }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(() => makeGoogleMapHtml(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY), []);

  const post = (message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'map-ready') {
        onReady();
        if (location) post({ type: 'center', lat: location.latitude, lng: location.longitude, zoom: 15 });
      }
      if (event.data?.type === 'tap') onSelect({ type: event.data.itemType, id: event.data.id });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [location, onReady, onSelect]);

  useEffect(() => {
    post({ type: 'data', location, requests, donations });
  }, [location, requests, donations]);

  return (
    <View style={styles.mapWrap}>
      {React.createElement('iframe', {
        ref: (node: HTMLIFrameElement | null) => { iframeRef.current = node; },
        title: 'SHARek real map',
        srcDoc: html,
        style: { border: 0, width: '100%', height: '100%', display: 'block' },
        onLoad: () => {
          onReady();
          post({ type: 'data', location, requests, donations });
          if (location) post({ type: 'center', lat: location.latitude, lng: location.longitude, zoom: 15 });
        },
        allow: 'geolocation',
      })}
      {locating && <LoadingOverlay font={font} t={t} />}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.mapControlBtn} onPress={() => location && post({ type: 'center', lat: location.latitude, lng: location.longitude, zoom: 15 })} activeOpacity={0.75}><LocateFixed size={18} color={colors.primary} /></TouchableOpacity>
        <TouchableOpacity style={styles.mapControlBtn} onPress={() => post({ type: 'zoom', delta: 1 })} activeOpacity={0.75}><Text style={[styles.mapControlText, { fontFamily: `${font}Bold` }]}>+</Text></TouchableOpacity>
        <TouchableOpacity style={styles.mapControlBtn} onPress={() => post({ type: 'zoom', delta: -1 })} activeOpacity={0.75}><Text style={[styles.mapControlText, { fontFamily: `${font}Bold` }]}>−</Text></TouchableOpacity>
      </View>
      <Legend font={font} t={t} />
    </View>
  );
}

function makeGoogleMapHtml(apiKey?: string) {
  const key = (apiKey ?? '').trim();
  if (!key) {
    return `<!DOCTYPE html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#eef5f0;font-family:Arial;color:#5D4037;text-align:center;padding:24px;box-sizing:border-box">
      <div>Google Maps API key is not configured.<br/>Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY on Vercel.</div>
    </body></html>`;
  }
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#e8efe8}.marker{width:40px;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:18px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)}.user{width:18px;height:18px;border-radius:50%;background:#1E88E5;border:3px solid white;box-shadow:0 0 0 2px rgba(30,136,229,.35)}</style></head>
<body><div id="map"></div><script>
var map,markers={},userMarker=null,accuracyCircle=null;
function initMap(){map=new google.maps.Map(document.getElementById('map'),{center:{lat:24.4539,lng:54.3773},zoom:7,mapTypeId:'roadmap',disableDefaultUI:false,streetViewControl:false,mapTypeControl:false,fullscreenControl:false,gestureHandling:'greedy'});parent.postMessage({type:'map-ready'},'*');}
function markerContent(emoji,color){var el=document.createElement('div');el.className='marker';el.style.background=color;el.textContent=emoji;return el}
function userContent(){var el=document.createElement('div');el.className='user';return el}
function makeMarker(position,content){return new google.maps.marker.AdvancedMarkerElement({map:map,position:position,content:content})}
function update(data){if(!map)return;data=data||{};var seen={};(data.requests||[]).forEach(function(r){var k='r_'+r.id,pos={lat:r.latitude,lng:r.longitude};seen[k]=1;if(!markers[k]){markers[k]=makeMarker(pos,markerContent('❤️','#F7564C'));markers[k].addListener('click',function(){parent.postMessage({type:'tap',itemType:'request',id:r.id},'*')})}else markers[k].position=pos});(data.donations||[]).forEach(function(d){var k='d_'+d.id,pos={lat:d.latitude,lng:d.longitude};seen[k]=1;if(!markers[k]){markers[k]=makeMarker(pos,markerContent('🍱','#2E9E5B'));markers[k].addListener('click',function(){parent.postMessage({type:'tap',itemType:'food',id:d.id},'*')})}else markers[k].position=pos});Object.keys(markers).forEach(function(k){if(!seen[k]){markers[k].map=null;delete markers[k]}});if(data.location){var pos={lat:data.location.latitude,lng:data.location.longitude};if(!userMarker)userMarker=makeMarker(pos,userContent());else userMarker.position=pos;if(!accuracyCircle)accuracyCircle=new google.maps.Circle({map:map,center:pos,radius:Math.max(data.location.accuracy||35,25),strokeColor:'#1E88E5',strokeOpacity:.45,strokeWeight:1,fillColor:'#1E88E5',fillOpacity:.16});else{accuracyCircle.setCenter(pos);accuracyCircle.setRadius(Math.max(data.location.accuracy||35,25));}}}
addEventListener('message',function(e){var m=e.data||{};if(m.type==='data')update(m);if(m.type==='center'&&map)map.panTo({lat:m.lat,lng:m.lng}),map.setZoom(m.zoom||15);if(m.type==='zoom'&&map)map.setZoom(map.getZoom()+(m.delta||0));});
</script><script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=marker&callback=initMap"></script></body></html>`;
}

function LoadingOverlay({ font, t }: { font: string; t: (key: string) => string }) {
  return <View style={styles.locatingOverlay}><ActivityIndicator color={colors.primary} size="small" /><Text style={[typography.small, { color: colors.brownMuted, fontFamily: `${font}Regular` }]}>{t('locating')}</Text></View>;
}

function Legend({ font, t }: { font: string; t: (key: string) => string }) {
  return <View style={styles.legend}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.coral }]} /><Text style={[styles.legendText, { fontFamily: `${font}SemiBold` }]}>{t('markerRequest')}</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.green }]} /><Text style={[styles.legendText, { fontFamily: `${font}SemiBold` }]}>{t('markerFood')}</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#1E88E5', borderColor: colors.white, borderWidth: 2 }]} /><Text style={[styles.legendText, { fontFamily: `${font}SemiBold` }]}>{t('myLocation')}</Text></View></View>;
}

const styles = StyleSheet.create({
  mapWrap: { height: 320, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border },
  mapControls: { position: 'absolute', right: spacing.sm, top: spacing.sm, gap: spacing.xs },
  mapControlBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  mapControlText: { fontSize: 24, lineHeight: 26, color: colors.primary },
  locatingOverlay: { position: 'absolute', top: spacing.sm, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.white, alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, marginHorizontal: spacing.xxl, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  legend: { position: 'absolute', bottom: spacing.sm, left: spacing.sm, right: spacing.sm, flexDirection: 'row', justifyContent: 'center', gap: spacing.md, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.micro, color: colors.brown },
});
