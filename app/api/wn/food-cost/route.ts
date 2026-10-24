import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import WnFoodCost from "@/lib/models/WnFoodCost";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toSections(doc: any): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  (doc?.sections ?? []).forEach((s: any) => {
    out[s.key] = (s.rows ?? []).map((r: any) => ({
      name: r.name ?? "",
      qty: r.qty ?? 0,
      unit: r.unit ?? "kg",
      rate: r.rate ?? 0,
    }));
  });
  return out;
}

/**
 * GET /api/wn/food-cost?date=YYYY-MM-DD      → that day's sheet
 * GET /api/wn/food-cost?prevOf=YYYY-MM-DD    → latest saved sheet before that day
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? "";
    const prevOf = searchParams.get("prevOf") ?? "";

    await connectToDatabase();

    if (DATE_RE.test(prevOf)) {
      const doc: any = await WnFoodCost.findOne({ date: { $lt: prevOf } })
        .sort({ date: -1 })
        .lean();
      return NextResponse.json({
        date: doc?.date ?? null,
        sections: toSections(doc),
      });
    }

    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "A valid ?date=YYYY-MM-DD is required." },
        { status: 400 }
      );
    }
    const doc = await WnFoodCost.findOne({ date }).lean();
    return NextResponse.json({ date, saved: Boolean(doc), sections: toSections(doc) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/wn/food-cost
 * Body: { date, sections: { [key]: [{ name, qty, unit, rate }] } }
 * Replaces that day's sheet. Rows without a name are dropped.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const date = body.date ?? "";
    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "A valid date (YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    const input = body.sections && typeof body.sections === "object" ? body.sections : {};
    const sections = Object.entries(input).map(([key, rows]) => ({
      key,
      rows: (Array.isArray(rows) ? rows : [])
        .filter((r: any) => (r?.name ?? "").trim())
        .map((r: any) => ({
          name: String(r.name).trim(),
          qty: Math.max(0, Number(r.qty) || 0),
          unit: String(r.unit ?? "").trim() || "kg",
          rate: Math.max(0, Number(r.rate) || 0),
        })),
    }));

    await connectToDatabase();

    if (sections.every((s) => s.rows.length === 0)) {
      await WnFoodCost.deleteOne({ date });
    } else {
      await WnFoodCost.updateOne(
        { date },
        { $set: { date, sections } },
        { upsert: true }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
