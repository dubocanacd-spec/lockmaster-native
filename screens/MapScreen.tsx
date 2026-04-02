import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { COLORS } from '../colors';
import LockAlert, { NearbyLock } from './LockAlert';

const SIM_LAT = 51.7512;
const SIM_LNG = -1.2678;
const API_BASE = 'https://lockmasterai.co.uk';

async function fetchPOI(lat: number, lng: number) {
  try {
    const r = await fetch(`${API_BASE}/crt_poi?lat=${lat}&lon=${lng}&radius=5000`);
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data.poi || data.pois || data.features || []);
    return arr;
  } catch (e) {
    return [];
  }
}

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #1A1B2E; }
    .leaflet-popup-content-wrapper { background: #1A1B2E; color: #fff; border: 1px solid #FF6B35; border-radius: 8px; font-family: sans-serif; }
    .leaflet-popup-tip { background: #1A1B2E; }
    .leaflet-popup-content { margin: 10px 14px; font-size: 13px; }
    .poi-name { font-weight: 700; color: #FF6B35; margin-bottom: 4px; }
    .poi-type { color: #8D99AE; font-size: 11px; text-transform: uppercase; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: false })
             .setView([51.7512, -1.2678], 15);

  // Satellite tiles (Esri) primary, Carto Dark fallback
  var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Esri'
  });
  var cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png', {
    subdomains: 'abcd', maxZoom: 19
  });

  var usingSatellite = true;
  satelliteLayer.addTo(map);

  // Toggle satellite/dark
  window.toggleTiles = function() {
    if (usingSatellite) {
      map.removeLayer(satelliteLayer);
      cartoLayer.addTo(map);
    } else {
      map.removeLayer(cartoLayer);
      satelliteLayer.addTo(map);
    }
    usingSatellite = !usingSatellite;
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tileMode', satellite: usingSatellite }));
    }
  };

  var POI_COLORS  = { lock: '#FF6B35', bridge: '#8D99AE', tunnel: '#4FC3F7', winding: '#4CAF50', winding_hole: '#4CAF50', water: '#4FC3F7', water_point: '#4FC3F7', pub: '#FFC107', mooring: '#4CAF50', elsan: '#9C27B0', fuel: '#FF9800' };
  var POI_SYMBOLS = { lock: '🔒', bridge: '🌉', tunnel: '🕳️', winding: '↩️', winding_hole: '↩️', water: '💧', water_point: '💧', pub: '🍺', mooring: '⚓', elsan: '🚽', fuel: '⛽' };

  function getIcon(type) {
    var t = (type || '').toLowerCase();
    var color = POI_COLORS[t] || '#8D99AE';
    var sym = POI_SYMBOLS[t] || '📍';
    return L.divIcon({
      html: '<div style="width:28px;height:28px;background:' + color + ';border:2px solid rgba(255,255,255,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.6);">' + sym + '</div>',
      iconSize: [28,28], iconAnchor: [14,14], className: ''
    });
  }

  var poiLayer = L.layerGroup().addTo(map);
  var canalLayer = L.layerGroup().addTo(map);



  // Narrowboat icon
  var boatIcon = L.divIcon({
    html: '<div style="width:24px;height:24px;background:#FF6B35;border:3px solid white;border-radius:50%;box-shadow:0 0 12px rgba(255,107,53,1),0 0 24px rgba(255,107,53,0.4);"></div>',
    iconSize: [24,24], iconAnchor: [12,12], className: ''
  });
  var boatMarker = null;

  window.handleMessage = function(d) {
    try {
      if (!d) return;

      if (d.type === 'location') {
        if (!boatMarker) {
          boatMarker = L.marker([d.lat, d.lng], { icon: boatIcon }).addTo(map);
          map.setView([d.lat, d.lng], 16);
        } else {
          boatMarker.setLatLng([d.lat, d.lng]);
          map.panTo([d.lat, d.lng]);
        }
      }

      if (d.type === 'canal') {
        L.geoJSON(d.geojson, {
          style: function() { return { color: '#4FC3F7', weight: 3, opacity: 0.85 }; }
        }).addTo(canalLayer);
      }

      if (d.type === 'poi') {
        poiLayer.clearLayers();
        var added = 0;
        (d.pois || []).forEach(function(poi) {
          var coords, name, type;
          if (poi.geometry && poi.geometry.coordinates) {
            coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            name = (poi.properties && poi.properties.name) || 'Unknown';
            type = (poi.properties && poi.properties.type) || 'default';
          } else {
            var lat = poi.lat;
            var lon = poi.lon || poi.lng;
            if (lat && lon) { coords = [lat, lon]; name = poi.name || 'Unknown'; type = poi.type || 'default'; }
          }
          if (coords) {
            L.marker(coords, { icon: getIcon(type) })
             .bindPopup('<div class="poi-name">' + name + '</div><div class="poi-type">' + type + '</div>')
             .addTo(poiLayer);
            added++;
          }
        });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'poiLoaded', count: added }));
        }
      }
    } catch(e) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', msg: e.message }));
    }
  };
