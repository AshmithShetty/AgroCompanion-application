import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { CustomText } from '../atomic/CustomText';
import { theme } from '../../theme';

export const InputField = ({ label, placeholder, value, onChangeText, secureTextEntry, keyboardType, multiline, numberOfLines, autoCapitalize }) => {
  return (
    <View style={styles.container}>
      {label && <CustomText variant="caption" style={styles.label}>{label}</CustomText>}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textLight}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  label: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  }
});
