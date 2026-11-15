import { total, type Category, type Draft, type InventoryItem, type Unit } from './domain';

/** A spoken question such as "how much chicken do we have". Answered, never saved. */
export type Question = { heard: string; itemIds: string[] };
export type ParseResult = { drafts: Draft[]; unparsed: string[]; question: Question | null };

type Intent = 'add' | 'remove';

const REMOVE_VERBS = [
  'took out', 'take out', 'taking out', 'taken out', 'got out', 'get out', 'getting out', 'pulled out', 'pull out',
  'finished off', 'finished', 'used up', 'used', 'use', 'ate', 'eat', 'eaten', 'removed', 'remove', 'removing',
  'took', 'take', 'grabbed', 'grab', 'pulled', 'pull', 'thawed', 'thaw', 'thawing', 'defrosted', 'defrost',
  'cooked', 'cooking', 'cook', 'minus', 'subtract',
];
const ADD_VERBS = [
  'put in', 'putting in', 'threw in', 'throw in', 'tossed in', 'toss in', 'picked up', 'added', 'adding', 'add',
  'put', 'putting', 'stored', 'store', 'stocked', 'stock', 'froze', 'freeze', 'freezing', 'bought', 'got', 'plus',
];
const FILLER = /^(?:ok(?:ay)?|so|um+|uh+|also|and|please|just|i|we|i've|we've|i've just|ive|weve|have|has|i just|we just)\b\s*/;

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, another: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, dozen: 12, half: 0.5, some: 1, the: 1, couple: 2, few: 3, several: 3,
};

const UNIT_WORDS: Record<string, Unit> = {
  item: 'item', items: 'item', loaf: 'item', loaves: 'item',
  pack: 'pack', packs: 'pack', package: 'pack', packages: 'pack', packet: 'pack', packets: 'pack',
  bag: 'bag', bags: 'bag', box: 'box', boxes: 'box', container: 'container', containers: 'container',
  tub: 'container', tubs: 'container', tray: 'tray', trays: 'tray', roll: 'roll', rolls: 'roll',
  piece: 'piece', pieces: 'piece', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', oz: 'oz', ounce: 'oz',
  ounces: 'oz', kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', gram: 'g', grams: 'g',
};

const CATEGORY_KEYWORDS: [Category, string[]][] = [
  ['desserts', ['ice cream', 'popsicle', 'sorbet', 'gelato', 'cake', 'pie crust', 'cookie dough', 'cheesecake', 'ice pop', 'frozen yogurt']],
  ['frozen_meals', ['pizza', 'lasagna', 'burrito', 'nugget', 'tender', 'pot pie', 'enchilada', 'casserole', 'tv dinner', 'meal', 'soup', 'chili', 'stew', 'dumpling', 'potsticker', 'pierogi', 'ravioli', 'pierogy', 'mac and cheese', 'egg roll', 'taquito', 'fry', 'tot', 'hash brown', 'waffle', 'leftover']],
  ['seafood', ['fish', 'salmon', 'shrimp', 'tilapia', 'cod', 'tuna', 'crab', 'lobster', 'scallop', 'halibut', 'mahi', 'walleye', 'perch', 'trout']],
  ['poultry', ['chicken', 'turkey', 'duck', 'thigh', 'drumstick', 'wing', 'breast', 'goose', 'pheasant', 'quail']],
  ['meat', ['beef', 'pork', 'steak', 'ground', 'roast', 'rib', 'chop', 'brisket', 'sausage', 'bacon', 'ham', 'venison', 'lamb', 'burger', 'patty', 'hot dog', 'bratwurst', 'brat', 'meatball', 'tenderloin', 'loin', 'elk', 'bison']],
  ['vegetables', ['pea', 'corn', 'broccoli', 'bean', 'carrot', 'spinach', 'vegetable', 'veggie', 'mixed veg', 'cauliflower', 'okra', 'edamame', 'pepper', 'onion', 'squash', 'kale', 'brussel sprout']],
  ['fruit', ['berry', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'mango', 'peach', 'banana', 'cherry', 'pineapple', 'fruit', 'grape']],
  ['baked_goods', ['bread', 'bun', 'roll', 'bagel', 'muffin', 'tortilla', 'biscuit', 'croissant', 'pastry', 'dough', 'pita', 'english muffin']],
];

