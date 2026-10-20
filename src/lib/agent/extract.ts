import { CITY_NAMES } from "../cities";
import type { Entity, QlooType } from "../types";

export type Candidate = { surface: string; start: number; end: number; sentenceStart: boolean };

/** Words that may be stripped off the front of a run ("Then Love Island" -> "Love Island"). */
const OPENERS = new Set(
  `a an and as at back but by for from he her here his i i'm i've i'd i'll if in it it's my now of oh ok okay on or our
  so she that then there these they this those to we well when where while yes no also just first honestly anyway look
  listen think imagine remember after before because you your their`.split(/\s+/),
);

/** Capitalised words that start sentences or address people, never references on their own. */
const STOP = new Set(
  `a an and as at back but by first for from he her here his how i i'm i've i'd i'll if in is it it's let me my no not now
  of oh ok okay on or our out she so some that the their then there these they this those to too up us was we well what
  when where which who why will with yes yet you your fair honestly anyway look listen thanks thank sorry also just
  mr mrs ms dr sir madam ladies gentlemen everyone everybody tonight today tomorrow yesterday monday tuesday wednesday
  thursday friday saturday sunday january february march april may june july august september october november december
  mom dad mum grandma grandpa one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty
  hundred thousand million think imagine picture remember guess maybe know said told get got make made see saw
  tell ask asked wait stop please sure right great good nice wow hey hi hello yeah nope never always every everything
  nothing something anyone someone people ever still even only last next our`.split(/\s+/),
);

/** Common first names: on their own they are almost always people in the room, not references. */
const FIRST_NAMES = new Set(
  `james john robert michael william david richard joseph thomas charles chris christopher daniel matthew anthony mark
  donald steven paul andrew joshua kevin brian george timothy ronald jason edward jeffrey ryan jacob gary nicholas eric
  jonathan stephen larry justin scott brandon benjamin samuel gregory alexander frank patrick raymond jack dennis jerry
  tyler aaron jose adam nathan henry zachary douglas peter kyle noah ethan jeremy walter christian keith roger terry
  austin sean gerald carl harold dylan arthur lawrence jordan jesse bryan billy bruce gabriel joe logan alan juan albert
  willie elijah wayne randy vincent mason roy ralph bobby russell bradley philip eugene dave mike tom tim jim bob steve
  mary patricia jennifer linda elizabeth barbara susan jessica sarah karen lisa nancy betty sandra margaret ashley
  kimberly emily donna michelle carol amanda melissa deborah stephanie dorothy rebecca sharon laura cynthia amy kathleen
  angela shirley brenda emma anna pamela nicole samantha katherine christine helen debra rachel carolyn janet maria
  catherine heather diane olivia julie joyce victoria ruth virginia lauren kelly christina joan evelyn judith andrea
  hannah megan cheryl jacqueline martha madison teresa gloria sara janice ann kathryn abigail sophia frances jean alice
  judy isabella julia grace amber denise danielle marilyn beverly charlotte natalie theresa diana brittany doris kayla
  alexis lori marie priya aisha fatima ahmed mohammed muhammad ali omar jen kate liz beth meg sam alex`.split(/\s+/),
);

const CITY_SET = new Set(CITY_NAMES.map((c) => c.toLowerCase()));

// a run of Capitalised words, allowing short lowercase joiners ("Parks and Recreation", "House of Cards")
const RUN = /\p{Lu}[\p{L}\p{N}'’&-]*(?:[ \t]+(?:(?:of|the|and|de|la|on|in|&)[ \t]+)?\p{Lu}[\p{L}\p{N}'’&-]*)*/gu;

