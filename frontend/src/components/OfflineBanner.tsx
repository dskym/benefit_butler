import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { usePendingMutationsStore } from '../store/pendingMutationsStore';

interface Props { isOnline: boolean; }

export function OfflineBanner({ isOnline }: Props) {
  const pendingCount = usePendingMutationsStore((s) => s.queue.length);
  const translateY = useRef(new Animated.Value(-44)).current;
  const shouldShow = !isOnline || pendingCount > 0;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: shouldShow ? 0 : -44,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, translateY]);

  const isSyncing = isOnline && pendingCount > 0;
  const bgColor = isSyncing ? '#3182F6' : '#FF9500';
  const message = isSyncing
    ? `동기화 중... (${pendingCount}개 남음)`
    : '오프라인 모드 — 연결 시 자동 동기화됩니다';

  return (
    <Animated.View style={[styles.banner, { backgroundColor: bgColor, transform: [{ translateY }] }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 36,
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  text: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
