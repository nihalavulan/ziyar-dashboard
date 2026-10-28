import WnFoodCost from "./models/WnFoodCost";
import WnFoodItem from "./models/WnFoodItem";

/** Today's date (YYYY-MM-DD) in India, where the restaurant is. */
export function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function nextDay(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

type Row = { name: string; qty: number; unit: string; rate: number };
type Section = { key: string; label: string; rows: Row[]; copiedFrom: string };

const plainRows = (rows: any[]): Row[] =>
  (rows ?? []).map((r: any) => ({
    name: r.name,
    qty: r.qty ?? 0,
    unit: r.unit ?? "kg",
    rate: r.rate ?? 0,
  }));

const plainSection = (s: any): Section => ({
  key: s.key,
  label: s.label ?? "",
  rows: plainRows(s.rows),
  copiedFrom: s.copiedFrom ?? "",
});

/**
 * Carry every dish forward, day by day, from the first saved sheet up to
 * `until` (default: today in India).
 *
 * - A dish entered by hand on a day is kept exactly as it is.
 * - Any other dish on the list gets its most recent hand-entered rows (and
 *   the date they came from). Editing an earlier day therefore updates the
 *   copied dishes on all later days.
 * - A dish deliberately cleared by hand stays empty until entered again.
 * - Missing days are created (marked auto).
 *
 * Only writes days whose content actually changes. Returns how many changed.
 */
export async function fillFoodCostDays(until: string = todayIST()) {
  const [docs, dishes]: any[] = await Promise.all([
    WnFoodCost.find({ date: { $lte: until } }).sort({ date: 1 }).lean(),
    WnFoodItem.find().sort({ order: 1, createdAt: 1 }).lean(),
  ]);
  if (!docs.length) return 0;

  const dishKeys: string[] = dishes.map((d: any) => String(d._id));
  const dishName = new Map<string, string>(dishes.map((d: any) => [String(d._id), String(d.name)]));
  const byDate = new Map<string, any>(docs.map((d: any) => [d.date, d]));

  // Latest hand-entered rows per dish (null = deliberately cleared).
  const latest = new Map<string, { label: string; rows: Row[]; from: string } | null>();
  let changed = 0;

  for (let day = docs[0].date; day <= until; day = nextDay(day)) {
    const doc = byDate.get(day);
    // Dishes entered by hand this day. A day created automatically has none
    // (older auto days may not have per-dish markers, so check the day flag too).
    const own: Section[] = doc?.auto
      ? []
      : (doc?.sections ?? []).map(plainSection).filter((s: Section) => !s.copiedFrom);

    // Hand-entered dishes this day become the latest for each dish.
    own.forEach((s) => {
      latest.set(s.key, s.rows.length ? { label: s.label, rows: s.rows, from: day } : null);
    });

    const ownKeys = new Set(own.map((s) => s.key));
    const copied: Section[] = dishKeys
      .filter((k) => !ownKeys.has(k))
      .map((k) => ({ k, src: latest.get(k) }))
      .filter((x) => x.src && x.src.rows.length)
      .map(({ k, src }) => ({
        key: k,
        label: dishName.get(k) || src!.label,
        rows: src!.rows,
        copiedFrom: src!.from,
      }));

    const sections = [...own, ...copied];
    const before = JSON.stringify((doc?.sections ?? []).map(plainSection));
    if (doc && JSON.stringify(sections) === before) continue;

    if (doc) {
      await WnFoodCost.updateOne({ _id: doc._id }, { $set: { sections } });
    } else {
      if (!sections.length) continue;
      // $setOnInsert so two requests at once never overwrite each other.
      await WnFoodCost.updateOne(
        { date: day },
        { $setOnInsert: { date: day, sections, auto: true, copiedFrom: "" } },
        { upsert: true }
      );
    }
    changed++;
  }
  return changed;
}
