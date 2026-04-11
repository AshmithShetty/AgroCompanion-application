export const ConfigService = {
  APP_ENV: process.env.EXPO_PUBLIC_APP_ENV || 'development',
  DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE === 'true',
  ENABLE_AI: process.env.EXPO_PUBLIC_ENABLE_AI === 'true',
  ENABLE_OFFLINE: process.env.EXPO_PUBLIC_ENABLE_OFFLINE === 'true',
  GROQ_API_KEY: process.env.EXPO_PUBLIC_GROQ_API_KEY || '',
  GROQ_TEXT_MODEL: process.env.EXPO_PUBLIC_GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile',
  GROQ_VISION_MODEL: process.env.EXPO_PUBLIC_GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
  MAPBOX_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '',
  OPENWEATHER_KEY: process.env.EXPO_PUBLIC_OPENWEATHER_KEY || '',
  DATA_GOV_KEY: process.env.EXPO_PUBLIC_DATA_GOV_KEY || '',
  MQTT_BROKER_URL: process.env.EXPO_PUBLIC_MQTT_BROKER_URL || 'ws://localhost:3000',
  AGROMONITORING_API_KEY: process.env.EXPO_PUBLIC_AGROMONITORING_API_KEY || '',
  DEFAULT_JURISDICTION: process.env.EXPO_PUBLIC_DEFAULT_JURISDICTION || ''
};
