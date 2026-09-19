import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Supplier from "@/lib/models/Supplier";
import DailyEntry from "@/lib/models/DailyEntry";

export const dynamic = "force-dynamic";

/**
 * GET /api/suppliers/:id/statement
 * Returns the supplier's transaction history with a running balance.
 * Each row: date, balance (at start of day), purchase, paid, total (running).
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const supplier: any = await Supplier.findById(params.id).lean();
    if (!supplier) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const entries = await DailyEntry.find({ supplier: params.id })
      .sort({ date: 1 })
      .lean();

    let running = supplier.openingBalance ?? 0;
    const rows = entries.map((e: any) => {
      const balance = Math.max(0, running);
      running = Math.max(0, running + (e.purchase ?? 0) - (e.paid ?? 0));
      return {
        date: e.date,
        balance,
        purchase: e.purchase ?? 0,
        paid: e.paid ?? 0,
        total: running,
      };
    });

    return NextResponse.json({
      supplier: supplier.name,
      openingBalance: supplier.openingBalance ?? 0,
      currentBalance: Math.max(0, running),
      rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
