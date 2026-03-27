import NetInfo from '@react-native-community/netinfo';
import { EventBusService } from './EventBusService';
import { EVENT_TOPICS } from '../utils/EventRegistry';

export const NetworkMonitor = {
  init: () => {
    NetInfo.addEventListener(state => {
      EventBusService.publish(EVENT_TOPICS.NETWORK_STATUS_CHANGED, {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable
      });
    });
  },
  
  checkConnection: async () => {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable;
  }
};