import { updateSensor, triggerEvent } from './api';

export const Scenarios = {
  runPestOutbreak: async () => {
    await updateSensor('temperature', 26);
    await updateSensor('humidity', 90);
    setTimeout(() => updateSensor('nitrogen', 40), 2000);
  },
  runHarvestSale: async () => {
    await triggerEvent('stop_rain');
    await updateSensor('soil_moisture', 40);
    await updateSensor('temperature', 22);
  }
};