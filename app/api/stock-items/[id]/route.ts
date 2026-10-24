import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import StockItem from "@/lib/models/StockItem";
import StockCount from "@/lib/models/StockCount";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    await StockCount.deleteMany({ stockItem: params.id });
    await StockItem.findByIdAndDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