</script>
</body>
</html>
`;

export default function MapScreen() {
  const webviewRef = useRef<WebView>(null);
  const webviewReady = useRef(false);
  const pendingMessages = useRef<object[]>([]);
  const lastPoiCenter = useRef<{lat: number, lng: number} | null>(null);
  const knownPOI = useRef<any[]>([]);
  const dismissedLock = useRef<string | null>(null);

  const [gpsStatus, setGpsStatus] = useState('GPS...');
  const [simActive, setSimActive] = useState(false);
  const [nearbyLock, setNearbyLock] = useState<NearbyLock | null>(null);
  const [nextLock, setNextLock] = useState<{name: string, dist: number} | null>(null);
  const [satellite, setSatellite] = useState(true);
  const [speed, setSpeed] = useState(0);

  function inject(data: object) {
    const js = `if(window.handleMessage){window.handleMessage(${JSON.stringify(data)});} true;`;
    if (!webviewReady.current) { pendingMessages.current.push(data); return; }
    webviewRef.current?.injectJavaScript(js);
  }

  function onWebViewReady() {
    webviewReady.current = true;
    pendingMessages.current.forEach(data => {
      webviewRef.current?.injectJavaScript(`if(window.handleMessage){window.handleMessage(${JSON.stringify(data)});} true;`);
    });
    pendingMessages.current = [];
    loadCanal();
  }

  function checkProximity(lat: number, lng: number) {
    if (!knownPOI.current.length) return;
    let closest: any = null;
    let minDist = Infinity;
    knownPOI.current.forEach(poi => {
      const dlat = lat - poi.lat;
      const dlon = lng - (poi.lon || poi.lng);
      const dist = Math.sqrt(dlat*dlat + dlon*dlon) * 111000;
      if (dist < minDist) { minDist = dist; closest = poi; }
    });
    if (closest) {
      setNextLock({ name: closest.name, dist: Math.round(minDist) });
      if (minDist < 600 && dismissedLock.current !== closest.name) {
        setNearbyLock({ name: closest.name, dist: minDist, type: closest.type });
      } else if (minDist > 700) {
        setNearbyLock(null);
      }
    }
  }

  async function loadCanal() {
    try {
      const r = await fetch(`${API_BASE}/geojson/canals`);
      const geojson = await r.json();
      const js = `if(window.handleMessage){window.handleMessage(${JSON.stringify({ type: 'canal', geojson })});} true;`;
      webviewRef.current?.injectJavaScript(js);
    } catch (e) {
      console.warn('Canal fetch failed', e);
    }
  }

  async function sendPOI(lat: number, lng: number) {
    const pois = await fetchPOI(lat, lng);
    knownPOI.current = pois;
    inject({ type: 'poi', pois });
  }

  function sendLocation(lat: number, lng: number, spd?: number) {
    inject({ type: 'location', lat, lng });
    if (spd !== undefined) setSpeed(Math.round(spd * 2.237)); // m/s to mph
    checkProximity(lat, lng);
    if (!lastPoiCenter.current) {
      lastPoiCenter.current = { lat, lng };
      sendPOI(lat, lng);
    } else {
      const dlat = lat - lastPoiCenter.current.lat;
      const dlng = lng - lastPoiCenter.current.lng;
      if (Math.sqrt(dlat*dlat + dlng*dlng) * 111000 > 500) {
        lastPoiCenter.current = { lat, lng };
        sendPOI(lat, lng);
      }
    }
  }

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    if (!simActive) {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setGpsStatus('GPS denied'); return; }
        setGpsStatus('GPS ✓');
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
          (loc) => sendLocation(loc.coords.latitude, loc.coords.longitude, loc.coords.speed || 0)
        );
      })();
    }
    return () => { sub?.remove(); };
  }, [simActive]);

  function toggleSim() {
    if (simActive) {
      setSimActive(false); setGpsStatus('GPS ✓');
      setNearbyLock(null); setNextLock(null);
      lastPoiCenter.current = null; dismissedLock.current = null;
    } else {
      setSimActive(true); setGpsStatus('SIM Isis Lock');
      lastPoiCenter.current = null; dismissedLock.current = null;
      sendLocation(SIM_LAT, SIM_LNG, 1.5);
      setTimeout(() => checkProximity(SIM_LAT, SIM_LNG), 4000);
    }
  }

  function toggleTiles() {
    webviewRef.current?.injectJavaScript('window.toggleTiles(); true;');
    setSatellite(prev => !prev);
  }

  const distText = (d: number) => d < 1000 ? `${d}m` : `${(d/1000).toFixed(1)}km`;

  return (
    <View style={styles.container}>
      {/* Next Lock Header */}
      {nextLock && (
        <View style={styles.nextLockHeader}>
          <Text style={styles.nextLockIcon}>🔒</Text>
          <View>
            <Text style={styles.nextLockName}>{nextLock.name}</Text>
            <Text style={styles.nextLockDist}>{distText(nextLock.dist)} ahead</Text>
          </View>
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ html: MAP_HTML }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        onLoadEnd={onWebViewReady}
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d.type === 'tileMode') setSatellite(d.satellite);
          } catch {}
        }}
      />

      {/* GPS badge */}
      <View style={styles.gpsBadge}>
        <Text style={styles.gpsText}>🛰 {gpsStatus}</Text>
      </View>

      {/* Tile toggle */}
      <TouchableOpacity style={styles.tileToggle} onPress={toggleTiles}>
        <Text style={styles.tileToggleText}>{satellite ? '🛰️' : '🗺️'}</Text>
      </TouchableOpacity>

      {/* Speed bar */}
      <View style={styles.speedBar}>
        <Text style={styles.speedValue}>{speed}</Text>
        <Text style={styles.speedUnit}>mph</Text>
      </View>

      {/* SIM button */}
      <TouchableOpacity style={[styles.simBtn, simActive && styles.simBtnActive]} onPress={toggleSim}>
        <Text style={styles.simText}>{simActive ? '⏹' : '▶'}</Text>
        <Text style={styles.simLabel}>{simActive ? 'STOP' : 'SIM'}</Text>
      </TouchableOpacity>

      {/* Lock Alert */}
      <LockAlert
        lock={nearbyLock}
        onApproach={() => setNearbyLock(null)}
        onDismiss={() => { dismissedLock.current = nearbyLock?.name || null; setNearbyLock(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#1A1B2E' },
  map:            { flex: 1 },

  nextLockHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(26,27,46,0.95)', paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.orange },
  nextLockIcon:   { fontSize: 20 },
  nextLockName:   { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  nextLockDist:   { color: COLORS.orange, fontSize: 11, fontWeight: '600' },

  gpsBadge:       { position: 'absolute', top: 60, right: 10, backgroundColor: 'rgba(26,27,46,0.88)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: COLORS.green },
  gpsText:        { color: COLORS.green, fontSize: 11, fontWeight: '700' },

  tileToggle:     { position: 'absolute', top: 60, left: 10, backgroundColor: 'rgba(26,27,46,0.88)', width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2b3d' },
  tileToggleText: { fontSize: 18 },

  speedBar:       { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 30, paddingHorizontal: 24, paddingVertical: 10, flexDirection: 'row', alignItems: 'baseline', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  speedValue:     { color: COLORS.white, fontSize: 32, fontWeight: '900' },
  speedUnit:      { color: COLORS.muted, fontSize: 14, fontWeight: '600' },

  simBtn:         { position: 'absolute', right: 10, top: '45%', backgroundColor: 'rgba(26,27,46,0.92)', paddingHorizontal: 10, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.orange, alignItems: 'center' },
  simBtnActive:   { borderColor: COLORS.red, backgroundColor: 'rgba(230,57,70,0.15)' },
  simText:        { color: COLORS.white, fontSize: 16 },
  simLabel:       { color: COLORS.white, fontSize: 9, fontWeight: '700', marginTop: 2 },
});
