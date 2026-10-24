import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import WnSop from "@/lib/models/WnSop";
import { cleanSop, serializeSop } from "@/lib/wnSop";

export const dynamic = "force-dynamic";

/** PUT /api/wn/sop/:id → replace a member's SOP. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const input = cleanSop(await request.json());
    if (!input.name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    await connectToDatabase();
    const doc = await WnSop.findByIdAndUpdate(params.id, { $set: input }, { new: true }).lean();
    if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ member: serializeSop(doc) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** DELETE /api/wn/sop/:id */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await connectToDatabase();
    await WnSop.findByIdAndDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
