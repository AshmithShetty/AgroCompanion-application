import AsyncStorage from '@react-native-async-storage/async-storage';

export const LoggerService = {
  log: async (type, module, message) => {
    try {
      const currentLogs = await AsyncStorage.getItem('app_logs');
      const logs = currentLogs ? JSON.parse(currentLogs) : [];
      logs.unshift({ type, module, message, timestamp: Date.now() });
      await AsyncStorage.setItem('app_logs', JSON.stringify(logs.slice(0, 100)));
    } catch (error) {
    }
  },

  getLogs: async () => {
    try {
      const currentLogs = await AsyncStorage.getItem('app_logs');
      return currentLogs ? JSON.parse(currentLogs) : [];
    } catch (error) {
      return [];
    }
  },

  clearLogs: async () => {
    await AsyncStorage.removeItem('app_logs');
  }
};