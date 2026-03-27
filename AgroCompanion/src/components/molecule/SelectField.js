import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CustomText } from '../atomic/CustomText';
import { theme } from '../../theme';

export const SelectField = ({ label, placeholder, value, options = [], onChange, disabled = false }) => {
  const [visible, setVisible] = useState(false);

  const displayLabel = useMemo(() => {
    if (value) {
      return value;
    }
    return placeholder || 'Select an option';
  }, [placeholder, value]);

  return (
    <>
      <View style={styles.container}>
        {label ? <CustomText variant="caption" style={styles.label}>{label}</CustomText> : null}
        <Pressable
          style={({ pressed }) => [styles.field, disabled && styles.disabled, pressed && !disabled ? styles.pressed : null]}
          onPress={() => {
            if (!disabled) {
              setVisible(true);
            }
          }}
          disabled={disabled}
        >
          <CustomText style={[styles.value, !value && styles.placeholder]}>{displayLabel}</CustomText>
        </Pressable>
      </View>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <CustomText variant="h2" style={styles.title}>{label || 'Select'}</CustomText>
            <ScrollView style={styles.scroll}>
              {options.map(option => (
                <Pressable
                  key={option}
                  style={({ pressed }) => [styles.option, option === value && styles.optionSelected, pressed ? styles.pressed : null]}
                  onPress={() => {
                    onChange(option);
                    setVisible(false);
                  }}
                >
                  <CustomText style={styles.optionText}>{option}</CustomText>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]} onPress={() => setVisible(false)}>
              <CustomText style={styles.closeText}>Close</CustomText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
  field: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  value: {
    color: theme.colors.text,
  },
  placeholder: {
    color: theme.colors.textLight,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    maxHeight: '70%',
    padding: theme.spacing.lg,
  },
  title: {
    marginBottom: theme.spacing.md,
    color: theme.colors.primary,
  },
  scroll: {
    marginBottom: theme.spacing.md,
  },
  option: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  optionSelected: {
    backgroundColor: '#F1F8E9',
  },
  optionText: {
    color: theme.colors.text,
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  closeText: {
    color: theme.colors.primary,
  },
});
