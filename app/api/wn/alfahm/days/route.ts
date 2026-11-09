import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import WnAlfahmDay from "@/lib/models/WnAlfahmDay";
import { calcDay } from "@/lib/alfahm";
import { serializeDay } from "@/lib/alfahmStore";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const summary = (doc: any) => {
  const day = serializeDay(doc);
  const res = calcDay(day);
  return {
    date: day.date,
    birds: res.birds,
    total: res.total,
    sales: day.sales,
    foodCostPct: res.foodCostPct,
    perBird: res.perBird,
  };
};

/**
 * GET /api/wn/alfahm/days?from=YYYY-MM-DD&to=YYYY-MM-DD → saved days in range (oldest first)
 * GET /api/wn/alfahm/days?last=30                       → the last N saved days
 */
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    await connectToDatabase();

    const last = Number(sp.get("last"));
    if (last > 0) {
      const docs: any[] = await WnAlfahmDay.find().sort({ date: -1 }).limit(Math.min(last, 366)).lean();
      return NextResponse.json({ days: docs.reverse().map(summary) });
    }

    const from = sp.get("from") ?? "";
    const to = sp.get("to") ?? "";
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json({ error: "Valid from/to dates or ?last=N are required." }, { status: 400 });
    }
    const docs: any[] = await WnAlfahmDay.find({ date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean();
    return NextResponse.json({ days: docs.map(summary) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
