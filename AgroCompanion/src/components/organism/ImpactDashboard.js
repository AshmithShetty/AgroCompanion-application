import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Card } from '../molecule/Card';
import { CustomText } from '../atomic/CustomText';
import { MetricsCalculator } from '../../services/analytics/MetricsCalculator';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { useUserSessionStore } from '../../store';
import { EventBusService } from '../../services/EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';
import { Button } from '../atomic/Button';

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

export const ImpactDashboard = ({ onPressDetails, onPressLog }) => {
  const currentSession = useUserSessionStore(state => state.currentSession);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const hasSession = Boolean(currentSession?.id);

  const title = useMemo(() => {
    return 'Impact';
  }, []);

  useEffect(() => {
    let alive = true;

    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const data = await MetricsCalculator.calculateImpact();
        if (alive) {
          setMetrics(data);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    fetchMetrics();

    const sub = EventBusService.subscribe(EVENT_TOPICS.IMPACT_EVENT_CREATED, (payload) => {
      if (!payload?.sessionId || payload.sessionId !== currentSession?.id) {
        return;
      }
      fetchMetrics();
    });

    return () => {
      alive = false;
      if (sub) {
        sub.unsubscribe();
      }
    };
  }, [currentSession?.id]);

  return (
    <Card style={styles.container}>
      <View style={styles.headerRow}>
        <CustomText variant="subheading">{title}</CustomText>
        {hasSession && metrics?.baselineSessionsUsed ? (
          <CustomText variant="caption" color={theme.colors.textLight}>
            Baseline: {metrics.baselineSessionsUsed} session{metrics.baselineSessionsUsed === 1 ? '' : 's'}
          </CustomText>
        ) : null}
      </View>

      {!hasSession ? (
        <CustomText variant="body" color={theme.colors.textLight} style={styles.emptyText}>
          Select a farm session to track impact.
        </CustomText>
      ) : null}

      {hasSession ? (
        <>
          <View style={styles.grid}>
            <View style={styles.metricBox}>
              <Ionicons name="water" size={22} color={theme.colors.primary} />
              <CustomText variant="heading" color={theme.colors.primary}>
                {loading ? '--' : formatMaybe(metrics?.waterSavedL, 'L')}
              </CustomText>
              <CustomText variant="caption" color={theme.colors.textLight}>Water saved</CustomText>
            </View>
            <View style={styles.metricBox}>
              <Ionicons name="flask-outline" size={22} color={theme.colors.primary} />
              <CustomText variant="heading" color={theme.colors.primary}>
                {loading ? '--' : formatMaybe(metrics?.fertilizerReducedKg, 'kg')}
              </CustomText>
              <CustomText variant="caption" color={theme.colors.textLight}>Fertilizer reduced</CustomText>
            </View>
          </View>

          <View style={styles.grid}>
            <View style={styles.metricBox}>
              <Ionicons name="bug-outline" size={22} color={theme.colors.primary} />
              <CustomText variant="heading" color={theme.colors.primary}>
                {loading ? '--' : formatMaybe(metrics?.pesticideReducedG, 'g')}
              </CustomText>
              <CustomText variant="caption" color={theme.colors.textLight}>Pesticide reduced</CustomText>
            </View>
            <View style={styles.metricBox}>
              <Ionicons name="leaf-outline" size={22} color={theme.colors.primary} />
              <CustomText variant="heading" color={theme.colors.primary}>
                {loading ? '--' : formatMaybe(metrics?.co2eAvoidedKg, 'kg')}
              </CustomText>
              <CustomText variant="caption" color={theme.colors.textLight}>CO2e avoided</CustomText>
            </View>
          </View>

          <View style={[styles.actionsRow, { justifyContent: 'flex-start' }]}>
            <Pressable style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]} onPress={onPressDetails} disabled={!onPressDetails}>
              <CustomText variant="body" color={theme.colors.primary}>View details</CustomText>
            </Pressable>
          </View>
        </>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { padding: theme.spacing.md, marginTop: theme.spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyText: { marginTop: theme.spacing.sm },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.md },
  metricBox: { alignItems: 'center', flex: 1, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.xs, backgroundColor: theme.colors.background, borderRadius: theme.radius.md, marginHorizontal: theme.spacing.xs },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md },
  link: { paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.xs },
  logBtn: { paddingHorizontal: theme.spacing.md },
  pressed: { opacity: 0.85 },
});
