import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import SalaryEntry from "@/lib/models/SalaryEntry";

export const dynamic = "force-dynamic";

/**
 * GET /api/salary/pending
 * Pending = unpaid salary = (salary - paid) for present days where paid < salary.
 * Grouped by person, newest entry first. Optional ?name= to filter.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    await connectToDatabase();

    const filter: Record<string, unknown> = {
      present: true,
      $expr: { $gt: ["$salary", "$paid"] },
    };
    if (name) filter.name = name;

    const entries = await SalaryEntry.find(filter).sort({ date: -1 }).lean();

    const groups = new Map<
      string,
      { name: string; section: string; total: number; count: number; entries: any[] }
    >();
    let grandTotal = 0;

    for (const e of entries) {
      const due = Math.max(0, (e.salary ?? 0) - (e.paid ?? 0));
      if (due <= 0) continue;
      grandTotal += due;
      const key = e.name || "(unnamed)";
      if (!groups.has(key)) {
        groups.set(key, {
          name: e.name,
          section: e.section,
          total: 0,
          count: 0,
          entries: [],
        });
      }
      const g = groups.get(key)!;
      g.total += due;
      g.count += 1;
      g.entries.push({
        id: String(e._id),
        date: e.date,
        salary: e.salary ?? 0,
        paid: e.paid ?? 0,
        due,
        isPartTime: e.isPartTime,
        manual: e.manual,
      });
    }

    const people = Array.from(groups.values()).sort((a, b) => b.total - a.total);
    return NextResponse.json({ grandTotal, people });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/salary/pending
 * Settle (pay the rest): set paid = salary. Body: { ids: [...] } or { name: "..." }.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    await connectToDatabase();

    let filter: Record<string, unknown> | null = null;
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      filter = { _id: { $in: body.ids } };
    } else if (typeof body.name === "string" && body.name) {
      filter = { name: body.name, present: true };
    }

    if (!filter) {
      return NextResponse.json(
        { error: "Provide ids[] or name to settle." },
        { status: 400 }
      );
    }

    // Set paid = salary so the shortfall becomes zero.
    const res = await SalaryEntry.updateMany(filter, [
      { $set: { paid: "$salary" } },
    ]);
    return NextResponse.json({ ok: true, settled: res.modifiedCount });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
