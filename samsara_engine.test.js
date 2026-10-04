import { describe, it, expect } from 'vitest';
import SamsaraEngine from './samsara_engine.js';

describe('SamsaraEngine Math Utils', () => {
  it('should calculate distance correctly (Haversine)', () => {
    // Times Square to Penn Station ~ 1.1km
    const ts = { lat: 40.7580, lng: -73.9855 };
    const ps = { lat: 40.7506, lng: -73.9935 };
    const dist = SamsaraEngine.getDistanceMeters(ts.lat, ts.lng, ps.lat, ps.lng);
    expect(dist).toBeGreaterThan(1000);
    expect(dist).toBeLessThan(1300);
  });

  it('should calculate bearing correctly', () => {
    // North: 0 deg
    const bNorth = SamsaraEngine.getBearingDegrees(40, -74, 41, -74);
    expect(bNorth).toBeCloseTo(0, 0);

    // East: 90 deg
    const bEast = SamsaraEngine.getBearingDegrees(40, -74, 40, -73);
    expect(bEast).toBeCloseTo(90, 0);

    // South: 180 deg
    const bSouth = SamsaraEngine.getBearingDegrees(41, -74, 40, -74);
    expect(bSouth).toBeCloseTo(180, 0);

    // West: 270 deg
    const bWest = SamsaraEngine.getBearingDegrees(40, -73, 40, -74);
    expect(bWest).toBeCloseTo(270, 0);
  });
});

describe('SamsaraEngine.resolveRouteContext', () => {
  const mockStops = [
    { id: 1, name: "Stop 1", lat: 40.7580, lng: -73.9855 }, // Times Square
    { id: 2, name: "Stop 2", lat: 40.7506, lng: -73.9935 }, // Penn Station
    { id: 15, name: "Stop 15", lat: 40.7601, lng: -73.9874 } // Uptown stop
  ];

  it('should identify the correct loop (Downtown)', () => {
    // Bus near Times Square
    const busGps = { latitude: 40.7581, longitude: -73.9856, heading: 180 };
    const context = SamsaraEngine.resolveRouteContext(busGps, mockStops);
    expect(context.route).toBe('Downtown');
    expect(context.absoluteClosest.id).toBe(1);
  });

  it('should identify the correct loop (Uptown)', () => {
    // Bus near Stop 15
    const busGps = { latitude: 40.7602, longitude: -73.9875, heading: 0 };
    const context = SamsaraEngine.resolveRouteContext(busGps, mockStops);
    expect(context.route).toBe('Uptown');
    expect(context.absoluteClosest.id).toBe(15);
  });

  it('should correctly identify upcoming stop (approaching Stop 2)', () => {
    // Bus between Stop 1 and Stop 2, heading South (towards Stop 2)
    const busGps = { 
      latitude: 40.7543, 
      longitude: -73.9895, 
      heading: 210 // Heading towards Penn Station
    };
    const context = SamsaraEngine.resolveRouteContext(busGps, mockStops);
    
    // Downtown stops are 1 and 2
    expect(context.upcoming.id).toBe(2);
    expect(context.lastVisited.id).toBe(1);
  });

  it('should handle edge case: bus turned around (U-turn)', () => {
    // Bus between Stop 1 and Stop 2, but heading North (back to Stop 1)
    const busGps = { 
      latitude: 40.7543, 
      longitude: -73.9895, 
      heading: 30 // Heading towards Times Square
    };
    const context = SamsaraEngine.resolveRouteContext(busGps, mockStops);
    
    expect(context.upcoming.id).toBe(1);
    expect(context.lastVisited.id).toBe(2);
  });

  it('should handle: Stopped AT Stop (Exactly on coords)', () => {
    // Bus exactly at Stop 1
    const busGps = { latitude: 40.7580, longitude: -73.9855, heading: 180 };
    const context = SamsaraEngine.resolveRouteContext(busGps, mockStops);
    
    // If exactly on coords, bearing is 0 or NaN usually, but our code might return 0.
    // Let's see how it behaves.
    console.log('[Test] Context at stop:', context.upcoming?.name, context.lastVisited?.name);
    // Ideally, if we are AT a stop, it should maybe be 'upcoming' until we clearly move past it.
  });

  it('should handle: Jitter near stop (Slightly past but same heading)', () => {
    // Stop 1 is at 40.7580. Bus is at 40.7579 (slightly South), heading South (180).
    // The bearing from 40.7579 to 40.7580 is 0 (North).
    // Heading (180) - Bearing (0) = 180. isBehind = true.
    const busGps = { latitude: 40.7579, longitude: -73.9855, heading: 180 };
    const context = SamsaraEngine.resolveRouteContext(busGps, mockStops);
    
    expect(context.lastVisited.id).toBe(1); // Correct: It passed it.
  });
});
