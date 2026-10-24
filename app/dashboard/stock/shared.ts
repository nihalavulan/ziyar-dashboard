export const STOCK_TABS = [
  { label: "Daily count", href: "/dashboard/stock" },
  { label: "Usage report", href: "/dashboard/stock/usage" },
];

export const UNITS = ["kg", "g", "L", "ml", "pcs", "dozen", "packet", "box", "bag", "bottle", "tin", "tray", "bundle", "cylinder"];
export const CATEGORIES = ["Vegetables", "Meat & Fish", "Dairy", "Grocery", "Spices", "Oil", "Beverages", "Packaging", "Cleaning", "Gas", "Other"];

export function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
export function shiftDate(s: string, days: number) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}
export function prettyDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
export function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
export const num = (v: string) => Math.max(0, Number(v) || 0);

/** Group rows by category (alphabetical), keeping each item's entry order. */
export function groupRows<T extends { category: string }>(rows: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  rows.forEach((r) => {
    if (!map.has(r.category)) map.set(r.category, []);
    map.get(r.category)!.push(r);
  });
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}
