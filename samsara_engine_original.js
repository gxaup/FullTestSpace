/**
 * Samsara Telemetry Engine
 * 
 * This module fetches real-time GPS coordinates directly from the Samsara Vehicle Stats API
 * and geometrically resolves them against a static list of physical stops to determine
 * the closest LAST VISITED stop vs the exact NEXT UPCOMING stop without relying 
 * on complex route polygons.
 */

/**
 * SAMSARA CONFIGURATION
 * ------------------------------------------------------------
 * 1. Insert your API Key below.
 * 2. Update the latitude and longitude for each of the 23 stops.
 */
const SAMSARA_CONFIG = {
  API_KEY: 'PASTE_YOUR_SAMSARA_API_KEY_HERE',
  STOPS: [
    { "id": 1, "name": "Stop 01", "lat": 40.759433036950966, "lng": -73.98454271585518 },
    { "id": 2, "name": "Stop 02", "lat": 40.7551337, "lng": -73.9878992 },
    { "id": 3, "name": "Stop 03", "lat": 40.7540893569216, "lng": -73.98240036497312 },
    { "id": 4, "name": "Stop 04", "lat": 40.74948665445104, "lng": -73.98400743844203 },
    { "id": 5, "name": "Stop 05", "lat": 40.74124988195435, "lng": -73.98986219295237 },
    { "id": 6, "name": "Stop 06", "lat": 40.72274571331615, "lng": -73.99935832990472 },
    { "id": 7, "name": "Stop 07", "lat": 40.7181918, "lng": -74.00303760489153 },
    { "id": 8, "name": "Stop 08", "lat": 40.71287778281122, "lng": -74.00761735246677 },
    { "id": 9, "name": "Stop 09", "lat": 40.70485523333685, "lng": -74.0145540134917 },
    { "id": 10, "name": "Stop 10", "lat": 40.71744280723422, "lng": -74.01266527299902 },
    { "id": 11, "name": "Stop 11", "lat": 40.728250369455836, "lng": -74.01055839970415 },
    { "id": 12, "name": "Stop 12", "lat": 40.75470897188512, "lng": -74.00641577135055 },
    { "id": 13, "name": "Stop 13", "lat": 40.761713808732345, "lng": -74.0007794063889 },
    { "id": 14, "name": "Stop 14", "lat": 40.758033819326194, "lng": -73.98907964773709 },
    { "id": 15, "name": "Stop 15", "lat": 40.7601836, "lng": -73.9874334 },
    { "id": 16, "name": "Stop 16", "lat": 40.776564036598295, "lng": -73.97567436826684 },
    { "id": 17, "name": "Stop 17", "lat": 40.781254188344924, "lng": -73.972319676628 },
    { "id": 18, "name": "Stop 18", "lat": 40.79280713927449, "lng": -73.95224754745723 },
    { "id": 19, "name": "Stop 19", "lat": 40.78358504626594, "lng": -73.95898904334892 },
    { "id": 20, "name": "Stop 20", "lat": 40.779910469854684, "lng": -73.96167300597553 },
    { "id": 21, "name": "Stop 21", "lat": 40.76826722798106, "lng": -73.9701455132616 },
    { "id": 22, "name": "Stop 22", "lat": 40.765145593895625, "lng": -73.98037615495919 },
    { "id": 23, "name": "Stop 23", "lat": 40.76127825073647, "lng": -73.98318299967468 }
  ]
};

class SamsaraEngine {
  
  static get CONFIG() {
    return SAMSARA_CONFIG;
  }
  
  /**
   * Fetches the raw GPS state of a specific vehicle from the Samsara platform.
   * @param {string} vehicleId - The specific Samsara ID of the bus
   * @param {string} accessToken - The Samsara API Token
   * @returns {Promise<{latitude: number, longitude: number, heading: number, speed: number}>}
   */
  static async fetchBusLocation(vehicleId, accessToken) {
    // Stage 1: Resolve name to ID
    const timestamp = Date.now();
    let listUrl = `https://api.samsara.com/fleet/vehicles?_cb=${timestamp}`;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      listUrl = 'https://corsproxy.io/?' + encodeURIComponent(listUrl);
    }

    try {
      const listRes = await fetch(listUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
      });

      if (!listRes.ok) throw new Error(listRes.status === 401 ? 'Invalid API Token' : `Discovery Error: ${listRes.status}`);

      const listData = await listRes.json();
      const vehicles = listData.data || [];
      console.log(`[Samsara] Fleet Discovery: Found ${vehicles.length} assets.`);

      const searchId = vehicleId.trim().toLowerCase();
      
