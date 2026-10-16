import type { Room } from "./types";

export type Preset = { id: string; label: string; text: string; room: Room };

export const PRESETS: Preset[] = [
  {
    id: "standup",
    label: "Stand-up set",
    room: { city: "Atlanta", age: "35_and_younger" },
    text: `I just moved to Atlanta from Boston and the culture shock is real. Back home, Dunkin' is a personality. Here, I walked into a Waffle House at 3 a.m. and the waitress knew my name, my order, and my ex.

My roommate listens to nothing but Future and says Taylor Swift is for people who peaked in 2014. I told him I'm more of a Fenway Park guy. He said that's a place, not a personality. Fair.

Then he asked if I wanted to watch Love Island, and honestly? First time I felt like a local. I'm a Starbucks guy now, which back home is basically treason. Cumberland Farms would never forgive me.`,
  },
  {
    id: "toast",
    label: "Wedding toast",
    room: { city: "Chicago", age: "36_to_55" },
    text: `Dave, when I met you, you were wearing a Michael Jordan jersey to a Wrigley Field game, and I knew we were either going to be best friends or fight in a parking lot.

Twenty years later, you have never missed a Portillo's run, you watch The Bear like it's homework, and you still talk about Dropkick Murphys like they're personal friends. Priya, you married a man who thinks Friends is a documentary. I'm so proud of you both.`,
  },
  {
    id: "pitch",
    label: "Sales pitch",
    room: { city: "Denver", age: "36_to_55" },
    text: `Think of us as the Tattered Cover of B2B data: curated, local, and you leave knowing more than when you walked in.

Your team doesn't need another Fortnite of dashboards. They need Parks and Recreation: people who show up, know the town, and get it done. We've done this for brands from Starbucks to Cracker Barrel, and we can do it for you before the next Red Rocks season starts.`,
  },
];
