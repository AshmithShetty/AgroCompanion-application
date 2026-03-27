import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { theme } from '../../theme';

const DEFAULT_CENTER = { latitude: 20.5937, longitude: 78.9629 };

const buildMapHtml = (serializedInitialState) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
    body { overflow: hidden; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${DEFAULT_CENTER.latitude}, ${DEFAULT_CENTER.longitude}], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    var marker = null;
    var polygon = null;
    var state = {
      selectedLocation: null,
      polygonPoints: [],
      drawMode: false,
      readOnly: false,
      center: null,
      zoom: null,
    };
    try {
      var parsedInitialState = JSON.parse(${JSON.stringify(serializedInitialState)});
      if (parsedInitialState && parsedInitialState.type === 'syncState') {
        state = {
          selectedLocation: parsedInitialState.selectedLocation || null,
          polygonPoints: Array.isArray(parsedInitialState.polygonPoints) ? parsedInitialState.polygonPoints : [],
          drawMode: Boolean(parsedInitialState.drawMode),
          readOnly: Boolean(parsedInitialState.readOnly),
          center: parsedInitialState.center || null,
          zoom: typeof parsedInitialState.zoom === 'number' ? parsedInitialState.zoom : null,
        };
      }
    } catch (error) {}

    function postMessage(message) {
      var serialized = JSON.stringify(message);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(serialized);
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(serialized, '*');
      }
    }

    function setMarker(location) {
      if (!location) {
        if (marker) {
          map.removeLayer(marker);
          marker = null;
        }
        return;
      }

      var latLng = [location.latitude, location.longitude];
      if (marker) {
        marker.setLatLng(latLng);
      } else {
        marker = L.circleMarker(latLng, {
          radius: 9,
          fillColor: '#D32F2F',
          color: '#FFFFFF',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.95
        }).addTo(map);
      }
    }

    function setPolygon(points) {
      if (polygon) {
        map.removeLayer(polygon);
        polygon = null;
      }

      if (!points || points.length < 3) {
        return;
      }

      polygon = L.polygon(points.map(function(point) {
        return [point.latitude, point.longitude];
      }), {
        color: '#2E7D32',
        weight: 2,
        fillColor: '#66BB6A',
        fillOpacity: 0.22
      }).addTo(map);
    }

    function applyState(nextState) {
      if (!nextState || nextState.type !== 'syncState') {
        return;
      }

      state = {
        selectedLocation: nextState.selectedLocation || null,
        polygonPoints: Array.isArray(nextState.polygonPoints) ? nextState.polygonPoints : [],
        drawMode: Boolean(nextState.drawMode),
        readOnly: Boolean(nextState.readOnly),
        center: nextState.center || null,
        zoom: typeof nextState.zoom === 'number' ? nextState.zoom : null,
      };

      setMarker(state.selectedLocation);
      setPolygon(state.polygonPoints);

      if (state.center && typeof state.center.latitude === 'number' && typeof state.center.longitude === 'number') {
        map.setView([state.center.latitude, state.center.longitude], state.zoom || map.getZoom(), { animate: false });
      } else if (state.selectedLocation) {
        map.setView([state.selectedLocation.latitude, state.selectedLocation.longitude], state.zoom || 15, { animate: false });
      } else if (state.polygonPoints.length >= 3 && polygon) {
        map.fitBounds(polygon.getBounds(), { padding: [20, 20] });
      }
    }

    window.addEventListener('message', function(event) {
      try {
        var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        applyState(data);
      } catch (error) {}
    });

    map.on('click', function(event) {
      if (state.readOnly) {
        return;
      }

      var coordinate = {
        latitude: event.latlng.lat,
        longitude: event.latlng.lng
      };

      if (state.drawMode) {
        postMessage({ type: 'polygonTap', coordinate: coordinate });
        return;
      }

      postMessage({ type: 'pointSelected', coordinate: coordinate });
    });

    applyState({ type: 'syncState', selectedLocation: state.selectedLocation, polygonPoints: state.polygonPoints, drawMode: state.drawMode, readOnly: state.readOnly, center: state.center, zoom: state.zoom });
    postMessage({ type: 'mapReady' });
  <\/script>
</body>
</html>
`;

const getMapPayload = ({ selectedLocation, polygonPoints, drawMode, readOnly, center, zoom }) => JSON.stringify({
  type: 'syncState',
  selectedLocation,
  polygonPoints,
  drawMode,
  readOnly,
  center,
  zoom,
});

const WebMap = ({ style, onMapMessage, mapPayload }) => {
  const iframeRef = useRef(null);
  const htmlSource = useMemo(() => {
    const blob = new Blob([buildMapHtml(mapPayload)], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [mapPayload]);

  useEffect(() => () => {
    URL.revokeObjectURL(htmlSource);
  }, [htmlSource]);

  useEffect(() => {
    const handler = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        onMapMessage?.(data);
      } catch (error) {}
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMapMessage]);

  return (
    <View style={[styles.container, style]}>
      <iframe
        ref={iframeRef}
        src={htmlSource}
        style={styles.webFrame}
        title="Farm Map"
      />
    </View>
  );
};

const NativeMap = ({ style, onMapMessage, mapPayload }) => {
  const WebView = require('react-native-webview').WebView;
  const webViewRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const htmlSource = useMemo(() => ({ html: buildMapHtml(mapPayload) }), [mapPayload]);

  useEffect(() => {
    if (!isLoaded || !webViewRef.current) {
      return;
    }

    const injected = `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(mapPayload)} })); true;`;
    webViewRef.current.injectJavaScript(injected);
  }, [isLoaded, mapPayload]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={htmlSource}
        key={mapPayload}
        style={styles.map}
        onMessage={(event) => {
          try {
            onMapMessage?.(JSON.parse(event.nativeEvent.data));
          } catch (error) {}
        }}
        onLoadEnd={() => setIsLoaded(true)}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        scrollEnabled={false}
        nestedScrollEnabled={false}
      />
    </View>
  );
};

export const MapContainer = ({
  style,
  onPress,
  onPointSelected,
  onPolygonTap,
  selectedLocation = null,
  polygonPoints = [],
  drawMode = false,
  center = null,
  zoom = null,
  readOnly = false,
}) => {
  const mapPayload = useMemo(() => getMapPayload({
    selectedLocation,
    polygonPoints,
    drawMode,
    readOnly,
    center,
    zoom,
  }), [center, drawMode, polygonPoints, readOnly, selectedLocation, zoom]);

  const handleMapMessage = (message) => {
    if (!message || !message.type) {
      return;
    }

    if (message.type === 'pointSelected') {
      const event = { nativeEvent: { coordinate: message.coordinate } };
      if (onPointSelected) {
        onPointSelected(event);
      } else if (onPress) {
        onPress(event);
      }
      return;
    }

    if (message.type === 'polygonTap') {
      onPolygonTap?.({ nativeEvent: { coordinate: message.coordinate } });
    }
  };

  if (Platform.OS === 'web') {
    return <WebMap style={style} onMapMessage={handleMapMessage} mapPayload={mapPayload} />;
  }

  return <NativeMap style={style} onMapMessage={handleMapMessage} mapPayload={mapPayload} />;
};

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  webFrame: {
    width: '100%',
    height: '100%',
    border: 'none',
    borderRadius: theme.radius.lg,
  },
});
