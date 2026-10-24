import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import WnFoodItem from "@/lib/models/WnFoodItem";

export const dynamic = "force-dynamic";

const serialize = (d: any) => ({ id: String(d._id), name: d.name });

/** GET /api/wn/food-items → all dishes, in display order. */
export async function GET() {
  try {
    await connectToDatabase();
    const docs = await WnFoodItem.find().sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ items: docs.map(serialize) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST /api/wn/food-items  Body: { name } */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    await connectToDatabase();
    const last: any = await WnFoodItem.findOne().sort({ order: -1 }).lean();
    const doc = await WnFoodItem.create({ name, order: (last?.order ?? 0) + 1 });
    return NextResponse.json({ item: serialize(doc) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
