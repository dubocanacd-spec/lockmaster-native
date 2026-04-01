import React, { useRef, useEffect, useState, useCallback } from 'react';
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
    const r = await fetch(`${API_BASE}/crt_poi?lat=${lat}&lon=${lng}&radius=3000`);
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data.poi || data.pois || data.features || []);
    console.log('POI fetched:', arr.length, 'items', arr[0] ? JSON.stringify(arr[0]) : 'empty');
    return arr;
  } catch (e) {
    console.warn('POI fetch failed', e);
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
    html, body, #map { width: 100%; height: 100%; background: #2B2D42; }
    #tile-badge {
      position: absolute; top: 10px; left: 10px; z-index: 1000;
      background: rgba(27,28,46,0.88); color: #FF6B35;
      font-size: 11px; font-weight: 700;
      padding: 4px 10px; border-radius: 6px;
      border: 1px solid #FF6B35; font-family: sans-serif;
    }
    .leaflet-popup-content-wrapper { background: #1A1B2E; color: #fff; border: 1px solid #FF6B35; border-radius: 8px; font-family: sans-serif; }
    .leaflet-popup-tip { background: #1A1B2E; }
    .leaflet-popup-content { margin: 10px 14px; font-size: 13px; }
    .poi-name { font-weight: 700; color: #FF6B35; margin-bottom: 4px; }
    .poi-type { color: #8D99AE; font-size: 11px; text-transform: uppercase; }
  </style>
</head>
<body>
<div id="map"></div>
<div id="tile-badge">Carto</div>
<script>
  var errorCount = 0;
  var map = L.map('map', { zoomControl: true, attributionControl: false })
             .setView([51.7512, -1.2678], 15);

  var cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png', { subdomains: 'abcd', maxZoom: 19 });
  var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 19 });
  cartoLayer.on('tileerror', function() {
    errorCount++;
    if (errorCount > 4) { map.removeLayer(cartoLayer); osmLayer.addTo(map); document.getElementById('tile-badge').textContent = 'OSM'; }
  });
  cartoLayer.addTo(map);

  var POI_COLORS  = { lock: '#FF6B35', bridge: '#8D99AE', tunnel: '#4FC3F7', winding: '#4CAF50', winding_hole: '#4CAF50', water: '#4FC3F7', water_point: '#4FC3F7', pub: '#FFC107', mooring: '#4CAF50', elsan: '#9C27B0', fuel: '#FF9800' };
  var POI_SYMBOLS = { lock: '🔒', bridge: '🌉', tunnel: '🕳️', winding: '↩️', winding_hole: '↩️', water: '💧', water_point: '💧', pub: '🍺', mooring: '⚓', elsan: '🚽', fuel: '⛽' };

  function getIcon(type) {
    var t = (type || '').toLowerCase();
    var color = POI_COLORS[t] || '#8D99AE';
    var sym = POI_SYMBOLS[t] || '📍';
    return L.divIcon({
      html: '<div style="width:22px;height:22px;background:' + color + ';border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.4);">' + sym + '</div>',
      iconSize: [22,22], iconAnchor: [11,11], className: ''
    });
  }

  var poiLayer = L.layerGroup().addTo(map);

  var boatIcon = L.divIcon({
    html: '<div style="width:18px;height:18px;background:#FF6B35;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(255,107,53,0.9);"></div>',
    iconSize: [18,18], iconAnchor: [9,9], className: ''
  });
  var boatMarker = null;

  window.handleMessage = function(d) {
    try {
      if (!d) return;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('MSG type=' + d.type + (d.pois ? ' count=' + d.pois.length : ''));

      if (d.type === 'location') {
        if (!boatMarker) {
          boatMarker = L.marker([d.lat, d.lng], { icon: boatIcon }).addTo(map);
          map.setView([d.lat, d.lng], 15);
        } else {
          boatMarker.setLatLng([d.lat, d.lng]);
          map.panTo([d.lat, d.lng]);
        }
      }

      if (d.type === 'poi') {
        poiLayer.clearLayers();
        var poiList = d.pois || [];
        var added = 0;
        poiList.forEach(function(poi) {
          var coords, name, type;
          if (poi.geometry && poi.geometry.coordinates) {
            coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            name = (poi.properties && poi.properties.name) || 'Unknown';
            type = (poi.properties && poi.properties.type) || 'default';
          } else {
            var lat = poi.lat;
            var lon = poi.lon || poi.lng || poi.longitude;
            if (lat && lon) {
              coords = [lat, lon];
              name = poi.name || 'Unknown';
              type = poi.type || 'default';
            }
          }
          if (coords) {
            L.marker(coords, { icon: getIcon(type) })
             .bindPopup('<div class="poi-name">' + name + '</div><div class="poi-type">' + type + '</div>')
             .addTo(poiLayer);
            added++;
          }
        });
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage('POI added: ' + added + '/' + poiList.length);
      }
    } catch(e) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('JS Error: ' + e.message);
    }
  };
</script>
</body>
</html>
`;

export default function MapScreen() {
  const webviewRef = useRef<WebView>(null);
  const [gpsStatus, setGpsStatus] = useState('GPS...');
  const [simActive, setSimActive] = useState(false);
  const [nearbyLock, setNearbyLock] = useState<NearbyLock | null>(null);
  const knownPOI = useRef<any[]>([]);
  const dismissedLock = useRef<string | null>(null);
  const webviewReady = useRef(false);
  const pendingMessages = useRef<object[]>([]);
  const lastPoiCenter = useRef<{lat: number, lng: number} | null>(null);

  function inject(data: object) {
    const js = `if(window.handleMessage){window.handleMessage(${JSON.stringify(data)});} true;`;
    if (!webviewReady.current) {
      pendingMessages.current.push(data);
      return;
    }
    webviewRef.current?.injectJavaScript(js);
  }

  function onWebViewReady() {
    webviewReady.current = true;
    // Flush pending messages
    pendingMessages.current.forEach(data => {
      const js = `if(window.handleMessage){window.handleMessage(${JSON.stringify(data)});} true;`;
      webviewRef.current?.injectJavaScript(js);
    });
    pendingMessages.current = [];
  }

  async function sendPOI(lat: number, lng: number) {
    const pois = await fetchPOI(lat, lng);
    knownPOI.current = pois;
    inject({ type: 'poi', pois });
  }

  function checkProximity(lat: number, lng: number) {
    if (knownPOI.current.length === 0) return;
    let closest: any = null;
    let minDist = Infinity;
    knownPOI.current.forEach(poi => {
      const dlat = lat - poi.lat;
      const dlon = lng - (poi.lon || poi.lng);
      const dist = Math.sqrt(dlat*dlat + dlon*dlon) * 111000;
      if (dist < minDist) { minDist = dist; closest = { ...poi, dist }; }
    });
    if (closest && minDist < 600 && dismissedLock.current !== closest.name) {
      setNearbyLock({ name: closest.name, dist: minDist, type: closest.type });
    } else if (minDist > 700) {
      setNearbyLock(null);
    }
  }

  function sendLocation(lat: number, lng: number) {
    inject({ type: 'location', lat, lng });
    checkProximity(lat, lng);
    if (!lastPoiCenter.current) {
      lastPoiCenter.current = { lat, lng };
      sendPOI(lat, lng);
    } else {
      const dlat = lat - lastPoiCenter.current.lat;
      const dlng = lng - lastPoiCenter.current.lng;
      const dist = Math.sqrt(dlat*dlat + dlng*dlng) * 111000;
      if (dist > 500) {
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
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
          (loc) => sendLocation(loc.coords.latitude, loc.coords.longitude)
        );
      })();
    }
    return () => { sub?.remove(); };
  }, [simActive]);

  function toggleSim() {
    if (simActive) {
      setSimActive(false);
      setGpsStatus('GPS ✓');
      lastPoiCenter.current = null;
      setNearbyLock(null);
    } else {
      setSimActive(true);
      setGpsStatus('SIM Isis Lock');
      lastPoiCenter.current = null;
      dismissedLock.current = null;
      sendLocation(SIM_LAT, SIM_LNG);
      // POI fetch je async, checkProximity tek nakon 4s
      setTimeout(() => checkProximity(SIM_LAT, SIM_LNG), 4000);
    }
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ html: MAP_HTML }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        onLoadEnd={onWebViewReady}
        onMessage={(e) => console.log('WebView log:', e.nativeEvent.data)}
      />
      <View style={styles.gpsBadge}>
        <Text style={styles.gpsText}>🛰 {gpsStatus}</Text>
      </View>
      <LockAlert
        lock={nearbyLock}
        onApproach={() => { console.log('Approaching', nearbyLock?.name); setNearbyLock(null); }}
        onDismiss={() => { dismissedLock.current = nearbyLock?.name || null; setNearbyLock(null); }}
      />
      <TouchableOpacity style={[styles.simBtn, simActive && styles.simBtnActive]} onPress={toggleSim}>
        <Text style={styles.simText}>{simActive ? '⏹' : '▶'}</Text>
        <Text style={styles.simLabel}>{simActive ? 'STOP' : 'SIM'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  map:          { flex: 1 },
  gpsBadge:     { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(27,28,46,0.88)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: COLORS.green },
  gpsText:      { color: COLORS.green, fontSize: 11, fontWeight: '700' },
  simBtn:       { position: 'absolute', right: 10, top: '45%', backgroundColor: 'rgba(27,28,46,0.92)', paddingHorizontal: 10, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.orange, alignItems: 'center' },
  simBtnActive: { borderColor: COLORS.red, backgroundColor: 'rgba(230,57,70,0.15)' },
  simText:      { color: COLORS.white, fontSize: 16 },
  simLabel:     { color: COLORS.white, fontSize: 9, fontWeight: '700', marginTop: 2 },
});
