import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Header, CustomText, Card, Spacer, MapContainer, TaskCard, SensorStatusCard } from '../components';
import { TaskRepository } from '../services/TaskRepository';
import { MQTTClientService } from '../services/iot/MQTTClient';
import { DataAggregator } from '../services/iot/DataAggregator';
import { EventBusService } from '../services/EventBusService';
import { EVENT_TOPICS } from '../utils/EventRegistry';
import { Ionicons } from '@expo/vector-icons';
import { WeatherService } from '../services/external/WeatherService';
import { SatelliteService } from '../services/external/SatelliteService';
import { useUserSessionStore } from '../store';
import { theme } from '../theme';

const parseJson = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

export const HomeScreen = () => {
  const { t } = useTranslation(['farm', 'common', 'errors']);
  const [recentTasks, setRecentTasks] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [weatherData, setWeatherData] = useState(null);
  const [ndviData, setNdviData] = useState(null);
  const currentFarm = useUserSessionStore(state => state.currentFarm);
  const currentSession = useUserSessionStore(state => state.currentSession);
  const selectedLocation = parseJson(currentFarm?.locationPointJson, null);
  const boundaryGeoJson = parseJson(currentFarm?.boundaryGeoJson, null);
  const previewPolygon = Array.isArray(boundaryGeoJson?.geometry?.coordinates?.[0])
    ? boundaryGeoJson.geometry.coordinates[0].slice(0, -1).map(([longitude, latitude]) => ({ latitude, longitude }))
    : [];

  const ndviScore = Number.isFinite(Number(ndviData?.ndviMean)) ? Number(ndviData.ndviMean) : 0;
  const clampedNdvi = Math.max(-1, Math.min(1, ndviScore));
  const healthScore = Math.max(0, Math.min(100, Math.round(clampedNdvi * 100)));
  const confidencePercent = Math.max(0, Math.min(100, Math.round(((clampedNdvi + 1) / 2) * 100)));
  const ndviLabel = `${currentFarm?.districtName || t('farm:dashboard.farmFallback', 'Farm')} NDVI`;
  const providerLabel = ndviData?.provider ? String(ndviData.provider).toUpperCase() : '';
  const observedLabel = ndviData?.observationDate ? new Date(ndviData.observationDate).toLocaleDateString() : '';

  const [sensorData, setSensorData] = useState({
    temperature: 0,
    humidity: 0,
    pressure: 0,
    soil_moisture: 0,
    soil_ph: 0,
    nitrogen: 0,
    phosphorus: 0,
    potassium: 0,
    light_lux: 0,
    is_raining: 0
  });

  useEffect(() => {
    const initializeDashboard = async () => {
      const allTasks = await TaskRepository.getAllTasks();
      setRecentTasks(allTasks.slice(0, 3));

      const lat = currentFarm?.latitude || 12.9716;
      const lon = currentFarm?.longitude || 77.5946;
      try {
        const forecast = await WeatherService.getForecast(lat, lon);
        if (forecast?.list?.length > 0) {
          setWeatherData(forecast.list[0]);
        }
      } catch (e) {
        console.error('Weather fetch error:', e);
      }

      try {
        if (currentFarm?.boundaryGeoJson) {
          const ndviPayload = await SatelliteService.getFarmNdvi(currentFarm);
          setNdviData(ndviPayload);
        }
      } catch (e) {
        console.error('NDVI fetch error:', e);
      }

      const keys = Object.keys(sensorData);
      const cachedData = { ...sensorData };
      for (const key of keys) {
        const val = await DataAggregator.getOfflineValue(key);
        if (val !== null) cachedData[key] = val;
      }
      setSensorData(cachedData);

      MQTTClientService.connect();
    };

    initializeDashboard();

    const subs = [
      EventBusService.subscribe(EVENT_TOPICS.TASK_CREATED, async () => {
        const all = await TaskRepository.getAllTasks();
        setRecentTasks(all.slice(0, 3));
      }),
      EventBusService.subscribe(EVENT_TOPICS.TASK_RESOLVED, async () => {
        const all = await TaskRepository.getAllTasks();
        setRecentTasks(all.slice(0, 3));
      }),
      EventBusService.subscribe(EVENT_TOPICS.TASK_UPDATED, async () => {
        const all = await TaskRepository.getAllTasks();
        setRecentTasks(all.slice(0, 3));
      }),
      EventBusService.subscribe(EVENT_TOPICS.TASK_DELETED, async () => {
        const all = await TaskRepository.getAllTasks();
        setRecentTasks(all.slice(0, 3));
      }),
      EventBusService.subscribe(EVENT_TOPICS.SENSOR_DATA_RECEIVED, (data) => {
        setSensorData(prev => ({ ...prev, [data.type]: data.value }));
        DataAggregator.cacheLatestValue(data.type, data.value);

      }),
      EventBusService.subscribe(EVENT_TOPICS.NODE_CONNECTION_RESTORED, () => setConnectionStatus('online')),
      EventBusService.subscribe(EVENT_TOPICS.NODE_CONNECTION_LOST, () => setConnectionStatus('offline'))
    ];

    return () => {
      subs.forEach(sub => sub.unsubscribe());
      MQTTClientService.disconnect();
    };
  }, [currentFarm?.id, currentSession?.id]);

  const checkAlert = (type, val) => {
    const rules = {
      temperature: { min: 15, max: 35 },
      humidity: { min: 30, max: 90 },
      pressure: { min: 900, max: 1100 },
      soil_moisture: { min: 30, max: 80 },
      soil_ph: { min: 5.5, max: 7.5 },
      nitrogen: { min: 50, max: 150 },
      phosphorus: { min: 20, max: 80 },
      potassium: { min: 50, max: 200 },
      light_lux: { min: 2000, max: 100000 },
      is_raining: { min: 0, max: 0.5 }
    };
    
    if (!rules[type]) return 'normal';
    
    if (val < rules[type].min || val > rules[type].max) {
      if (['nitrogen', 'phosphorus', 'potassium'].includes(type) && val < rules[type].min) {
        return 'warning';
      }
      return 'alert';
    }
    return 'normal';
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('farm:dashboard.title', 'Farm Dashboard')} />

      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.statusRow}>
          <CustomText variant="caption" color={connectionStatus === 'online' ? theme.colors.primary : theme.colors.error}>
            {t('farm:dashboard.nodeStatus', 'Node Status')}: {t(`common:status.${connectionStatus}`, connectionStatus)}
          </CustomText>
        </View>

        <CustomText variant="subheading">{t('farm:dashboard.atmosphere', 'Atmosphere')}</CustomText>
        <Spacer size="sm" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
          <SensorStatusCard style={styles.cardItem} title={t('farm:dashboard.temperature', 'Temperature')} value={sensorData.temperature} unit="°C" iconName="thermometer-outline" status={checkAlert('temperature', sensorData.temperature)} />
          <SensorStatusCard style={styles.cardItem} title={t('farm:dashboard.humidity', 'Humidity')} value={sensorData.humidity} unit="%" iconName="water-outline" status={checkAlert('humidity', sensorData.humidity)} />
          <SensorStatusCard style={styles.cardItem} title={t('farm:dashboard.pressure', 'Pressure')} value={sensorData.pressure} unit="hPa" iconName="speedometer-outline" status={checkAlert('pressure', sensorData.pressure)} />
          <SensorStatusCard style={styles.cardItem} title={t('farm:dashboard.light', 'Light')} value={sensorData.light_lux} unit="lx" iconName="sunny-outline" status={checkAlert('light_lux', sensorData.light_lux)} />
          <SensorStatusCard style={styles.cardItem} title={t('farm:dashboard.rain', 'Rain Detected')} value={sensorData.is_raining ? t('common:yes', 'Yes') : t('common:no', 'No')} unit="" iconName="rainy-outline" status={checkAlert('is_raining', sensorData.is_raining)} />
        </ScrollView>

        <Spacer size="md" />

        <CustomText variant="subheading">{t('farm:dashboard.soilHealth', 'Soil Health')}</CustomText>
        <Spacer size="sm" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
          <SensorStatusCard style={styles.cardItem} title={t('farm:dashboard.moisture', 'Moisture')} value={sensorData.soil_moisture} unit="%" iconName="leaf-outline" status={checkAlert('soil_moisture', sensorData.soil_moisture)} />
          <SensorStatusCard style={styles.cardItem} title={t('farm:dashboard.ph', 'pH Level')} value={sensorData.soil_ph} unit="pH" iconName="flask-outline" status={checkAlert('soil_ph', sensorData.soil_ph)} />
          <SensorStatusCard style={styles.cardItem} title={t('farm:dashboard.nitrogen', 'Nitrogen')} value={sensorData.nitrogen} unit="mg/kg" iconName="color-fill-outline" status={checkAlert('nitrogen', sensorData.nitrogen)} />
          <SensorStatusCard style={styles.cardItem} title={t('farm:dashboard.phosphorus', 'Phosphorus')} value={sensorData.phosphorus} unit="mg/kg" iconName="color-fill-outline" status={checkAlert('phosphorus', sensorData.phosphorus)} />
          <SensorStatusCard style={styles.cardItem} title={t('farm:dashboard.potassium', 'Potassium')} value={sensorData.potassium} unit="mg/kg" iconName="color-fill-outline" status={checkAlert('potassium', sensorData.potassium)} />
        </ScrollView>

        {weatherData && (
          <>
            <Spacer size="md" />
            <CustomText variant="subheading">{t('farm:dashboard.liveWeather', 'Live Weather')}</CustomText>
            <Spacer size="sm" />
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
                  <Ionicons 
                    name={
                      weatherData.weather[0]?.main?.toLowerCase().includes('cloud') ? 'cloudy-outline' :
                      weatherData.weather[0]?.main?.toLowerCase().includes('rain') ? 'rainy-outline' :
                      'partly-sunny-outline'
                    } 
                    size={40} 
                    color={theme.colors.primary} 
                    style={{ marginRight: 12 }} 
                  />
                  <View>
                    <CustomText variant="heading">{Math.round(weatherData.main.temp)}°C</CustomText>
                    <CustomText variant="caption" color={theme.colors.textLight}>
                      {weatherData.weather[0]?.description.toUpperCase()}
                    </CustomText>
                  </View>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end', paddingLeft: 10 }}>
                  <CustomText variant="body" style={{ flexShrink: 1, textAlign: 'right', flexWrap: 'wrap' }}>{t('farm:dashboard.humidity', 'Humidity')}: {weatherData.main.humidity}%</CustomText>
                  <CustomText variant="body" style={{ flexShrink: 1, textAlign: 'right', flexWrap: 'wrap' }}>{t('farm:dashboard.feelsLike', 'Feels Like')}: {Math.round(weatherData.main.feels_like)}°C</CustomText>
                </View>
              </View>
            </Card>
          </>
        )}

        <Spacer size="lg" />

        <Card>
          <CustomText variant="subheading">{t('farm:dashboard.activeFields', 'Active Fields')}</CustomText>
          <Spacer size="sm" />
          <View style={styles.mapWrapper}>
            <MapContainer
              readOnly={true}
              selectedLocation={selectedLocation}
              polygonPoints={previewPolygon}
              center={selectedLocation}
              zoom={14}
            />
          </View>
        </Card>

        <Spacer size="lg" />

        {ndviData && (
          <>
            <Card>
              <CustomText variant="subheading">{t('farm:dashboard.ndviTitle', 'Vegetation Health (NDVI)')}</CustomText>
              <Spacer size="sm" />
              <View style={styles.ndviHeroOuter}>
                <View style={styles.ndviHeroInner}>
                  <CustomText style={styles.ndviHeroTitle} color={theme.colors.white}>
                    {ndviLabel}
                  </CustomText>
                  <CustomText style={styles.ndviHeroValue} color={theme.colors.white}>
                    {clampedNdvi.toFixed(2)}
                  </CustomText>
                  <CustomText style={styles.ndviHeroSubtitle} color={theme.colors.white}>
                    {t('farm:dashboard.ndviScoreLabel', 'NDVI score')}
                  </CustomText>
                  <View style={styles.ndviBarTrack}>
                    <View style={[styles.ndviBarFill, { width: `${Math.max(6, confidencePercent)}%` }]} />
                  </View>
                  <CustomText style={styles.ndviConfidence} color={theme.colors.white}>
                    {confidencePercent}% {t('farm:dashboard.vegHealthConfidenceSuffix', 'vegetation health confidence')}
                  </CustomText>
                </View>
              </View>
              <Spacer size="md" />
              <View style={styles.ndviFooterRow}>
                <View>
                  <CustomText style={styles.ndviFooterScore} color={theme.colors.primary}>
                    {healthScore}%
                  </CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>
                    {t('farm:dashboard.healthScore', 'Health Score')}
                  </CustomText>
                </View>
                <View style={styles.ndviFooterRight}>
                  <CustomText variant="body" weight="bold">
                    {providerLabel}
                  </CustomText>
                  <CustomText variant="caption" color={theme.colors.textLight}>
                    {t('farm:dashboard.observedPrefix', 'Observed:')} {observedLabel}
                  </CustomText>
                </View>
              </View>
            </Card>
            <Spacer size="lg" />
          </>
        )}

        <CustomText variant="subheading">{t('farm:dashboard.upcomingTasks', 'Upcoming Tasks')}</CustomText>
        <Spacer size="sm" />
        {recentTasks.map(task => (
          <TaskCard key={task.id} title={task.title} description={task.description} date={task.date} priority={task.priority} />
        ))}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md },
  statusRow: { marginBottom: theme.spacing.sm, alignItems: 'flex-end' },
  scrollRow: { paddingBottom: theme.spacing.xs, paddingRight: theme.spacing.md },
  cardItem: { width: 140, marginRight: theme.spacing.md },
  mapWrapper: { height: 150, borderRadius: theme.radius.md, overflow: 'hidden' },
  ndviHeroOuter: { backgroundColor: '#0D1B14', borderRadius: theme.radius.md, padding: theme.spacing.sm },
  ndviHeroInner: { backgroundColor: '#1B5E20', borderRadius: theme.radius.md, padding: theme.spacing.lg },
  ndviHeroTitle: { fontSize: 16, fontWeight: theme.typography.weights.semiBold, opacity: 0.95 },
  ndviHeroValue: { fontSize: 44, fontWeight: theme.typography.weights.bold, lineHeight: 48, marginTop: theme.spacing.xs },
  ndviHeroSubtitle: { fontSize: 12, fontWeight: theme.typography.weights.semiBold, opacity: 0.9, marginTop: theme.spacing.xs },
  ndviBarTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: theme.spacing.md, overflow: 'hidden' },
  ndviBarFill: { height: 10, borderRadius: 999, backgroundColor: theme.colors.white },
  ndviConfidence: { fontSize: 12, fontWeight: theme.typography.weights.semiBold, marginTop: theme.spacing.sm, opacity: 0.95 },
  ndviFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  ndviFooterRight: { alignItems: 'flex-end' },
  ndviFooterScore: { fontSize: 32, fontWeight: theme.typography.weights.bold, lineHeight: 34 },
});