const LOCATION = /\b(?:in|into|to|from|out of|outta|inside)\s+(?:the\s+|our\s+|my\s+)?(?:deep\s+|chest\s+|garage\s+|big\s+|basement\s+)?(?:freezer|freeze|deep freeze)\b/g;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const FROM_MONTH = /\s+(?:from|added in|added|in)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)(?:\s+(\d{1,2})(?:st|nd|rd|th)?)?$/;
const QUESTION = /^(?:how much|how many|do we have(?: any)?|do i have(?: any)?|is there(?: any)?|are there(?: any)?|have we got(?: any)?|any)\s+(.+?)(?:\s+(?:left|do we have|do i have|have we got|in there|is there|are there|in the freezer))*$/;
const KNOWN_AND_NAMES = ['mac and cheese', 'macaroni and cheese', 'chips and dip', 'rice and beans', 'beef and broccoli', 'surf and turf', 'franks and beans'];

export function parseCommand(text: string, inventory: InventoryItem[], today: string): ParseResult {
  const protectedNames = [...KNOWN_AND_NAMES, ...inventory.map((i) => normalize(i.name)).filter((n) => n.includes(' and '))];
  const asked = normalize(text).replace(/\?/g, '').replace(LOCATION, ' ').trim().match(QUESTION);
  if (asked) {
    const heard = asked[1].replace(/^(?:of\s+)?(?:the\s+|some\s+)?/, '');
    const itemIds = rank(heard, inventory.filter((i) => total(i) > 0), null)
      .filter((r) => r.score >= 0.45)
      .slice(0, 3)
      .map((r) => r.item.id);
    return { drafts: [], unparsed: [], question: { heard, itemIds } };
  }
  let body = normalize(text).replace(LOCATION, ' ');
  for (const n of protectedNames) body = body.split(n).join(n.replace(/ and /g, ' & '));
  body = body.replace(/ and (a )?half\b/g, ' & $1half');

  const clauses = body
    .split(/\s*(?:,|;|\.(?!\d)|\band then\b|\bthen\b|\band\b|\bplus also\b|\balso\b)\s*/)
    .map((c) => c.replace(/&/g, 'and').trim())
    .filter(Boolean);

  const drafts: Draft[] = [];
  const unparsed: string[] = [];
  let intent: Intent | null = null;

  for (const raw of clauses) {
    const step = readClause(raw);
    intent = step.intent ?? intent;
    if (!intent || !step.name) {
      if (step.name || step.intent === null) unparsed.push(raw);
      continue;
    }
    drafts.push(intent === 'add' ? toAdd(step, inventory, today) : toRemove(step, inventory));
  }
  return { drafts, unparsed, question: null };
}

type When = { month: number; day: number | null };
type Clause = { intent: Intent | null; quantity: number | 'all' | null; unit: Unit | null; name: string; when: When | null };

function readClause(raw: string): Clause {
  let s = raw;
  while (FILLER.test(s)) s = s.replace(FILLER, '');

  let intent: Intent | null = null;
  const verb = matchPrefix(s, REMOVE_VERBS) ?? matchPrefix(s, ADD_VERBS);
  if (verb) {
    intent = REMOVE_VERBS.includes(verb) ? 'remove' : 'add';
    s = s.slice(verb.length).trim();
  }
  if (/\bout$/.test(s)) {
    intent = 'remove';
    s = s.replace(/\s*\bout$/, '');
  }
  if (/\bin$/.test(s) && intent !== 'remove') {
    intent = 'add';
    s = s.replace(/\s*\bin$/, '');
  }

  let quantity: number | 'all' | null = null;
  const all = s.match(/^(?:all (?:of )?(?:the )?|the last (?:of (?:the )?)?|the rest of (?:the )?|rest of (?:the )?)/);
  if (all) {
    quantity = 'all';
    s = s.slice(all[0].length);
  } else {
    const q = readQuantity(s);
    if (q) {
      quantity = q.value;
      s = s.slice(q.length).trim();
    }
  }
  s = s.replace(/^more\s+/, '');

  let unit: Unit | null = null;
  const first = s.split(' ')[0];
  if (first && UNIT_WORDS[first] && s.split(' ').length > 1) {
    unit = UNIT_WORDS[first];
    s = s.slice(first.length).trim();
  }
  s = s.replace(/^(?:of\s+)?(?:the\s+|some\s+|our\s+|my\s+)?/, '').replace(/\s+(?:please|too|as well)$/, '').trim();
  let when: When | null = null;
  const from = s.match(FROM_MONTH);
  if (from) {
    when = { month: MONTHS.indexOf(from[1].slice(0, 3)) + 1, day: from[2] ? Number(from[2]) : null };
    s = s.slice(0, from.index).trim();
  }
  return { intent, quantity, unit, name: s, when };
}

