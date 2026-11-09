import WnAlfahmCard from "./models/WnAlfahmCard";
import { RateCard, cleanCard, cleanQty, cleanSnapshot, seedCard, AlfahmDay } from "./alfahm";

/** The saved rate card, or the seed data when nothing has been saved yet. */
export async function loadCard(): Promise<RateCard> {
  const doc: any = await WnAlfahmCard.findOne({ key: "main" }).lean();
  if (!doc) return { ...seedCard(), updatedAt: null };
  return { ...cleanCard(doc), updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null };
}

export function serializeDay(doc: any): AlfahmDay {
  return {
    date: doc.date,
    chickenRatePerKg: doc.chickenRatePerKg ?? 0,
    sales: typeof doc.sales === "number" && doc.sales > 0 ? doc.sales : null,
    qty: cleanQty(doc.qty),
    snapshot: cleanSnapshot(doc.snapshot)!,
  };
}
