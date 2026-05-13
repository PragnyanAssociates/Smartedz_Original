// src/utils/routeHelper.js
import polyline from '@mapbox/polyline';

// OSRM API for road routing (HTTPS for web compatibility)
const OSRM_API_URL = 'https://router.project-osrm.org/route/v1/driving/';

export const getRoadPath = async (stops) => {
  // Need at least 2 stops to make a path
  if (!stops || stops.length < 2) {
    return [];
  }

  try {
    // Format: "Lng,Lat;Lng,Lat" (OSRM requires Longitude first)
    const coordinatesString = stops
      .map((stop) => {
        const lat = parseFloat(stop.stop_lat);
        const lng = parseFloat(stop.stop_lng);
        // Skip invalid coordinates
        if (isNaN(lat) || isNaN(lng)) return null;
        return `${lng},${lat}`;
      })
      .filter(Boolean) // Remove nulls
      .join(';');

    if (!coordinatesString) {
      return [];
    }

    // Fetch route from OSRM
    const response = await fetch(
      `${OSRM_API_URL}${coordinatesString}?overview=full&geometries=polyline`
    );

    if (!response.ok) {
      console.warn('OSRM Request Failed:', response.status);
      return [];
    }

    const json = await response.json();

    if (json.routes && json.routes.length > 0) {
      // Decode polyline into [lat, lng] coordinates
      const points = polyline.decode(json.routes[0].geometry);
      
      // Convert to MapLibre format: [lng, lat]
      return points.map((point) => [point[1], point[0]]);
    }

    return [];
  } catch (error) {
    console.error('OSRM Route Error:', error);
    return [];
  }
};