import { ConfigService } from '../../utils/ConfigService';

export const MarketDataService = {
  getMandiPrices: async (commodity, state = '', district = '') => {
    const key = ConfigService.DATA_GOV_KEY;

    try {
      let url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${key}&format=json&limit=20`;

      if (commodity) url += `&filters[commodity]=${encodeURIComponent(commodity)}`;
      if (state)     url += `&filters[state]=${encodeURIComponent(state)}`;
      if (district)  url += `&filters[district]=${encodeURIComponent(district)}`;

      console.log(`[MarketDataService] Requesting URL: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.records || data.records.length === 0) {
        console.log(`[MarketDataService] 0 records returned. Check exact string matching or API latency.`);
        return [];
      }
      console.log(`[MarketDataService] Found ${data.records.length} records.`);

      // Normalize field names — data.gov.in returns capitalized keys
      return data.records.map(r => ({
        market:      r.Market      || r.market      || '—',
        district:    r.District    || r.district    || '—',
        state:       r.State       || r.state       || state,
        commodity:   r.Commodity   || r.commodity   || commodity,
        variety:     r.Variety     || r.variety     || 'General',
        min_price:   r['Min Price']  || r.min_price  || '0',
        max_price:   r['Max Price']  || r.max_price  || '0',
        modal_price: r['Modal Price'] || r.modal_price || '0',
        arrival_date: r['Arrival Date'] || r.arrival_date || '',
      }));

    } catch (error) {
      console.error('MarketDataService error:', error);
      throw error;
    }
  }
};