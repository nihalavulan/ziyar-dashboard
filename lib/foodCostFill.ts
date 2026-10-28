import WnFoodCost from "./models/WnFoodCost";

/** Today's date (YYYY-MM-DD) in India, where the restaurant is. */
export function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function nextDay(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

const plainSections = (doc: any) =>
  (doc?.sections ?? []).map((s: any) => ({
    key: s.key,
    label: s.label ?? "",
    rows: (s.rows ?? []).map((r: any) => ({
      name: r.name,
      qty: r.qty ?? 0,
      unit: r.unit ?? "kg",
      rate: r.rate ?? 0,
    })),
  }));

/**
 * Make sure every day from the first saved sheet up to `until` (default: today
 * in India) has a sheet. A missing day gets a copy of the day before it,
 * marked auto. Existing days are never touched.
 */
export async function fillFoodCostDays(until: string = todayIST()) {
  const docs: any[] = await WnFoodCost.find({ date: { $lte: until } })
    .sort({ date: 1 })
    .lean();
  if (!docs.length) return 0;

  const byDate = new Map(docs.map((d) => [d.date, d]));
  let prev = docs[0];
  let created = 0;
  for (let day = nextDay(docs[0].date); day <= until; day = nextDay(day)) {
    const existing = byDate.get(day);
    if (existing) {
      prev = existing;
      continue;
    }
    const copiedFrom = prev.auto ? prev.copiedFrom || prev.date : prev.date;
    const sections = plainSections(prev);
    // $setOnInsert so two requests at once never overwrite each other.
    await WnFoodCost.updateOne(
      { date: day },
      { $setOnInsert: { date: day, sections, auto: true, copiedFrom } },
      { upsert: true }
    );
    prev = { date: day, sections, auto: true, copiedFrom };
    created++;
  }
  return created;
}

/**
 * After a day is saved by hand, push its sheet forward to the following days
 * that were only auto-copied, stopping at the next day saved by hand.
 */
export async function pushForward(date: string) {
  const saved: any = await WnFoodCost.findOne({ date }).lean();
  const sections = plainSections(saved);
  const later: any[] = await WnFoodCost.find({ date: { $gt: date } })
    .sort({ date: 1 })
    .select("date auto")
    .lean();
  let expected = nextDay(date);
  let updated = 0;
  for (const d of later) {
    if (d.date !== expected || !d.auto) break; // a gap or a hand-saved day
    await WnFoodCost.updateOne({ date: d.date }, { $set: { sections, copiedFrom: date } });
    expected = nextDay(d.date);
    updated++;
  }
  return updated;
}
