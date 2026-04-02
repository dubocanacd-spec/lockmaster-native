import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { COLORS } from '../colors';
import LockAlert, { NearbyLock } from './LockAlert';
import { Modal, Alert, FlatList, TextInput, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REPORT_TYPES = [
  { key: 'broken_lock',    label: 'Broken Lock',    icon: '🔒' },
  { key: 'debris',         label: 'Debris/Tree',    icon: '🌿' },
  { key: 'waterway_closed',label: 'Closed',         icon: '🚫' },
  { key: 'flooding',       label: 'Flooding',       icon: '💧' },
  { key: 'mooring_free',   label: 'Mooring Free',   icon: '🟢' },
  { key: 'mooring_full',   label: 'Mooring Full',   icon: '🔴' },
  { key: 'obstruction',    label: 'Obstruction',    icon: '🚧' },
  { key: 'weir_hazard',    label: 'Weir Hazard',    icon: '☢️' },
  { key: 'other',          label: 'Other',          icon: '❓' },
];

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

      if (d.type === 'safeRoute') {
        // Remove old safe route
        if (window._safeRouteLine) { map.removeLayer(window._safeRouteLine); }
        if (window._safeDestMarker) { map.removeLayer(window._safeDestMarker); }

        // Draw route line
        if (d.waypoints && d.waypoints.length > 1) {
          var latlngs = d.waypoints.map(function(w) { return [w[0], w[1]]; });
          window._safeRouteLine = L.polyline(latlngs, { color: '#4CAF50', weight: 4, opacity: 0.9, dashArray: '8,6' }).addTo(map);
          map.fitBounds(window._safeRouteLine.getBounds(), { padding: [40, 40] });
        }

        // Draw destination marker
        if (d.dest && d.dest.lat) {
          var destIcon = L.divIcon({
            html: '<div style="background:#4CAF50;width:28px;height:28px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 0 12px rgba(76,175,80,0.9);">🏔️</div>',
            iconSize: [28,28], iconAnchor: [14,14], className: ''
          });
          window._safeDestMarker = L.marker([d.dest.lat, d.dest.lon], { icon: destIcon })
            .bindPopup('<b style="color:#4CAF50">Safe Haven</b><br>' + (d.dest.type || 'Safe location'))
            .addTo(map)
            .openPopup();
        }
      }

      if (d.type === 'addMooring') {
        if (!window._mooringMarkers) window._mooringMarkers = {};
        var mIcon = L.divIcon({
          html: '<div style="background:#4CAF50;width:20px;height:20px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 0 8px rgba(76,175,80,0.8);">⚓</div>',
          iconSize: [20,20], iconAnchor: [10,10], className: ''
        });
        var mm = L.marker([d.lat, d.lon], { icon: mIcon })
          .bindPopup('<b style="color:#4CAF50">⚓ ' + d.name + '</b><br>Moored here')
          .addTo(map);
        window._mooringMarkers[d.id] = mm;
      }

      if (d.type === 'removeMooring') {
        if (window._mooringMarkers && window._mooringMarkers[d.id]) {
          map.removeLayer(window._mooringMarkers[d.id]);
          delete window._mooringMarkers[d.id];
        }
      }

      if (d.type === 'otherBoats') {
        // Remove old other boat markers
        if (window._otherBoatMarkers) {
          window._otherBoatMarkers.forEach(function(m) { map.removeLayer(m); });
        }
        window._otherBoatMarkers = [];
        (d.boats || []).forEach(function(boat) {
          var icon = L.divIcon({
            html: '<div style="background:#4FC3F7;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 0 6px rgba(79,195,247,0.8);display:flex;align-items:center;justify-content:center;font-size:8px;">⛵</div>',
            iconSize: [16,16], iconAnchor: [8,8], className: ''
          });
          var m = L.marker([boat.lat, boat.lon], { icon: icon })
            .bindPopup('<b style="color:#4FC3F7">' + boat.boat_name + '</b><br>' + (boat.is_moored ? '⚓ Moored' : '🚢 ' + (boat.speed_kmh || 0).toFixed(1) + ' km/h') + (boat.dist_m ? '<br>📍 ' + boat.dist_m + 'm away' : ''))
            .addTo(map);
          window._otherBoatMarkers.push(m);
        });
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

export default function MapScreen({ safeRoute, setSafeRoute }: { safeRoute?: any, setSafeRoute?: (r: any) => void } = {}) {
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
  const [showReports, setShowReports] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const toolbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showVoyageSummary, setShowVoyageSummary] = useState(false);
  const [showPrivacyPrompt, setShowPrivacyPrompt] = useState(false);
  const [shareBoatName, setShareBoatName] = useState<boolean | null>(null);
  const [myMooringId, setMyMooringId] = useState<number | null>(null);
  const currentPos = useRef<{lat: number, lng: number} | null>(null);
  const [voyageSummary, setVoyageSummary] = useState<any>(null);
  const [idrisRoast, setIdrisRoast] = useState('');
  const [otherBoats, setOtherBoats] = useState<any[]>([]);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const myUUID = useRef('');
  const [reports, setReports] = useState<any[]>([]);
  const [showNewReport, setShowNewReport] = useState(false);
  const [reportType, setReportType] = useState('other');
  const [reportNote, setReportNote] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [voyageActive, setVoyageActive] = useState(false);
  const [voyageStart, setVoyageStart] = useState<number | null>(null);
  const [voyageKm, setVoyageKm] = useState(0);
  const [weather, setWeather] = useState<{temp: number, wind: number, desc: string} | null>(null);

  useEffect(() => {
    // Auto-hide toolbar after 4 seconds
    toolbarTimer.current = setTimeout(() => setToolbarVisible(false), 4000);
    return () => { if (toolbarTimer.current) clearTimeout(toolbarTimer.current); };
  }, []);

  function showToolbar() {
    setToolbarVisible(true);
    if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
    toolbarTimer.current = setTimeout(() => setToolbarVisible(false), 3000);
  }

  useEffect(() => {
    AsyncStorage.getItem('lockmaster_uuid').then(id => {
      const uid = id || `native_${Date.now()}`;
      if (!id) AsyncStorage.setItem('lockmaster_uuid', uid);
      myUUID.current = uid;
    });
    AsyncStorage.getItem('share_boat_name').then(val => {
      if (val === null) {
        setShowPrivacyPrompt(true);
      } else {
        setShareBoatName(val === 'true');
      }
    });
    return () => {
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };
  }, []);

  async function sendHeartbeat(lat: number, lng: number, spd: number) {
    try {
      const storedShare = await AsyncStorage.getItem('share_boat_name');
      const sharing = storedShare === 'true';
      const boatName = sharing ? (await AsyncStorage.getItem('boat_name') || 'Jolly Plonker') : 'Anonymous';
      await fetch(`${API_BASE}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: myUUID.current, lat, lon: lng, boat_name: boatName, speed_kmh: spd * 3.6 }),
      });
      // Fetch other boats
      const r = await fetch(`${API_BASE}/boats?uuid=${myUUID.current}&lat=${lat}&lon=${lng}`);
      const data = await r.json();
      const boats = data.boats || [];
      setOtherBoats(boats);
      // Send to map
      inject({ type: 'otherBoats', boats });
    } catch (e) {}
  }

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

  const isWeatherLoading = useRef(false);

  // Draw safe route when received
  useEffect(() => {
    if (!safeRoute) return;
    // Build polyline from waypoints
    const waypoints = Object.keys(safeRoute)
      .filter(k => !isNaN(Number(k)))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => safeRoute[k]);
    if (waypoints.length > 0) {
      inject({ type: 'safeRoute', waypoints, dest: { lat: safeRoute.lat, lon: safeRoute.lon, type: safeRoute.type } });
      // Center map on destination
      if (safeRoute.lat && safeRoute.lon) {
        setTimeout(() => {
          inject({ type: 'location', lat: safeRoute.lat, lng: safeRoute.lon });
        }, 500);
      }
    }
  }, [safeRoute]);

  async function fetchWeather(lat: number, lng: number) {
    if (isWeatherLoading.current) return;
    isWeatherLoading.current = true;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);
    try {
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code&wind_speed_unit=mph`,
        { signal: controller.signal }
      );
      clearTimeout(id);
      const data = await r.json();
      const c = data.current;
      const code = c.weather_code;
      const desc = code <= 1 ? '☀️' : code <= 3 ? '⛅' : code <= 51 ? '🌦️' : code <= 67 ? '🌧️' : code <= 77 ? '❄️' : '⛈️';
      setWeather({ temp: Math.round(c.temperature_2m), wind: Math.round(c.wind_speed_10m), desc });
    } catch (e: any) {
      console.warn('Weather fetch failed:', e.message);
    } finally {
      isWeatherLoading.current = false;
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

  async function pinMooring() {
    if (!currentPos.current) return;
    const boatName = await AsyncStorage.getItem('boat_name') || 'Jolly Plonker';
    if (myMooringId) {
      // Remove existing mooring
      await fetch(`${API_BASE}/moorings/${myMooringId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: myUUID.current }),
      }).catch(() => {});
      setMyMooringId(null);
      inject({ type: 'removeMooring', id: myMooringId });
    } else {
      // Add mooring
      const r = await fetch(`${API_BASE}/moorings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: myUUID.current, boat_name: boatName, lat: currentPos.current.lat, lon: currentPos.current.lng, note: '' }),
      });
      const data = await r.json();
      if (data.id) {
        setMyMooringId(data.id);
        inject({ type: 'addMooring', lat: currentPos.current.lat, lon: currentPos.current.lng, name: boatName, id: data.id });
      }
    }
  }

  function sendLocation(lat: number, lng: number, spd?: number) {
    currentPos.current = { lat, lng };
    inject({ type: 'location', lat, lng });
    if (spd !== undefined) {
      setSpeed(Math.round(spd * 2.237));
      sendHeartbeat(lat, lng, spd);
    }
    checkProximity(lat, lng);
    if (!lastPoiCenter.current) {
      lastPoiCenter.current = { lat, lng };
      sendPOI(lat, lng);
      fetchWeather(lat, lng);
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

  async function fetchReports() {
    try {
      const r = await fetch(`${API_BASE}/reports`);
      const data = await r.json();
      setReports(Array.isArray(data) ? data : (data.reports || []));
    } catch (e) {}
  }

  async function submitReport() {
    setSubmittingReport(true);
    try {
      await fetch(`${API_BASE}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: reportType, note: reportNote.trim(), lat: SIM_LAT, lon: SIM_LNG }),
      });
      setShowNewReport(false);
      setReportNote('');
      fetchReports();
    } catch (e) {} finally { setSubmittingReport(false); }
  }

  async function voteReport(id: number) {
    try {
      await fetch(`${API_BASE}/reports/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      fetchReports();
    } catch (e) {}
  }

  function toggleSim() {
    if (simActive) {
      setSimActive(false); setGpsStatus('GPS ✓');
      setNearbyLock(null); setNextLock(null);
      lastPoiCenter.current = null; dismissedLock.current = null;
    } else {
      setSimActive(true); setGpsStatus('SIM Isis Lock');
      lastPoiCenter.current = null; dismissedLock.current = null;
      sendLocation(SIM_LAT, SIM_LNG, 1.5);
      fetchWeather(SIM_LAT, SIM_LNG);
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
      {/* Voyage status bar */}
      {voyageActive && voyageStart && (
        <View style={styles.voyageBar}>
          <Text style={styles.voyageBarText}>
            ⚓ {Math.floor((Date.now() - voyageStart) / 3600000)}h {Math.floor(((Date.now() - voyageStart) % 3600000) / 60000)}m · {voyageKm.toFixed(1)}km
          </Text>
        </View>
      )}

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

      {/* Weather widget */}
      {weather && (
        <View style={styles.weatherWidget}>
          <Text style={styles.weatherDesc}>{weather.desc}</Text>
          <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
          <Text style={styles.weatherWind}>💨 {weather.wind}mph</Text>
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
        onTouchStart={showToolbar}
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

      {/* Speed bar */}
      <View style={styles.speedBar}>
        <Text style={styles.speedValue}>{speed}</Text>
        <Text style={styles.speedUnit}>mph</Text>
      </View>

      {/* Map toolbar — tap map to show */}
      {toolbarVisible && <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowReports(true)}>
          <Text style={styles.toolbarIcon}>📢</Text>
          <Text style={styles.toolbarLabel}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarBtn, voyageActive && styles.toolbarBtnActive]}
          onPress={() => {
            if (voyageActive) {
              const secs = Math.floor((Date.now() - (voyageStart || Date.now())) / 1000);
              const h = Math.floor(secs / 3600);
              const m = Math.floor((secs % 3600) / 60);
              const summary = { hours: h, mins: m, km: voyageKm.toFixed(1) };
              setVoyageSummary(summary);
              setVoyageActive(false);
              setVoyageStart(null);
              setVoyageKm(0);
              // Get Idris roast
              fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `I just finished a canal voyage of ${voyageKm.toFixed(1)}km in ${h}h ${m}m. Give me your best Crabtree roast!`, uuid: 'native-voyage' })
              }).then(r => r.json()).then(d => setIdrisRoast(d.reply || '')).catch(() => {});
              setShowVoyageSummary(true);
            } else {
              setVoyageActive(true);
              setVoyageStart(Date.now());
              setVoyageKm(0);
            }
          }}
        >
          <Text style={styles.toolbarIcon}>{voyageActive ? '⏹' : '⚓'}</Text>
          <Text style={[styles.toolbarLabel, voyageActive && { color: COLORS.orange }]}>
            {voyageActive ? 'End' : 'Voyage'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={toggleTiles}>
          <Text style={styles.toolbarIcon}>{satellite ? '🛰️' : '🗺️'}</Text>
          <Text style={styles.toolbarLabel}>Tiles</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarBtn, myMooringId ? styles.toolbarBtnActive : null]}
          onPress={pinMooring}
        >
          <Text style={styles.toolbarIcon}>⚓</Text>
          <Text style={[styles.toolbarLabel, myMooringId ? { color: COLORS.green } : null]}>
            {myMooringId ? 'Lift' : 'Moor'}
          </Text>
        </TouchableOpacity>
      </View>}

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
      {/* Voyage Summary Modal */}
      <Modal visible={showVoyageSummary} transparent animationType="fade">
        <View style={vStyles.overlay}>
          <View style={vStyles.card}>
            <Text style={vStyles.title}>⚓ Voyage Complete!</Text>

            <View style={vStyles.statsRow}>
              <View style={vStyles.stat}>
                <Text style={vStyles.statVal}>{voyageSummary?.hours}h {voyageSummary?.mins}m</Text>
                <Text style={vStyles.statLbl}>Duration</Text>
              </View>
              <View style={vStyles.stat}>
                <Text style={vStyles.statVal}>{voyageSummary?.km}</Text>
                <Text style={vStyles.statLbl}>km</Text>
              </View>
            </View>

            {!!idrisRoast && (
              <View style={vStyles.roastBox}>
                <Text style={vStyles.roastLabel}>👮 Idris says:</Text>
                <Text style={vStyles.roastText}>{idrisRoast}</Text>
              </View>
            )}

            <View style={vStyles.shareRow}>
              <TouchableOpacity style={vStyles.shareBtn} onPress={() => {
                const txt = `⚓ Canal voyage complete!
🗺️ ${voyageSummary?.km}km
⏱️ ${voyageSummary?.hours}h ${voyageSummary?.mins}m

Lockmaster AI — lockmasterai.co.uk`;
                require('react-native').Share.share({ message: txt });
              }}>
                <Text style={vStyles.shareBtnText}>📤 Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={vStyles.closeBtn} onPress={() => { setShowVoyageSummary(false); setIdrisRoast(''); }}>
                <Text style={vStyles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy Prompt */}
      <Modal visible={showPrivacyPrompt} transparent animationType="fade">
        <View style={vStyles.overlay}>
          <View style={vStyles.card}>
            <Text style={vStyles.title}>👥 Boat Visibility</Text>
            <Text style={{ color: COLORS.muted, fontSize: 14, textAlign: 'center', marginBottom: 8, lineHeight: 22 }}>
              Show your boat name to other boaters nearby?
            </Text>
            <Text style={{ color: COLORS.muted, fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
              Your position is always shared anonymously for safety.
            </Text>
            <TouchableOpacity style={[vStyles.shareBtn, { marginBottom: 10 }]} onPress={() => {
              AsyncStorage.setItem('share_boat_name', 'true');
              setShareBoatName(true);
              setShowPrivacyPrompt(false);
            }}>
              <Text style={vStyles.shareBtnText}>⛵ Yes, show my boat name</Text>
            </TouchableOpacity>
            <TouchableOpacity style={vStyles.closeBtn} onPress={() => {
              AsyncStorage.setItem('share_boat_name', 'false');
              setShareBoatName(false);
              setShowPrivacyPrompt(false);
            }}>
              <Text style={vStyles.closeBtnText}>🕵️ No, stay anonymous</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reports Modal */}
      <Modal visible={showReports} transparent animationType="slide" onShow={fetchReports}>
        <View style={rStyles.overlay}>
          <View style={rStyles.sheet}>
            <View style={rStyles.header}>
              <Text style={rStyles.title}>📢 Reports</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={rStyles.newBtn} onPress={() => setShowNewReport(true)}>
                  <Text style={rStyles.newBtnText}>+ New</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowReports(false)}>
                  <Text style={{ color: COLORS.muted, fontSize: 22, padding: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={reports}
              keyExtractor={(_, i) => i.toString()}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <View style={rStyles.card}>
                  <Text style={rStyles.cardIcon}>{REPORT_TYPES.find(r => r.key === item.type)?.icon || '📍'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={rStyles.cardType}>{item.type}</Text>
                    {item.location ? <Text style={rStyles.cardLoc}>{item.location}</Text> : null}
                    {item.note ? <Text style={rStyles.cardNote}>{item.note}</Text> : null}
                    <Text style={rStyles.cardAge}>{item.age || ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => voteReport(item.id)} style={rStyles.voteBtn}>
                    <Text style={rStyles.voteText}>✅ {item.votes || 0}/3</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: COLORS.muted, textAlign: 'center', padding: 20 }}>No reports nearby</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* New Report Modal */}
      <Modal visible={showNewReport} transparent animationType="slide">
        <View style={rStyles.overlay}>
          <View style={rStyles.sheet}>
            <Text style={rStyles.title}>📢 New Report</Text>
            <View style={rStyles.typeGrid}>
              {REPORT_TYPES.map(rt => (
                <TouchableOpacity key={rt.key} style={[rStyles.typeBtn, reportType === rt.key && rStyles.typeBtnActive]} onPress={() => setReportType(rt.key)}>
                  <Text style={{ fontSize: 18 }}>{rt.icon}</Text>
                  <Text style={[rStyles.typeBtnLabel, reportType === rt.key && { color: COLORS.orange }]}>{rt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={rStyles.noteInput} placeholder="Note (optional)..." placeholderTextColor={COLORS.muted} value={reportNote} onChangeText={setReportNote} multiline />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={rStyles.cancelBtn} onPress={() => setShowNewReport(false)}>
                <Text style={{ color: COLORS.muted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={rStyles.submitBtn} onPress={submitReport} disabled={submittingReport}>
                {submittingReport ? <ActivityIndicator color={COLORS.white} /> : <Text style={{ color: COLORS.white, fontWeight: '800' }}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const vStyles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  card:       { backgroundColor: '#1A1B2E', borderRadius: 20, padding: 24, borderWidth: 2, borderColor: COLORS.orange },
  title:      { color: COLORS.white, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  statsRow:   { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  stat:       { alignItems: 'center' },
  statVal:    { color: COLORS.white, fontSize: 32, fontWeight: '900' },
  statLbl:    { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  roastBox:   { backgroundColor: 'rgba(255,107,53,0.08)', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: COLORS.orange },
  roastLabel: { color: COLORS.orange, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  roastText:  { color: COLORS.white, fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
  shareRow:   { flexDirection: 'row', gap: 10 },
  shareBtn:   { flex: 1, backgroundColor: COLORS.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  shareBtnText:{ color: COLORS.white, fontWeight: '800', fontSize: 14 },
  closeBtn:   { flex: 1, backgroundColor: COLORS.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a2b3d' },
  closeBtnText:{ color: COLORS.muted, fontWeight: '700', fontSize: 14 },
});

const rStyles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#1A1B2E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, borderTopWidth: 1, borderColor: COLORS.orange },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:        { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  newBtn:       { backgroundColor: COLORS.orange, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  newBtnText:   { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  card:         { flexDirection: 'row', backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginBottom: 8, gap: 10, alignItems: 'center' },
  cardIcon:     { fontSize: 24 },
  cardType:     { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  cardLoc:      { color: '#4FC3F7', fontSize: 11, marginTop: 2 },
  cardNote:     { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  cardAge:      { color: COLORS.orange, fontSize: 10, marginTop: 3 },
  voteBtn:      { padding: 6 },
  voteText:     { color: COLORS.green, fontSize: 11, fontWeight: '700' },
  typeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  typeBtn:      { backgroundColor: COLORS.bg, borderRadius: 8, padding: 8, alignItems: 'center', width: '30%', borderWidth: 1, borderColor: '#2a2b3d' },
  typeBtnActive:{ borderColor: COLORS.orange, backgroundColor: 'rgba(255,107,53,0.1)' },
  typeBtnLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  noteInput:    { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, color: COLORS.white, borderWidth: 1, borderColor: '#2a2b3d', minHeight: 60, textAlignVertical: 'top' },
  cancelBtn:    { flex: 1, backgroundColor: COLORS.bg, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a2b3d' },
  submitBtn:    { flex: 2, backgroundColor: COLORS.orange, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
});

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#1A1B2E' },
  map:            { flex: 1 },

  nextLockHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(26,27,46,0.95)', paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.orange },
  nextLockIcon:   { fontSize: 20 },
  nextLockName:   { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  nextLockDist:   { color: COLORS.orange, fontSize: 11, fontWeight: '600' },

  gpsBadge:       { position: 'absolute', top: 60, right: 10, backgroundColor: 'rgba(26,27,46,0.88)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: COLORS.green },
  gpsText:        { color: COLORS.green, fontSize: 11, fontWeight: '700' },


  speedBar:       { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 30, paddingHorizontal: 24, paddingVertical: 10, flexDirection: 'row', alignItems: 'baseline', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  speedValue:     { color: COLORS.white, fontSize: 32, fontWeight: '900' },
  speedUnit:      { color: COLORS.muted, fontSize: 14, fontWeight: '600' },

  weatherWidget:  { position: 'absolute', top: 60, left: 52, backgroundColor: 'rgba(26,27,46,0.88)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#2a2b3d', alignItems: 'center' },
  weatherDesc:    { fontSize: 16 },
  weatherTemp:    { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  weatherWind:    { color: COLORS.muted, fontSize: 10, marginTop: 2 },

  toolbar:         { position: 'absolute', left: 10, top: '35%', backgroundColor: 'rgba(26,27,46,0.92)', borderRadius: 10, borderWidth: 1, borderColor: '#2a2b3d', overflow: 'hidden' },
  toolbarBtn:      { alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#2a2b3d' },
  toolbarBtnActive:{ backgroundColor: 'rgba(255,107,53,0.15)' },
  toolbarIcon:     { fontSize: 20 },
  toolbarLabel:    { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  voyageBar:       { position: 'absolute', top: 44, left: 0, right: 0, zIndex: 99, backgroundColor: 'rgba(255,107,53,0.9)', paddingVertical: 4, alignItems: 'center' },
  voyageBarText:   { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  simBtn:         { position: 'absolute', right: 10, top: '45%', backgroundColor: 'rgba(26,27,46,0.92)', paddingHorizontal: 10, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.orange, alignItems: 'center' },
  simBtnActive:   { borderColor: COLORS.red, backgroundColor: 'rgba(230,57,70,0.15)' },
  simText:        { color: COLORS.white, fontSize: 16 },
  simLabel:       { color: COLORS.white, fontSize: 9, fontWeight: '700', marginTop: 2 },
});
