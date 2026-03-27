import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Header, CustomText, Card, Spacer, SelectField, InputField, Button } from '../components';
import { useUserSessionStore } from '../store';
import { theme } from '../theme';
import { ImpactEventRepository } from '../services/analytics/ImpactEventRepository';

const OPTIONS = [
  { option: 'Irrigation (L)', type: 'irrigation', unit: 'L', quantityLabel: 'Water applied (L)' },
  { option: 'Fertilizer (kg)', type: 'fertilizer', unit: 'kg', quantityLabel: 'Fertilizer used (kg)' },
  { option: 'Pesticide (g)', type: 'pesticide', unit: 'g', quantityLabel: 'Pesticide used (g)' },
  { option: 'Fuel (L)', type: 'fuel', unit: 'L', quantityLabel: 'Diesel used (L)' },
  { option: 'Electricity (kWh)', type: 'electricity', unit: 'kWh', quantityLabel: 'Electricity used (kWh)' },
  { option: 'Sale (INR)', type: 'sale', unit: 'INR', quantityLabel: 'Sale amount (INR)' },
];

const optionByType = (type) => OPTIONS.find(o => o.type === type) || OPTIONS[0];
const optionByLabel = (label) => OPTIONS.find(o => o.option === label) || OPTIONS[0];

const isValidNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

export const ImpactLogEventScreen = ({ navigation, route }) => {
  const currentSession = useUserSessionStore(state => state.currentSession);
  const defaultType = route?.params?.defaultType;

  const [selectedOption, setSelectedOption] = useState(optionByType(defaultType).option);
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (defaultType) {
      setSelectedOption(optionByType(defaultType).option);
    }
  }, [defaultType]);

  const selected = useMemo(() => optionByLabel(selectedOption), [selectedOption]);

  const canSave = useMemo(() => {
    if (!currentSession?.id) {
      return false;
    }
    if (!isValidNumber(quantity)) {
      return false;
    }
    if (cost && !Number.isFinite(Number(cost))) {
      return false;
    }
    return true;
  }, [cost, currentSession?.id, quantity]);

  const handleSave = async () => {
    if (!canSave || saving) {
      return;
    }

    setSaving(true);
    try {
      await ImpactEventRepository.createEvent({
        type: selected.type,
        quantity: Number(quantity),
        unit: selected.unit,
        costInInr: cost ? Number(cost) : null,
        notes: notes || '',
        source: 'manual',
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Log Impact" showBack={true} />
      <ScrollView style={styles.content}>
        {!currentSession?.id ? (
          <Card>
            <CustomText variant="body" color={theme.colors.textLight}>Select a farm session to add logs.</CustomText>
          </Card>
        ) : null}

        {currentSession?.id ? (
          <Card>
            <CustomText variant="subheading">Session</CustomText>
            <Spacer size="xs" />
            <CustomText variant="body" color={theme.colors.textLight}>{currentSession.cropType || 'Active session'}</CustomText>
            <Spacer size="md" />

            <SelectField
              label="Event type"
              value={selectedOption}
              options={OPTIONS.map(o => o.option)}
              onChange={setSelectedOption}
            />

            <InputField
              label={selected.quantityLabel}
              placeholder={`Enter ${selected.unit}`}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              autoCapitalize="none"
            />

            <InputField
              label="Cost (INR, optional)"
              placeholder="Enter cost"
              value={cost}
              onChangeText={setCost}
              keyboardType="numeric"
              autoCapitalize="none"
            />

            <InputField
              label="Notes (optional)"
              placeholder="Add notes"
              value={notes}
              onChangeText={setNotes}
              multiline={true}
              numberOfLines={4}
              autoCapitalize="sentences"
            />

            <Button title={saving ? 'Saving...' : 'Save'} onPress={handleSave} disabled={!canSave || saving} />
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md },
});

