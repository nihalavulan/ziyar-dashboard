import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import FoodItem from "@/lib/models/FoodItem";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const items = await FoodItem.find().sort({ order: 1, name: 1 }).lean();
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").trim();
    const rate = Math.max(0, Number(body.rate) || 0);
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    await connectToDatabase();
    const last = await FoodItem.findOne().sort({ order: -1 }).lean();
    const order = last ? (last as any).order + 1 : 0;
    const item = await FoodItem.create({ name, rate, order });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
