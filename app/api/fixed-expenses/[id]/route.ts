import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import FixedExpense from "@/lib/models/FixedExpense";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    await FixedExpense.findByIdAndDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
