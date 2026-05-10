import React, { useEffect, useState } from 'react';
import { Modal, View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { CustomText } from '../atomic/CustomText';
import { Button } from '../atomic/Button';
import { LoggerService } from '../../services/analytics/LoggerService';
import { DemoDataService } from '../../services/DemoDataService';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../utils/alert';

export const DebugConsole = ({ visible, onClose }) => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (visible) {
      loadLogs();
    }
  }, [visible]);

  const loadLogs = async () => {
    const data = await LoggerService.getLogs();
    setLogs(data);
  };

  const handleClearLogs = async () => {
    await LoggerService.clearLogs();
    loadLogs();
  };

  const handleResetDemoData = async () => {
    try {
      await DemoDataService.resetToDemoState();
      showAlert("Success", "Demo data has been reset successfully.", "success");
    } catch (error) {
      showAlert("Error", "Failed to reset demo data.", "error");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <CustomText variant="heading">Debug Console</CustomText>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.actions}>
            <Button title="Refresh" onPress={loadLogs} variant="secondary" />
            <Button title="Clear Cache" onPress={handleClearLogs} variant="secondary" />
            <Button title="Reset Data" onPress={handleResetDemoData} variant="secondary" />
          </View>

          <ScrollView style={styles.logArea}>
            {logs.map((log, index) => (
              <View key={index} style={styles.logEntry}>
                <CustomText variant="caption" color={theme.colors.primary}>[{log.type}] {log.module}</CustomText>
                <CustomText variant="body">{log.message}</CustomText>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { height: '80%', backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, padding: theme.spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  logArea: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.sm, borderRadius: theme.radius.md },
  logEntry: { marginBottom: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: theme.spacing.xs }
});