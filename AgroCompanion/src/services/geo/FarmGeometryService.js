const EARTH_RADIUS_METERS = 6371008.8;

const toRadians = (value) => (value * Math.PI) / 180;

const closePolygon = (points) => {
  if (!Array.isArray(points) || points.length === 0) {
    return [];
  }

  const normalized = points.map(point => ({
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
  })).filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  if (normalized.length === 0) {
    return [];
  }

  const first = normalized[0];
  const last = normalized[normalized.length - 1];

  if (first.latitude === last.latitude && first.longitude === last.longitude) {
    return normalized;
  }

  return [...normalized, first];
};

const getReferenceLatitude = (points) => {
  if (!points.length) {
    return 0;
  }

  return points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
};

const projectPoint = (point, referenceLatitude) => {
  const latRad = toRadians(point.latitude);
  const lngRad = toRadians(point.longitude);
  const refLatRad = toRadians(referenceLatitude);
  const x = EARTH_RADIUS_METERS * lngRad * Math.cos(refLatRad);
  const y = EARTH_RADIUS_METERS * latRad;
  return { x, y };
};

const polygonAreaSquareMeters = (points) => {
  const closed = closePolygon(points);
  if (closed.length < 4) {
    return 0;
  }

  const referenceLatitude = getReferenceLatitude(closed);
  const projected = closed.map(point => projectPoint(point, referenceLatitude));
  let sum = 0;

  for (let index = 0; index < projected.length - 1; index += 1) {
    const current = projected[index];
    const next = projected[index + 1];
    sum += (current.x * next.y) - (next.x * current.y);
  }

  return Math.abs(sum) / 2;
};

const pointInPolygon = (point, polygonPoints) => {
  const polygon = closePolygon(polygonPoints);
  if (polygon.length < 4) {
    return false;
  }

  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersects = ((yi > point.latitude) !== (yj > point.latitude))
      && (point.longitude < ((xj - xi) * (point.latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const computeCentroid = (points) => {
  const normalized = closePolygon(points).slice(0, -1);
  if (normalized.length === 0) {
    return null;
  }

  const latitude = normalized.reduce((sum, point) => sum + point.latitude, 0) / normalized.length;
  const longitude = normalized.reduce((sum, point) => sum + point.longitude, 0) / normalized.length;
  return { latitude, longitude };
};

const computeBoundingBox = (points) => {
  const normalized = closePolygon(points).slice(0, -1);
  if (normalized.length === 0) {
    return null;
  }

  const latitudes = normalized.map(point => point.latitude);
  const longitudes = normalized.map(point => point.longitude);

  return {
    minLat: Math.min(...latitudes),
    minLng: Math.min(...longitudes),
    maxLat: Math.max(...latitudes),
    maxLng: Math.max(...longitudes),
  };
};

const toGeoJsonPolygon = (points) => {
  const closed = closePolygon(points);
  if (closed.length < 4) {
    return null;
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        closed.map(point => [point.longitude, point.latitude]),
      ],
    },
  };
};

const hashString = (value) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

export const FarmGeometryService = {
  normalizePolygonPoints: (points) => closePolygon(points).slice(0, -1),

  validatePolygon: (points, selectedPoint = null) => {
    const normalized = closePolygon(points).slice(0, -1);
    if (normalized.length < 3) {
      return { isValid: false, reason: 'Polygon must have at least 3 points.' };
    }

    if (selectedPoint && !pointInPolygon(selectedPoint, normalized)) {
      return { isValid: false, reason: 'Selected farm location must stay inside the farm boundary.' };
    }

    return { isValid: true, reason: '' };
  },

  closePolygon,
  pointInPolygon,
  computeCentroid,
  computeBoundingBox,

  computeAreaHectares: (points) => polygonAreaSquareMeters(points) / 10000,

  toGeoJsonPolygon,

  hashPolygon: (geoJsonFeature) => {
    if (!geoJsonFeature) {
      return '';
    }
    return hashString(JSON.stringify(geoJsonFeature.geometry || geoJsonFeature));
  },
};
