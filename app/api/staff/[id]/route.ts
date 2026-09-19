import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Staff from "@/lib/models/Staff";
import SalaryEntry from "@/lib/models/SalaryEntry";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const update: Record<string, unknown> = {};
    if (typeof body.name === "string") update.name = body.name.trim();
    if (typeof body.section === "string") update.section = body.section.trim();
    if (body.salary !== undefined) update.salary = Math.max(0, Number(body.salary) || 0);

    await connectToDatabase();
    const staff = await Staff.findByIdAndUpdate(params.id, update, {
      new: true,
    }).lean();
    if (!staff) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ staff });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Delete a staff member and all of their salary entries.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    await SalaryEntry.deleteMany({ staff: params.id });
    await Staff.findByIdAndDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
