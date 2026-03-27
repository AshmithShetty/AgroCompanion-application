import { EventBusService } from '../EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';

export const BuyerMatchingService = {
  findBuyers: (commodity, quantity) => {
    const mockBuyers = [
      { id: 'b1', name: 'AgriCorp Udupi', required: 500, contact: '9876543210' },
      { id: 'b2', name: 'FreshMart Mangalore', required: 200, contact: '9876543211' }
    ];

    const matched = mockBuyers.filter(b => b.required <= quantity);

    if (matched.length > 0) {
      EventBusService.publish(EVENT_TOPICS.BUYER_MATCH_FOUND, matched);
    }

    return matched;
  }
};