      // Filter for all potential matches (Name, ID, or VIN)
      const possibleVehicles = vehicles.filter(v => {
        const name = (v.name || '').trim().toLowerCase();
        const id = (v.id || '').trim().toLowerCase();
        const vin = (v.vin || '').trim().toLowerCase();
        return name === searchId || id === searchId || vin === searchId;
      });

      if (possibleVehicles.length === 0) {
        console.warn(`[Samsara] No match for "${searchId}" in registry.`);
        throw new Error('Invalid Bus ID');
      }

      // SELECT THE MOST RECENT: Sort by updatedAtTime to ensure we get the live asset, not a decommissioned clone
      possibleVehicles.sort((a, b) => new Date(b.updatedAtTime || 0) - new Date(a.updatedAtTime || 0));
      const vehicleEntry = possibleVehicles[0];
      
      console.log(`[Samsara] Resolved "${searchId}" to ${vehicleEntry.name} (ID: ${vehicleEntry.id}) - Updated: ${vehicleEntry.updatedAtTime}`);

      // Stage 2: Fetch HIGH-PRECISION location for ID
      const cacheBust = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      let locUrl = `https://api.samsara.com/fleet/vehicles/locations?vehicleIds=${vehicleEntry.id}&_cb=${cacheBust}`;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        locUrl = 'https://corsproxy.io/?' + encodeURIComponent(locUrl);
      }

      const locRes = await fetch(locUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
      });

      if (!locRes.ok) throw new Error(`Latency Error: ${locRes.status}`);

      const locData = await locRes.json();
      const vehicle = (locData.data || [])[0];
      
      if (!vehicle || !vehicle.location) throw new Error('No Satellite Contact');

      const locBlock = vehicle.location;
      
      return {
        latitude: locBlock.latitude,
        longitude: locBlock.longitude,
        heading: locBlock.heading || 0,
        speed: (locBlock.speed !== undefined) ? locBlock.speed : 0,
        time: locBlock.time,
        address: locBlock.reverseGeo ? locBlock.reverseGeo.formattedLocation : "Unknown Street"
      };
    } catch (e) {
      console.error('[SamsaraEngine] Connection failed:', e);
      throw e;
    }
  }

  /**
   * Calculates the Haversine great-circle distance between two earth coordinates.
   */
  static getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
  }

  /**
   * Calculates the Vector Bearing (Angle) from A to B.
   */
  static getBearingDegrees(startLat, startLng, destLat, destLng) {
    const startLatRad = startLat * Math.PI / 180;
    const startLngRad = startLng * Math.PI / 180;
    const destLatRad = destLat * Math.PI / 180;
    const destLngRad = destLng * Math.PI / 180;

    const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
              Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
              
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; 
  }

  /**
   * Compares the bus telemetry against all known stops.
   * Returns human-readable nearest stop and the next upcoming stop.
   * 
   * @param {Object} busGps - { latitude, longitude, heading }
   * @param {Array} routeStops - Array of objects with at least: { name, lat, lng }
  /**
   * Compares the bus telemetry against known stops using Orbital Route Logic.
   * Segments stops into Downtown (1-14) and Uptown (15-23) loops.
   * 
   * @param {Object} busGps - { latitude, longitude, heading }
   * @param {Array} routeStops - Array of objects with at least: { id, name, lat, lng }
   */
  static resolveRouteContext(busGps, routeStops) {
    // 1. First, find the ABSOLUTE closest stop to determine the current Route Cluster
    const allStopsWithDist = routeStops.map(stop => ({
      ...stop,
      distanceMeters: this.getDistanceMeters(busGps.latitude, busGps.longitude, stop.lat, stop.lng)
    }));
    
    allStopsWithDist.sort((a, b) => a.distanceMeters - b.distanceMeters);
    const absoluteClosest = allStopsWithDist[0];
    
    // 2. Identify active cluster (Downtown 1-14 vs Uptown 15-23)
    // Using ID ranges as the source of truth for the loop
    const isDowntown = absoluteClosest.id <= 14;
    const activeCluster = isDowntown 
      ? allStopsWithDist.filter(s => s.id <= 14)
      : allStopsWithDist.filter(s => s.id > 14);

    console.log(`[RouteEngine] Detected Loop: ${isDowntown ? 'DOWNTOWN' : 'UPTOWN'} (Locked to ${activeCluster.length} nodes)`);

    // 3. Resolve Last/Upcoming based ONLY on the active cluster
    let analyzedStops = activeCluster.map(stop => {
      const bearingToStop = this.getBearingDegrees(busGps.latitude, busGps.longitude, stop.lat, stop.lng);
      
      // Calculate angular drift
      let angleDiff = Math.abs(busGps.heading - bearingToStop);
      if (angleDiff > 180) angleDiff = 360 - angleDiff;
      
      // Geometric "Behind" check
      const isBehind = angleDiff > 90; 

      return { 
        ...stop, 
        bearingToStop: bearingToStop,
        isBehind: isBehind 
      };
    });

    // 4. Extract context
    // Sort within cluster by distance to ensure we find the closest one ahead/behind
    analyzedStops.sort((a, b) => a.distanceMeters - b.distanceMeters);
    
    const lastVisited = analyzedStops.find(s => s.isBehind) || null;
    const upcoming = analyzedStops.find(s => !s.isBehind) || null;

    return {
      route: isDowntown ? 'Downtown' : 'Uptown',
      absoluteClosest,
      lastVisited,
      upcoming,
      rawAnalysis: analyzedStops 
    };
  }

  /**
   * Fetches the closest active buses to a given coordinate.
   * @param {number} lat - Latitude of the stop
   * @param {number} lng - Longitude of the stop
   * @param {string} accessToken - Samsara API Token
   * @param {number} limit - Number of closest buses to return (default: 2)
   */
  static async findBusesNearStop(lat, lng, accessToken, limit = 3) {
    const timestamp = Date.now();
    let listUrl = `https://api.samsara.com/fleet/vehicles?_cb=${timestamp}`;
    let locUrl = `https://api.samsara.com/fleet/vehicles/locations?_cb=${timestamp}`;
    
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      listUrl = 'https://corsproxy.io/?' + encodeURIComponent(listUrl);
      locUrl = 'https://corsproxy.io/?' + encodeURIComponent(locUrl);
    }

    try {
      // 1. Fetch Fleet Roster to get Names mapping
      const listRes = await fetch(listUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
      });
      if (!listRes.ok) throw new Error('Fleet Discovery Error');
      const listData = await listRes.json();
      const vehicles = listData.data || [];
      
      const nameMap = {};
      vehicles.forEach(v => {
        nameMap[v.id] = v.name || 'Unknown Bus';
      });

      // 2. Fetch all locations
      const locRes = await fetch(locUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
      });
      if (!locRes.ok) throw new Error('Location API Error');
      const locData = await locRes.json();
      const activeLocations = locData.data || [];

      // 3. Calculate distance to Stop for each vehicle
      let busesWithDistance = [];
      activeLocations.forEach(v => {
        if (!v.location) return;
        const busName = nameMap[v.id] || v.name || v.id;
        const distance = this.getDistanceMeters(lat, lng, v.location.latitude, v.location.longitude);
        
        // Filter out stale coordinates (older than 10 minutes)
        const diffMins = Math.floor(Math.abs(Date.now() - new Date(v.location.time).getTime()) / 60000);
        if (diffMins > 10) return; // Skip severely stale buses

        busesWithDistance.push({
          id: v.id,
          name: busName,
          latitude: v.location.latitude,
          longitude: v.location.longitude,
          heading: v.location.heading || 0,
          speed: v.location.speed || 0,
          time: v.location.time,
          address: v.location.reverseGeo ? v.location.reverseGeo.formattedLocation : "Unknown Location",
          distanceToStop: distance
        });
      });

      busesWithDistance.sort((a, b) => a.distanceToStop - b.distanceToStop);
      
      return busesWithDistance.slice(0, limit);
      
    } catch(e) {
      console.error('[SamsaraEngine] Error in findBusesNearStop:', e);
      throw e;
    }
  }

}

