// frontend/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import RootNavigation from './src/navigation';
import { initStorage } from './src/storage';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { syncService } from './src/services/syncService';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, color: 'red', textAlign: 'center' }}>
            {this.state.error.toString()}
          </Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 10, textAlign: 'center' }}>
            {this.state.error.stack?.slice(0, 400)}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [storageReady, setStorageReady] = useState(false);
  const { isOnline } = useNetworkStatus();
  const prevOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    initStorage().then(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (prevOnlineRef.current === false && isOnline) {
      syncService.flush();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  if (!storageReady) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>초기화 중...</Text>
    </View>
  );
  return (
    <ErrorBoundary>
      <RootNavigation />
    </ErrorBoundary>
  );
}
