const toRadians = (value) => (value * Math.PI) / 180;

const toFixedNumber = (value, digits = 6) => Number(Number(value).toFixed(digits));

const ensureCoordinate = (point) => ({
  latitude: Number(point.latitude),
  longitude: Number(point.longitude),
});

const getProjectedPoint = (point, referenceLatitude) => {
  const earthRadius = 6378137;
  const latRad = toRadians(point.latitude);
  const lonRad = toRadians(point.longitude);
  const refRad = toRadians(referenceLatitude);

  return {
    x: earthRadius * lonRad * Math.cos(refRad),
    y: earthRadius * latRad,
  };
};

export const FarmGeometryService = {
  normalizePoints: (points = []) =>
    points
      .map(ensureCoordinate)
      .filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)),

  closePolygon: (points = []) => {
    const normalized = FarmGeometryService.normalizePoints(points);
    if (normalized.length === 0) {
      return [];
    }

    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (first.latitude === last.latitude && first.longitude === last.longitude) {
      return normalized;
    }

    return [...normalized, first];
  },

  hasMinimumPolygon: (points = []) => FarmGeometryService.normalizePoints(points).length >= 3,

  toGeoJsonPolygon: (points = []) => {
    const closed = FarmGeometryService.closePolygon(points);
    return {
      type: 'Polygon',
      coordinates: [closed.map(point => [toFixedNumber(point.longitude), toFixedNumber(point.latitude)])],
    };
  },

  getBoundingBox: (points = []) => {
    const normalized = FarmGeometryService.normalizePoints(points);
    if (!normalized.length) {
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
  },

  getCentroid: (points = []) => {
    const normalized = FarmGeometryService.normalizePoints(points);
    if (!normalized.length) {
      return null;
    }

    const sums = normalized.reduce(
      (acc, point) => ({
        latitude: acc.latitude + point.latitude,
        longitude: acc.longitude + point.longitude,
      }),
      { latitude: 0, longitude: 0 }
    );

    return {
      latitude: sums.latitude / normalized.length,
      longitude: sums.longitude / normalized.length,
    };
  },

  getAreaHectares: (points = []) => {
    const normalized = FarmGeometryService.normalizePoints(points);
    if (normalized.length < 3) {
      return 0;
    }

    const referenceLatitude =
      normalized.reduce((sum, point) => sum + point.latitude, 0) / normalized.length;
    const projected = normalized.map(point => getProjectedPoint(point, referenceLatitude));

    let area = 0;
    for (let index = 0; index < projected.length; index += 1) {
      const current = projected[index];
      const next = projected[(index + 1) % projected.length];
      area += current.x * next.y - next.x * current.y;
    }

    return Math.abs(area / 2) / 10000;
  },

  isPointInsidePolygon: (point, polygonPoints = []) => {
    const normalizedPoint = ensureCoordinate(point);
    const polygon = FarmGeometryService.normalizePoints(polygonPoints);
    if (polygon.length < 3) {
      return false;
    }

    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].longitude;
      const yi = polygon[i].latitude;
      const xj = polygon[j].longitude;
      const yj = polygon[j].latitude;

      const intersects =
        yi > normalizedPoint.latitude !== yj > normalizedPoint.latitude &&
        normalizedPoint.longitude <
          ((xj - xi) * (normalizedPoint.latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi;

      if (intersects) {
        isInside = !isInside;
      }
    }

    return isInside;
  },

  buildPolygonSummary: (points = []) => {
    const normalized = FarmGeometryService.normalizePoints(points);
    const bbox = FarmGeometryService.getBoundingBox(normalized);
    const centroid = FarmGeometryService.getCentroid(normalized);
    const areaHectares = FarmGeometryService.getAreaHectares(normalized);

    return {
      points: normalized,
      geoJson: FarmGeometryService.toGeoJsonPolygon(normalized),
      bbox,
      centroid,
      areaHectares,
      pointCount: normalized.length,
      hash: FarmGeometryService.hashPolygon(normalized),
    };
  },

  hashPolygon: (points = []) => {
    const source = JSON.stringify(
      FarmGeometryService.normalizePoints(points).map(point => [
        toFixedNumber(point.latitude),
        toFixedNumber(point.longitude),
      ])
    );
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash << 5) - hash + source.charCodeAt(index);
      hash |= 0;
    }
    return `${Math.abs(hash)}`;
  },
};
