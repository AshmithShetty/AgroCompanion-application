import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { CustomText } from '../components/atomic/CustomText';
import { Button } from '../components/atomic/Button';
import { SelectField } from '../components/molecule/SelectField';
import { database } from '../database';
import { useUserSessionStore } from '../store';
import { showAlert } from '../utils/alert';
import { ContextExtractionAgent } from '../services/ai/ContextExtractionAgent';
import { ScheduleAgent } from '../services/ai/ScheduleAgent';
import { SessionOptionsService } from '../services/SessionOptionsService';
import { theme } from '../theme';

const getLocalDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const SessionCreateScreen = ({ navigation }) => {
  const currentFarm = useUserSessionStore(state => state.currentFarm);
  const setCurrentSession = useUserSessionStore(state => state.setCurrentSession);
  const [cropType, setCropType] = useState('');
  const [soilType, setSoilType] = useState('');
  const [farmingMethod, setFarmingMethod] = useState('');
  const [startDateStr, setStartDateStr] = useState(getLocalDateString());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);

  const catalog = useMemo(() => SessionOptionsService.getCatalogForFarm(currentFarm), [currentFarm]);
  const minDate = getLocalDateString();

  const handleCreate = async () => {
    if (!catalog.isReady) {
      showAlert('Farm setup incomplete', 'Finish farm analysis before creating a session.');
      return;
    }

    if (!cropType || !soilType || !farmingMethod) {
      showAlert('All fields required', 'Select crop type, soil type, and farming method.');
      return;
    }

    if (startDateStr < minDate) {
      showAlert('Invalid date', 'Start date cannot be before today.');
      return;
    }

    setIsLoading(true);
    setLoadingStatus('Preparing farm session...');
    try {
      const envContext = await ContextExtractionAgent.generateEnvironmentalContext(currentFarm, {
        cropType,
        soilType,
        farmingMethod,
        startDate: new Date(startDateStr).getTime(),
      });

      setLoadingStatus('Saving session data...');
      let newSession;
      await database.write(async () => {
        newSession = await database.get('sessions').create(session => {
          session.farmId = currentFarm.id;
          session.cropType = cropType;
          session.seedVariety = '';
          session.soilType = soilType;
          session.startDate = new Date(startDateStr).getTime();
          session.farmingMethod = farmingMethod;
          session.environmentalContext = envContext;
          session.farmContextSnapshot = currentFarm.farmContext || '';
          session.optionCatalogSnapshotJson = currentFarm.farmOptionCatalogJson || '';
          session.isActive = true;
        });
      });

      setCurrentSession(newSession);

      setLoadingStatus('Generating task schedule...');
      await ScheduleAgent.generateMasterSchedule({
        cropType,
        soilType,
        farmingMethod,
        startDate: new Date(startDateStr).getTime(),
      }, `${currentFarm.farmContext || ''}\n${envContext}`);

      navigation.navigate('Main');
    } catch (error) {
      showAlert('Session failed', 'Unable to initialize the farm session.');
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText variant="h1" style={styles.title}>New Farm Session</CustomText>
        <CustomText variant="body" style={styles.subtitle}>
          Select the approved farm parameters for this district-aware setup.
        </CustomText>

        {catalog.districtWarnings.length > 0 ? (
          <View style={styles.warningBox}>
            {catalog.districtWarnings.map(warning => (
              <CustomText key={warning} variant="caption" style={styles.warningText}>{warning}</CustomText>
            ))}
          </View>
        ) : null}

        <SelectField
          label="Crop Type"
          placeholder="Select a crop type"
          value={cropType}
          options={catalog.viableCrops}
          onChange={setCropType}
          disabled={!catalog.isReady}
        />

        <SelectField
          label="Soil Type"
          placeholder="Select a soil type"
          value={soilType}
          options={catalog.soilTypes}
          onChange={setSoilType}
          disabled={!catalog.isReady}
        />

        <SelectField
          label="Farming Method"
          placeholder="Select a farming method"
          value={farmingMethod}
          options={catalog.farmingMethods}
          onChange={setFarmingMethod}
          disabled={!catalog.isReady}
        />

        <View style={styles.dateField}>
          <CustomText variant="caption" style={styles.dateLabel}>Start Date</CustomText>
          <Pressable style={({ pressed }) => [styles.dateButton, pressed ? styles.pressed : null]} onPress={() => setIsCalendarVisible(true)}>
            <CustomText style={styles.dateValue}>{startDateStr}</CustomText>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Button title="Start Session" onPress={handleCreate} disabled={isLoading || !catalog.isReady} />
        </View>
      </ScrollView>

      <Modal visible={isLoading} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <CustomText variant="h3" style={styles.modalTitle}>Preparing your AgroCompanion session</CustomText>
            <CustomText variant="body" style={styles.modalText}>{loadingStatus}</CustomText>
          </View>
        </View>
      </Modal>

      <Modal visible={isCalendarVisible} transparent animationType="fade" onRequestClose={() => setIsCalendarVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <Calendar
              current={startDateStr}
              minDate={minDate}
              onDayPress={(day) => {
                setStartDateStr(day.dateString);
                setIsCalendarVisible(false);
              }}
              markedDates={{
                [startDateStr]: {
                  selected: true,
                  selectedColor: theme.colors.primary,
                },
              }}
              theme={{
                selectedDayBackgroundColor: theme.colors.primary,
                todayTextColor: theme.colors.secondary,
                arrowColor: theme.colors.primary,
              }}
            />
            <Pressable style={({ pressed }) => [styles.calendarClose, pressed ? styles.pressed : null]} onPress={() => setIsCalendarVisible(false)}>
              <CustomText style={styles.calendarCloseText}>Close</CustomText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg },
  title: { color: theme.colors.primary, marginBottom: theme.spacing.xs },
  subtitle: { color: theme.colors.textLight, marginBottom: theme.spacing.lg },
  warningBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#F6C453',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  warningText: {
    color: '#8A5A00',
    marginBottom: theme.spacing.xs,
  },
  dateField: {
    marginBottom: theme.spacing.md,
  },
  dateLabel: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.text,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  dateValue: {
    color: theme.colors.text,
  },
  pressed: {
    opacity: 0.85,
  },
  footer: { marginTop: theme.spacing.lg },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    width: '85%',
  },
  modalTitle: {
    color: theme.colors.primary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  modalText: {
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  calendarModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    width: '90%',
  },
  calendarClose: {
    alignSelf: 'flex-end',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  calendarCloseText: {
    color: theme.colors.primary,
  },
});
