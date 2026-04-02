import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS } from '../colors';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://lockmasterai.co.uk';

interface Journey {
  journey_id: number;
  planned_distance_km: number;
  locks_count: number;
  eta_hours: number;
  start_time: number;
}

export default function VoyageScreen() {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [boatName, setBoatName] = useState('');
  const [startLoc, setStartLoc] = useState('');
  const [destLoc, setDestLoc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState('0:00');
  const [uuid, setUuid] = useState('');
  const updateInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Load UUID and saved journey
    AsyncStorage.getItem('lockmaster_uuid').then(id => {
      const uid = id || `native_${Date.now()}`;
      if (!id) AsyncStorage.setItem('lockmaster_uuid', uid);
      setUuid(uid);
    });
    AsyncStorage.getItem('active_journey').then(j => {
      if (j) setJourney(JSON.parse(j));
    });
    AsyncStorage.getItem('boat_name').then(n => { if (n) setBoatName(n); });
  }, []);

  useEffect(() => {
    if (journey) {
      startTracking();
      startTimer();
    } else {
      stopTracking();
      if (timerInterval.current) clearInterval(timerInterval.current);
    }
    return () => { stopTracking(); };
  }, [journey]);

  function startTimer() {
    if (timerInterval.current) clearInterval(timerInterval.current);
    timerInterval.current = setInterval(() => {
      if (!journey) return;
      const secs = Math.floor((Date.now() / 1000) - journey.start_time);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      setElapsed(`${h}:${m.toString().padStart(2, '0')}`);
    }, 10000);
  }

  async function startTracking() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    updateInterval.current = setInterval(async () => {
      const loc = await Location.getCurrentPositionAsync({});
      await fetch(`${API_BASE}/journey/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid,
          journey_id: journey?.journey_id,
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          speed_knots: (loc.coords.speed || 0) * 1.944,
        }),
      }).catch(() => {});
    }, 60000); // Update every minute
  }

  function stopTracking() {
    if (updateInterval.current) { clearInterval(updateInterval.current); updateInterval.current = null; }
  }

  async function startJourney() {
    if (!boatName.trim() || !startLoc.trim() || !destLoc.trim()) {
      setError('Fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 51.7512, lon = -1.2678;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      }
      const r = await fetch(`${API_BASE}/journey/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid,
          boat_name: boatName.trim(),
          start_location: startLoc.trim(),
          dest_location: destLoc.trim(),
          start_lat: lat,
          start_lon: lon,
          dest_lat: lat + 0.1, // approximate
          dest_lon: lon,
        }),
      });
      const data = await r.json();
      if (data.error) { setError(data.error); return; }
      const j = { ...data };
      setJourney(j);
      AsyncStorage.setItem('active_journey', JSON.stringify(j));
      AsyncStorage.setItem('boat_name', boatName.trim());
    } catch (e) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  }

  async function stopJourney() {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/journey/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, journey_id: journey?.journey_id }),
      });
      setJourney(null);
      AsyncStorage.removeItem('active_journey');
    } catch (e) {} finally {
      setLoading(false);
    }
  }

  if (journey) {
    return (
      <View style={styles.container}>
        <View style={styles.activeHeader}>
          <Text style={styles.activeTitle}>⚓ Voyage Active</Text>
          <Text style={styles.activeSub}>{boatName}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{elapsed}</Text>
            <Text style={styles.statLabel}>Elapsed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{journey.planned_distance_km?.toFixed(1)}</Text>
            <Text style={styles.statLabel}>km planned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{journey.locks_count}</Text>
            <Text style={styles.statLabel}>Locks</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{journey.eta_hours?.toFixed(1)}h</Text>
            <Text style={styles.statLabel}>ETA</Text>
          </View>
        </View>

        <View style={styles.routeCard}>
          <Text style={styles.routeFrom}>🟢 {startLoc || 'Start'}</Text>
          <Text style={styles.routeArrow}>↓</Text>
          <Text style={styles.routeTo}>🔴 {destLoc || 'Destination'}</Text>
        </View>

        <TouchableOpacity style={styles.stopBtn} onPress={stopJourney} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.stopBtnText}>⏹ END VOYAGE</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚓ Voyage Log</Text>
        <Text style={styles.headerSub}>Track your canal journey</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.formLabel}>Boat Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Jolly Plonker"
          placeholderTextColor={COLORS.muted}
          value={boatName}
          onChangeText={setBoatName}
        />

        <Text style={styles.formLabel}>Start</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Oxford, Isis Lock"
          placeholderTextColor={COLORS.muted}
          value={startLoc}
          onChangeText={setStartLoc}
        />

        <Text style={styles.formLabel}>Destination</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Banbury"
          placeholderTextColor={COLORS.muted}
          value={destLoc}
          onChangeText={setDestLoc}
        />

        {!!error && <Text style={styles.error}>⚠️ {error}</Text>}

        <TouchableOpacity style={styles.startBtn} onPress={startJourney} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.startBtnText}>⚓ START VOYAGE</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.bg },
  content:        { padding: 16, paddingBottom: 40 },
  header:         { paddingVertical: 20, alignItems: 'center' },
  headerTitle:    { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  headerSub:      { color: COLORS.muted, fontSize: 13, marginTop: 4 },

  form:           { gap: 8 },
  formLabel:      { color: COLORS.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 8 },
  input:          { backgroundColor: '#1A1B2E', borderRadius: 10, padding: 14, color: COLORS.white, fontSize: 15, borderWidth: 1, borderColor: '#2a2b3d' },
  error:          { color: COLORS.red, fontSize: 13, marginTop: 8 },
  startBtn:       { backgroundColor: COLORS.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  startBtnText:   { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },

  activeHeader:   { backgroundColor: '#1A1B2E', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.orange },
  activeTitle:    { color: COLORS.orange, fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  activeSub:      { color: COLORS.muted, fontSize: 14, marginTop: 4 },

  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  statCard:       { flex: 1, minWidth: '45%', backgroundColor: '#1A1B2E', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2a2b3d' },
  statValue:      { color: COLORS.white, fontSize: 28, fontWeight: '900' },
  statLabel:      { color: COLORS.muted, fontSize: 11, marginTop: 4 },

  routeCard:      { margin: 12, backgroundColor: '#1A1B2E', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2a2b3d' },
  routeFrom:      { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  routeArrow:     { color: COLORS.muted, fontSize: 20, textAlign: 'center', marginVertical: 4 },
  routeTo:        { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  stopBtn:        { margin: 12, backgroundColor: COLORS.red, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  stopBtnText:    { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});
