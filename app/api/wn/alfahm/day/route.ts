import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import WnAlfahmDay from "@/lib/models/WnAlfahmDay";
import { cleanQty, snapshotFrom } from "@/lib/alfahm";
import { loadCard, serializeDay } from "@/lib/alfahmStore";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/wn/alfahm/day?date=YYYY-MM-DD
 * → { day (null if not saved), prevRate (last saved day's chicken rate before this date) }
 */
export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date") ?? "";
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: "A valid ?date=YYYY-MM-DD is required." }, { status: 400 });
    }
    await connectToDatabase();
    const [doc, prev]: any[] = await Promise.all([
      WnAlfahmDay.findOne({ date }).lean(),
      WnAlfahmDay.findOne({ date: { $lt: date }, chickenRatePerKg: { $gt: 0 } })
        .sort({ date: -1 })
        .select("date chickenRatePerKg")
        .lean(),
    ]);
    return NextResponse.json({
      day: doc ? serializeDay(doc) : null,
      prevRate: prev ? { date: prev.date, rate: prev.chickenRatePerKg } : null,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/wn/alfahm/day
 * Body: { date, chickenRatePerKg, sales, qty, recalc? }
 * A new day takes its per-bird rates from the current rate card. An existing day
 * keeps the rates it was saved with, unless recalc is true.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const date = typeof body?.date === "string" ? body.date : "";
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: "A valid date (YYYY-MM-DD) is required." }, { status: 400 });
    }
    await connectToDatabase();
    const existing: any = await WnAlfahmDay.findOne({ date }).lean();
    const keepSnapshot = existing?.snapshot?.takenAt && body?.recalc !== true;
    const snapshot = keepSnapshot ? existing.snapshot : snapshotFrom(await loadCard());
    const sales = Number(body?.sales) > 0 ? Number(body.sales) : null;

    const doc = await WnAlfahmDay.findOneAndUpdate(
      { date },
      {
        $set: {
          date,
          chickenRatePerKg: Math.max(0, Number(body?.chickenRatePerKg) || 0),
          sales,
          qty: cleanQty(body?.qty),
          snapshot,
        },
      },
      { upsert: true, new: true }
    ).lean();
    return NextResponse.json({ day: serializeDay(doc) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** DELETE /api/wn/alfahm/day?date=YYYY-MM-DD — removes that day's entry. */
export async function DELETE(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date") ?? "";
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: "A valid ?date=YYYY-MM-DD is required." }, { status: 400 });
    }
    await connectToDatabase();
    await WnAlfahmDay.deleteOne({ date });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
