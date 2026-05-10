import React, { useEffect, useState } from 'react';
import { View, Text, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StackNavigator } from './src/navigation/StackNavigator';
import { VisibleErrorBoundary } from './src/components/organism/VisibleErrorBoundary';
import { GlobalAlertModal } from './src/components/organism/GlobalAlertModal';
import { AppLifecycleService } from './src/services/AppLifecycleService';
import { NetworkMonitor } from './src/services/NetworkMonitor';
import { SyncEngine } from './src/services/sync/SyncEngine';
import { AlertManager } from './src/services/notifications/AlertManager';
import { LanguageService } from './src/services/LanguageService';
import { VoiceService } from './src/services/voice/VoiceService';
import { MQTTClientService } from './src/services/iot/MQTTClient';
import { AppLogger } from './src/services/iot/AppLogger';
import { 
  useFonts, 
  Poppins_400Regular, 
  Poppins_500Medium, 
  Poppins_600SemiBold, 
  Poppins_700Bold 
} from '@expo-google-fonts/poppins';
import { 
  Inter_400Regular, 
  Inter_500Medium, 
  Inter_600SemiBold 
} from '@expo-google-fonts/inter';

LogBox.ignoreLogs([
  'props.pointerEvents is deprecated',
  'Image: style.tintColor is deprecated',
  'Invalid DOM property',
  'transform-origin',
  'aria-hidden'
]);

// Explicitly filter out known RNW console warnings that LogBox might miss
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args.join(' ');
  if (msg.includes('style.tintColor is deprecated') || msg.includes('props.pointerEvents is deprecated')) return;
  originalWarn(...args);
};

const originalError = console.error;
console.error = (...args) => {
  const msg = args.join(' ');
  if (msg.includes('Blocked aria-hidden on an element')) return;
  originalError(...args);
};

export default function App() {
  const [isReady, setIsReady] = useState(false);

  let [fontsLoaded] = useFonts({
    Poppins: Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
    Inter: Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
  });

  useEffect(() => {
    async function initializeServices() {
      await LanguageService.init();
      VoiceService.init();
      AppLifecycleService.init();
      NetworkMonitor.init();
      SyncEngine.init();
      AlertManager.init();
      AppLogger.connect();
      MQTTClientService.connect();
      setIsReady(true);
    }
    initializeServices();
  }, []);

  if (!fontsLoaded || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading AgroCompanion...</Text>
      </View>
    );
  }

  return (
    <VisibleErrorBoundary>
      <NavigationContainer>
        <StackNavigator />
      </NavigationContainer>
      <GlobalAlertModal />
    </VisibleErrorBoundary>
  );
}
