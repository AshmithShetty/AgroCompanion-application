import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, CustomText, Card, Spacer, Button } from '../components';
import { MetricsCalculator } from '../services/analytics/MetricsCalculator';
import { ImpactEventRepository } from '../services/analytics/ImpactEventRepository';
import { useUserSessionStore } from '../store';
import { theme } from '../theme';
import { EventBusService } from '../services/EventBusService';
import { EVENT_TOPICS } from '../utils/EventRegistry';

const formatMaybe = (value, suffix = '') => {
  if (value === null || value === undefined) {
    return '--';
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '--';
  }
  return `${num}${suffix}`;
};

const EVENT_TYPES = [
  { key: 'irrigation', label: 'Irrigation', unit: 'L', icon: 'water' },
  { key: 'fertilizer', label: 'Fertilizer', unit: 'kg', icon: 'flask-outline' },
  { key: 'pesticide', label: 'Pesticide', unit: 'g', icon: 'bug-outline' },
  { key: 'fuel', label: 'Fuel', unit: 'L', icon: 'car-outline' },
  { key: 'electricity', label: 'Electricity', unit: 'kWh', icon: 'flash-outline' },
  { key: 'sale', label: 'Sale', unit: 'INR', icon: 'cash-outline' },
];

const typeByKey = (key) => EVENT_TYPES.find(t => t.key === key) || EVENT_TYPES[0];

const formatEventTime = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleString();
};

