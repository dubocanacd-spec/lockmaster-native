import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS } from '../colors';
import * as Location from 'expo-location';

const API_BASE = 'https://lockmasterai.co.uk';

interface Lock {
  name: string;
  lat: number;
  lon: number;
  dist?: number;
  type: string;
  waterway?: string;
  queue?: number;
  wait_minutes?: number;
}

export default function LocksScreen() {
  const [locks, setLocks] = useState<Lock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userLat, setUserLat] = useState(51.7512);
  const [userLng, setUserLng] = useState(-1.2678);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 51.7512, lng = -1.2678;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
      }
      fetchLocks(lat, lng);
    })();
  }, []);

  async function fetchLocks(lat: number, lng: number) {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_BASE}/crt_poi?lat=${lat}&lon=${lng}&radius=10000`);
      const data = await r.json();
      const all = Array.isArray(data) ? data : (data.poi || data.pois || []);
      const lockList = all.filter((p: any) => p.type === 'lock' || p.type === 'winding_hole');

      // Fetch queue data
      const queueR = await fetch(`${API_BASE}/lock_queue`);
      const queueData = await queueR.json();
      const queues = Array.isArray(queueData) ? queueData : (queueData.queues || []);

      // Merge queue data
      const merged = lockList.map((lock: any) => {
        const q = queues.find((q: any) => q.name === lock.name || q.lock_name === lock.name);
        return { ...lock, queue: q?.queue_count || 0, wait_minutes: q?.wait_minutes || 0 };
      });

      setLocks(merged);
    } catch (e) {
      setError('Could not load locks');
    } finally {
      setLoading(false);
    }
  }

  function distText(dist?: number) {
    if (!dist) return '';
    return dist < 1000 ? `${Math.round(dist)}m` : `${(dist/1000).toFixed(1)}km`;
  }

  function waitColor(mins: number) {
    if (mins === 0) return COLORS.green;
    if (mins < 15) return '#FFC107';
    return COLORS.red;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔒 Nearby Locks</Text>
        <Text style={styles.headerSub}>Within 10km · Queue times live</Text>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} size="large" />
          <Text style={styles.loadingText}>Loading locks...</Text>
        </View>
      )}

      {!!error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchLocks(userLat, userLng)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && locks.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyTitle}>No locks nearby</Text>
          <Text style={styles.emptySub}>You're not near any UK canals</Text>
        </View>
      )}

      <FlatList
        data={locks}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.lockCard}>
            <View style={styles.lockLeft}>
              <Text style={styles.lockIcon}>{item.type === 'winding_hole' ? '↩️' : '🔒'}</Text>
            </View>
            <View style={styles.lockInfo}>
              <Text style={styles.lockName}>{item.name}</Text>
              {item.waterway && <Text style={styles.lockWaterway}>{item.waterway}</Text>}
              <Text style={styles.lockType}>{item.type === 'winding_hole' ? 'WINDING HOLE' : 'LOCK'}</Text>
            </View>
            <View style={styles.lockRight}>
              {item.dist ? <Text style={styles.lockDist}>{distText(item.dist)}</Text> : null}
              <View style={[styles.queueBadge, { borderColor: waitColor(item.wait_minutes || 0) }]}>
                <Text style={[styles.queueText, { color: waitColor(item.wait_minutes || 0) }]}>
                  {item.wait_minutes ? `${item.wait_minutes}min` : 'Clear'}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.bg },
  header:        { padding: 16, paddingBottom: 8, backgroundColor: '#1A1B2E', borderBottomWidth: 1, borderBottomColor: '#2a2b3d' },
  headerTitle:   { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  headerSub:     { color: COLORS.muted, fontSize: 12, marginTop: 2 },

  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText:   { color: COLORS.muted, marginTop: 12, fontSize: 14 },
  errorText:     { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:      { backgroundColor: COLORS.orange, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText:     { color: COLORS.white, fontWeight: '700' },
  emptyIcon:     { fontSize: 48, marginBottom: 12 },
  emptyTitle:    { color: COLORS.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub:      { color: COLORS.muted, fontSize: 13, textAlign: 'center' },

  list:          { padding: 12, gap: 8 },
  lockCard:      { flexDirection: 'row', backgroundColor: '#1A1B2E', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2b3d', alignItems: 'center' },
  lockLeft:      { marginRight: 12 },
  lockIcon:      { fontSize: 24 },
  lockInfo:      { flex: 1 },
  lockName:      { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  lockWaterway:  { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  lockType:      { color: COLORS.orange, fontSize: 10, fontWeight: '700', marginTop: 3, letterSpacing: 0.5 },
  lockRight:     { alignItems: 'flex-end', gap: 6 },
  lockDist:      { color: COLORS.muted, fontSize: 12 },
  queueBadge:    { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  queueText:     { fontSize: 11, fontWeight: '700' },
});
