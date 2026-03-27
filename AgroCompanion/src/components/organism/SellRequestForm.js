import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { InputField } from '../molecule/InputField';
import { Button } from '../atomic/Button';
import { Card } from '../molecule/Card';
import { CustomText } from '../atomic/CustomText';
import { EventBusService } from '../../services/EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';
import { theme } from '../../theme';
import { QueueManager } from '../../services/sync/QueueManager';

export const SellRequestForm = () => {
  const [crop, setCrop] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  const handleSubmit = async () => {
    if (!crop || !quantity || !price) return;

    const transaction = {
      id: Date.now().toString(),
      crop,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      total: parseFloat(quantity) * parseFloat(price),
      date: new Date().toISOString()
    };

    await QueueManager.enqueue('CREATE_TRANSACTION', transaction);
    EventBusService.publish(EVENT_TOPICS.TRANSACTION_COMPLETED, transaction);

    setCrop('');
    setQuantity('');
    setPrice('');
  };

  return (
    <Card style={styles.container}>
      <CustomText variant="subheading">New Sell Request</CustomText>
      <InputField label="Crop" value={crop} onChangeText={setCrop} />
      <InputField label="Quantity (kg)" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
      <InputField label="Expected Price (per kg)" value={price} onChangeText={setPrice} keyboardType="numeric" />
      <Button title="Submit Request" onPress={handleSubmit} />
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { padding: theme.spacing.md }
});