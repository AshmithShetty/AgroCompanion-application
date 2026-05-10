import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserSessionStore } from '../../store';

const getLogKey = () => {
  const { currentUser } = useUserSessionStore.getState();
  const userId = currentUser?.id || 'anonymous';
  return `app_logs_${userId}`;
};

export const LoggerService = {
  log: async (type, module, message) => {
    try {
      const key = getLogKey();
      const currentLogs = await AsyncStorage.getItem(key);
      const logs = currentLogs ? JSON.parse(currentLogs) : [];
      logs.unshift({ type, module, message, timestamp: Date.now() });
      await AsyncStorage.setItem(key, JSON.stringify(logs.slice(0, 100)));
    } catch (error) {
    }
  },

  getLogs: async () => {
    try {
      const key = getLogKey();
      const currentLogs = await AsyncStorage.getItem(key);
      return currentLogs ? JSON.parse(currentLogs) : [];
    } catch (error) {
      return [];
    }
  },

  clearLogs: async () => {
    const key = getLogKey();
    await AsyncStorage.removeItem(key);
  }
};