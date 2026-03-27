import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoggerService } from './LoggerService';

export const UsageTracker = {
  trackFeature: async (featureId) => {
    try {
      const currentUsage = await AsyncStorage.getItem('feature_usage');
      const usage = currentUsage ? JSON.parse(currentUsage) : {};
      
      if (!usage[featureId]) {
        usage[featureId] = { count: 0, lastUsed: null };
      }
      
      usage[featureId].count += 1;
      usage[featureId].lastUsed = Date.now();
      
      await AsyncStorage.setItem('feature_usage', JSON.stringify(usage));
      await LoggerService.log('INFO', 'UsageTracker', `Feature accessed: ${featureId}`);
    } catch (error) {
    }
  }
};