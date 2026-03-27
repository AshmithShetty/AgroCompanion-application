import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { HomeScreen } from './HomeScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { ProfileScreen } from './ProfileScreen';
import { FarmSetupScreen } from './FarmSetupScreen';
import { SessionSelectScreen } from './SessionSelectScreen';
import { SessionCreateScreen } from './SessionCreateScreen';
import { AssistantScreen } from './AssistantScreen';
import { CalendarScreen } from './CalendarScreen';
import { MarketScreen } from './MarketScreen';
import { NotificationInboxScreen } from './NotificationInboxScreen';
import { ImpactDetailsScreen } from './ImpactDetailsScreen';
import { ImpactLogEventScreen } from './ImpactLogEventScreen';

const Placeholder = ({ title }) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
  </View>
);

export const TaskDetailScreen = () => <Placeholder title="Task Detail Screen" />;

export { 
  HomeScreen, 
  OnboardingScreen, 
  ProfileScreen, 
  FarmSetupScreen,
  SessionSelectScreen,
  SessionCreateScreen,
  AssistantScreen, 
  CalendarScreen, 
  MarketScreen, 
  NotificationInboxScreen,
  ImpactDetailsScreen,
  ImpactLogEventScreen
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32' }
});
