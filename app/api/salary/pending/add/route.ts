import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import SalaryEntry from "@/lib/models/SalaryEntry";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/salary/pending/add
 * Manually add a pending salary (e.g. legacy amount already owed).
 * Body: { name, section?, salary, date }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").trim();
    const section = (body.section ?? "").trim();
    const salary = Math.max(0, Number(body.salary) || 0);
    const date = body.date ?? "";

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (salary <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0." },
        { status: 400 }
      );
    }
    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "A valid date (YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const entry = await SalaryEntry.create({
      staff: null,
      date,
      name,
      section,
      salary,
      present: true,
      pending: true,
      isPartTime: false,
      manual: true,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
