/**
 * Alfahm costing: marinade recipes that last several days ("rate card") turned
 * into a cost per bird for each variant, and daily costs from what sold.
 * Shared by the API routes and the /wn/dashboard/food-cost/new page.
 */

export const VARIANTS = [
  { key: "normal", label: "Normal" },
  { key: "honey", label: "Honey chilli" },
  { key: "peri", label: "Peri peri" },
  { key: "green", label: "Green chilli" },
  { key: "pepper", label: "Pepper" },
] as const;

export type VariantKey = (typeof VARIANTS)[number]["key"];
export const VARIANT_KEYS: VariantKey[] = VARIANTS.map((v) => v.key);
export const variantLabel = (k: string) => VARIANTS.find((v) => v.key === k)?.label ?? k;

// ---------------------------------------------------------------------------
// Rate card
// ---------------------------------------------------------------------------

export interface RecipeRow {
  name: string;
  qty: number;
  unit: string;
  rate: number | null; // null = rate missing
  lastsDays: number | null; // null = use the recipe's defaultDays
}

export interface Recipe {
  id: string;
  name: string;
  defaultDays: number;
  variants: VariantKey[];
  rows: RecipeRow[];
}

export interface CardSettings {
  avgBirdsPerDay: number;
  birdWeightKg: number;
  chickenRatePerKg: number; // used for the rate-card result table
  shares: Record<VariantKey, number>; // % of alfahm birds, should total 100
}

export interface RateCard {
  settings: CardSettings;
  recipes: Recipe[];
  updatedAt?: string | null;
}

export const DEFAULT_SETTINGS: CardSettings = {
  avgBirdsPerDay: 37, // Petpooja 7 Aug–6 Nov: 3,399 birds / 92 days
  birdWeightKg: 1.1,
  chickenRatePerKg: 0,
  shares: { normal: 51.2, honey: 26.8, peri: 16.6, green: 3.0, pepper: 2.4 },
};

const r = (name: string, qty: number, unit: string, rate: number | null, lastsDays: number | null = null): RecipeRow => ({
  name,
  qty,
  unit,
  rate,
  lastsDays,
});

export const SEED_RECIPES: Recipe[] = [
  {
    id: "base",
    name: "Alfahm base",
    defaultDays: 7,
    variants: [...VARIANT_KEYS],
    rows: [
      r("garlic", 3, "kg", 200),
      r("ginger", 3, "kg", 78),
      r("green chilly", 1, "kg", 60),
      r("pothina", 0.5, "kg", 78),
      r("chapp", 0.5, "kg", 120),
      r("kashmiri chilly", 3, "kg", 827),
      r("chilly powder", 1, "kg", 298.93),
      r("coriander powder", 2.5, "kg", 261.32),
      r("chicken masala", 2.5, "kg", 477),
      r("garam masala", 2.5, "kg", 924),
      r("cumin powder", 2.5, "kg", 472),
      r("pepper powder", 1, "kg", 1000),
      r("vinegar", 5, "L", 15),
      r("salt", 4, "packet", 10),
      r("aju", 2, "kg", 185),
      r("clr", 2, "pcs", 65),
      r("curd", 20, "packet", 29),
      r("sunflower oil", 4, "L", 171),
      r("charcoal", 2, "sack", 700),
    ],
  },
  {
    id: "peri-normal",
    name: "Peri-peri and normal",
    defaultDays: 7,
    variants: ["normal", "peri"],
    rows: [
      r("curd", 7, "packet", 29, 1),
      r("kashmiri chilly powder", 1, "kg", 827, 7),
      r("chilly powder", 0.5, "kg", 298.93, 14),
      r("chilli flakes", 1.5, "kg", 432.41, 7),
      r("sunflower oil", 1, "packet", 171, 7),
    ],
  },
  {
    id: "honey",
    name: "Honey alfahm",
    defaultDays: 4,
    variants: ["honey"],
    rows: [
      r("honey", 4, "bottle", 260),
      r("green chilly sauce", 3, "L", 75.71),
      r("tomato sauce", 3, "L", 53),
      r("ginger powder", 0.5, "kg", 570),
      r("garlic powder", 0.5, "kg", 220),
      r("kashmiri chilly", 1, "kg", 827),
      r("vinegar", 1, "L", 15),
      r("salt", 1, "kg", 10),
      r("aju", 0.5, "kg", 185),
      r("seasoning seeds", 0.5, "kg", 260),
    ],
  },
  {
    id: "green-pepper",
    name: "Green chilly and pepper",
    defaultDays: 7,
    variants: ["green", "pepper"],
    rows: [
      r("chapp", 0.3, "kg", 120),
      r("pothina", 0.3, "kg", 78),
      r("ginger", 0.5, "kg", 78),
      r("garlic", 0.5, "kg", 200),
      r("green chilly", 1, "kg", 60),
      r("kanthari", 1, "kg", null),
      r("green clr", 1, "packet", 65),
      r("salt", 0.3, "kg", 10),
      r("aju", 0.2, "kg", 185),
      r("vinegar", 1, "L", 15),
      r("chicken masala", 0.25, "kg", 477),
      r("cumin powder", 0.25, "kg", 472),
      r("garam masala", 0.25, "kg", 924),
      r("sunflower oil", 1, "L", 171),
    ],
  },
];

