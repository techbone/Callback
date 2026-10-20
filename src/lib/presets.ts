import type { Room } from "./types";

export type Preset = { id: string; label: string; text: string; room: Room };

/**
 * Example sets. References were picked because Qloo has city-level data for them,
 * so every underline is a real verdict (checked against live data on 2026-10-20).
 */
export const PRESETS: Preset[] = [
  {
    id: "standup",
    label: "Stand-up set",
    room: { city: "Atlanta", age: "any" },
    text: `I just moved to Atlanta from Boston and the culture shock is real. Back home, Dunkin' is a personality. Here, I walked into a Waffle House at 3 a.m. and the waitress knew my name, my order, and my ex.

My roommate plays Outkast every morning and says Tom Brady is just a guy who throws. I told him I grew up on Wawa hoagies. He looked at me like I'd said a swear word.

Then he made me watch P-Valley, and honestly? First time I felt like a local. I'm a Trader Joe's guy now, which back home is basically treason.`,
  },
  {
    id: "toast",
    label: "Wedding toast",
    room: { city: "Chicago", age: "36_to_55" },
    text: `Dave, the night I met you, you were in line at Portillo's at 1 a.m. arguing about ketchup, and I knew we'd either be best friends or fight in a parking lot.

Twenty years later, you still watch The Bear like it's homework, you think Chance the Rapper is a personal friend, and you have never forgiven Tom Brady for anything. Priya, you married a man who cried at Succession. I'm so proud of you both.`,
  },
  {
    id: "pitch",
    label: "Sales pitch",
    room: { city: "Denver", age: "36_to_55" },
    text: `Think of us as the Whataburger of B2B data: fast, there when you need us, and nobody leaves hungry.

Your team doesn't need another Succession. They need Yellowstone: people who know the land and get the work done. We've done this for brands from Publix to Trader Joe's, and we can do it for you before the season starts.`,
  },
];
