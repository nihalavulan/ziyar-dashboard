import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import WnFoodCost from "@/lib/models/WnFoodCost";
import { fillFoodCostDays } from "@/lib/foodCostFill";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toSections(doc: any) {
  return (doc?.sections ?? []).map((s: any) => ({
    key: s.key,
    label: s.label ?? "",
    copiedFrom: s.copiedFrom ?? "",
    rows: (s.rows ?? []).map((r: any) => ({
      name: r.name ?? "",
      qty: r.qty ?? 0,
      unit: r.unit ?? "kg",
      rate: r.rate ?? 0,
    })),
  }));
}

/**
 * GET /api/wn/food-cost?date=YYYY-MM-DD      → that day's sheet
 *   (first carries every dish forward to all days up to today)
 * GET /api/wn/food-cost?prevOf=YYYY-MM-DD    → latest saved sheet before that day
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? "";
    const prevOf = searchParams.get("prevOf") ?? "";

    await connectToDatabase();
    await fillFoodCostDays();

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
    const doc: any = await WnFoodCost.findOne({ date }).lean();
    return NextResponse.json({
      date,
      saved: Boolean(doc),
      auto: Boolean(doc?.auto),
      sections: toSections(doc),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wn/food-cost
 * Body: { date, sections: [{ key, label, rows: [{ name, qty, unit, rate }] }] }
 * Replaces that day's sheet. Rows without a name, and dishes with no rows, are dropped.
 * Sections sent with copiedFrom are still copies (not edited); the rest count as
 * entered by hand. A section with cleared: true and no rows = that dish
 * deliberately cleared for the day. Afterwards every dish is carried forward
 * again so later days pick up the change.
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

    const input: any[] = Array.isArray(body.sections) ? body.sections : [];
    const sections = input
      .filter((s) => typeof s?.key === "string" && s.key)
      .map((s) => ({
        key: s.key as string,
        label: typeof s.label === "string" ? s.label.trim() : "",
        rows: (Array.isArray(s.rows) ? s.rows : [])
          .filter((r: any) => (r?.name ?? "").trim())
          .map((r: any) => ({
            name: String(r.name).trim(),
            qty: Math.max(0, Number(r.qty) || 0),
            unit: String(r.unit ?? "").trim() || "kg",
            rate: Math.max(0, Number(r.rate) || 0),
          })),
        copiedFrom: typeof s.copiedFrom === "string" ? s.copiedFrom : "",
        cleared: s.cleared === true,
      }))
      // Keep a dish with no rows only when it was cleared by hand.
      .filter((s) => s.rows.length > 0 || (s.cleared && !s.copiedFrom))
      .map(({ cleared, ...s }) => s);

    await connectToDatabase();

    // Kept even when empty, so the day isn't recreated as a copy.
    await WnFoodCost.updateOne(
      { date },
      { $set: { date, sections, auto: false, copiedFrom: "" } },
      { upsert: true }
    );
    await fillFoodCostDays();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
