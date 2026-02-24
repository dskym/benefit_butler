import { AppRegistry, Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';

// Headless JS task for push notification listener (Android only)
// 알림 수신 시 Android가 백그라운드에서 이 태스크를 실행
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask(
    'RNAndroidNotificationListenerHeadlessJs',
    () => require('./src/services/headlessNotificationHandler').headlessNotificationHandler
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
