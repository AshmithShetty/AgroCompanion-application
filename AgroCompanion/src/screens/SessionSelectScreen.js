import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { CustomText } from '../components/atomic/CustomText';
import { Button } from '../components/atomic/Button';
import { database } from '../database';
import { useUserSessionStore } from '../store';
import { Q } from '@nozbe/watermelondb';
import { theme } from '../theme';
import { SessionOptionsService } from '../services/SessionOptionsService';
import { FarmSetupService } from '../services/FarmSetupService';
import { showAlert } from '../utils/alert';

export const SessionSelectScreen = ({ navigation }) => {
  const [sessions, setSessions] = useState([]);
  const [isRefreshingFarm, setIsRefreshingFarm] = useState(false);

  const currentFarm = useUserSessionStore(state => state.currentFarm);
  const setCurrentSession = useUserSessionStore(state => state.setCurrentSession);
  const setCurrentFarm = useUserSessionStore(state => state.setCurrentFarm);

  const catalog = useMemo(() => SessionOptionsService.getCatalogForFarm(currentFarm), [currentFarm]);

  useEffect(() => {
    const loadSessions = async () => {
      if (!currentFarm) {
        setSessions([]);
        return;
      }

      const sessionsCollection = database.get('sessions');
      const farmSessions = await sessionsCollection.query(
        Q.where('farm_id', currentFarm.id)
      ).fetch();
      setSessions(farmSessions);
    };

    loadSessions();
  }, [currentFarm]);

  const handleSelectSession = (session) => {
    setCurrentSession(session);
    navigation.replace('Main');
  };

  const handleCreateNew = () => {
    if (!catalog.isReady) {
      showAlert('Farm setup incomplete', 'Finish farm analysis before creating a new session.');
      return;
    }
    navigation.navigate('SessionCreate');
  };

  const handleRefreshFarm = async () => {
    if (!currentFarm?.id) {
      return;
    }

    setIsRefreshingFarm(true);
    try {
      const refreshedFarm = await FarmSetupService.refreshFarmAnalysis(currentFarm.id);
      setCurrentFarm(refreshedFarm);
      if (refreshedFarm.contextStatus !== 'ready') {
        showAlert('Analysis pending', 'Farm analysis did not complete successfully. You can retry or update the farm setup.');
      }
    } catch (error) {
      showAlert('Refresh failed', 'Unable to refresh the farm analysis right now.');
    } finally {
      setIsRefreshingFarm(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <CustomText variant="h1" style={styles.title}>Select Farm Session</CustomText>
        <CustomText variant="body" style={styles.subtitle}>Choose an active session or create a new one.</CustomText>
      </View>

      {!catalog.isReady ? (
        <View style={styles.statusCard}>
          <CustomText variant="h2" style={styles.statusTitle}>Farm analysis required</CustomText>
          <CustomText variant="body" style={styles.statusText}>
            Your farm must finish district analysis and option generation before a new session can be created.
          </CustomText>
          <View style={styles.statusActions}>
            <Button
              title={isRefreshingFarm ? 'Refreshing...' : 'Retry Analysis'}
              onPress={handleRefreshFarm}
              disabled={isRefreshingFarm}
              style={[styles.statusButton, styles.statusButtonSpacing]}
            />
            <Button
              title="Edit Farm Setup"
              variant="secondary"
              onPress={() => navigation.navigate('FarmSetup')}
              style={styles.statusButton}
            />
          </View>
          {isRefreshingFarm ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
        </View>
      ) : (
        <View style={styles.statusCard}>
          <CustomText variant="h2" style={styles.statusTitle}>Farm ready</CustomText>
          <CustomText variant="body" style={styles.statusText}>
            District: {currentFarm?.districtName || 'Unknown'} | Crops: {catalog.viableCrops.length} | Soils: {catalog.soilTypes.length}
          </CustomText>
        </View>
      )}

      <ScrollView style={styles.list}>
        {sessions.length === 0 ? (
          <CustomText style={styles.emptyText}>No sessions found for this farm.</CustomText>
        ) : (
          sessions.map(session => (
            <Pressable
              key={session.id}
              style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
              onPress={() => handleSelectSession(session)}
            >
              <CustomText variant="h2">{session.cropType}</CustomText>
              <CustomText variant="body">
                Method: {session.farmingMethod || 'N/A'} | Soil: {session.soilType || 'N/A'}
              </CustomText>
              <CustomText variant="caption" style={styles.date}>
                Started: {new Date(session.startDate).toLocaleDateString()}
              </CustomText>
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Create New Session" onPress={handleCreateNew} disabled={!catalog.isReady} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  title: { color: theme.colors.primary, marginBottom: theme.spacing.xs },
  subtitle: { color: theme.colors.textLight },
  statusCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusTitle: {
    color: theme.colors.textMain,
    marginBottom: theme.spacing.xs,
  },
  statusText: {
    color: theme.colors.textLight,
    marginBottom: theme.spacing.md,
  },
  statusActions: {
    flexDirection: 'row',
  },
  statusButton: {
    flex: 1,
  },
  statusButtonSpacing: {
    marginRight: theme.spacing.sm,
  },
  list: { flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  emptyText: { textAlign: 'center', marginTop: theme.spacing.xl, color: theme.colors.textLight },
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.88,
  },
  date: { marginTop: theme.spacing.sm, color: theme.colors.textLight },
  footer: { padding: theme.spacing.lg, backgroundColor: theme.colors.surface },
});
