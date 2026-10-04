import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import FoodItem from "@/lib/models/FoodItem";
import FoodEntry from "@/lib/models/FoodEntry";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    await FoodEntry.deleteMany({ foodItem: params.id });
    await FoodItem.findByIdAndDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
