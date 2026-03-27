import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CustomText } from '../atomic/CustomText';
import { Card } from './Card';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export const SensorStatusCard = ({ title, value, unit, iconName, status, style }) => {
  const isAlert = status === 'alert';
  const isWarning = status === 'warning';
  
  const getColor = () => {
    if (isAlert) return theme.colors.error;
    if (isWarning) return '#FF9800';
    return theme.colors.primary;
  };

  const activeColor = getColor();

  return (
    <Card style={[styles.container, style, (isAlert || isWarning) && { borderColor: activeColor, borderWidth: 1 }]}>
      <View style={styles.header}>
        <Ionicons name={iconName} size={24} color={activeColor} />
        <CustomText variant="caption" color={theme.colors.textLight} style={styles.title} numberOfLines={1}>
          {title}
        </CustomText>
      </View>
      <View style={styles.valueRow}>
        <CustomText variant="heading" color={activeColor} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </CustomText>
        <CustomText variant="body" color={theme.colors.textLight} style={styles.unit}>
          {unit}
        </CustomText>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { padding: theme.spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  title: { marginLeft: theme.spacing.xs, flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  unit: { marginLeft: theme.spacing.xs }
});