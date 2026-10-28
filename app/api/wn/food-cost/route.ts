import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import WnFoodCost from "@/lib/models/WnFoodCost";
import { fillFoodCostDays, pushForward } from "@/lib/foodCostFill";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toSections(doc: any) {
  return (doc?.sections ?? []).map((s: any) => ({
    key: s.key,
    label: s.label ?? "",
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
 *   (first fills any missing days up to today with a copy of the day before)
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
      copiedFrom: doc?.auto ? doc.copiedFrom || null : null,
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
 * The day counts as saved by hand, and its sheet is pushed forward to the
 * following auto-copied days.
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
      }))
      .filter((s) => s.rows.length > 0);

    await connectToDatabase();

    // An emptied day is kept (not deleted) so auto-fill doesn't bring it back.
    await WnFoodCost.updateOne(
      { date },
      { $set: { date, sections, auto: false, copiedFrom: "" } },
      { upsert: true }
    );
    const pushed = await pushForward(date);
    return NextResponse.json({ ok: true, pushed });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
