import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Button } from '../components/atomic/Button';
import { CustomText } from '../components/atomic/CustomText';
import { InputField } from '../components/molecule/InputField';
import { MapContainer } from '../components/map/MapContainer';
import { useUserSessionStore } from '../store';
import { showAlert } from '../utils/alert';
import { theme } from '../theme';
import { GeoSearchService } from '../services/geo/GeoSearchService';
import { FarmGeometryService } from '../services/geo/FarmGeometryService';
import { FarmSetupService } from '../services/FarmSetupService';

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

export const FarmSetupScreen = ({ navigation }) => {
  const currentUser = useUserSessionStore(state => state.currentUser);
  const currentFarm = useUserSessionStore(state => state.currentFarm);
  const setCurrentFarm = useUserSessionStore(state => state.setCurrentFarm);

  const [farmName, setFarmName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [drawMode, setDrawMode] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');

  const FARM_NAME_MAX_LENGTH = 80;

  useEffect(() => {
    if (!currentFarm) {
      return;
    }

    setFarmName(currentFarm.name || '');
    const locationPoint = parseJson(currentFarm.locationPointJson, null);
    const geoJson = parseJson(currentFarm.boundaryGeoJson, null);
    const legacyPolygon = parseJson(currentFarm.plotBoundaries, []);
    const geoPolygon = Array.isArray(geoJson?.geometry?.coordinates?.[0])
      ? geoJson.geometry.coordinates[0].slice(0, -1).map(([longitude, latitude]) => ({ latitude, longitude }))
      : [];
    const polygon = geoPolygon.length ? geoPolygon : Array.isArray(legacyPolygon) ? legacyPolygon : [];

    if (locationPoint) {
      setSelectedLocation(locationPoint);
      setMapCenter({ latitude: locationPoint.latitude, longitude: locationPoint.longitude });
    }

    if (polygon.length >= 3) {
      setPolygonPoints(polygon);
    }
  }, [currentFarm]);

  const polygonArea = useMemo(() => FarmGeometryService.computeAreaHectares(polygonPoints), [polygonPoints]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      showAlert('Search required', 'Enter a location to search.');
      return;
    }

    setIsSearching(true);
    try {
      const results = await GeoSearchService.searchPlaces(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        showAlert('No results', 'No location matched your search.');
      }
    } catch (error) {
      showAlert('Search failed', 'Unable to search for that location right now.');
    } finally {
      setIsSearching(false);
    }
  };

  const applySelectedLocation = (location) => {
    setSelectedLocation(location);
    setMapCenter({ latitude: location.latitude, longitude: location.longitude });
    setSearchResults([]);
    setPolygonPoints([]);
    setDrawMode(false);
  };

  const handleMapPointSelected = (event) => {
    const coordinate = event?.nativeEvent?.coordinate;
    if (!coordinate) {
      return;
    }

    applySelectedLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      label: `Dropped pin (${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)})`,
      address: '',
      source: 'map',
    });
  };

  const handlePolygonTap = (event) => {
    const coordinate = event?.nativeEvent?.coordinate;
    if (!coordinate) {
      return;
    }

    if (!selectedLocation) {
      showAlert('Location required', 'Select the farm location before drawing the boundary.');
      return;
    }

    setPolygonPoints(prev => [...prev, coordinate]);
  };

  const handleUndoPoint = () => {
    setPolygonPoints(prev => prev.slice(0, -1));
  };

  const handleClearBoundary = () => {
    setPolygonPoints([]);
    setDrawMode(false);
  };

  const handleSaveFarm = async () => {
    if (!currentUser?.id) {
      showAlert('User missing', 'Please log in again before saving the farm.');
      return;
    }

    if (!farmName.trim()) {
      showAlert('Farm name required', 'Please enter a farm name.');
      return;
    }

    if (!selectedLocation) {
      showAlert('Location required', 'Select a farm location on the map or from search.');
      return;
    }

    const validation = FarmGeometryService.validatePolygon(polygonPoints, selectedLocation);
    if (!validation.isValid) {
      showAlert('Boundary required', validation.reason);
      return;
    }

    setIsSaving(true);
    try {
      setStatusText('Saving farm geometry...');
      const savedFarm = await FarmSetupService.saveFarmSetup({
        currentFarm,
        userId: currentUser.id,
        farmName,
        locationPoint: selectedLocation,
        polygonPoints,
      });
      setCurrentFarm(savedFarm);

      if (Number(savedFarm.boundaryAreaHectares) <= 0.001) {
        showAlert('Area too small', 'The drawn boundary has a near-zero area. Please draw a larger boundary around your farm.');
        setIsSaving(false);
        setStatusText('');
        return;
      }

      if (savedFarm.contextStatus !== 'ready') {
        showAlert(
          'Analysis incomplete',
          'Your farm was saved, but district analysis did not complete. Some features may be limited. You can retry from the Session Select screen.'
        );
      }

      setStatusText('Farm analysis completed.');
      navigation.replace('SessionSelect');
    } catch (error) {
      showAlert('Save failed', error.message || 'Unable to save the farm details.');
    } finally {
      setIsSaving(false);
      setStatusText('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText variant="h1" style={styles.title}>Set Up Your Farm</CustomText>
        <InputField
          label="Farm Name"
          placeholder="e.g. Green Valley Farm"
          value={farmName}
          onChangeText={(text) => setFarmName(text.slice(0, FARM_NAME_MAX_LENGTH))}
          maxLength={FARM_NAME_MAX_LENGTH}
        />

        <CustomText variant="h3" style={styles.sectionTitle}>Search Location</CustomText>
        <InputField
          label="Search"
          placeholder="Search for a village, district, or place"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.buttonRow}>
          <Button title={isSearching ? 'Searching...' : 'Search'} onPress={handleSearch} disabled={isSearching} />
        </View>

        {searchResults.length > 0 ? (
          <View style={styles.searchResults}>
            {searchResults.map(result => (
              <Pressable
                key={result.id}
                style={({ pressed }) => [styles.searchResult, pressed ? styles.searchResultPressed : null]}
                onPress={() => applySelectedLocation({
                  latitude: result.latitude,
                  longitude: result.longitude,
                  label: result.label,
                  address: result.label,
                  source: 'search',
                })}
              >
                <CustomText variant="body">{result.label}</CustomText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <CustomText variant="h3" style={styles.sectionTitle}>Location and Boundary</CustomText>
        <View style={styles.mapWrapper}>
          <MapContainer
            style={styles.map}
            onPointSelected={handleMapPointSelected}
            onPolygonTap={handlePolygonTap}
            selectedLocation={selectedLocation}
            polygonPoints={polygonPoints}
            drawMode={drawMode}
            center={mapCenter}
            zoom={selectedLocation ? 15 : 5}
          />
        </View>

        <CustomText variant="caption" style={styles.helperText}>
          {selectedLocation
            ? `Selected location: ${selectedLocation.label || `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`}`
            : 'Tap the map or search for the farm location. A red marker appears on the selected point.'}
        </CustomText>

        <View style={styles.buttonRow}>
          <Button
            title={drawMode ? 'Boundary Mode Active' : 'Draw Boundary'}
            variant={drawMode ? 'primary' : 'secondary'}
            onPress={() => {
              if (!selectedLocation) {
                showAlert('Location required', 'Select the farm location before drawing the boundary.');
                return;
              }
              setDrawMode(prev => !prev);
            }}
          />
        </View>

        <View style={styles.inlineActions}>
          <Button title="Undo Last Point" variant="secondary" onPress={handleUndoPoint} disabled={!polygonPoints.length} style={[styles.inlineButton, styles.inlineButtonSpacing]} />
          <Button title="Clear Boundary" variant="secondary" onPress={handleClearBoundary} disabled={!polygonPoints.length} style={styles.inlineButton} />
        </View>

        <CustomText variant="caption" style={styles.helperText}>
          {polygonPoints.length >= 3
            ? `Boundary points: ${polygonPoints.length} | Approximate area: ${polygonArea.toFixed(2)} ha`
            : 'Enable boundary mode, then tap the map to add boundary points around the farm.'}
        </CustomText>

        {isSaving ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <CustomText variant="body" style={styles.loadingText}>{statusText || 'Saving farm...'}</CustomText>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Button title={currentFarm ? 'Update Farm Setup' : 'Create Farm'} onPress={handleSaveFarm} disabled={isSaving} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  title: {
    color: theme.colors.primary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    color: theme.colors.textMain,
  },
  mapWrapper: {
    height: 320,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  map: {
    height: 320,
  },
  helperText: {
    color: theme.colors.textLight,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  buttonRow: {
    marginBottom: theme.spacing.sm,
  },
  inlineActions: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  inlineButton: {
    flex: 1,
  },
  inlineButtonSpacing: {
    marginRight: theme.spacing.sm,
  },
  searchResults: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.md,
  },
  searchResult: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchResultPressed: {
    opacity: 0.85,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textLight,
  },
  footer: {
    marginTop: theme.spacing.lg,
  },
});
