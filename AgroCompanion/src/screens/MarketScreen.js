import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, ScrollView, View, StyleSheet,
  TextInput, TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, CustomText, Card, Spacer } from '../components';
import { MarketDataService } from '../services/market/MarketDataService';
import { YieldPredictorAgent } from '../services/ai/YieldPredictorAgent';
import { PriceForecastingService } from '../services/market/PriceForecastingService';
import { InventoryRepository } from '../services/inventory/InventoryRepository';
import { TaskRepository } from '../services/TaskRepository';
import { useUserSessionStore } from '../store';
import { theme } from '../theme';
import { districtKnowledgeBase } from '../data/districtKnowledgeBase';

const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export const MarketScreen = () => {
  const currentSession = useUserSessionStore(state => state.currentSession);
  const currentFarm = useUserSessionStore(state => state.currentFarm);
  const cropType = currentSession?.cropType || '';

  const [commodity, setCommodity] = useState(() => {
    if (currentSession?.cropType) return currentSession.cropType.toLowerCase();
    return '';
  });
  const [state, setState] = useState(() => {
    if (currentFarm?.districtName) {
      const knowledge = districtKnowledgeBase[currentFarm.districtName.toLowerCase()];
      if (knowledge && knowledge.state) return knowledge.state;
    }
    return 'Karnataka';
  });
  const [marketPrices, setMarketPrices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [yieldPrediction, setYieldPrediction] = useState(null);
  const [futurePrices, setFuturePrices] = useState([]);
  const [selectedFutureIndex, setSelectedFutureIndex] = useState(0);
  const [inventory, setInventory] = useState([]);
  const fetchAbortRef = React.useRef(false);

  const parsePriceInt = (raw) => {
    if (!raw && raw !== 0) return 0;
    const cleaned = String(raw).replace(/,/g, '');
    const n = parseInt(cleaned, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const loadPrices = async (refresh = false) => {
    const query = commodity.trim().toLowerCase();
    if (!query) return;
    if (isLoading || isRefreshing) {
      fetchAbortRef.current = true;
    }
    fetchAbortRef.current = false;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const prices = await MarketDataService.getMandiPrices(query, state);
      if (fetchAbortRef.current) return;
      setMarketPrices(prices || []);
      if (prices && prices.length > 0) {
        const livePrice = parsePriceInt(prices[0].modal_price);
        const plantingTimestamp = Number(currentSession?.startDate) || Date.now();
        const plantingDateStr = new Date(plantingTimestamp).toISOString();

        let harvestDateOverride = null;
        if (currentSession?.id) {
          const tasks = await TaskRepository.getAllTasks({ sessionId: currentSession.id });
          const harvestTask = tasks.find(t => {
            const title = t.title.toLowerCase();
            return title.includes('harvest') || title.includes('picking') || title.includes('collection');
          });
          if (harvestTask) {
            harvestDateOverride = harvestTask.date;
          }
        }

        const forecastedPrices = PriceForecastingService.getForecasts(
          livePrice,
          query,
          plantingDateStr,
          harvestDateOverride
        );
        setFuturePrices(forecastedPrices || []);
        setSelectedFutureIndex(0);
        const pred = await YieldPredictorAgent.predictYieldAndFinance(prices.slice(0, 3), forecastedPrices);
        if (!fetchAbortRef.current) {
          setYieldPrediction(pred);
        }
      }
    } catch (e) {
      if (!fetchAbortRef.current) {
        setError('Could not fetch prices. Check your connection or try again.');
        setMarketPrices([]);
      }
    } finally {
      if (!fetchAbortRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  const loadInventory = async () => {
    const data = await InventoryRepository.getInventory();
    setInventory(data);
  };

  useEffect(() => {
    if (commodity && state) {
      loadPrices();
    }
    loadInventory();
  }, []);

  const getPriceStatus = (modal, min, max) => {
    const modalNum = parsePriceInt(modal);
    const minNum = parsePriceInt(min);
    const maxNum = parsePriceInt(max);
    if (minNum === maxNum) {
      return { label: 'Fair', color: '#E65100' };
    }
    const mid = (minNum + maxNum) / 2;
    if (modalNum > mid * 1.1) return { label: 'High', color: '#2E7D32' };
    if (modalNum < mid * 0.9) return { label: 'Low', color: '#C62828' };
    return { label: 'Fair', color: '#E65100' };
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Marketplace & Finance" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadPrices(true)} tintColor={theme.colors.primary} />}
      >
        {!currentSession && (
          <View style={[styles.banner, { backgroundColor: '#E65100' }]}>
            <CustomText variant="caption" color="#fff">
              No active session. Select or create a session to see crop-specific market data.
            </CustomText>
          </View>
        )}

        {currentSession && (
          <View style={styles.banner}>
            <CustomText variant="caption" color="#fff">
              Active Session: {currentSession.cropType} • {currentFarm?.name || 'My Farm'}
            </CustomText>
          </View>
        )}

        <Card style={styles.searchCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name="search-outline" size={20} color={theme.colors.text} style={{ marginRight: 6 }} />
            <CustomText variant="subheading" style={{ fontWeight: '700' }}>Search Mandi Prices</CustomText>
          </View>
          <Spacer size="sm" />

          <CustomText variant="caption" style={styles.label}>Commodity</CustomText>
          <TextInput
            style={styles.input}
            placeholder="e.g. Tomato, Wheat, Rice..."
            value={commodity}
            onChangeText={setCommodity}
            placeholderTextColor="#999"
          />

          <Spacer size="sm" />
          <CustomText variant="caption" style={styles.label}>State</CustomText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateRow}>
            {STATES.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.stateChip, state === s && styles.stateChipActive]}
                onPress={() => setState(s)}
              >
                <CustomText
                  variant="caption"
                  color={state === s ? '#fff' : theme.colors.text}
                >
                  {s}
                </CustomText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Spacer size="md" />
          <TouchableOpacity
            style={[styles.searchBtn, (!commodity.trim() || isLoading) && { opacity: 0.5 }]}
            onPress={() => loadPrices()}
            disabled={!commodity.trim() || isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <CustomText color="#fff" style={{ fontWeight: '700' }}>Fetch Live Prices</CustomText>
            }
          </TouchableOpacity>
        </Card>

        <Spacer size="md" />

        {yieldPrediction && (
          <Card style={[styles.card, { backgroundColor: '#e8f5e9' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="trending-up-outline" size={20} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <CustomText variant="subheading" color={theme.colors.primary} style={{ fontWeight: '700' }}>
                Yield & Finance Forecast
              </CustomText>
            </View>
            <CustomText variant="caption" color={theme.colors.textLight} style={{ marginBottom: 12 }}>
              AI prediction based on farm size, crop type, and current market trends.
            </CustomText>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View>
                <CustomText variant="caption">Est. Yield</CustomText>
                <CustomText variant="body" style={{ fontWeight: '700' }}>{yieldPrediction.predictedYieldQuintals} Quintals</CustomText>
              </View>
              <View>
                <CustomText variant="caption">Est. Price</CustomText>
                <CustomText variant="body" style={{ fontWeight: '700' }}>₹{yieldPrediction.predictedPricePerQuintal}/Q</CustomText>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 8, marginBottom: 8 }}>
              <View>
                <CustomText variant="caption">Est. Revenue</CustomText>
                <CustomText variant="body" style={{ fontWeight: '700' }}>₹{yieldPrediction.estimatedRevenue}</CustomText>
              </View>
              <View>
                <CustomText variant="caption">Est. Profit</CustomText>
                <CustomText variant="body" style={{ fontWeight: '700', color: theme.colors.primary }}>₹{yieldPrediction.estimatedNetProfit}</CustomText>
              </View>
            </View>

            {yieldPrediction.priceTrends && yieldPrediction.priceTrends.length > 0 && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ccc' }}>
                <CustomText variant="subheading" style={{ fontWeight: '700', marginBottom: 8 }}>
                  Harvest & Future Projections
                </CustomText>
                {yieldPrediction.priceTrends.map((trend, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <View>
                      <CustomText variant="body" style={{ fontWeight: '600' }}>{trend.period}</CustomText>
                      <CustomText variant="caption" color={theme.colors.textLight}>{trend.dateStr}</CustomText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <CustomText variant="body" style={{ fontWeight: '700', color: trend.trend === 'up' ? '#2E7D32' : trend.trend === 'down' ? '#C62828' : theme.colors.text }}>
                        ₹{trend.predictedPrice}/Q
                      </CustomText>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginTop: 12, padding: 10, backgroundColor: '#fff', borderRadius: 8 }}>
              <CustomText variant="caption" style={{ fontWeight: '700', color: theme.colors.primary, marginBottom: 4 }}>
                AI Recommendation:
              </CustomText>
              <CustomText variant="caption" color={theme.colors.text}>
                {yieldPrediction.recommendation || yieldPrediction.reasoning}
              </CustomText>
            </View>
          </Card>
        )}

        <Spacer size="md" />

        {error && (
          <Card style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#C62828' }]}>
            <CustomText color="#C62828">{error}</CustomText>
          </Card>
        )}

        {marketPrices.length > 0 && (
          <Card style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="stats-chart-outline" size={20} color={theme.colors.text} style={{ marginRight: 6 }} />
              <CustomText variant="subheading" style={{ fontWeight: '700' }}>
                Live Mandi Prices — {commodity}
              </CustomText>
            </View>
            <CustomText variant="caption" color={theme.colors.textLight} style={{ marginBottom: 12 }}>
              {marketPrices.length} market{marketPrices.length > 1 ? 's' : ''} found in {state}
            </CustomText>

            {marketPrices.map((item, index) => {
              const status = getPriceStatus(item.modal_price, item.min_price, item.max_price);
              return (
                <View key={index} style={styles.priceRow}>
                  <View style={styles.priceLeft}>
                    <CustomText variant="body" style={{ fontWeight: '600' }}>{item.market || item.Market}</CustomText>
                    <CustomText variant="caption" color={theme.colors.textLight}>
                      {item.district || item.District} • {item.variety || item.Variety || 'General'}
                    </CustomText>
                    <View style={styles.rangeRow}>
                      <CustomText variant="caption" color={theme.colors.textLight}>
                        Min: ₹{item.min_price} • Max: ₹{item.max_price}
                      </CustomText>
                    </View>
                  </View>
                  <View style={styles.priceRight}>
                    <CustomText style={[styles.modalPrice, { color: status.color }]}>
                      ₹{item.modal_price}
                    </CustomText>
                    <CustomText variant="caption" color={theme.colors.textLight}>/Quintal</CustomText>
                    <View style={[styles.badge, { backgroundColor: status.color + '22' }]}>
                      <CustomText variant="caption" color={status.color} style={{ fontWeight: '700' }}>
                        {status.label}
                      </CustomText>
                    </View>
                  </View>
                  {index < marketPrices.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </Card>
        )}

        {!isLoading && marketPrices.length === 0 && !error && (
          <Card style={styles.emptyCard}>
            <Ionicons name="leaf-outline" size={48} color={theme.colors.primary} style={{ marginBottom: 16 }} />
            <CustomText variant="subheading" style={{ textAlign: 'center', marginBottom: 8 }}>
              No prices loaded yet
            </CustomText>
            <CustomText variant="caption" color={theme.colors.textLight} style={{ textAlign: 'center' }}>
              Enter a commodity name and tap "Fetch Live Prices" to get real-time Mandi data.
            </CustomText>
          </Card>
        )}

        <Spacer size="md" />

        {futurePrices.length > 0 && (
          <Card style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.text} style={{ marginRight: 6 }} />
              <CustomText variant="subheading" style={{ fontWeight: '700' }}>
                Future Price Forecaster
              </CustomText>
            </View>
            <CustomText variant="caption" color={theme.colors.textLight} style={{ marginBottom: 12 }}>
              Select a post-harvest timeline to check expected pricing for {commodity}.
            </CustomText>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {futurePrices.map((forecast, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.stateChip, selectedFutureIndex === idx && styles.stateChipActive]}
                  onPress={() => setSelectedFutureIndex(idx)}
                >
                  <CustomText
                    variant="caption"
                    color={selectedFutureIndex === idx ? '#fff' : theme.colors.text}
                  >
                    {forecast.period}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {futurePrices[selectedFutureIndex] && (
              <View style={{ padding: 12, backgroundColor: theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <CustomText variant="body" style={{ fontWeight: '600' }}>{futurePrices[selectedFutureIndex].period}</CustomText>
                    <CustomText variant="caption" color={theme.colors.textLight}>{futurePrices[selectedFutureIndex].dateStr}</CustomText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <CustomText variant="h3" style={{ color: theme.colors.primary }}>
                      ₹{futurePrices[selectedFutureIndex].predictedPrice}
                    </CustomText>
                    <CustomText variant="caption" color={theme.colors.textLight}>/Quintal</CustomText>
                  </View>
                </View>
              </View>
            )}
          </Card>
        )}

        <Spacer size="md" />
        
        <Card style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="cube-outline" size={20} color={theme.colors.text} style={{ marginRight: 6 }} />
              <CustomText variant="subheading" style={{ fontWeight: '700' }}>Virtual Inventory</CustomText>
            </View>
            <TouchableOpacity onPress={loadInventory}>
              <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          <CustomText variant="caption" color={theme.colors.textLight} style={{ marginBottom: 12 }}>
            Materials tracked by AI agent. Automatically deducted on task creation.
          </CustomText>

          {inventory.length === 0 ? (
            <CustomText variant="body" color={theme.colors.textLight} style={{ textAlign: 'center', marginVertical: 10 }}>
              No inventory tracked.
            </CustomText>
          ) : (
            inventory.map((item, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 8 }}>
                <CustomText variant="body" style={{ fontWeight: '600' }}>{item.name}</CustomText>
                <CustomText variant="body" color={item.quantity > 5 ? theme.colors.primary : '#C62828'} style={{ fontWeight: '700' }}>
                  {item.quantity} {item.unit || 'units'}
                </CustomText>
              </View>
            ))
          )}
        </Card>

        <Spacer size="md" />
        <Card style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name="business-outline" size={20} color={theme.colors.text} style={{ marginRight: 6 }} />
            <CustomText variant="subheading" style={{ fontWeight: '700' }}>Eligible Govt. Schemes</CustomText>
          </View>
          <Spacer size="sm" />
          {[
            { name: 'PM-KISAN', benefit: '₹6,000/year direct income support', tag: 'Farmers' },
            { name: 'PM Fasal Bima Yojana', benefit: 'Crop insurance at low premiums', tag: 'Insurance' },
            { name: 'Krishi Bhagya', benefit: 'Rainwater harvesting subsidy', tag: 'Karnataka' },
            { name: 'eNAM (Digital Mandi)', benefit: 'Sell directly at national market', tag: 'Market' },
          ].map((scheme, i) => (
            <View key={i} style={styles.schemeRow}>
              <View style={styles.schemeLeft}>
                <CustomText variant="body" style={{ fontWeight: '600' }}>{scheme.name}</CustomText>
                <CustomText variant="caption" color={theme.colors.textLight}>{scheme.benefit}</CustomText>
              </View>
              <View style={[styles.badge, { backgroundColor: theme.colors.primary + '22', alignSelf: 'flex-start' }]}>
                <CustomText variant="caption" color={theme.colors.primary} style={{ fontWeight: '700' }}>
                  {scheme.tag}
                </CustomText>
              </View>
            </View>
          ))}
        </Card>

        <Spacer size="lg" />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md },
  banner: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 12,
  },
  searchCard: { padding: theme.spacing.md },
  card: { padding: theme.spacing.md },
  sectionTitle: { marginBottom: 4, fontWeight: '700' },
  label: { color: theme.colors.textLight, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  stateRow: { flexDirection: 'row', marginTop: 4 },
  stateChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    backgroundColor: theme.colors.surface,
  },
  stateChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  searchBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: 14,
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    flexWrap: 'wrap',
  },
  priceLeft: { flex: 1 },
  priceRight: { alignItems: 'flex-end', marginLeft: 8 },
  rangeRow: { marginTop: 2 },
  modalPrice: { fontSize: 20, fontWeight: '700' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: theme.colors.border,
    marginTop: 2,
  },
  schemeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  schemeLeft: { flex: 1, marginRight: 8 },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
});