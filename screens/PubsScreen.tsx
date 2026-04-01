import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { COLORS } from '../colors';
import * as Location from 'expo-location';

const API_BASE = 'https://lockmasterai.co.uk';

interface Pub {
  name: string;
  lat: number;
  lon: number;
  dist?: number;
  featured?: boolean;
  phone?: string;
  description?: string;
}

export default function PubsScreen() {
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userLat, setUserLat] = useState(51.7512);
  const [userLng, setUserLng] = useState(-1.2678);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLat(loc.coords.latitude);
        setUserLng(loc.coords.longitude);
      }
      fetchPubs(userLat, userLng);
    })();
  }, []);

  async function fetchPubs(lat: number, lng: number) {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_BASE}/crt_poi?lat=${lat}&lon=${lng}&radius=10000`);
      const data = await r.json();
      const all = Array.isArray(data) ? data : (data.poi || data.pois || data.features || []);
      const pubList = all.filter((p: any) => p.type === 'pub' || p.type === 'featured_pub');
      
      // If no pubs from CRT, fetch featured pubs separately
      if (pubList.length === 0) {
        await fetchFeaturedPubs(lat, lng);
      } else {
        setPubs(pubList);
      }
    } catch (e) {
      setError('Could not load pubs');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFeaturedPubs(lat: number, lng: number) {
    try {
      const r = await fetch(`${API_BASE}/featured_pubs?lat=${lat}&lon=${lng}&radius=20000`);
      const data = await r.json();
      const list = Array.isArray(data) ? data : (data.pubs || data.poi || []);
      setPubs(list);
    } catch (e) {
      // No featured pubs endpoint — show empty state
      setPubs([]);
    }
  }

  function openMaps(pub: Pub) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${pub.lat},${pub.lon}`;
    Linking.openURL(url);
  }

  function distText(dist?: number) {
    if (!dist) return '';
    return dist < 1000 ? `${Math.round(dist)}m` : `${(dist/1000).toFixed(1)}km`;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🍺 Canalside Pubs</Text>
        <Text style={styles.headerSub}>Within 10km of your location</Text>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} size="large" />
          <Text style={styles.loadingText}>Finding pubs...</Text>
        </View>
      )}

      {!!error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPubs(userLat, userLng)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && pubs.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🍺</Text>
          <Text style={styles.emptyTitle}>No pubs nearby</Text>
          <Text style={styles.emptySub}>Try expanding your search area or use SIM mode near Oxford</Text>
        </View>
      )}

      <FlatList
        data={pubs}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.pubCard, item.featured && styles.pubCardFeatured]} onPress={() => openMaps(item)}>
            <View style={styles.pubLeft}>
              <Text style={styles.pubIcon}>{item.featured ? '⭐' : '🍺'}</Text>
            </View>
            <View style={styles.pubInfo}>
              <Text style={styles.pubName}>{item.name}</Text>
              {item.description ? <Text style={styles.pubDesc} numberOfLines={2}>{item.description}</Text> : null}
              {item.featured && <Text style={styles.featuredTag}>PARTNER PUB</Text>}
            </View>
            <View style={styles.pubRight}>
              {item.dist ? <Text style={styles.pubDist}>{distText(item.dist)}</Text> : null}
              <Text style={styles.pubNav}>→</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.bg },
  header:           { padding: 16, paddingBottom: 8, backgroundColor: '#1A1B2E', borderBottomWidth: 1, borderBottomColor: '#2a2b3d' },
  headerTitle:      { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  headerSub:        { color: COLORS.muted, fontSize: 12, marginTop: 2 },

  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText:      { color: COLORS.muted, marginTop: 12, fontSize: 14 },
  errorText:        { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:         { backgroundColor: COLORS.orange, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText:        { color: COLORS.white, fontWeight: '700' },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyTitle:       { color: COLORS.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub:         { color: COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  list:             { padding: 12, gap: 8 },
  pubCard:          { flexDirection: 'row', backgroundColor: '#1A1B2E', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2b3d', alignItems: 'center' },
  pubCardFeatured:  { borderColor: COLORS.orange, backgroundColor: 'rgba(255,107,53,0.06)' },
  pubLeft:          { marginRight: 12 },
  pubIcon:          { fontSize: 24 },
  pubInfo:          { flex: 1 },
  pubName:          { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  pubDesc:          { color: COLORS.muted, fontSize: 12, marginTop: 3, lineHeight: 16 },
  featuredTag:      { color: COLORS.orange, fontSize: 10, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },
  pubRight:         { alignItems: 'flex-end', gap: 4 },
  pubDist:          { color: COLORS.orange, fontSize: 12, fontWeight: '700' },
  pubNav:           { color: COLORS.muted, fontSize: 18 },
});
