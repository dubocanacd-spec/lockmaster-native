import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS } from '../colors';

export interface NearbyLock {
  name: string;
  dist: number;
  type: string;
}

interface Props {
  lock: NearbyLock | null;
  onApproach: () => void;
  onDismiss: () => void;
}

export default function LockAlert({ lock, onApproach, onDismiss }: Props) {
  const slideAnim = useRef(new Animated.Value(200)).current;
  const visible = !!lock;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 200,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [visible]);

  if (!lock && slideAnim.__getValue() === 200) return null;

  const distText = lock ? (lock.dist < 1000 ? `${Math.round(lock.dist)}m` : `${(lock.dist/1000).toFixed(1)}km`) : '';
  const isWinding = lock?.type === 'winding_hole';

  return (
    <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{isWinding ? '↩️' : '🔒'}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>{lock?.name || ''}</Text>
          <Text style={styles.sub}>{isWinding ? 'WINDING HOLE' : 'LOCK'} · {distText} ahead</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.btnApproach} onPress={onApproach}>
          <Text style={styles.btnApproachText}>⚓ APPROACH NOW</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnCancel} onPress={onDismiss}>
          <Text style={styles.btnCancelText}>CANCEL MOOR</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    backgroundColor: '#1A1B2E',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.orange,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  icon: {
    fontSize: 28,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  sub: {
    color: COLORS.orange,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: COLORS.muted,
    fontSize: 16,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  btnApproach: {
    flex: 2,
    backgroundColor: COLORS.orange,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnApproachText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  btnCancel: {
    flex: 1,
    backgroundColor: 'rgba(141,153,174,0.15)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.muted,
  },
  btnCancelText: {
    color: COLORS.muted,
    fontWeight: '600',
    fontSize: 12,
  },
});
