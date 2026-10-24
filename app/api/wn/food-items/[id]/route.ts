import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import WnFoodItem from "@/lib/models/WnFoodItem";

export const dynamic = "force-dynamic";

/** PUT /api/wn/food-items/:id  Body: { name } — rename a dish. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    await connectToDatabase();
    const doc: any = await WnFoodItem.findByIdAndUpdate(params.id, { $set: { name } }, { new: true }).lean();
    if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item: { id: String(doc._id), name: doc.name } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/wn/food-items/:id — removes the dish from the list.
 * Past days that already have rows for it keep them (shown under the saved name).
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await connectToDatabase();
    await WnFoodItem.findByIdAndDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
