import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Supplier from "@/lib/models/Supplier";
import DailyEntry from "@/lib/models/DailyEntry";

export const dynamic = "force-dynamic";

// Update a supplier (name / opening balance).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const update: Record<string, unknown> = {};
    if (typeof body.name === "string") update.name = body.name.trim();
    if (body.openingBalance !== undefined)
      update.openingBalance = Number(body.openingBalance) || 0;

    await connectToDatabase();
    const supplier = await Supplier.findByIdAndUpdate(params.id, update, {
      new: true,
    }).lean();
    if (!supplier)
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ supplier });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

// Delete a supplier and all of its daily entries.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    await DailyEntry.deleteMany({ supplier: params.id });
    await Supplier.findByIdAndDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