export const seedCard = (): RateCard => ({
  settings: { ...DEFAULT_SETTINGS, shares: { ...DEFAULT_SETTINGS.shares } },
  recipes: JSON.parse(JSON.stringify(SEED_RECIPES)),
});

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export const rowTotal = (row: RecipeRow) => num(row.qty) * num(row.rate);
export const rowDays = (row: RecipeRow, recipe: Recipe) =>
  row.lastsDays && row.lastsDays > 0 ? row.lastsDays : num(recipe.defaultDays);
export const rowPerDay = (row: RecipeRow, recipe: Recipe) => {
  const d = rowDays(row, recipe);
  return d > 0 ? rowTotal(row) / d : 0;
};
export const rateMissing = (row: RecipeRow) => row.rate === null || !(row.rate > 0);

export const recipeBatchTotal = (recipe: Recipe) => recipe.rows.reduce((s, x) => s + rowTotal(x), 0);
export const recipePerDay = (recipe: Recipe) => recipe.rows.reduce((s, x) => s + rowPerDay(x, recipe), 0);

/** Share (0–1) of alfahm birds a recipe serves. */
export const recipeShare = (recipe: Recipe, s: CardSettings) =>
  recipe.variants.reduce((t, v) => t + num(s.shares[v]), 0) / 100;

export const birdsServed = (recipe: Recipe, s: CardSettings) => num(s.avgBirdsPerDay) * recipeShare(recipe, s);

export const marinadePerBird = (recipe: Recipe, s: CardSettings) => {
  const b = birdsServed(recipe, s);
  return b > 0 ? recipePerDay(recipe) / b : 0;
};

/** A recipe that serves every variant (e.g. Alfahm base) counts as "base"; the rest are flavours. */
export const isBaseRecipe = (recipe: Recipe) => VARIANT_KEYS.every((v) => recipe.variants.includes(v));

export const sharesTotal = (s: CardSettings) => VARIANT_KEYS.reduce((t, v) => t + num(s.shares[v]), 0);

export interface PerBirdRates {
  base: Record<VariantKey, number>;
  flavour: Record<VariantKey, number>;
}

/** Marinade cost per bird for each variant, split into base and flavour. */
export function perBirdRates(card: RateCard): PerBirdRates {
  const base = {} as Record<VariantKey, number>;
  const flavour = {} as Record<VariantKey, number>;
  VARIANT_KEYS.forEach((v) => {
    base[v] = 0;
    flavour[v] = 0;
  });
  card.recipes.forEach((rec) => {
    const mpb = marinadePerBird(rec, card.settings);
    const target = isBaseRecipe(rec) ? base : flavour;
    rec.variants.forEach((v) => {
      if (v in target) target[v] += mpb;
    });
  });
  return { base, flavour };
}

export const chickenPerBird = (weightKg: number, ratePerKg: number) => num(weightKg) * num(ratePerKg);

/** Expected daily alfahm cost from the rate card alone (average day). */
export const cardDailyCost = (card: RateCard) =>
  card.recipes.reduce((t, rec) => t + recipePerDay(rec), 0) +
  num(card.settings.avgBirdsPerDay) * chickenPerBird(card.settings.birdWeightKg, card.settings.chickenRatePerKg);

// ---------------------------------------------------------------------------
// Daily entry
// ---------------------------------------------------------------------------

export interface PortionQty {
  q: number; // quarter
  h: number; // half
  tq: number; // three-quarter
  f: number; // full
}

/** Rates frozen onto a saved day so later recipe edits don't change it. */
export interface DaySnapshot {
  takenAt: string; // ISO time the rates were taken
  birdWeightKg: number;
  base: Record<VariantKey, number>;
  flavour: Record<VariantKey, number>;
}

export interface AlfahmDay {
  date: string; // YYYY-MM-DD
  chickenRatePerKg: number;
  sales: number | null;
  qty: Record<VariantKey, PortionQty>;
  snapshot: DaySnapshot;
}

export const emptyQty = (): Record<VariantKey, PortionQty> =>
  Object.fromEntries(VARIANT_KEYS.map((v) => [v, { q: 0, h: 0, tq: 0, f: 0 }])) as Record<VariantKey, PortionQty>;

