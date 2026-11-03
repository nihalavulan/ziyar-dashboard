import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import WnMasala from "@/lib/models/WnMasala";
import { cleanMasalaBody, serializeMasala } from "@/lib/masala";

export const dynamic = "force-dynamic";

/** PUT /api/wn/masalas/:id  Body: { name, rows, yieldQty, yieldUnit } — replaces the recipe. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const data = cleanMasalaBody(await request.json());
    if (!data.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    await connectToDatabase();
    const doc = await WnMasala.findByIdAndUpdate(params.id, { $set: data }, { new: true }).lean();
    if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ masala: serializeMasala(doc) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** DELETE /api/wn/masalas/:id — days that already used it keep their figures. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await connectToDatabase();
    await WnMasala.findByIdAndDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
