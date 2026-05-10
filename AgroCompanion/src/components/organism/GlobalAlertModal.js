import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAlertStore } from '../../store';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export const GlobalAlertModal = () => {
  const { visible, title, message, type, hide } = useAlertStore();

  if (!visible) return null;

  const getHeaderColor = () => {
    switch (type) {
      case 'success':
        return theme.colors.primary;
      case 'info':
        return '#2196F3';
      case 'error':
      default:
        return theme.colors.error;
    }
  };

  const headerColor = getHeaderColor();

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={hide}
    >
      <View style={styles.overlay}>
        <View style={styles.alertCard}>
          <View style={[styles.header, { backgroundColor: headerColor }]}>
            <Text style={styles.titleText}>{title}</Text>
            <TouchableOpacity onPress={hide} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.body}>
            <Text style={styles.messageText}>{message}</Text>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: headerColor }]} 
              onPress={hide}
            >
              <Text style={styles.actionText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.layout.margin,
  },
  alertCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.layout.radiusCard,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleText: {
    fontFamily: theme.typography.fontFamily.heading,
    fontSize: theme.typography.sizes.subheading,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.white,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 20,
    alignItems: 'center',
  },
  messageText: {
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textMain,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  actionBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: theme.radius.round,
    width: '100%',
    alignItems: 'center',
  },
  actionText: {
    fontFamily: theme.typography.fontFamily.heading,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.white,
    fontSize: theme.typography.sizes.body,
  }
});