export const snapshotFrom = (card: RateCard): DaySnapshot => ({
  takenAt: new Date().toISOString(),
  birdWeightKg: num(card.settings.birdWeightKg),
  ...perBirdRates(card),
});

export const birdsFromQty = (p: PortionQty) => (num(p.q) + 2 * num(p.h) + 3 * num(p.tq) + 4 * num(p.f)) / 4;

export interface DayVariantResult {
  key: VariantKey;
  birds: number;
  chicken: number;
  base: number;
  flavour: number;
  total: number;
  perBird: number;
}

export interface DayResult {
  rows: DayVariantResult[];
  birds: number;
  chicken: number;
  base: number;
  flavour: number;
  total: number;
  perBird: number;
  foodCostPct: number | null;
}

export function calcDay(day: Pick<AlfahmDay, "chickenRatePerKg" | "sales" | "qty" | "snapshot">): DayResult {
  const cpb = chickenPerBird(day.snapshot.birdWeightKg, day.chickenRatePerKg);
  const rows = VARIANT_KEYS.map((key) => {
    const birds = birdsFromQty(day.qty[key] ?? { q: 0, h: 0, tq: 0, f: 0 });
    const chicken = birds * cpb;
    const base = birds * num(day.snapshot.base[key]);
    const flavour = birds * num(day.snapshot.flavour[key]);
    const total = chicken + base + flavour;
    return { key, birds, chicken, base, flavour, total, perBird: birds > 0 ? total / birds : 0 };
  });
  const sum = (f: (x: DayVariantResult) => number) => rows.reduce((t, x) => t + f(x), 0);
  const birds = sum((x) => x.birds);
  const total = sum((x) => x.total);
  const sales = day.sales && day.sales > 0 ? day.sales : null;
  return {
    rows,
    birds,
    chicken: sum((x) => x.chicken),
    base: sum((x) => x.base),
    flavour: sum((x) => x.flavour),
    total,
    perBird: birds > 0 ? total / birds : 0,
    foodCostPct: sales ? (total / sales) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Cleaning input from the page
// ---------------------------------------------------------------------------

const pos = (v: unknown) => Math.max(0, Number(v) || 0);
const posOrNull = (v: unknown) => (v === null || v === "" || v === undefined ? null : Number(v) > 0 ? Number(v) : null);

export function cleanCard(body: any): RateCard {
  const s = body?.settings ?? {};
  const shares = {} as Record<VariantKey, number>;
  VARIANT_KEYS.forEach((v) => (shares[v] = pos(s.shares?.[v])));
  const recipes: Recipe[] = (Array.isArray(body?.recipes) ? body.recipes : []).map((rec: any, i: number) => ({
    id: typeof rec?.id === "string" && rec.id ? rec.id.slice(0, 40) : `recipe-${Date.now()}-${i}`,
    name: typeof rec?.name === "string" && rec.name.trim() ? rec.name.trim().slice(0, 80) : "Untitled recipe",
    defaultDays: pos(rec?.defaultDays) || 1,
    variants: (Array.isArray(rec?.variants) ? rec.variants : []).filter((v: any) => VARIANT_KEYS.includes(v)),
    rows: (Array.isArray(rec?.rows) ? rec.rows : [])
      .filter((row: any) => typeof row?.name === "string" && row.name.trim())
      .map((row: any) => ({
        name: row.name.trim().slice(0, 80),
        qty: pos(row.qty),
        unit: typeof row.unit === "string" && row.unit.trim() ? row.unit.trim().slice(0, 20) : "kg",
        rate: posOrNull(row.rate),
        lastsDays: posOrNull(row.lastsDays),
      })),
  }));
  return {
    settings: {
      avgBirdsPerDay: pos(s.avgBirdsPerDay),
      birdWeightKg: pos(s.birdWeightKg),
      chickenRatePerKg: pos(s.chickenRatePerKg),
      shares,
    },
    recipes,
  };
}

export function cleanQty(input: any): Record<VariantKey, PortionQty> {
  const out = emptyQty();
  VARIANT_KEYS.forEach((v) => {
    const p = input?.[v] ?? {};
    out[v] = { q: pos(p.q), h: pos(p.h), tq: pos(p.tq), f: pos(p.f) };
  });
  return out;
}

export function cleanSnapshot(input: any): DaySnapshot | null {
  if (!input || typeof input !== "object") return null;
  const pick = (o: any) => Object.fromEntries(VARIANT_KEYS.map((v) => [v, pos(o?.[v])])) as Record<VariantKey, number>;
  return {
    takenAt: typeof input.takenAt === "string" ? input.takenAt : new Date().toISOString(),
    birdWeightKg: pos(input.birdWeightKg),
    base: pick(input.base),
    flavour: pick(input.flavour),
  };
}
