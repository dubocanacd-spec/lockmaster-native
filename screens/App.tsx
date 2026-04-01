import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { COLORS } from './colors';
import MapScreen from './screens/MapScreen';
import UrgentScreen from './screens/UrgentScreen';
import PlannerScreen from './screens/PlannerScreen';
import IdrisChat from './screens/IdrisChat';


function PubsScreen() {
  return <View style={styles.screen}><Text style={styles.screenTitle}>🍺 Pubs</Text><Text style={styles.screenSub}>Canalside pubs</Text></View>;
}



const TABS = [
  { key: 'map',     label: 'Map',     icon: '🗺️',  screen: MapScreen },
  { key: 'locks',   label: 'Idris',   icon: '👮',  screen: IdrisChat },
  { key: 'pubs',    label: 'Pubs',    icon: '🍺',  screen: PubsScreen },
  { key: 'planner', label: 'Planner', icon: '📍',  screen: PlannerScreen },
  { key: 'urgent',  label: 'Urgent',  icon: '🚨',  screen: UrgentScreen },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('map');
  const ActiveScreen = TABS.find(t => t.key === activeTab)!.screen;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.content}><ActiveScreen /></View>
      <View style={styles.nav}>
        {TABS.map(tab => {
          const active   = tab.key === activeTab;
          const isUrgent = tab.key === 'urgent';
          return (
            <TouchableOpacity key={tab.key} style={[styles.navItem, isUrgent && styles.navUrgent]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
              <Text style={styles.navIcon}>{tab.icon}</Text>
              <Text style={[styles.navLabel, active && { color: isUrgent ? COLORS.red : COLORS.orange }, isUrgent && { color: COLORS.red }]}>
                {tab.label}
              </Text>
              {active && <View style={[styles.navIndicator, { backgroundColor: isUrgent ? COLORS.red : COLORS.orange }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  content:       { flex: 1 },
  screen:        { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  screenTitle:   { color: COLORS.white, fontSize: 28, fontWeight: '700' },
  screenSub:     { color: COLORS.muted, fontSize: 15 },
  nav:           { flexDirection: 'row', backgroundColor: COLORS.navBg, borderTopWidth: 1, borderTopColor: '#2a2b3d', paddingBottom: 4, paddingTop: 8 },
  navItem:       { flex: 1, alignItems: 'center', paddingVertical: 4, position: 'relative' },
  navUrgent:     { borderLeftWidth: 1, borderLeftColor: '#2a2b3d' },
  navIcon:       { fontSize: 20, marginBottom: 2 },
  navLabel:      { color: COLORS.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  navIndicator:  { position: 'absolute', top: 0, left: '25%', right: '25%', height: 2, borderRadius: 1 },
});