function readQuantity(s: string): { value: number; length: number } | null {
  const digits = s.match(/^(\d+(?:\.\d+)?)\b\s*/);
  if (digits) return { value: Number(digits[1]), length: digits[0].length };
  const mixed = s.match(/^(?:(\w+) and a half|(\w+) and half)\b\s*/);
  if (mixed) {
    const base = NUMBER_WORDS[mixed[1] ?? mixed[2]];
    if (base) return { value: base + 0.5, length: mixed[0].length };
  }
  const phrase = s.match(/^(?:a |an )?(couple|few|dozen|half)(?: (?:a|an))?(?: of)?\b\s*/);
  if (phrase) return { value: NUMBER_WORDS[phrase[1]], length: phrase[0].length };
  const word = s.match(/^([a-z]+)\b\s*/);
  if (word && NUMBER_WORDS[word[1]] !== undefined) return { value: NUMBER_WORDS[word[1]], length: word[0].length };
  return null;
}

function toAdd(c: Clause, inventory: InventoryItem[], today: string): Draft {
  const quantity = c.quantity === 'all' || c.quantity === null ? 1 : c.quantity;
  const known = bestMatch(c.name, inventory, c.unit);
  if (known && known.score >= 0.85) {
    return { kind: 'add', name: known.item.name, quantity, unit: c.unit ?? known.item.unit, category: known.item.category, frozenOn: today };
  }
  const category = guessCategory(c.name);
  const unit = c.unit ?? (['meat', 'poultry', 'seafood'].includes(category) ? 'pack' : 'item');
  return { kind: 'add', name: capitalize(c.name), quantity, unit, category, frozenOn: today };
}

function toRemove(c: Clause, inventory: InventoryItem[]): Draft {
  const quantity = typeof c.quantity === 'number' ? c.quantity : 1;
  const ranked = rank(c.name, inventory.filter((i) => total(i) > 0), c.unit).filter((r) => r.score >= 0.45);
  const lotFor = (item: InventoryItem) =>
    c.when ? item.lots.find((l) => Number(l.frozenOn.slice(5, 7)) === c.when!.month && (!c.when!.day || Number(l.frozenOn.slice(8, 10)) === c.when!.day)) ?? null : null;
  const fits = c.when ? ranked.filter((r) => lotFor(r.item)) : ranked;
  const best = (fits.length ? fits : ranked)[0];
  if (!best) return { kind: 'remove', heard: c.name, itemId: null, lotId: null, quantity, choices: [] };

  const close = (fits.length ? fits : ranked).filter((r) => r.score >= best.score - 0.05);
  const lot = lotFor(best.item);
  const have = lot ? lot.quantity : total(best.item);
  return {
    kind: 'remove',
    heard: c.name,
    itemId: best.item.id,
    lotId: lot?.id ?? null,
    quantity: c.quantity === 'all' ? have : Math.min(quantity, have),
    choices: close.length > 1 ? close.slice(0, 4).map((r) => r.item.id) : [],
  };
}

function bestMatch(name: string, items: InventoryItem[], unit: Unit | null) {
  return rank(name, items, unit)[0] ?? null;
}

function rank(name: string, items: InventoryItem[], unit: Unit | null) {
  return items
    .map((item) => ({ item, score: similarity(name, item.name) + (unit && item.unit === unit ? 0.02 : 0) }))
    .sort((a, b) => b.score - a.score);
}

export function similarity(a: string, b: string): number {
  const qa = words(a);
  const qb = words(b);
  if (qa.length === 0 || qb.length === 0) return 0;
  if (qa.join(' ') === qb.join(' ')) return 1;
  const setB = new Set(qb);
  const contained = qa.every((w) => setB.has(w)) ? 0.6 + 0.35 * (qa.length / qb.length) : 0;
  return Math.max(contained, dice(qa.join(' '), qb.join(' ')));
}

function words(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((w) => w && !['the', 'of', 'a', 'an', 'some'].includes(w))
    .map(singular);
}

function singular(w: string): string {
  if (w.length <= 3 || w.endsWith('ss')) return w;
  if (w === 'loaves') return 'loaf';
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (/(?:ches|shes|xes|oes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function dice(a: string, b: string): number {
  const grams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) ?? 0) + 1);
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  let overlap = 0;
  for (const [g, n] of ga) overlap += Math.min(n, gb.get(g) ?? 0);
  const total = a.length - 1 + (b.length - 1);
  return total > 0 ? (2 * overlap) / total : 0;
}

export function guessCategory(name: string): Category {
  const n = ' ' + words(name).join(' ') + ' ';
  for (const [category, keys] of CATEGORY_KEYWORDS) {
    if (keys.some((k) => n.includes(' ' + k + ' '))) return category;
  }
  return 'other';
}

function matchPrefix(s: string, phrases: string[]): string | null {
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  return sorted.find((p) => s === p || s.startsWith(p + ' ')) ?? null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9.,;&' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
