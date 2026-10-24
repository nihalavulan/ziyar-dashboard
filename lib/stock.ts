/**
 * Stock is tracked by physical count. For any day:
 *   opening = last count before the day + anything received since that count
 *   used    = opening + received today − count today   (only on counted days)
 * Everything is floored at 0 (no negative numbers).
 */
export interface CountEntry {
  date: string;
  received: number;
  count: number | null;
  rate: number;
}

/** Opening stock for `date`, from one item's entries sorted by date ascending. */
export function openingFor(entries: CountEntry[], date: string) {
  let opening = 0;
  for (const e of entries) {
    if (e.date >= date) break;
    opening = e.count !== null && e.count !== undefined ? e.count : opening + (e.received ?? 0);
  }
  return Math.max(0, opening);
}

/** Quantity used on each counted day, from one item's entries sorted by date ascending. */
export function usageByDay(entries: CountEntry[]) {
  const out: { date: string; used: number; received: number; rate: number }[] = [];
  let stock = 0;
  for (const e of entries) {
    const available = stock + (e.received ?? 0);
    if (e.count !== null && e.count !== undefined) {
      out.push({ date: e.date, used: Math.max(0, available - e.count), received: e.received ?? 0, rate: e.rate ?? 0 });
      stock = e.count;
    } else {
      out.push({ date: e.date, used: 0, received: e.received ?? 0, rate: e.rate ?? 0 });
      stock = available;
    }
  }
  return out;
}

/** Group entry docs by item id, each list sorted by date ascending. */
export function groupByItem(docs: any[]) {
  const map = new Map<string, CountEntry[]>();
  const sorted = docs.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  sorted.forEach((d) => {
    const id = String(d.stockItem);
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push({ date: d.date, received: d.received ?? 0, count: d.count ?? null, rate: d.rate ?? 0 });
  });
  return map;
}
