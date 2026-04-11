const toDateKey = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const WorkflowUtils = {
  toDateKey,

  summarizeNextHours: (forecast, hours = 24) => {
    const list = Array.isArray(forecast?.list) ? forecast.list : [];
    if (list.length === 0) {
      return { rainMm: 0, maxWind: 0, minTemp: null, maxTemp: null };
    }
    const now = Date.now();
    const until = now + Number(hours) * 60 * 60 * 1000;
    let rainMm = 0;
    let maxWind = 0;
    let minTemp = null;
    let maxTemp = null;

    for (const item of list) {
      const ts = typeof item?.dt === 'number' ? item.dt * 1000 : null;
      if (!ts || ts < now || ts > until) continue;
      const temp = Number(item?.main?.temp);
      const wind = Number(item?.wind?.speed);
      const rain = Number(item?.rain?.['3h'] || 0);
      if (Number.isFinite(rain)) rainMm += rain;
      if (Number.isFinite(wind)) maxWind = Math.max(maxWind, wind);
      if (Number.isFinite(temp)) {
        minTemp = minTemp === null ? temp : Math.min(minTemp, temp);
        maxTemp = maxTemp === null ? temp : Math.max(maxTemp, temp);
      }
    }

    return { rainMm, maxWind, minTemp, maxTemp };
  },

  pickBestWindowDate: (forecast, { maxRainMm = 1, maxWind = 6 } = {}) => {
    const list = Array.isArray(forecast?.list) ? forecast.list : [];
    for (const item of list) {
      const rain = Number(item?.rain?.['3h'] || 0);
      const wind = Number(item?.wind?.speed);
      if (Number.isFinite(rain) && rain > maxRainMm) continue;
      if (Number.isFinite(wind) && wind > maxWind) continue;
      const key = toDateKey(item?.dt_txt || (typeof item?.dt === 'number' ? item.dt * 1000 : null));
      if (key) return key;
    }
    return toDateKey(Date.now());
  },
};

