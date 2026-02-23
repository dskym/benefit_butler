import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props { isOnline: boolean; }

const BANNER_H = 36;
// 숨김 위치: top:0 기준으로 배너 높이보다 충분히 위쪽으로 이동.
// 기존 -44는 insets.top(예: Android 24dp)이 있으면 배너 일부가 status bar 뒤로 노출됐음.
// -46은 insets.top과 무관하게 항상 완전히 화면 밖으로 나간다.
const HIDE_Y = -(BANNER_H + 10);

export function OfflineBanner({ isOnline }: Props) {
  const { top } = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(HIDE_Y)).current;
  const shouldShow = !isOnline;

  useEffect(() => {
    // 표시: status bar 아래(top 만큼 아래로 이동)
    // 숨김: 화면 완전히 위쪽(-46px)
    Animated.timing(translateY, {
      toValue: shouldShow ? top : HIDE_Y,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [shouldShow, top, translateY]);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <Text style={styles.text}>오프라인 모드 — 연결 시 자동 동기화됩니다</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    // top: 0 → translateY로만 위치 제어. insets.top을 style에 넣지 않는다.
    position: 'absolute', top: 0, left: 0, right: 0, height: BANNER_H,
    backgroundColor: '#FF9500',
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  text: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
