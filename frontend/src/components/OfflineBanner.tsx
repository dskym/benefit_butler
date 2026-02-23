import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

const BANNER_H = 36;
const HIDE_Y = -(BANNER_H + 10);

export function OfflineBanner({ isOnline, isSyncing, pendingCount }: Props) {
  const { top } = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(HIDE_Y)).current;

  const shouldShow = !isOnline || isSyncing;
  const bgColor = !isOnline ? '#FF9500' : '#3182F6';
  const message = !isOnline
    ? '오프라인 모드 — 연결 시 자동 동기화됩니다'
    : `동기화 중... (${pendingCount}개 남음)`;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: shouldShow ? top : HIDE_Y,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [shouldShow, top, translateY]);

  return (
    <Animated.View
      style={[styles.banner, { backgroundColor: bgColor, transform: [{ translateY }] }]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, height: BANNER_H,
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  text: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
