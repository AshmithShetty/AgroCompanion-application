export const SensorDataParser = {
  parse: (payloadString) => {
    try {
      const data = JSON.parse(payloadString);
      const validKeys = [
        'temperature', 'humidity', 'pressure', 'soil_moisture',
        'soil_ph', 'nitrogen', 'phosphorus', 'potassium',
        'light_lux', 'is_raining'
      ];

      for (const key of validKeys) {
        if (data.hasOwnProperty(key)) {
          return {
            type: key,
            value: Number(data[key])
          };
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }
};