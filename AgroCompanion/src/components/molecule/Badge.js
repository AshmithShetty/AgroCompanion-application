import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CustomText } from '../atomic/CustomText';
import { theme } from '../../theme';

export const Badge = ({ label, status = 'default' }) => {
  const getColors = () => {
    switch(status) {
      case 'error': return { bg: '#FFEBEE', text: theme.colors.error };
      case 'warning': return { bg: '#FFF8E1', text: theme.colors.secondary };
      case 'success': return { bg: '#E8F5E9', text: theme.colors.primary };
      default: return { bg: '#E0E0E0', text: theme.colors.textMain };
    }
  };
  const colors = getColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <CustomText variant="caption" color={colors.text}>{label}</CustomText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.round,
    alignSelf: 'flex-start',
  }
});