export function extractCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(RUN)) {
    let surface = m[0].replace(/[.,;:!?]+$/, "");
    let start = m.index!;
    const before = text.slice(0, start).trimEnd();
    const sentenceStart = before === "" || /[.!?:\n"“(]$/.test(before);
    // strip openers ("Then Love Island" -> "Love Island"), but never "The": it is part of titles
    for (;;) {
      const first = surface.split(/\s+/)[0];
      const w = first.toLowerCase().replace(/[’]/g, "'");
      if (!OPENERS.has(w) || first === surface) break;
      const cut = surface.indexOf(first) + first.length;
      const rest = surface.slice(cut).replace(/^\s+/, "");
      start += surface.length - rest.length;
      surface = rest;
    }
    const lower = surface.toLowerCase();
    if (!surface || STOP.has(lower) || FIRST_NAMES.has(lower) || CITY_SET.has(lower)) continue;
    // "Dave and Priya": people in the room joined by "and", not a title
    const parts = lower.split(/\s+(?:and|&)\s+/);
    if (parts.length > 1 && parts.every((p) => FIRST_NAMES.has(p) || STOP.has(p))) continue;
    if (surface.length < 3) continue;
    out.push({ surface, start, end: start + surface.length, sentenceStart });
  }
  return out;
}

/** Most references are brands, shows, films or music; people come last (artists share names with them). */
const TYPE_ORDER: QlooType[] = ["brand", "tv_show", "movie", "artist", "podcast", "video_game", "book", "person"];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Beyoncé -> beyonce
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9' ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Pick the entity a surface refers to, or null when nothing in Qloo matches it
 * closely enough. Exact names beat prefixes ("Dunkin'" -> "Dunkin' Donuts"),
 * then type order, then popularity.
 */
export function pickEntity(surface: string, results: Entity[], opts: { sentenceStart: boolean }): Entity | null {
  const s = norm(surface);
  const noThe = (x: string) => x.replace(/^the /, "");
  const scored = results.flatMap((e) => {
    const n = norm(e.name);
    const exact = n === s || n.replace(/'/g, "") === s.replace(/'/g, "");
    // Qloo often titles shows "The ..." where people drop the article ("Real Housewives of Atlanta")
    const loose = !exact && noThe(n) === noThe(s);
    // prefixes only for brands: "Dunkin'" -> "Dunkin' Donuts", but not "Red Rocks" -> "Red Rocks Live in VR"
    const prefix = !exact && !loose && e.type === "brand" && s.length >= 6 && n.startsWith(s + " ");
    if (!exact && !loose && !prefix) return [];
    const typeRank = TYPE_ORDER.indexOf(e.type);
    if (typeRank < 0) return [];
    return [{ e, exact, loose, typeRank }];
  });
  // single capitalised words at the start of a sentence are often just words; demand a well-known match
  // obscure exact matches are usually the wrong thing (e.g. "Red Rocks" the 0.24 book)
  const minPop = opts.sentenceStart && !surface.includes(" ") ? 0.6 : 0.3;
  const ok = scored.filter((x) => x.e.popularity >= minPop);
  // exact names beat "The ..." variants (so "Future" stays the artist, not the film "The Future")
  ok.sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.loose) - Number(a.loose) || a.typeRank - b.typeRank || b.e.popularity - a.e.popularity);
  return ok[0]?.e ?? null;
}

/** "Tattered Cover of B2B" -> ["Tattered Cover", "B2B"]: fallbacks when a joined run matches nothing. */
export function splitOnJoiners(c: Candidate): Candidate[] {
  const parts: Candidate[] = [];
  const re = /\s+(?:of|the|and|de|la|on|in|&)\s+/g;
  let from = 0;
  for (const m of [...c.surface.matchAll(re), null]) {
    const to = m ? m.index! : c.surface.length;
    const piece = c.surface.slice(from, to);
    const low = piece.toLowerCase();
    if (piece && /^[A-Z]/.test(piece) && piece.length >= 3 && !CITY_SET.has(low) && !STOP.has(low) && !FIRST_NAMES.has(low)) {
      parts.push({ surface: piece, start: c.start + from, end: c.start + to, sentenceStart: from === 0 && c.sentenceStart });
    }
    if (m) from = m.index! + m[0].length;
  }
  return parts.length > 1 ? parts : [];
}
