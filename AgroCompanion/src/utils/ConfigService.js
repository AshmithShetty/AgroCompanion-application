const trimEnv = (value, fallback = '') => (typeof value === 'string' ? value.trim() : '') || fallback;

export const ConfigService = {
  APP_ENV: trimEnv(process.env.EXPO_PUBLIC_APP_ENV, 'development'),
  DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE === 'true',
  ENABLE_AI: process.env.EXPO_PUBLIC_ENABLE_AI === 'true',
  ENABLE_OFFLINE: process.env.EXPO_PUBLIC_ENABLE_OFFLINE === 'true',
  GROQ_API_KEY: trimEnv(process.env.EXPO_PUBLIC_GROQ_API_KEY),
  GROQ_TEXT_MODEL: trimEnv(process.env.EXPO_PUBLIC_GROQ_TEXT_MODEL, 'llama-3.3-70b-versatile'),
  GROQ_TEXT_MODEL_FAST: trimEnv(process.env.EXPO_PUBLIC_GROQ_TEXT_MODEL_FAST, 'llama-3.1-8b-instant'),
  GROQ_TEXT_MODEL_STRUCTURED: trimEnv(process.env.EXPO_PUBLIC_GROQ_TEXT_MODEL_STRUCTURED || process.env.EXPO_PUBLIC_GROQ_TEXT_MODEL_FAST, 'llama-3.1-8b-instant'),
  GROQ_TRANSLATION_MODEL: trimEnv(process.env.EXPO_PUBLIC_GROQ_TRANSLATION_MODEL || process.env.EXPO_PUBLIC_GROQ_TEXT_MODEL_FAST, 'llama-3.1-8b-instant'),
  GROQ_VISION_MODEL: trimEnv(process.env.EXPO_PUBLIC_GROQ_VISION_MODEL, 'meta-llama/llama-4-scout-17b-16e-instruct'),
  MAPBOX_TOKEN: trimEnv(process.env.EXPO_PUBLIC_MAPBOX_TOKEN),
  OPENWEATHER_KEY: trimEnv(process.env.EXPO_PUBLIC_OPENWEATHER_KEY),
  DATA_GOV_KEY: trimEnv(process.env.EXPO_PUBLIC_DATA_GOV_KEY),
  MQTT_BROKER_URL: trimEnv(process.env.EXPO_PUBLIC_MQTT_BROKER_URL, 'ws://localhost:3000'),
  AGROMONITORING_API_KEY: trimEnv(process.env.EXPO_PUBLIC_AGROMONITORING_API_KEY),
  DEFAULT_JURISDICTION: trimEnv(process.env.EXPO_PUBLIC_DEFAULT_JURISDICTION),
};
