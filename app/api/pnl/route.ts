import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import FoodItem from "@/lib/models/FoodItem";
import FoodEntry from "@/lib/models/FoodEntry";
import DailyPnl from "@/lib/models/DailyPnl";
import FixedExpense from "@/lib/models/FixedExpense";
import SalaryEntry from "@/lib/models/SalaryEntry";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FX_DIVISOR: Record<string, number> = { day: 1, month: 30, year: 360 };

/**
 * GET /api/pnl?date=YYYY-MM-DD
 * Food rows (cost) + the day's P&L: sales, food cost, staff food, fixed-expense
 * share, salary paid, and the resulting profit/loss.
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

    const items = await FoodItem.find().sort({ order: 1, name: 1 }).lean();
    const todayEntries = await FoodEntry.find({ date }).lean();
    const priorEntries = await FoodEntry.find({ date: { $lt: date } })
      .sort({ date: 1 })
      .lean();

    // Rate carries forward from the most recent prior day.
    const lastRate = new Map<string, number>();
    for (const e of priorEntries) lastRate.set(String(e.foodItem), e.rate ?? 0);

    const todayByItem = new Map<string, any>();
    for (const e of todayEntries) todayByItem.set(String(e.foodItem), e);

    let foodCost = 0;
    const foodRows = items.map((it: any) => {
      const id = String(it._id);
      const t = todayByItem.get(id);
      const prepared = t ? t.prepared : 0;
      const sold = t ? t.sold : 0;
      const damage = t ? t.damage : 0;
      const rate = t ? t.rate : lastRate.has(id) ? lastRate.get(id)! : it.rate;
      const total = sold * rate;
      foodCost += total;
      return {
        foodItemId: id,
        name: it.name,
        prepared,
        sold,
        damage,
        rate,
        balance: prepared - sold - damage,
        total,
      };
    });

    const pnl: any = (await DailyPnl.findOne({ date }).lean()) ?? {};
    const totalSales = pnl.totalSales ?? 0;
    const staffFood = pnl.staffFood ?? 0;

    // Fixed expenses -> per-day share.
    const fx = await FixedExpense.find().lean();
    const fixedDaily = fx.reduce(
      (a: number, e: any) => a + (e.amount ?? 0) / (FX_DIVISOR[e.period] ?? 30),
      0
    );

    // Salary actually paid that day (permanent + part-time, present only).
    const salEntries = await SalaryEntry.find({ date, present: true }).lean();
    const salaryPaid = salEntries.reduce((a: number, e: any) => a + (e.paid ?? 0), 0);

    const basicExpenses = staffFood + fixedDaily + salaryPaid;
    const profit = totalSales - foodCost - basicExpenses;

    return NextResponse.json({
      date,
      foodRows,
      totalSales,
      staffFood,
      foodCost,
      fixedDaily,
      salaryPaid,
      basicExpenses,
      profit,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/pnl
 * Body: { date, foodRows:[{foodItemId, prepared, sold, damage, rate}], totalSales, staffFood }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const date = body.date ?? "";
    const foodRows = Array.isArray(body.foodRows) ? body.foodRows : [];
    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "A valid date (YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const items = await FoodItem.find().lean();
    const existingIds = new Set(items.map((i: any) => String(i._id)));
    const valid = foodRows.filter((r: any) => existingIds.has(String(r.foodItemId)));

    // Persist any inline item-name edits to the FoodItem itself.
    const itemOps = valid
      .filter((r: any) => (r.name ?? "").trim())
      .map((r: any) => ({
        updateOne: {
          filter: { _id: r.foodItemId },
          update: { $set: { name: (r.name ?? "").trim() } },
        },
      }));
    if (itemOps.length > 0) await FoodItem.bulkWrite(itemOps);

    const ops = valid.map((r: any) => ({
      updateOne: {
        filter: { foodItem: r.foodItemId, date },
        update: {
          $set: {
            foodItem: r.foodItemId,
            date,
            name: (r.name ?? "").trim(),
            prepared: Math.max(0, Number(r.prepared) || 0),
            sold: Math.max(0, Number(r.sold) || 0),
            damage: Math.max(0, Number(r.damage) || 0),
            rate: Math.max(0, Number(r.rate) || 0),
          },
        },
        upsert: true,
      },
    }));
    if (ops.length > 0) await FoodEntry.bulkWrite(ops);

    await DailyPnl.updateOne(
      { date },
      {
        $set: {
          date,
          totalSales: Math.max(0, Number(body.totalSales) || 0),
          staffFood: Math.max(0, Number(body.staffFood) || 0),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
