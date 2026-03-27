import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, ScrollView, View, StyleSheet,
  TextInput, TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, CustomText, Card, Spacer } from '../components';
import { MarketDataService } from '../services/market/MarketDataService';
import { useUserSessionStore } from '../store';
import { theme } from '../theme';

const STATES = ['Karnataka', 'Maharashtra', 'Uttar Pradesh', 'Punjab', 'Gujarat', 'Tamil Nadu'];

export const MarketScreen = () => {
  const currentSession = useUserSessionStore(state => state.currentSession);
  const currentFarm = useUserSessionStore(state => state.currentFarm);
  const cropType = currentSession?.cropType || '';

  const [commodity, setCommodity] = useState(cropType);
  const [state, setState] = useState('Karnataka');
  const [marketPrices, setMarketPrices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPrices = async (refresh = false) => {
    if (!commodity.trim()) return;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const prices = await MarketDataService.getMandiPrices(commodity.trim(), state);
      setMarketPrices(prices || []);
    } catch (e) {
      setError('Could not fetch prices. Check your connection or try again.');
      setMarketPrices([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (commodity) loadPrices();
  }, []);

  const getPriceStatus = (modal, min, max) => {
    const mid = (parseFloat(min) + parseFloat(max)) / 2;
    if (parseFloat(modal) > mid * 1.1) return { label: 'High', color: '#2E7D32' };
    if (parseFloat(modal) < mid * 0.9) return { label: 'Low', color: '#C62828' };
    return { label: 'Fair', color: '#E65100' };
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Marketplace & Finance" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadPrices(true)} tintColor={theme.colors.primary} />}
      >
        {/* Session Info Banner */}
        {currentSession && (
          <View style={styles.banner}>
            <CustomText variant="caption" color="#fff">
              Active Session: {currentSession.cropType} • {currentFarm?.name || 'My Farm'}
            </CustomText>
          </View>
        )}

        {/* Search Controls */}
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

        {/* Results */}
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

        {/* Government Schemes */}
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