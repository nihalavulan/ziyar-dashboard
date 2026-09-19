import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Supplier from "@/lib/models/Supplier";
import DailyEntry from "@/lib/models/DailyEntry";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/**
 * GET /api/overview?date=YYYY-MM-DD
 * Business analytics computed from suppliers + daily entries.
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
    const month = date.slice(0, 7); // YYYY-MM

    await connectToDatabase();

    const suppliers = await Supplier.find().sort({ order: 1, name: 1 }).lean();
    // Only entries up to and including today count toward "current" figures.
    const entries = await DailyEntry.find({ date: { $lte: date } }).lean();

    // Net (purchase - paid) per supplier -> current balance.
    const netPerSupplier = new Map<string, number>();
    let allPurchase = 0;
    let allPaid = 0;
    let monthPurchase = 0;
    let monthPaid = 0;
    let todayPurchase = 0;
    let todayPaid = 0;

    // Last 7 days series (oldest -> newest).
    const last7Dates: string[] = [];
    for (let i = 6; i >= 0; i--) last7Dates.push(shiftDate(date, -i));
    const last7 = last7Dates.map((d) => ({ date: d, purchase: 0, paid: 0 }));
    const last7Index = new Map(last7.map((r, i) => [r.date, i]));

    for (const e of entries) {
      const sid = String(e.supplier);
      const p = e.purchase ?? 0;
      const pd = e.paid ?? 0;
      netPerSupplier.set(sid, (netPerSupplier.get(sid) ?? 0) + p - pd);
      allPurchase += p;
      allPaid += pd;
      if (e.date.startsWith(month)) {
        monthPurchase += p;
        monthPaid += pd;
      }
      if (e.date === date) {
        todayPurchase += p;
        todayPaid += pd;
      }
      const idx = last7Index.get(e.date);
      if (idx !== undefined) {
        last7[idx].purchase += p;
        last7[idx].paid += pd;
      }
    }

    let totalOpening = 0;
    const supplierBalances = suppliers.map((s: any) => {
      const bal = Math.max(
        0,
        (s.openingBalance ?? 0) + (netPerSupplier.get(String(s._id)) ?? 0)
      );
      totalOpening += s.openingBalance ?? 0;
      return { name: s.name, balance: bal };
    });

    const totalPending = supplierBalances.reduce((a, b) => a + b.balance, 0);
    const activeSuppliers = supplierBalances.filter((s) => s.balance > 0).length;

    const topSuppliers = [...supplierBalances]
      .filter((s) => s.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);

    // Overall settlement rate: paid vs everything owed (opening + purchases).
    const totalObligations = totalOpening + allPurchase;
    const paymentRatio =
      totalObligations > 0 ? allPaid / totalObligations : 0;
    // This month's coverage: paid vs purchased this month.
    const monthCoverage =
      monthPurchase > 0 ? monthPaid / monthPurchase : null;

    return NextResponse.json({
      date,
      totalPending,
      supplierCount: suppliers.length,
      activeSuppliers,
      allPurchase,
      allPaid,
      monthPurchase,
      monthPaid,
      todayPurchase,
      todayPaid,
      paymentRatio,
      monthCoverage,
      topSuppliers,
      last7,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
