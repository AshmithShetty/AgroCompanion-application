import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabNavigator } from './MainTabNavigator';
import { OnboardingScreen, TaskDetailScreen, NotificationInboxScreen, FarmSetupScreen, SessionSelectScreen, SessionCreateScreen, ImpactDetailsScreen, ImpactLogEventScreen } from '../screens';

const Stack = createNativeStackNavigator();

export const StackNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="Onboarding" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Main" component={MainTabNavigator} />
      <Stack.Screen name="NotificationInbox" component={NotificationInboxScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="FarmSetup" component={FarmSetupScreen} />
      <Stack.Screen name="SessionSelect" component={SessionSelectScreen} />
      <Stack.Screen name="SessionCreate" component={SessionCreateScreen} />
      <Stack.Screen name="ImpactDetails" component={ImpactDetailsScreen} />
      <Stack.Screen name="ImpactLogEvent" component={ImpactLogEventScreen} />
    </Stack.Navigator>
  );
};
