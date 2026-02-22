import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props { isOnline: boolean; }

export function OfflineBanner({ isOnline }: Props) {
  const { top } = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-44)).current;
  const shouldShow = !isOnline;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: shouldShow ? 0 : -44,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [shouldShow, translateY]);

  return (
    <Animated.View style={[styles.banner, { top, transform: [{ translateY }] }]}>
      <Text style={styles.text}>오프라인 모드 — 연결 시 자동 동기화됩니다</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 36,
    backgroundColor: '#FF9500',
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  text: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
