import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Supplier from "@/lib/models/Supplier";
import DailyEntry from "@/lib/models/DailyEntry";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/daily-entry?date=YYYY-MM-DD
 * Returns one row per supplier for that day:
 *   balance  = openingBalance + net(purchase - paid) of ALL earlier days
 *   purchase = today's purchase (0 if none saved)
 *   paid     = today's paid (0 if none saved)
 *   total    = balance + purchase - paid   (carries to next day)
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

    const suppliers = await Supplier.find().sort({ order: 1, name: 1 }).lean();

    // All entries up to and including the requested date.
    const entries = await DailyEntry.find({ date: { $lte: date } }).lean();

    // Group per supplier: net of prior days, and today's entry.
    const priorNet = new Map<string, number>();
    const today = new Map<string, { purchase: number; paid: number }>();

    for (const e of entries) {
      const sid = String(e.supplier);
      if (e.date < date) {
        priorNet.set(
          sid,
          (priorNet.get(sid) ?? 0) + (e.purchase ?? 0) - (e.paid ?? 0)
        );
      } else if (e.date === date) {
        today.set(sid, { purchase: e.purchase ?? 0, paid: e.paid ?? 0 });
      }
    }

    const rows = suppliers.map((s: any) => {
      const sid = String(s._id);
      const balance = Math.max(0, (s.openingBalance ?? 0) + (priorNet.get(sid) ?? 0));
      const t = today.get(sid) ?? { purchase: 0, paid: 0 };
      const total = Math.max(0, balance + t.purchase - t.paid);
      return {
        supplierId: sid,
        name: s.name,
        balance,
        purchase: t.purchase,
        paid: t.paid,
        total,
      };
    });

    return NextResponse.json({ date, rows });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/daily-entry
 * Body: { date: 'YYYY-MM-DD', entries: [{ supplierId, purchase, paid }] }
 * Upserts each row. Rows with both purchase and paid = 0 are removed so the
 * ledger stays clean.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const date = body.date ?? "";
    const entries = Array.isArray(body.entries) ? body.entries : [];

    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "A valid date (YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const ops = entries.map((row: any) => {
      const purchase = Number(row.purchase) || 0;
      const paid = Number(row.paid) || 0;
      if (purchase === 0 && paid === 0) {
        return {
          deleteOne: {
            filter: { supplier: row.supplierId, date },
          },
        };
      }
      return {
        updateOne: {
          filter: { supplier: row.supplierId, date },
          update: { $set: { purchase, paid } },
          upsert: true,
        },
      };
    });

    if (ops.length > 0) {
      await DailyEntry.bulkWrite(ops);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
