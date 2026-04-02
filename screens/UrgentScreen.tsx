import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated, ScrollView, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { COLORS } from '../colors';

const EMERGENCY_CONTACTS = [
  { label: 'UK Emergency', number: '999', icon: '🚨' },
  { label: 'Canal & River Trust', number: '03030400404', icon: '⚓' },
  { label: 'Environment Agency', number: '08708506506', icon: '🌊' },
  { label: 'Coastguard', number: '01293768000', icon: '🚁' },
];

const FLOOD_TIPS = [
  '🏔️ Move to highest ground immediately',
  '⚓ Secure your boat to fixed moorings',
  '🔴 Do NOT navigate in flood conditions',
  '📻 Monitor CRT flood alerts',
  '🔋 Keep phone charged & powered',
  '🧰 Grab emergency kit & life jackets',
];

export default function UrgentScreen({ setActiveTab, setSafeRoute }: { setActiveTab?: (tab: string) => void, setSafeRoute?: (route: any) => void }) {
  const [sosActive, setSosActive] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [safeHaven, setSafeHaven] = useState<any>(null);
  const [loadingSafe, setLoadingSafe] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (sosActive) {
      setCountdown(10);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            triggerSOS();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(10);
    }
    async function findSafeHaven() {
    setLoadingSafe(true);
    setSafeHaven(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 51.7512, lon = -1.2678; // Default Isis Lock
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      }
      const r = await fetch(`https://lockmasterai.co.uk/safe_haven?lat=${lat}&lon=${lon}`);
      const data = await r.json();
      if (data.found) setSafeHaven(data);
      else setSafeHaven({ error: 'No safe haven found nearby' });
    } catch (e) {
      setSafeHaven({ error: 'Connection failed' });
    } finally {
      setLoadingSafe(false);
    }
  }

  function openSafeHavenOnMap() {
    if (!safeHaven) return;
    if (setSafeRoute) setSafeRoute(safeHaven);
    if (setActiveTab) setActiveTab('map');
  }

  return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [sosActive]);

  function triggerSOS() {
    setSosActive(false);
    Linking.openURL('tel:999');
  }

  function call(number: string) {
    Linking.openURL(`tel:${number}`);
  }

  async function findSafeHaven() {
    setLoadingSafe(true);
    setSafeHaven(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 51.7512, lon = -1.2678; // Default Isis Lock
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      }
      const r = await fetch(`https://lockmasterai.co.uk/safe_haven?lat=${lat}&lon=${lon}`);
      const data = await r.json();
      if (data.found) setSafeHaven(data);
      else setSafeHaven({ error: 'No safe haven found nearby' });
    } catch (e) {
      setSafeHaven({ error: 'Connection failed' });
    } finally {
      setLoadingSafe(false);
    }
  }

  function openSafeHavenOnMap() {
    if (!safeHaven) return;
    if (setSafeRoute) setSafeRoute(safeHaven);
    if (setActiveTab) setActiveTab('map');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🚨</Text>
        <Text style={styles.headerTitle}>EMERGENCY</Text>
        <Text style={styles.headerSub}>Flood & Distress Alerts</Text>
      </View>

      {/* SOS Button */}
      <Animated.View style={[styles.sosWrapper, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          style={[styles.sosBtn, sosActive && styles.sosBtnActive]}
          onPress={() => setSosActive(!sosActive)}
          activeOpacity={0.85}
        >
          {sosActive ? (
            <>
              <Text style={styles.sosCountdown}>{countdown}</Text>
              <Text style={styles.sosLabel}>Calling 999...</Text>
              <Text style={styles.sosTap}>Tap to cancel</Text>
            </>
          ) : (
            <>
              <Text style={styles.sosIcon}>🆘</Text>
              <Text style={styles.sosLabel}>SEND SOS</Text>
              <Text style={styles.sosTap}>Hold to activate</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Safe Haven */}
      <TouchableOpacity
        style={[styles.safeHavenBtn, loadingSafe && { opacity: 0.6 }]}
        onPress={findSafeHaven}
        disabled={loadingSafe}
      >
        {loadingSafe ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.safeHavenText}>🏔️ FIND SAFE HAVEN</Text>
        )}
      </TouchableOpacity>

      {safeHaven && !safeHaven.error && (
        <TouchableOpacity style={styles.safeHavenResult} onPress={openSafeHavenOnMap}>
          <Text style={styles.safeHavenResultTitle}>✅ {safeHaven.type || 'Safe Haven'}</Text>
          <Text style={styles.safeHavenResultDist}>📍 {safeHaven.distance_km?.toFixed(2)}km · {safeHaven.eta_minutes} min</Text>
          <Text style={styles.safeHavenResultSub}>Tap to show on Lockmaster map →</Text>
        </TouchableOpacity>
      )}

      {safeHaven?.error && (
        <View style={styles.safeHavenError}>
          <Text style={styles.safeHavenErrorText}>⚠️ {safeHaven.error}</Text>
        </View>
      )}

      {/* Flood Tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚠️ FLOOD PROTOCOL</Text>
        {FLOOD_TIPS.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      {/* Emergency Contacts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📞 EMERGENCY CONTACTS</Text>
        {EMERGENCY_CONTACTS.map((c, i) => (
          <TouchableOpacity key={i} style={styles.contactRow} onPress={() => call(c.number)}>
            <Text style={styles.contactIcon}>{c.icon}</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>{c.label}</Text>
              <Text style={styles.contactNumber}>{c.number}</Text>
            </View>
            <Text style={styles.callBtn}>CALL</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.disclaimer}>
        Lockmaster AI is an informational tool only. In genuine emergencies always call 999 directly.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0d0005' },
  content:     { padding: 16, paddingBottom: 40 },
  header:      { alignItems: 'center', paddingVertical: 20 },
  headerIcon:  { fontSize: 40, marginBottom: 8 },
  headerTitle: { color: COLORS.red, fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  headerSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 },

  sosWrapper:  { alignItems: 'center', marginVertical: 20 },
  sosBtn:      { width: 180, height: 180, borderRadius: 90, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)', shadowColor: COLORS.red, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 15 },
  sosBtnActive:{ backgroundColor: '#8B0000', borderColor: COLORS.white },
  sosIcon:     { fontSize: 48, marginBottom: 4 },
  sosCountdown:{ color: COLORS.white, fontSize: 52, fontWeight: '900' },
  sosLabel:    { color: COLORS.white, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  sosTap:      { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },

  section:       { marginTop: 24 },
  sectionTitle:  { color: COLORS.red, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },

  tipRow:      { backgroundColor: 'rgba(230,57,70,0.08)', borderLeftWidth: 3, borderLeftColor: COLORS.red, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, marginBottom: 6 },
  tipText:     { color: COLORS.white, fontSize: 13 },

  contactRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  contactIcon: { fontSize: 24, marginRight: 12 },
  contactInfo: { flex: 1 },
  contactLabel:{ color: COLORS.white, fontSize: 14, fontWeight: '600' },
  contactNumber:{ color: COLORS.muted, fontSize: 12, marginTop: 2 },
  callBtn:     { color: COLORS.red, fontWeight: '800', fontSize: 13, letterSpacing: 1 },

  safeHavenBtn:        { backgroundColor: '#1a3a1a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: COLORS.green },
  safeHavenText:       { color: COLORS.green, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  safeHavenResult:     { backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.green },
  safeHavenResultTitle:{ color: COLORS.white, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  safeHavenResultDist: { color: COLORS.green, fontSize: 13, marginBottom: 4 },
  safeHavenResultSub:  { color: COLORS.muted, fontSize: 11 },
  safeHavenError:      { backgroundColor: 'rgba(230,57,70,0.1)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.red },
  safeHavenErrorText:  { color: COLORS.red, fontSize: 13 },

  disclaimer:  { color: 'rgba(255,255,255,0.25)', fontSize: 10, textAlign: 'center', marginTop: 30, lineHeight: 16 },
});
