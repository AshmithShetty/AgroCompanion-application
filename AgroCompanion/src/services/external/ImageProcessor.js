export const ImageProcessor = {
  applyGeoJSONMask: (imageUrl, geoJsonPolygon) => {
    if (!geoJsonPolygon || !geoJsonPolygon.coordinates) {
      return imageUrl;
    }

    const coords = geoJsonPolygon.coordinates[0];
    const geometryString = coords.map(coord => `${coord[0]},${coord[1]}`).join(';');
    
    return `${imageUrl}&geometry=${geometryString}`;
  }
};