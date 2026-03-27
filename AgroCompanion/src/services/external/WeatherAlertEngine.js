import { EventBusService } from '../EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';

const WEATHER_THRESHOLDS = {
  tempMax: 38,
  tempMin: 10,
  rainVolume: 50,
  windSpeed: 20
};

export const WeatherAlertEngine = {
  analyzeForecast: (forecastData) => {
    if (!forecastData || !forecastData.list) return;

    const alerts = [];

    forecastData.list.forEach(item => {
      const temp = item.main.temp;
      const rain = item.rain ? item.rain['3h'] : 0;
      const wind = item.wind.speed;

      if (temp > WEATHER_THRESHOLDS.tempMax) {
        alerts.push({ type: 'HEAT_WAVE', severity: 'HIGH', value: temp, time: item.dt_txt });
      }
      if (temp < WEATHER_THRESHOLDS.tempMin) {
        alerts.push({ type: 'FROST_WARNING', severity: 'HIGH', value: temp, time: item.dt_txt });
      }
      if (rain > WEATHER_THRESHOLDS.rainVolume) {
        alerts.push({ type: 'HEAVY_RAIN', severity: 'MEDIUM', value: rain, time: item.dt_txt });
      }
      if (wind > WEATHER_THRESHOLDS.windSpeed) {
        alerts.push({ type: 'HIGH_WIND', severity: 'MEDIUM', value: wind, time: item.dt_txt });
      }
    });

    if (alerts.length > 0) {
      EventBusService.publish(EVENT_TOPICS.WEATHER_ALERT_CREATED, alerts);
    }
  }
};