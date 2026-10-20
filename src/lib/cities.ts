export type City = { name: string; lon: number; lat: number };

/**
 * The comparison pool. A reference "lands" in a city when that city ranks near the
 * top of this pool for the reference, not when it clears some national number
 * (Qloo exposes no national baseline).
 */
export const CITIES: City[] = [
  { name: "Atlanta", lon: -84.388, lat: 33.749 },
  { name: "Boston", lon: -71.059, lat: 42.36 },
  { name: "Chicago", lon: -87.63, lat: 41.878 },
  { name: "Dallas", lon: -96.797, lat: 32.777 },
  { name: "Denver", lon: -104.99, lat: 39.739 },
  { name: "Houston", lon: -95.37, lat: 29.76 },
  { name: "Los Angeles", lon: -118.244, lat: 34.052 },
  { name: "Miami", lon: -80.191, lat: 25.762 },
  { name: "Nashville", lon: -86.781, lat: 36.163 },
  { name: "New York", lon: -74.006, lat: 40.713 },
  { name: "Philadelphia", lon: -75.165, lat: 39.953 },
  { name: "Seattle", lon: -122.332, lat: 47.606 },
];

export const CITY_NAMES = CITIES.map((c) => c.name);
export const cityByName = (name: string) => CITIES.find((c) => c.name === name);

/**
 * Cities every reference is ranked against. Each one costs a Qloo call per entity
 * type, so the pool is kept small; a room city outside it is added on the fly.
 */
export const POOL = ["Atlanta", "Boston", "Chicago", "Denver", "Houston", "Los Angeles", "New York", "Seattle"];
