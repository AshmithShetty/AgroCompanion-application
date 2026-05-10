import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoggerService } from './LoggerService';
import { useUserSessionStore } from '../../store';

export const UsageTracker = {
  trackFeature: async (featureId) => {
    try {
      const { currentUser } = useUserSessionStore.getState();
      const userId = currentUser?.id || 'default';
      const key = `feature_usage_${userId}`;

      const currentUsage = await AsyncStorage.getItem(key);
      const usage = currentUsage ? JSON.parse(currentUsage) : {};
      
      if (!usage[featureId]) {
        usage[featureId] = { count: 0, lastUsed: null };
      }
      
      usage[featureId].count += 1;
      usage[featureId].lastUsed = Date.now();
      
      await AsyncStorage.setItem(key, JSON.stringify(usage));
      await LoggerService.log('INFO', 'UsageTracker', `Feature accessed: ${featureId}`);
    } catch (error) {
    }
  }
};