import NetInfo from '@react-native-community/netinfo';
import { EventBusService } from './EventBusService';
import { EVENT_TOPICS } from '../utils/EventRegistry';

export const NetworkService = {
  init: () => {
    NetInfo.addEventListener(state => {
      EventBusService.publish(EVENT_TOPICS.NETWORK_STATUS_CHANGED, {
        isConnected: state.isConnected,
        type: state.type
      });
    });
  },
  
  checkConnection: async () => {
    const state = await NetInfo.fetch();
    return Boolean(state.isConnected && (state.isInternetReachable ?? true));
  }
};
