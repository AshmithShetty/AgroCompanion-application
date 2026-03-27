import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';

export const Button = ({ title, onPress, variant = 'primary', style, textStyle, disabled = false }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return [styles.secondary, { borderColor: theme.colors.primary }];
      case 'danger':
        return [styles.danger, { backgroundColor: theme.colors.error }];
      default:
        return [styles.primary, { backgroundColor: theme.colors.primary }];
    }
  };

  const getTextColor = () => {
    return variant === 'secondary' ? theme.colors.primary : theme.colors.white;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        ...getVariantStyles(),
        style,
        disabled && { opacity: 0.5 },
        pressed && !disabled ? styles.pressed : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
        {title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: theme.layout.touchTarget,
    minWidth: theme.layout.touchTarget,
    borderRadius: theme.layout.radiusInput,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  primary: {},
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  danger: {},
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontFamily: theme.typography.fontFamily.body,
    fontWeight: theme.typography.weights.semiBold,
    fontSize: theme.typography.sizes.body,
  }
});
