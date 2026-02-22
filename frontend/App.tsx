// frontend/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import RootNavigation from './src/navigation';
import { initStorage } from './src/storage';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { syncService } from './src/services/syncService';

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

  if (!storageReady) return null;
  return <RootNavigation />;
}
