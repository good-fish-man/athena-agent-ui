export type CurrentLocationContext = {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  captured_at: string;
  source: 'device_geolocation';
};

const LOCATION_INTENT = /(?:天气|气温|温度|下雨|降雨|降雪|空气质量|weather|forecast|temperature|rain|snow)/i;
const LOCATION_TIMEOUT_MS = 8_000;
const LOCATION_CACHE_MS = 10 * 60_000;

export function needsCurrentLocation(message: string): boolean {
  return LOCATION_INTENT.test(message);
}

// The browser/OS owns the permission prompt. A refusal is intentionally
// represented as no context so the agent can ask the user for a city instead.
export async function currentLocationForMessage(message: string): Promise<CurrentLocationContext | undefined> {
  if (!needsCurrentLocation(message) || !navigator.geolocation) return undefined;

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: Math.round(position.coords.accuracy),
        captured_at: new Date(position.timestamp).toISOString(),
        source: 'device_geolocation',
      }),
      () => resolve(undefined),
      {
        enableHighAccuracy: false,
        maximumAge: LOCATION_CACHE_MS,
        timeout: LOCATION_TIMEOUT_MS,
      },
    );
  });
}
