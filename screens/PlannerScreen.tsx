import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS } from '../colors';

const API_BASE = 'https://lockmasterai.co.uk';

const ROUTE_OPTIONS = [
  { key: 'fastest',  label: 'Fastest',      icon: '⚡', desc: 'Shortest time' },
  { key: 'scenic',   label: 'Scenic',        icon: '🌿', desc: 'Most beautiful' },
  { key: 'fewest',   label: 'Fewest Locks',  icon: '🔓', desc: 'Less effort' },
];

interface RouteResult {
  distance_km: number;
  estimated_hours: number;
  locks: number;
  waypoints?: any[];
}

export default function PlannerScreen() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [routeType, setRouteType] = useState('fastest');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState('');

  async function planRoute() {
    if (!start.trim() || !end.trim()) {
      setError('Enter start and destination');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const params = new URLSearchParams({
        start: start.trim(),
        end: end.trim(),
        type: routeType,
      });
      const r = await fetch(`${API_BASE}/canal_route?${params}`);
      const data = await r.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError('Connection failed. Check your internet.');
    } finally {
      setLoading(false);
    }
  }

  function swapLocations() {
    const tmp = start;
    setStart(end);
    setEnd(tmp);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📍 Route Planner</Text>
        <Text style={styles.headerSub}>Plan your canal journey</Text>
      </View>

      {/* Input fields */}
      <View style={styles.inputSection}>
        <View style={styles.inputRow}>
          <Text style={styles.inputIcon}>🟢</Text>
          <TextInput
            style={styles.input}
            placeholder="Start — e.g. Oxford"
            placeholderTextColor={COLORS.muted}
            value={start}
            onChangeText={setStart}
            autoCapitalize="words"
          />
        </View>

        <TouchableOpacity style={styles.swapBtn} onPress={swapLocations}>
          <Text style={styles.swapIcon}>⇅</Text>
        </TouchableOpacity>

        <View style={styles.inputRow}>
          <Text style={styles.inputIcon}>🔴</Text>
          <TextInput
            style={styles.input}
            placeholder="Destination — e.g. Banbury"
            placeholderTextColor={COLORS.muted}
            value={end}
            onChangeText={setEnd}
            autoCapitalize="words"
          />
        </View>
      </View>

      {/* Route type */}
      <View style={styles.routeTypes}>
        {ROUTE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.routeTypeBtn, routeType === opt.key && styles.routeTypeBtnActive]}
            onPress={() => setRouteType(opt.key)}
          >
            <Text style={styles.routeTypeIcon}>{opt.icon}</Text>
            <Text style={[styles.routeTypeLabel, routeType === opt.key && styles.routeTypeLabelActive]}>
              {opt.label}
            </Text>
            <Text style={styles.routeTypeDesc}>{opt.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Plan button */}
      <TouchableOpacity
        style={[styles.planBtn, loading && styles.planBtnDisabled]}
        onPress={planRoute}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.planBtnText}>⚓ PLAN ROUTE</Text>
        )}
      </TouchableOpacity>

      {/* Error */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Result */}
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Route Found</Text>
          <View style={styles.resultStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{result.distance_km?.toFixed(1) ?? '—'}</Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{result.estimated_hours?.toFixed(1) ?? '—'}</Text>
              <Text style={styles.statLabel}>hours</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{result.locks ?? '—'}</Text>
              <Text style={styles.statLabel}>locks</Text>
            </View>
          </View>

          <View style={styles.routeSummary}>
            <Text style={styles.routeSummaryText}>
              🟢 {start} → 🔴 {end}
            </Text>
            <Text style={styles.routeTypeTag}>
              {ROUTE_OPTIONS.find(o => o.key === routeType)?.icon} {ROUTE_OPTIONS.find(o => o.key === routeType)?.label}
            </Text>
          </View>

          <TouchableOpacity style={styles.navigateBtn}>
            <Text style={styles.navigateBtnText}>▶ START NAVIGATION</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.bg },
  content:          { padding: 16, paddingBottom: 40 },

  header:           { paddingVertical: 20, alignItems: 'center' },
  headerTitle:      { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  headerSub:        { color: COLORS.muted, fontSize: 13, marginTop: 4 },

  inputSection:     { backgroundColor: '#1A1B2E', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#2a2b3d' },
  inputRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  inputIcon:        { fontSize: 16, marginRight: 10, width: 24, textAlign: 'center' },
  input:            { flex: 1, color: COLORS.white, fontSize: 15, paddingVertical: 10 },
  swapBtn:          { alignSelf: 'flex-end', marginRight: 4, marginVertical: 4, padding: 4 },
  swapIcon:         { color: COLORS.orange, fontSize: 20, fontWeight: '700' },

  routeTypes:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  routeTypeBtn:     { flex: 1, backgroundColor: '#1A1B2E', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2a2b3d' },
  routeTypeBtnActive: { borderColor: COLORS.orange, backgroundColor: 'rgba(255,107,53,0.1)' },
  routeTypeIcon:    { fontSize: 20, marginBottom: 4 },
  routeTypeLabel:   { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  routeTypeLabelActive: { color: COLORS.orange },
  routeTypeDesc:    { color: 'rgba(141,153,174,0.6)', fontSize: 9, marginTop: 2, textAlign: 'center' },

  planBtn:          { backgroundColor: COLORS.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  planBtnDisabled:  { opacity: 0.6 },
  planBtnText:      { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },

  errorBox:         { backgroundColor: 'rgba(230,57,70,0.1)', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.red, marginBottom: 16 },
  errorText:        { color: COLORS.red, fontSize: 13 },

  resultCard:       { backgroundColor: '#1A1B2E', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.orange },
  resultTitle:      { color: COLORS.orange, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 },
  resultStats:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 16 },
  statItem:         { alignItems: 'center' },
  statValue:        { color: COLORS.white, fontSize: 32, fontWeight: '900' },
  statLabel:        { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  statDivider:      { width: 1, height: 40, backgroundColor: '#2a2b3d' },
  routeSummary:     { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, marginBottom: 16 },
  routeSummaryText: { color: COLORS.white, fontSize: 13, marginBottom: 6 },
  routeTypeTag:     { color: COLORS.muted, fontSize: 11 },
  navigateBtn:      { backgroundColor: COLORS.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  navigateBtnText:  { color: COLORS.white, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});
