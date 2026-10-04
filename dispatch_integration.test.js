import { describe, it, expect } from 'vitest';
import DispatchEngine from './dispatch_engine.js';

describe('DispatchEngine Integration', () => {
  const mockDispatchData = [
    { 
      bus: '4205', 
      operator: 'John Doe', 
      stop: 'STOP 1 ', 
      route: 'Downtown Loop', 
      date: '4/28/2026 12:00:00 PM' 
    },
    { 
      bus: '4205', 
      operator: 'Jane Smith', 
      stop: 'STOP 5 ', 
      route: 'Downtown Loop', 
      date: '4/28/2026 1:00:00 PM' // More recent
    },
    { 
      bus: '4310', 
      operator: 'Bob Wilson', 
      stop: 'STOP 15 ', 
      route: 'Uptown Loop', 
      date: '4/28/2026 12:45:00 PM' 
    }
  ];

  it('should find the most recent driver for a bus', () => {
    const active = DispatchEngine.findActiveDriver('4205', mockDispatchData);
    expect(active.operator).toBe('Jane Smith');
    expect(active.stop).toBe('STOP 5 ');
  });

  it('should return null for a bus with no records', () => {
    const active = DispatchEngine.findActiveDriver('9999', mockDispatchData);
    expect(active).toBeNull();
  });

  it('should enrich Samsara telemetry with driver info', () => {
    const mockGps = { latitude: 40.7, longitude: -73.9, heading: 180 };
    const enriched = DispatchEngine.getEnrichedStatus(mockGps, '4205', mockDispatchData);
    
    expect(enriched.operator).toBe('Jane Smith');
    expect(enriched.latitude).toBe(40.7);
    expect(enriched.busId).toBe('4205');
  });

  it('should handle "Unknown Driver" if no match found during enrichment', () => {
    const mockGps = { latitude: 40.7, longitude: -73.9, heading: 180 };
    const enriched = DispatchEngine.getEnrichedStatus(mockGps, '8888', mockDispatchData);
    
    expect(enriched.operator).toBe('Unknown Driver');
  });
});
