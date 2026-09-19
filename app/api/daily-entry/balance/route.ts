import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Supplier from "@/lib/models/Supplier";
import DailyEntry from "@/lib/models/DailyEntry";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/daily-entry/balance
 * Body: { date: 'YYYY-MM-DD', balances: [{ supplierId, balance }] }
 *
 * Sets a supplier's BALANCE as of `date` to the given value by adjusting its
 * opening balance. Because balance = openingBalance + net(prior days), we set
 *   openingBalance = balance - priorNet
 * so the shown balance on `date` becomes exactly the typed value and carries
 * forward. When there are no earlier entries (typical first-time setup) this is
 * simply openingBalance = balance.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const date = body.date ?? "";
    const balances = Array.isArray(body.balances) ? body.balances : [];

    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "A valid date (YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const ids = balances.map((b: any) => b.supplierId);

    // Net (purchase - paid) of all days before `date`, per supplier.
    const priorEntries = await DailyEntry.find({
      supplier: { $in: ids },
      date: { $lt: date },
    }).lean();

    const priorNet = new Map<string, number>();
    for (const e of priorEntries) {
      const sid = String(e.supplier);
      priorNet.set(
        sid,
        (priorNet.get(sid) ?? 0) + (e.purchase ?? 0) - (e.paid ?? 0)
      );
    }

    const ops = balances.map((b: any) => {
      const target = Number(b.balance) || 0;
      const openingBalance = target - (priorNet.get(String(b.supplierId)) ?? 0);
      return {
        updateOne: {
          filter: { _id: b.supplierId },
          update: { $set: { openingBalance } },
        },
      };
    });

    if (ops.length > 0) await Supplier.bulkWrite(ops);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
