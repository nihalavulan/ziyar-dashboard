import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Supplier from "@/lib/models/Supplier";

export const dynamic = "force-dynamic";

// List all suppliers (alphabetical).
export async function GET() {
  try {
    await connectToDatabase();
    const suppliers = await Supplier.find()
      .sort({ order: 1, name: 1 })
      .lean();
    return NextResponse.json({ suppliers });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

// Create a supplier.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").trim();
    const openingBalance = Number(body.openingBalance) || 0;

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    await connectToDatabase();
    // Append to the end of the list.
    const last = await Supplier.findOne().sort({ order: -1 }).lean();
    const order = last ? (last as any).order + 1 : 0;
    const supplier = await Supplier.create({ name, openingBalance, order });
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
