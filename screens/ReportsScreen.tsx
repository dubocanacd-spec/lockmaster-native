import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Modal } from 'react-native';
import { COLORS } from '../colors';
import * as Location from 'expo-location';

const API_BASE = 'https://lockmasterai.co.uk';

const REPORT_TYPES = [
  { key: 'broken_lock',    label: 'Broken Lock',     icon: '🔒' },
  { key: 'shallow',        label: 'Shallow/Grounded', icon: '⚓' },
  { key: 'debris',         label: 'Debris/Tree',      icon: '🌿' },
  { key: 'waterway_closed',label: 'Waterway Closed',  icon: '🚫' },
  { key: 'strong_current', label: 'Strong Current',   icon: '🌊' },
  { key: 'flooding',       label: 'Flooding',         icon: '💧' },
  { key: 'vandalism',      label: 'Vandalism',        icon: '⚠️' },
  { key: 'mooring_free',   label: 'Mooring Free',     icon: '🟢' },
  { key: 'mooring_full',   label: 'Mooring Full',     icon: '🔴' },
  { key: 'obstruction',    label: 'Obstruction',      icon: '🚧' },
  { key: 'weir_hazard',    label: 'Weir Hazard',      icon: '☢️' },
  { key: 'pollution',      label: 'Pollution',        icon: '☣️' },
  { key: 'nav_hazard',     label: 'Nav Hazard',       icon: '📖' },
  { key: 'other',          label: 'Other',            icon: '❓' },
];

interface Report {
  id: number;
  type: string;
  note: string;
  lat: number;
  lon: number;
  timestamp: string;
  votes?: number;
  age?: string;
  location?: string;
}

export default function ReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState('hazard');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
      fetchReports();
    })();
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/reports`);
      const data = await r.json();
      setReports(Array.isArray(data) ? data : (data.reports || []));
    } catch (e) {
      console.warn('Reports failed', e);
    } finally {
      setLoading(false);
    }
  }

  async function submitReport() {
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          note: note.trim(),
          lat: userLat,
          lon: userLng,
        }),
      });
      setShowModal(false);
      setNote('');
      fetchReports();
    } catch (e) {
      console.warn('Submit failed', e);
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(id: number) {
    try {
      await fetch(`${API_BASE}/reports/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchReports();
    } catch (e) {}
  }

  function timeAgo(ts: string) {
    if (!ts) return 'Unknown';
    const date = new Date(ts.includes('T') ? ts : ts + 'Z');
    if (isNaN(date.getTime())) return ts;
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(Math.abs(diff) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const reportIcon = (type: string) => {
    const found = REPORT_TYPES.find(r => r.key === type);
    if (found) return found.icon;
    if (type?.includes('block') || type?.includes('debris')) return '🚫';
    if (type?.includes('lock')) return '🔒';
    if (type?.includes('water')) return '💧';
    return '📍';
  };
  const reportLabel = (type: string) => REPORT_TYPES.find(r => r.key === type)?.label || type;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📢 Community Reports</Text>
          <Text style={styles.headerSub}>Live canal conditions</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ Report</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} size="large" />
        </View>
      )}

      <FlatList
        data={reports}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.list}
        onRefresh={fetchReports}
        refreshing={loading}
        renderItem={({ item }) => (
          <View style={styles.reportCard}>
            <Text style={styles.reportIcon}>{reportIcon(item.type)}</Text>
            <View style={styles.reportInfo}>
              <Text style={styles.reportType}>{reportLabel(item.type)}</Text>
              {item.location ? <Text style={styles.reportLocation}>{item.location}</Text> : null}
              {item.note ? <Text style={styles.reportNote}>{item.note}</Text> : null}
              <Text style={styles.reportTime}>{item.age || timeAgo(item.timestamp)}</Text>
            </View>
            <TouchableOpacity style={styles.voteBtn} onPress={() => vote(item.id)}>
              <Text style={styles.voteIcon}>✅</Text>
              <Text style={styles.voteCount}>{item.votes || 0}/3</Text>
              <Text style={styles.voteLabel}>Resolve</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>📢</Text>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptySub}>Be the first to report a condition</Text>
          </View>
        ) : null}
      />

      {/* Submit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>📢 New Report</Text>

            <View style={styles.typeGrid}>
              {REPORT_TYPES.map(rt => (
                <TouchableOpacity
                  key={rt.key}
                  style={[styles.typeBtn, selectedType === rt.key && styles.typeBtnActive]}
                  onPress={() => setSelectedType(rt.key)}
                >
                  <Text style={styles.typeBtnIcon}>{rt.icon}</Text>
                  <Text style={[styles.typeBtnLabel, selectedType === rt.key && { color: COLORS.orange }]}>
                    {rt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.noteInput}
              placeholder="Add a note (optional)..."
              placeholderTextColor={COLORS.muted}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={300}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitReport} disabled={submitting}>
                {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.bg },
  header:         { padding: 16, paddingTop: 48, paddingBottom: 8, backgroundColor: '#1A1B2E', borderBottomWidth: 1, borderBottomColor: '#2a2b3d', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:    { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  headerSub:      { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  addBtn:         { backgroundColor: COLORS.orange, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:     { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { color: COLORS.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub:       { color: COLORS.muted, fontSize: 13, textAlign: 'center' },

  list:           { padding: 12, gap: 8 },
  reportCard:     { flexDirection: 'row', backgroundColor: '#1A1B2E', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2b3d', alignItems: 'center', gap: 12 },
  reportIcon:     { fontSize: 28 },
  reportInfo:     { flex: 1 },
  reportType:     { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  reportLocation: { color: '#4FC3F7', fontSize: 11, marginTop: 2 },
  reportNote:     { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  reportTime:     { color: COLORS.orange, fontSize: 11, marginTop: 4 },
  voteBtn:        { alignItems: 'center', gap: 2 },
  voteIcon:       { fontSize: 18 },
  voteCount:      { color: COLORS.green, fontSize: 11, fontWeight: '700' },
  voteLabel:      { color: COLORS.muted, fontSize: 9 },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:          { backgroundColor: '#1A1B2E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderTopWidth: 1, borderColor: COLORS.orange },
  modalTitle:     { color: COLORS.white, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  typeGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn:        { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, alignItems: 'center', width: '30%', borderWidth: 1, borderColor: '#2a2b3d' },
  typeBtnActive:  { borderColor: COLORS.orange, backgroundColor: 'rgba(255,107,53,0.1)' },
  typeBtnIcon:    { fontSize: 20, marginBottom: 4 },
  typeBtnLabel:   { color: COLORS.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  noteInput:      { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, color: COLORS.white, fontSize: 14, borderWidth: 1, borderColor: '#2a2b3d', marginBottom: 16, minHeight: 80, textAlignVertical: 'top' },
  modalButtons:   { flexDirection: 'row', gap: 10 },
  cancelBtn:      { flex: 1, backgroundColor: COLORS.bg, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a2b3d' },
  cancelText:     { color: COLORS.muted, fontWeight: '700' },
  submitBtn:      { flex: 2, backgroundColor: COLORS.orange, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitText:     { color: COLORS.white, fontWeight: '800', fontSize: 14 },
});
