import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Supplier from "@/lib/models/Supplier";
import DailyEntry from "@/lib/models/DailyEntry";
import DailyPnl from "@/lib/models/DailyPnl";
import FoodEntry from "@/lib/models/FoodEntry";
import SalaryEntry from "@/lib/models/SalaryEntry";
import FixedExpense from "@/lib/models/FixedExpense";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FX_DIVISOR: Record<string, number> = { day: 1, month: 30, year: 360 };
const COMMISSION = 0.25;

function shiftDate(s: string, days: number) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}
function netSales(p: any) {
  if (!p) return 0;
  return (
    (p.directSales || 0) +
    (p.swiggySales || 0) * (1 - COMMISSION) +
    (p.zomatoSales || 0) * (1 - COMMISSION)
  );
}

/**
 * GET /api/overview?date=YYYY-MM-DD
 * A business snapshot: today's P&L, month-to-date, money owed, 7-day trend.
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
    const month = date.slice(0, 7);
    const start = shiftDate(date, -30); // window covering month-to-date + last 7
    const days7: string[] = [];
    for (let i = 6; i >= 0; i--) days7.push(shiftDate(date, -i));

    await connectToDatabase();

    // Fixed expenses -> per-day share.
    const fx = await FixedExpense.find().lean();
    const fixedDaily = fx.reduce(
      (a: number, e: any) => a + (e.amount ?? 0) / (FX_DIVISOR[e.period] ?? 30),
      0
    );

    // Supplier analytics (outstanding, purchases vs paid, trend).
    const suppliers = await Supplier.find().sort({ order: 1, name: 1 }).lean();
    const supEntries = await DailyEntry.find({ date: { $lte: date } }).lean();
    const supNet = new Map<string, number>();
    let allPurchase = 0, allPaid = 0, monthPurchase = 0, monthPaid = 0, todayPurchase = 0, todayPaid = 0, totalOpening = 0;
    const sup7 = days7.map((d) => ({ date: d, purchase: 0, paid: 0 }));
    const sup7Index = new Map(sup7.map((r, i) => [r.date, i]));
    for (const e of supEntries as any[]) {
      const sid = String(e.supplier);
      const p = e.purchase ?? 0;
      const pd = e.paid ?? 0;
      supNet.set(sid, (supNet.get(sid) ?? 0) + p - pd);
      allPurchase += p;
      allPaid += pd;
      if (e.date.startsWith(month)) { monthPurchase += p; monthPaid += pd; }
      if (e.date === date) { todayPurchase += p; todayPaid += pd; }
      const idx = sup7Index.get(e.date);
      if (idx !== undefined) { sup7[idx].purchase += p; sup7[idx].paid += pd; }
    }
    const supplierBalances = (suppliers as any[]).map((s) => {
      totalOpening += s.openingBalance ?? 0;
      return { name: s.name, balance: Math.max(0, (s.openingBalance ?? 0) + (supNet.get(String(s._id)) ?? 0)) };
    });
    const supplierPending = supplierBalances.reduce((a, b) => a + b.balance, 0);
    const activeSuppliers = supplierBalances.filter((s) => s.balance > 0).length;
    const topSuppliers = [...supplierBalances]
      .filter((s) => s.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
    const obligations = totalOpening + allPurchase;
    const paymentRatio = obligations > 0 ? allPaid / obligations : 0;
    const monthCoverage = monthPurchase > 0 ? monthPaid / monthPurchase : null;

    // Salary pending (all-time shortfall).
    const pend = await SalaryEntry.find({
      present: true,
      $expr: { $gt: ["$salary", "$paid"] },
    }).lean();
    const salaryPending = pend.reduce(
      (a: number, e: any) => a + Math.max(0, (e.salary ?? 0) - (e.paid ?? 0)),
      0
    );

    // Windowed data (last ~31 days) for today / month / 7-day.
    const pnls = await DailyPnl.find({ date: { $gte: start, $lte: date } }).lean();
    const foods = await FoodEntry.find({ date: { $gte: start, $lte: date } }).lean();
    const sals = await SalaryEntry.find({ date: { $gte: start, $lte: date }, present: true }).lean();

    const pnlByDate = new Map<string, any>(pnls.map((p: any) => [p.date, p]));
    const foodCostByDate = new Map<string, number>();
    for (const f of foods as any[])
      foodCostByDate.set(f.date, (foodCostByDate.get(f.date) ?? 0) + (f.prepared ?? 0) * (f.rate ?? 0));
    const salaryByDate = new Map<string, number>();
    for (const e of sals as any[])
      salaryByDate.set(e.date, (salaryByDate.get(e.date) ?? 0) + (e.paid ?? 0));

    // A day only counts (and incurs its fixed-cost share) if it has activity.
    const dayFigures = (d: string) => {
      const p = pnlByDate.get(d);
      const sales = netSales(p);
      const foodCost = foodCostByDate.get(d) ?? 0;
      const staffFood = p?.staffFood ?? 0;
      const salaryPaid = salaryByDate.get(d) ?? 0;
      const active = sales > 0 || foodCost > 0 || staffFood > 0 || salaryPaid > 0;
      const fixed = active ? fixedDaily : 0;
      const profit = active ? sales - foodCost - staffFood - salaryPaid - fixed : 0;
      return { date: d, sales, foodCost, staffFood, salaryPaid, fixed, profit, active };
    };

    const today = dayFigures(date);

    // Month-to-date totals over active (recorded) days only.
    const monthDates = new Set<string>();
    for (const k of Array.from(pnlByDate.keys())) if (k.startsWith(month)) monthDates.add(k);
    for (const k of Array.from(foodCostByDate.keys())) if (k.startsWith(month)) monthDates.add(k);
    for (const k of Array.from(salaryByDate.keys())) if (k.startsWith(month)) monthDates.add(k);

    let monthSales = 0, monthFoodCost = 0, monthStaffFood = 0, monthSalaryPaid = 0, monthDays = 0;
    for (const dd of Array.from(monthDates)) {
      const f = dayFigures(dd);
      if (!f.active) continue;
      monthDays++;
      monthSales += f.sales;
      monthFoodCost += f.foodCost;
      monthStaffFood += f.staffFood;
      monthSalaryPaid += f.salaryPaid;
    }
    const monthFixed = fixedDaily * monthDays;
    const monthProfit = monthSales - monthFoodCost - monthStaffFood - monthSalaryPaid - monthFixed;

    // Last 7 days profit series (oldest -> newest).
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const f = dayFigures(shiftDate(date, -i));
      last7.push({ date: f.date, sales: f.sales, profit: f.profit, active: f.active });
    }

    return NextResponse.json({
      date,
      fixedDaily,
      supplierPending,
      salaryPending,
      supplierCount: suppliers.length,
      // supplier analytics
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
      supplier7: sup7,
      today,
      month: {
        sales: monthSales,
        foodCost: monthFoodCost,
        staffFood: monthStaffFood,
        salaryPaid: monthSalaryPaid,
        fixed: monthFixed,
        profit: monthProfit,
        days: monthDays,
      },
      last7,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
