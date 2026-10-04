import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import FixedExpense from "@/lib/models/FixedExpense";

export const dynamic = "force-dynamic";
const PERIODS = ["day", "month", "year"];

export async function GET() {
  try {
    await connectToDatabase();
    const expenses = await FixedExpense.find().sort({ order: 1, name: 1 }).lean();
    return NextResponse.json({ expenses });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Add one expense.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").trim();
    const amount = Math.max(0, Number(body.amount) || 0);
    const period = PERIODS.includes(body.period) ? body.period : "month";
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    await connectToDatabase();
    const last = await FixedExpense.findOne().sort({ order: -1 }).lean();
    const order = last ? (last as any).order + 1 : 0;
    const expense = await FixedExpense.create({ name, amount, period, order });
    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Bulk update (save all edited rows).
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const expenses = Array.isArray(body.expenses) ? body.expenses : [];
    await connectToDatabase();
    const ops = expenses
      .filter((e: any) => e.id)
      .map((e: any) => ({
        updateOne: {
          filter: { _id: e.id },
          update: {
            $set: {
              name: (e.name ?? "").trim(),
              amount: Math.max(0, Number(e.amount) || 0),
              period: PERIODS.includes(e.period) ? e.period : "month",
            },
          },
        },
      }));
    if (ops.length > 0) await FixedExpense.bulkWrite(ops);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
