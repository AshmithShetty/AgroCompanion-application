import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { CustomText } from '../atomic/CustomText';
import { Card } from './Card';
import { theme } from '../../theme';

export const NotificationCard = ({ title, message, isRead, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
    <Card style={[styles.card, !isRead && styles.unread]}>
      <CustomText variant="subheading" color={!isRead ? theme.colors.primary : theme.colors.text}>
        {title}
      </CustomText>
      <CustomText variant="body" color={theme.colors.textLight}>
        {message}
      </CustomText>
    </Card>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: { 
    marginBottom: theme.spacing.sm, 
    padding: theme.spacing.md 
  },
  unread: { 
    borderLeftWidth: 4, 
    borderLeftColor: theme.colors.primary 
  }
});