export const ImpactDetailsScreen = ({ navigation }) => {
  const currentSession = useUserSessionStore(state => state.currentSession);
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const sessionTitle = useMemo(() => {
    if (!currentSession) {
      return 'Impact Details';
    }
    return `Impact: ${currentSession.cropType || 'Session'}`;
  }, [currentSession]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const [metricData, eventData] = await Promise.all([
          MetricsCalculator.calculateImpact(),
          ImpactEventRepository.getEvents({}, { limit: 30 }),
        ]);
        if (!alive) {
          return;
        }
        setMetrics(metricData);
        setEvents(eventData || []);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    load();

    const sub = EventBusService.subscribe(EVENT_TOPICS.IMPACT_EVENT_CREATED, (payload) => {
      if (!payload?.sessionId || payload.sessionId !== currentSession?.id) {
        return;
      }
      load();
    });

    return () => {
      alive = false;
      if (sub) {
        sub.unsubscribe();
      }
    };
  }, [currentSession?.id]);



  const baselineLabel = useMemo(() => {
    const count = Number(metrics?.baselineSessionsUsed || 0);
    if (!count) {
      return 'Baseline: not available yet';
    }
    return `Baseline: ${count} previous session${count === 1 ? '' : 's'}`;
  }, [metrics?.baselineSessionsUsed]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title={sessionTitle} showBack={true} />
      <ScrollView style={styles.content}>
        {!currentSession ? (
          <Card>
            <CustomText variant="body" color={theme.colors.textLight}>Select a farm session to track impact.</CustomText>
          </Card>
        ) : null}

        {currentSession ? (
          <>
            <Card>
              <View style={styles.titleRow}>
                <CustomText variant="subheading">Session Summary</CustomText>
                <CustomText variant="caption" color={theme.colors.textLight}>{baselineLabel}</CustomText>
              </View>
              <Spacer size="sm" />

              <View style={styles.metricsGrid}>
                <View style={styles.metric}>
                  <Ionicons name="water" size={22} color={theme.colors.primary} />
                  <CustomText variant="heading" color={theme.colors.primary}>{loading ? '--' : formatMaybe(metrics?.waterSavedL, 'L')}</CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>Water saved</CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>Used: {loading ? '--' : formatMaybe(metrics?.waterUsedL, 'L')}</CustomText>
                </View>
                <View style={styles.metric}>
                  <Ionicons name="flask-outline" size={22} color={theme.colors.primary} />
                  <CustomText variant="heading" color={theme.colors.primary}>{loading ? '--' : formatMaybe(metrics?.fertilizerReducedKg, 'kg')}</CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>Fertilizer reduced</CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>Used: {loading ? '--' : formatMaybe(metrics?.fertilizerUsedKg, 'kg')}</CustomText>
                </View>
              </View>

              <Spacer size="sm" />

              <View style={styles.metricsGrid}>
                <View style={styles.metric}>
                  <Ionicons name="bug-outline" size={22} color={theme.colors.primary} />
                  <CustomText variant="heading" color={theme.colors.primary}>{loading ? '--' : formatMaybe(metrics?.pesticideReducedG, 'g')}</CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>Pesticide reduced</CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>Used: {loading ? '--' : formatMaybe(metrics?.pesticideUsedG, 'g')}</CustomText>
                </View>
                <View style={styles.metric}>
                  <Ionicons name="leaf-outline" size={22} color={theme.colors.primary} />
                  <CustomText variant="heading" color={theme.colors.primary}>{loading ? '--' : formatMaybe(metrics?.co2eAvoidedKg, 'kg')}</CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>CO2e avoided</CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>Actual: {loading ? '--' : formatMaybe(metrics?.co2eActualKg, 'kg')}</CustomText>
                </View>
              </View>

              <Spacer size="sm" />

              <View style={styles.incomeRow}>
                <Ionicons name="trending-up-outline" size={22} color={theme.colors.secondary} />
                <View style={styles.incomeText}>
                  <CustomText variant="subheading" color={theme.colors.secondary}>
                    {loading ? '--' : formatMaybe(metrics?.netIncomeChangeInr, ' INR')}
                  </CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>Net income change</CustomText>
                </View>
              </View>
            </Card>



            <Spacer size="md" />

            <CustomText variant="subheading">Recent Logs</CustomText>
            <Spacer size="sm" />
            {events.length === 0 ? (
              <Card>
                <CustomText variant="body" color={theme.colors.textLight}>No logs yet for this session.</CustomText>
              </Card>
            ) : (
              events.map(event => {
                const type = typeByKey((event?.type || '').toString().trim().toLowerCase());
                const qty = Number(event?.quantity);
                const unit = (event?.unit || type.unit).toString();
                const cost = Number(event?.costInInr || 0);
                return (
                  <Card key={event.id} style={styles.eventCard}>
                    <View style={styles.eventRow}>
                      <Ionicons name={type.icon} size={20} color={theme.colors.primary} />
                      <View style={styles.eventMain}>
                        <CustomText variant="subheading">{type.label}</CustomText>
                        <CustomText variant="caption" color={theme.colors.textLight}>{formatEventTime(event?.recordedAt)}</CustomText>
                      </View>
                      <View style={styles.eventRight}>
                        <CustomText variant="subheading">{Number.isFinite(qty) ? `${qty}${unit}` : '--'}</CustomText>
                        {Number.isFinite(cost) && cost > 0 ? (
                          <CustomText variant="caption" color={theme.colors.textLight}>Cost: {Math.round(cost)} INR</CustomText>
                        ) : null}
                      </View>
                    </View>
                    {event?.notes ? (
                      <View style={styles.noteRow}>
                        <CustomText variant="caption" color={theme.colors.textLight}>{event.notes}</CustomText>
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { flex: 1, backgroundColor: theme.colors.background, borderRadius: theme.radius.md, padding: theme.spacing.sm, marginHorizontal: theme.spacing.xs, alignItems: 'center' },
  incomeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: theme.radius.md, padding: theme.spacing.sm },
  incomeText: { marginLeft: theme.spacing.sm, flex: 1 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickItem: { width: '31%', alignItems: 'center', paddingVertical: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.background, marginBottom: theme.spacing.sm },
  quickLabel: { marginTop: theme.spacing.xs, textAlign: 'center' },
  eventCard: { marginBottom: theme.spacing.sm },
  eventRow: { flexDirection: 'row', alignItems: 'center' },
  eventMain: { marginLeft: theme.spacing.sm, flex: 1 },
  eventRight: { alignItems: 'flex-end' },
  noteRow: { marginTop: theme.spacing.xs },
  pressed: { opacity: 0.85 },
});
