import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import StockItem from "@/lib/models/StockItem";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").trim();
    const category = (body.category ?? "").trim() || "Other";
    const unit = (body.unit ?? "").trim() || "kg";
    const rate = Math.max(0, Number(body.rate) || 0);
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    await connectToDatabase();
    const last = await StockItem.findOne().sort({ order: -1 }).lean();
    const order = last ? (last as any).order + 1 : 0;
    const item = await StockItem.create({ name, category, unit, rate, order });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