// ==========================================
// TEST MOCK DATA - Usage Example
// ==========================================
/*
(async () => {
    try {
        // Assume you have this list matching your Topview Logger stops
        const myStops = [
            { name: "Times Square", lat: 40.7580, lng: -73.9855 },
            { name: "Penn Station", lat: 40.7506, lng: -73.9935 },
            { name: "Central Park Zoo", lat: 40.7670, lng: -73.9740 }
        ];

        // 1. Fetch live telemetry for Bus ID 4205
        // const liveBus = await SamsaraEngine.fetchBusLocation('4205'); 

        // Simulated Response: Bus heading South down 7th Ave from Central Park
        const mockedLiveBus = {
            latitude: 40.7630, 
            longitude: -73.9780,
            heading: 210, // Driving roughly South-West
            speed: 15
        };

        // 2. Run the math engine
        const context = SamsaraEngine.resolveRouteContext(mockedLiveBus, myStops);

        console.log(`CURRENT TARGET: The bus is driving towards ${context.upcoming.name} (Distance: ${Math.round(context.upcoming.distanceMeters)}m)`);
        console.log(`PREVIOUS STOP: It already passed ${context.lastVisited.name} (Distance: ${Math.round(context.lastVisited.distanceMeters)}m behind)`);

    } catch(err) {
        console.error(err);
    }
})();
*/
window.SamsaraEngine = SamsaraEngine;
