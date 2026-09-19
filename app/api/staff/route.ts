import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Staff from "@/lib/models/Staff";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const staff = await Staff.find().sort({ order: 1, name: 1 }).lean();
    return NextResponse.json({ staff });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").trim();
    const section = (body.section ?? "").trim();
    const salary = Math.max(0, Number(body.salary) || 0);

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    await connectToDatabase();
    const last = await Staff.findOne().sort({ order: -1 }).lean();
    const order = last ? (last as any).order + 1 : 0;
    const member = await Staff.create({ name, section, salary, order });
    return NextResponse.json({ staff: member }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
