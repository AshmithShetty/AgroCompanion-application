import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserSessionStore } from '../../store';

const getInventoryKey = () => {
  const { currentSession } = useUserSessionStore.getState();
  const sessionId = currentSession?.id || 'default';
  return `@agro_inventory_${sessionId}`;
};

export const InventoryRepository = {
  getInventory: async () => {
    try {
      const data = await AsyncStorage.getItem(getInventoryKey());
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },
  
  saveInventory: async (inventory) => {
    try {
      await AsyncStorage.setItem(getInventoryKey(), JSON.stringify(inventory));
    } catch (e) {
      console.error(e);
    }
  },

  addStock: async (itemName, quantity, unit) => {
    const inventory = await InventoryRepository.getInventory();
    const existing = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (existing) {
      existing.quantity += quantity;
    } else {
      inventory.push({ name: itemName, quantity, unit });
    }
    await InventoryRepository.saveInventory(inventory);
    return inventory;
  },

  deductStock: async (itemName, quantity) => {
    const inventory = await InventoryRepository.getInventory();
    const existing = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (existing) {
      existing.quantity -= quantity;
    } else {
      inventory.push({ name: itemName, quantity: -quantity, unit: 'units' });
    }
    await InventoryRepository.saveInventory(inventory);
    return inventory;
  }
};
