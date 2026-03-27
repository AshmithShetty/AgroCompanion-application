import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomText } from '../atomic/CustomText';
import { DebugConsole } from './DebugConsole';
import { UsageTracker } from '../../services/analytics/UsageTracker';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export const Header = ({ title, showBack = false }) => {
  const navigation = useNavigation();
  const [debugVisible, setDebugVisible] = useState(false);

  const handleNotificationPress = () => {
    UsageTracker.trackFeature('notification_inbox');
    navigation.navigate('NotificationInbox');
  };

  return (
    <View style={styles.container}>
      {showBack && (
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      )}
      <TouchableOpacity 
        style={styles.titleWrapper} 
        onLongPress={() => setDebugVisible(true)}
        delayLongPress={1500}
        activeOpacity={1}
      >
        <CustomText variant="heading" style={styles.title}>{title}</CustomText>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleNotificationPress}>
        <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
      </TouchableOpacity>
      
      <DebugConsole visible={debugVisible} onClose={() => setDebugVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  titleWrapper: {
    flex: 1,
  },
  title: {
    flex: 1,
  },
  backBtn: {
    marginRight: theme.spacing.sm,
  }
});