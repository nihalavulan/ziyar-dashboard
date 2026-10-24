import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import StockItem from "@/lib/models/StockItem";
import StockCount from "@/lib/models/StockCount";
import { groupByItem, openingFor, usageByDay } from "@/lib/stock";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/stock/usage?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Per item over the range: opening, received, used (qty + value), closing stock.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
      return NextResponse.json(
        { error: "Valid ?from=YYYY-MM-DD&to=YYYY-MM-DD are required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const items = await StockItem.find().sort({ order: 1, name: 1 }).lean();
    const docs = await StockCount.find({ date: { $lte: to } }).lean();
    const byItem = groupByItem(docs);

    const rows = items.map((it: any) => {
      const id = String(it._id);
      const entries = byItem.get(id) ?? [];
      const rate = it.rate ?? 0;
      let received = 0;
      let used = 0;
      let usedValue = 0;
      usageByDay(entries).forEach((d) => {
        if (d.date < from || d.date > to) return;
        received += d.received;
        used += d.used;
        usedValue += d.used * (d.rate || rate);
      });
      const closing = openingFor(entries, shiftDay(to, 1));
      return {
        itemId: id,
        name: it.name,
        category: it.category || "Other",
        unit: it.unit || "",
        rate,
        opening: openingFor(entries, from),
        received,
        used,
        usedValue,
        closing,
        closingValue: closing * rate,
      };
    });

    return NextResponse.json({ from, to, rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

const shiftDay = (s: string, days: number) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};
