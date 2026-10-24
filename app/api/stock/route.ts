import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import StockItem from "@/lib/models/StockItem";
import StockCount from "@/lib/models/StockCount";
import { groupByItem, openingFor } from "@/lib/stock";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/stock?date=YYYY-MM-DD
 * One row per item: opening (computed from history), today's received/count,
 * and the rate (that day's snapshot, else the item's current rate).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? "";
    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "A valid ?date=YYYY-MM-DD is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const items = await StockItem.find().sort({ order: 1, name: 1 }).lean();
    const docs = await StockCount.find({ date: { $lte: date } }).lean();
    const byItem = groupByItem(docs);

    const rows = items.map((it: any) => {
      const id = String(it._id);
      const entries = byItem.get(id) ?? [];
      const today = entries.find((e) => e.date === date);
      return {
        itemId: id,
        name: it.name,
        category: it.category || "Other",
        unit: it.unit || "",
        opening: openingFor(entries, date),
        received: today ? today.received : 0,
        count: today ? today.count : null,
        rate: today && today.rate ? today.rate : it.rate ?? 0,
      };
    });

    return NextResponse.json({ date, rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/stock
 * Body: { date, rows:[{itemId, name, category, unit, received, count|null, rate}] }
 * Saves the day's figures and any item edits (name/category/unit/current rate).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const date = body.date ?? "";
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "A valid date (YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const items = await StockItem.find().lean();
    const existingIds = new Set(items.map((i: any) => String(i._id)));
    const valid = rows.filter((r: any) => existingIds.has(String(r.itemId)));

    const itemOps = valid.map((r: any) => {
      const set: Record<string, unknown> = { rate: Math.max(0, Number(r.rate) || 0) };
      if ((r.name ?? "").trim()) set.name = r.name.trim();
      if ((r.category ?? "").trim()) set.category = r.category.trim();
      if ((r.unit ?? "").trim()) set.unit = r.unit.trim();
      return { updateOne: { filter: { _id: r.itemId }, update: { $set: set } } };
    });
    if (itemOps.length > 0) await StockItem.bulkWrite(itemOps);

    const ops: any[] = [];
    const clear: string[] = [];
    valid.forEach((r: any) => {
      const received = Math.max(0, Number(r.received) || 0);
      const count =
        r.count === null || r.count === undefined || r.count === ""
          ? null
          : Math.max(0, Number(r.count) || 0);
      // Nothing recorded that day → drop the entry so history stays clean.
      if (received === 0 && count === null) {
        clear.push(r.itemId);
        return;
      }
      ops.push({
        updateOne: {
          filter: { stockItem: r.itemId, date },
          update: {
            $set: {
              stockItem: r.itemId,
              date,
              received,
              count,
              rate: Math.max(0, Number(r.rate) || 0),
            },
          },
          upsert: true,
        },
      });
    });
    if (ops.length > 0) await StockCount.bulkWrite(ops);
    if (clear.length > 0) await StockCount.deleteMany({ date, stockItem: { $in: clear } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
