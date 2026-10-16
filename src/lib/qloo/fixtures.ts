import type { AgeBand, QlooType } from "../types";

/**
 * DEMO DATA. These numbers are invented to exercise the pipeline and the UI
 * before the Qloo hackathon key arrives. They are not Qloo data and the app
 * labels itself "demo data" whenever it is using them.
 */
export type Fixture = {
  id: string;
  name: string;
  type: QlooType;
  aliases?: string[];
  popularity: number;
  national: number;
  tags: string[];
  /** local affinity by city; cities not listed use the national figure */
  cities: Record<string, number>;
  /** multiplier applied to local affinity for an age band */
  age?: Partial<Record<AgeBand, number>>;
  /** items the "what the room loves right now" card flags as trending */
  trending?: string[];
  /** common-word names the keyword extractor must not match blindly */
  ambiguous?: boolean;
};

export const DEMO_CITIES = ["Atlanta", "Boston", "Chicago", "Houston", "Denver", "New York"] as const;

const f = (x: Fixture) => x;

export const FIXTURES: Fixture[] = [
  // brands: fast food and retail
  f({ id: "demo:waffle-house", name: "Waffle House", type: "brand", popularity: 0.82, national: 0.3, tags: ["diner", "breakfast", "late-night"], cities: { Atlanta: 0.78, Houston: 0.52, Boston: 0.1, Chicago: 0.14, Denver: 0.18, "New York": 0.1 }, trending: ["Atlanta"] }),
  f({ id: "demo:chick-fil-a", name: "Chick-fil-A", type: "brand", aliases: ["Chick fil A"], popularity: 0.93, national: 0.52, tags: ["chicken", "fast-food"], cities: { Atlanta: 0.81, Houston: 0.66, Boston: 0.4, Chicago: 0.45, Denver: 0.5, "New York": 0.36 } }),
  f({ id: "demo:dunkin", name: "Dunkin'", type: "brand", aliases: ["Dunkin", "Dunkin Donuts"], popularity: 0.9, national: 0.4, tags: ["coffee", "donuts", "fast-food"], cities: { Boston: 0.88, "New York": 0.58, Atlanta: 0.22, Houston: 0.2, Chicago: 0.35, Denver: 0.15 }, age: { "35_and_younger": 0.9, "55_and_older": 1.1 } }),
  f({ id: "demo:starbucks", name: "Starbucks", type: "brand", popularity: 0.97, national: 0.55, tags: ["coffee", "fast-food"], cities: { Atlanta: 0.52, Boston: 0.42, Chicago: 0.56, Houston: 0.5, Denver: 0.6, "New York": 0.45 } }),
  f({ id: "demo:portillos", name: "Portillo's", type: "brand", aliases: ["Portillos"], popularity: 0.55, national: 0.14, tags: ["hot-dogs", "italian-beef", "fast-food"], cities: { Chicago: 0.86, Atlanta: 0.08, Boston: 0.06, Houston: 0.1, Denver: 0.12, "New York": 0.07 } }),
  f({ id: "demo:wawa", name: "Wawa", type: "brand", popularity: 0.62, national: 0.18, tags: ["convenience", "sandwiches"], cities: { Atlanta: 0.1, Boston: 0.08, Chicago: 0.07, Houston: 0.06, Denver: 0.05, "New York": 0.22 } }),
  f({ id: "demo:whataburger", name: "Whataburger", type: "brand", popularity: 0.7, national: 0.24, tags: ["burgers", "fast-food", "late-night"], cities: { Houston: 0.91, Atlanta: 0.2, Boston: 0.08, Chicago: 0.1, Denver: 0.16, "New York": 0.06 } }),
  f({ id: "demo:cracker-barrel", name: "Cracker Barrel", type: "brand", popularity: 0.7, national: 0.3, tags: ["diner", "breakfast", "southern"], cities: { Atlanta: 0.5, Houston: 0.44, Boston: 0.12, Chicago: 0.24, Denver: 0.22, "New York": 0.1 }, age: { "55_and_older": 1.3, "35_and_younger": 0.7 } }),
  f({ id: "demo:cumberland-farms", name: "Cumberland Farms", type: "brand", popularity: 0.3, national: 0.06, tags: ["convenience", "coffee"], cities: { Boston: 0.58, Atlanta: 0.03, Chicago: 0.02, Houston: 0.02, Denver: 0.02, "New York": 0.04 } }),
  f({ id: "demo:jacobs-pickles", name: "Jacob's Pickles", type: "brand", popularity: 0.12, national: 0.03, tags: ["diner", "brunch"], cities: { "New York": 0.2 } }),
  f({ id: "demo:original-pancake-house", name: "Original Pancake House", type: "brand", popularity: 0.4, national: 0.12, tags: ["diner", "breakfast"], cities: { Chicago: 0.4, Denver: 0.3, Atlanta: 0.12, Houston: 0.1, Boston: 0.08, "New York": 0.08 } }),
  f({ id: "demo:tattered-cover", name: "Tattered Cover", type: "brand", popularity: 0.08, national: 0.02, tags: ["bookstore"], cities: { Denver: 0.4 } }),
  // tv
  f({ id: "demo:succession", name: "Succession", type: "tv_show", popularity: 0.74, national: 0.34, tags: ["drama", "satire", "prestige"], cities: { "New York": 0.7, Boston: 0.4, Chicago: 0.38, Atlanta: 0.3, Houston: 0.26, Denver: 0.34 }, age: { "36_to_55": 1.15 } }),
  f({ id: "demo:the-office", name: "The Office", type: "tv_show", popularity: 0.95, national: 0.62, tags: ["sitcom", "workplace", "comedy"], cities: { Atlanta: 0.6, Boston: 0.62, Chicago: 0.64, Houston: 0.6, Denver: 0.62, "New York": 0.6 } }),
  f({ id: "demo:friends", name: "Friends", type: "tv_show", ambiguous: true, popularity: 0.96, national: 0.55, tags: ["sitcom", "comedy", "ensemble"], cities: { "New York": 0.6, Atlanta: 0.5, Boston: 0.54, Chicago: 0.56, Houston: 0.5, Denver: 0.52 }, age: { "35_and_younger": 0.8, "55_and_older": 1.1 } }),
  f({ id: "demo:yellowstone", name: "Yellowstone", type: "tv_show", popularity: 0.82, national: 0.38, tags: ["drama", "western", "ranch"], cities: { Houston: 0.66, Denver: 0.6, Atlanta: 0.4, Chicago: 0.28, Boston: 0.2, "New York": 0.16 }, age: { "55_and_older": 1.2 } }),
  f({ id: "demo:atlanta-fx", name: "Atlanta", type: "tv_show", ambiguous: true, aliases: ["Atlanta (FX)"], popularity: 0.55, national: 0.22, tags: ["comedy", "drama", "surreal"], cities: { Atlanta: 0.8, Chicago: 0.28, Boston: 0.2, Houston: 0.3, Denver: 0.2, "New York": 0.36 }, age: { "35_and_younger": 1.25 } }),
  f({ id: "demo:love-island", name: "Love Island", type: "tv_show", popularity: 0.6, national: 0.2, tags: ["reality", "dating"], cities: { Atlanta: 0.26, Boston: 0.18, Chicago: 0.2, Houston: 0.26, Denver: 0.18, "New York": 0.22 }, age: { "35_and_younger": 1.7, "55_and_older": 0.3 } }),
  f({ id: "demo:cheers", name: "Cheers", type: "tv_show", ambiguous: true, popularity: 0.7, national: 0.22, tags: ["sitcom", "comedy", "bar"], cities: { Boston: 0.7, "New York": 0.26, Chicago: 0.2, Atlanta: 0.16, Houston: 0.14, Denver: 0.14 }, age: { "55_and_older": 1.6, "35_and_younger": 0.4 } }),
  f({ id: "demo:abbott-elementary", name: "Abbott Elementary", type: "tv_show", popularity: 0.62, national: 0.3, tags: ["sitcom", "workplace", "comedy"], cities: { Atlanta: 0.52, Chicago: 0.34, Houston: 0.4, Boston: 0.3, Denver: 0.24, "New York": 0.34 }, age: { "35_and_younger": 1.2 }, trending: ["Atlanta", "Houston"] }),
  f({ id: "demo:parks-and-rec", name: "Parks and Recreation", type: "tv_show", popularity: 0.78, national: 0.4, tags: ["sitcom", "workplace", "comedy"], cities: { Denver: 0.52, Chicago: 0.44, Boston: 0.42, Atlanta: 0.38, Houston: 0.34, "New York": 0.4 } }),
  f({ id: "demo:the-bear", name: "The Bear", type: "tv_show", popularity: 0.68, national: 0.3, tags: ["drama", "workplace", "food"], cities: { Chicago: 0.74, "New York": 0.44, Boston: 0.32, Atlanta: 0.3, Houston: 0.26, Denver: 0.3 }, age: { "35_and_younger": 1.2 }, trending: ["Chicago"] }),
  // music
  f({ id: "demo:taylor-swift", name: "Taylor Swift", type: "artist", popularity: 0.99, national: 0.62, tags: ["pop", "country-pop"], cities: { Atlanta: 0.62, Boston: 0.6, Chicago: 0.62, Houston: 0.6, Denver: 0.64, "New York": 0.6 }, age: { "35_and_younger": 1.2, "55_and_older": 0.6 } }),
  f({ id: "demo:future", name: "Future", type: "artist", ambiguous: true, popularity: 0.8, national: 0.34, tags: ["hip-hop", "trap"], cities: { Atlanta: 0.82, Houston: 0.5, Chicago: 0.36, Boston: 0.26, Denver: 0.26, "New York": 0.4 }, age: { "35_and_younger": 1.3, "55_and_older": 0.4 } }),
  f({ id: "demo:morgan-wallen", name: "Morgan Wallen", type: "artist", popularity: 0.86, national: 0.36, tags: ["country"], cities: { Houston: 0.62, Denver: 0.44, Atlanta: 0.44, Chicago: 0.28, Boston: 0.22, "New York": 0.14 } }),
  f({ id: "demo:chance-the-rapper", name: "Chance the Rapper", type: "artist", popularity: 0.72, national: 0.28, tags: ["hip-hop", "gospel-rap"], cities: { Chicago: 0.8, Atlanta: 0.34, Boston: 0.24, Houston: 0.26, Denver: 0.24, "New York": 0.3 }, age: { "35_and_younger": 1.25 } }),
  f({ id: "demo:dropkick-murphys", name: "Dropkick Murphys", type: "artist", popularity: 0.4, national: 0.1, tags: ["punk", "celtic-punk"], cities: { Boston: 0.7, Chicago: 0.12, "New York": 0.14, Atlanta: 0.06, Houston: 0.05, Denver: 0.1 } }),
  f({ id: "demo:travis-scott", name: "Travis Scott", type: "artist", popularity: 0.88, national: 0.36, tags: ["hip-hop", "trap"], cities: { Houston: 0.85, Atlanta: 0.5, Chicago: 0.36, Boston: 0.3, Denver: 0.32, "New York": 0.38 }, age: { "35_and_younger": 1.3, "55_and_older": 0.3 } }),
  f({ id: "demo:bon-iver", name: "Bon Iver", type: "artist", popularity: 0.5, national: 0.18, tags: ["indie-folk"], cities: { Denver: 0.4, Chicago: 0.3, Boston: 0.26, "New York": 0.26, Atlanta: 0.14, Houston: 0.1 } }),
  // places
  f({ id: "demo:fenway-park", name: "Fenway Park", type: "place", popularity: 0.76, national: 0.3, tags: ["stadium", "baseball"], cities: { Boston: 0.9, "New York": 0.2, Chicago: 0.28, Atlanta: 0.2, Houston: 0.18, Denver: 0.2 } }),
  f({ id: "demo:wrigley-field", name: "Wrigley Field", type: "place", popularity: 0.74, national: 0.28, tags: ["stadium", "baseball"], cities: { Chicago: 0.9, Boston: 0.26, "New York": 0.26, Atlanta: 0.2, Houston: 0.16, Denver: 0.2 } }),
  f({ id: "demo:truist-park", name: "Truist Park", type: "place", popularity: 0.3, national: 0.08, tags: ["stadium", "baseball"], cities: { Atlanta: 0.7 } }),
  f({ id: "demo:red-rocks", name: "Red Rocks Amphitheatre", type: "place", aliases: ["Red Rocks"], popularity: 0.6, national: 0.2, tags: ["amphitheater", "music-venue"], cities: { Denver: 0.88, Chicago: 0.2, Boston: 0.16, Atlanta: 0.14, Houston: 0.12, "New York": 0.14 } }),
  // people
  f({ id: "demo:michael-jordan", name: "Michael Jordan", type: "person", popularity: 0.97, national: 0.55, tags: ["basketball", "athlete"], cities: { Chicago: 0.9, Atlanta: 0.5, Boston: 0.4, Houston: 0.5, Denver: 0.5, "New York": 0.5 }, age: { "35_and_younger": 0.7, "55_and_older": 1.2 } }),
  f({ id: "demo:tom-brady", name: "Tom Brady", type: "person", popularity: 0.95, national: 0.5, tags: ["football", "athlete"], cities: { Boston: 0.9, "New York": 0.3, Atlanta: 0.4, Chicago: 0.34, Houston: 0.4, Denver: 0.36 } }),
  f({ id: "demo:kevin-hart", name: "Kevin Hart", type: "person", popularity: 0.9, national: 0.46, tags: ["comedian", "actor"], cities: { Atlanta: 0.64, Houston: 0.6, Chicago: 0.5, Boston: 0.4, Denver: 0.36, "New York": 0.5 } }),
  f({ id: "demo:jon-stewart", name: "Jon Stewart", type: "person", popularity: 0.82, national: 0.4, tags: ["comedian", "tv-host", "political"], cities: { "New York": 0.64, Boston: 0.5, Chicago: 0.44, Denver: 0.4, Atlanta: 0.34, Houston: 0.26 }, age: { "36_to_55": 1.15, "35_and_younger": 0.9 } }),
  // streaming/other
  f({ id: "demo:fortnite", name: "Fortnite", type: "video_game", popularity: 0.92, national: 0.4, tags: ["battle-royale", "shooter"], cities: { Atlanta: 0.46, Houston: 0.44, Boston: 0.36, Chicago: 0.4, Denver: 0.36, "New York": 0.38 }, age: { "35_and_younger": 1.5, "55_and_older": 0.2 } }),
  f({ id: "demo:oppenheimer", name: "Oppenheimer", type: "movie", popularity: 0.8, national: 0.4, tags: ["drama", "biopic", "history"], cities: { Boston: 0.54, "New York": 0.5, Chicago: 0.42, Denver: 0.42, Atlanta: 0.36, Houston: 0.34 } }),
  f({ id: "demo:barbie", name: "Barbie", type: "movie", popularity: 0.9, national: 0.44, tags: ["comedy", "fantasy"], cities: { Atlanta: 0.5, Boston: 0.42, Chicago: 0.46, Houston: 0.46, Denver: 0.44, "New York": 0.48 }, age: { "35_and_younger": 1.2 } }),
];

export const ALL_TAGS = Array.from(new Set(FIXTURES.flatMap((x) => x.tags)));
